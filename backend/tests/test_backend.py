"""Unit tests for ImobiSmart AI backend (schemas, presigner security, RAG service, handler)."""

from __future__ import annotations

import json
import sys
import unittest
from pathlib import Path
from unittest.mock import MagicMock

# Ensure backend/ is on sys.path for `from src...` imports
BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from src.config import Settings
from src.handlers.chat import lambda_handler
from src.schemas.chat import ChatRequest, FeedbackRequest, ValidationError
from src.services.bedrock_rag import BedrockRagService
from src.services.s3_presigner import S3Presigner
from src.services.session_store import SessionStore


def _make_settings() -> Settings:
    return Settings(
        aws_region="us-east-1",
        knowledge_base_id="TESTKB1234",
        model_arn="arn:aws:bedrock:us-east-1:111122223333:inference-profile/us.amazon.nova-pro-v1:0",
        rerank_model_arn="arn:aws:bedrock:us-east-1::foundation-model/cohere.rerank-v3-5:0",
        guardrail_id="guard1234",
        guardrail_version="DRAFT",
        docs_bucket_name="imobismart-kb-docs-111122223333",
        docs_prefix="documents/",
        sessions_table_name="imobismart-sessions",
        presigned_url_expires_seconds=600,
        allowed_origins=("https://imobismart.vercel.app",),
        log_level="INFO",
    )


class TestSchemas(unittest.TestCase):
    def test_valid_chat_request(self) -> None:
        req = ChatRequest.from_dict(
            {
                "prompt": "Qual o preco do Parque das Palmeiras Tipo 2Q?",
                "persona": "comprador",
                "empreendimento": "parque-das-palmeiras",
                "dominios": ["empreendimentos", "credito"],
            }
        )
        self.assertEqual(req.persona, "comprador")
        self.assertEqual(req.empreendimento, "parque-das-palmeiras")
        self.assertEqual(req.dominios, ("empreendimentos", "credito"))

    def test_rejects_oversized_prompt(self) -> None:
        with self.assertRaises(ValidationError):
            ChatRequest.from_dict({"prompt": "a" * 1001})

    def test_rejects_invalid_dominio(self) -> None:
        with self.assertRaises(ValidationError):
            ChatRequest.from_dict({"prompt": "Pergunta valida", "dominios": ["invalido"]})

    def test_feedback_validation(self) -> None:
        fb = FeedbackRequest.from_dict(
            {"session_id": "sess-1234", "message_id": "msg-5678", "rating": "up"}
        )
        self.assertEqual(fb.rating, "up")
        with self.assertRaises(ValidationError):
            FeedbackRequest.from_dict(
                {"session_id": "sess-1234", "message_id": "msg-5678", "rating": "maybe"}
            )


class TestS3PresignerSecurity(unittest.TestCase):
    def test_presigns_valid_document_only(self) -> None:
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://signed.example/doc.pdf"
        presigner = S3Presigner(
            bucket_name="imobismart-kb-docs-111122223333",
            allowed_prefix="documents/",
            s3_client=mock_s3,
        )
        url, key = presigner.presign_document_uri(
            "s3://imobismart-kb-docs-111122223333/documents/manual-credito-financiamento-imobi-fin-003.pdf"
        )
        self.assertEqual(url, "https://signed.example/doc.pdf")
        self.assertEqual(key, "documents/manual-credito-financiamento-imobi-fin-003.pdf")

    def test_blocks_wrong_bucket_prefix_and_traversal(self) -> None:
        mock_s3 = MagicMock()
        presigner = S3Presigner(
            bucket_name="imobismart-kb-docs-111122223333",
            allowed_prefix="documents/",
            s3_client=mock_s3,
        )
        for bad_uri in [
            "s3://other-bucket/documents/file.pdf",
            "s3://imobismart-kb-docs-111122223333/artifacts/lambda.zip",
            "s3://imobismart-kb-docs-111122223333/documents/../secrets.txt",
        ]:
            url, key = presigner.presign_document_uri(bad_uri)
            self.assertIsNone(url)
            self.assertIsNone(key)
        mock_s3.generate_presigned_url.assert_not_called()


class TestRagAndHandler(unittest.TestCase):
    def test_metadata_filter_builder(self) -> None:
        self.assertIsNone(BedrockRagService.build_metadata_filter(()))
        self.assertIsNone(
            BedrockRagService.build_metadata_filter(("empreendimentos", "condominio", "credito"))
        )
        self.assertEqual(
            BedrockRagService.build_metadata_filter(("credito",)),
            {"equals": {"key": "dominio_kb", "value": "credito"}},
        )
        self.assertEqual(
            BedrockRagService.build_metadata_filter(("empreendimentos", "credito")),
            {"in": {"key": "dominio_kb", "value": ["empreendimentos", "credito"]}},
        )

    def test_health_endpoint_zero_bedrock_calls(self) -> None:
        settings = _make_settings()
        resp = lambda_handler(
            {"httpMethod": "GET", "path": "/v1/health", "headers": {"Origin": "https://evil.com"}},
            settings=settings,
        )
        self.assertEqual(resp["statusCode"], 200)
        self.assertNotIn("Access-Control-Allow-Origin", resp["headers"])
        body = json.loads(resp["body"])
        self.assertEqual(body["status"], "ok")

    def test_chat_endpoint_with_presigned_citations_and_strict_cors(self) -> None:
        settings = _make_settings()
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.presigned/imobi-fin-003.pdf"
        presigner = S3Presigner(
            bucket_name=settings.docs_bucket_name,
            allowed_prefix=settings.docs_prefix,
            s3_client=mock_s3,
        )

        mock_bedrock = MagicMock()
        mock_bedrock.retrieve_and_generate.return_value = {
            "sessionId": "bedrock-sess-999",
            "guardrailAction": "NONE",
            "output": {"text": "O Parque das Palmeiras aceita FGTS no SFH."},
            "citations": [
                {
                    "generatedResponsePart": {
                        "textResponsePart": {"span": {"start": 0, "end": 41}}
                    },
                    "retrievedReferences": [
                        {
                            "content": {"text": "O Parque das Palmeiras enquadra-se em SBPE/SFH."},
                            "location": {
                                "s3Location": {
                                    "uri": "s3://imobismart-kb-docs-111122223333/documents/manual-credito-financiamento-imobi-fin-003.pdf"
                                }
                            },
                            "metadata": {
                                "codigo_doc": "IMOBI-FIN-003",
                                "titulo": "Manual Tecnico de Credito",
                                "dominio_kb": "credito",
                                "versao": "4.0",
                                "vigencia": "2026-11-01",
                                "x-amz-bedrock-kb-document-page-number": 1.0,
                            },
                        }
                    ],
                }
            ],
        }
        rag = BedrockRagService(settings=settings, presigner=presigner, bedrock_client=mock_bedrock)
        mock_table = MagicMock()
        store = SessionStore(table_name="imobismart-sessions", table_resource=mock_table)

        event = {
            "httpMethod": "POST",
            "path": "/v1/chat",
            "headers": {"Origin": "https://imobismart.vercel.app"},
            "body": json.dumps(
                {
                    "prompt": "O Parque das Palmeiras aceita FGTS?",
                    "persona": "corretor",
                    "dominios": ["credito"],
                }
            ),
        }
        resp = lambda_handler(event, settings=settings, rag_service=rag, session_store=store)
        self.assertEqual(resp["statusCode"], 200)
        self.assertEqual(
            resp["headers"]["Access-Control-Allow-Origin"], "https://imobismart.vercel.app"
        )
        body = json.loads(resp["body"])
        self.assertIn("[1]", body["answer"])
        self.assertEqual(body["session_id"], "bedrock-sess-999")
        self.assertEqual(len(body["citations"]), 1)
        self.assertEqual(
            body["citations"][0]["presigned_url"], "https://s3.presigned/imobi-fin-003.pdf"
        )
        self.assertEqual(body["citations"][0]["pagina"], 2)
        self.assertEqual(
            body["citations"][0]["arquivo"], "manual-credito-financiamento-imobi-fin-003.pdf"
        )
        self.assertEqual(
            body["citations"][0]["titulo"],
            "Manual Técnico de Crédito Imobiliário e Financiamento Habitacional",
        )
        mock_table.put_item.assert_called_once()

    def test_extracts_distinct_pages_from_same_pdf_and_caches_presign(self) -> None:
        settings = _make_settings()
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.presigned/imobi-emp-001.pdf"
        presigner = S3Presigner(
            bucket_name=settings.docs_bucket_name,
            allowed_prefix=settings.docs_prefix,
            s3_client=mock_s3,
        )
        rag = BedrockRagService(settings=settings, presigner=presigner, bedrock_client=MagicMock())
        pdf_uri = "s3://imobismart-kb-docs-111122223333/documents/catalogo-tecnico-empreendimentos-imobi-emp-001.pdf"
        answer = "Linha 1 da página 1.\nLinha 2 da página 4.\nLinha 3 novamente da página 1."
        raw_citations = [
            {
                "generatedResponsePart": {
                    "textResponsePart": {"text": "Linha 1 da página 1."}
                },
                "retrievedReferences": [
                    {
                        "content": {"text": "Resumo p1"},
                        "location": {"s3Location": {"uri": pdf_uri}},
                        "metadata": {
                            "codigo_doc": "IMOBI-EMP-001",
                            "x-amz-bedrock-kb-document-page-number": 0.0,
                        },
                    }
                ],
            },
            {
                "generatedResponsePart": {
                    "textResponsePart": {"text": "Linha 2 da página 4."}
                },
                "retrievedReferences": [
                    {
                        "content": {"text": "Detalhes p4"},
                        "location": {"s3Location": {"uri": pdf_uri}},
                        "metadata": {
                            "codigo_doc": "IMOBI-EMP-001",
                            "x-amz-bedrock-kb-document-page-number": 3.0,
                        },
                    }
                ],
            },
            {
                "generatedResponsePart": {
                    "textResponsePart": {"text": "Linha 3 novamente da página 1."}
                },
                "retrievedReferences": [
                    {
                        "content": {"text": "Resumo p1 duplicado"},
                        "location": {"s3Location": {"uri": pdf_uri}},
                        "metadata": {
                            "codigo_doc": "IMOBI-EMP-001",
                            "x-amz-bedrock-kb-document-page-number": 0.0,
                        },
                    }
                ],
            },
        ]
        marked, citations = rag._extract_citations(answer, raw_citations)
        self.assertEqual(len(citations), 2)
        self.assertEqual(citations[0]["pagina"], 1)
        self.assertEqual(citations[1]["pagina"], 4)
        self.assertEqual(
            citations[0]["arquivo"], "catalogo-tecnico-empreendimentos-imobi-emp-001.pdf"
        )
        self.assertIn("página 1. [1]", marked)
        self.assertIn("página 4. [2]", marked)
        # Same PDF URI should be presigned only once
        mock_s3.generate_presigned_url.assert_called_once()
        # 0-based Bedrock metadata maps 0.0 -> 1, 2.0 -> 3; negative/invalid yields None
        self.assertEqual(
            BedrockRagService._parse_page_number({"x-amz-bedrock-kb-document-page-number": 0.0}),
            1,
        )
        self.assertEqual(
            BedrockRagService._parse_page_number({"x-amz-bedrock-kb-document-page-number": 2.0}),
            3,
        )
        self.assertIsNone(BedrockRagService._parse_page_number({}))
        self.assertIsNone(
            BedrockRagService._parse_page_number({"x-amz-bedrock-kb-document-page-number": -1.0})
        )
        self.assertIsNone(
            BedrockRagService._parse_page_number(
                {"x-amz-bedrock-kb-document-page-number": True}
            )
        )
        self.assertIsNone(
            BedrockRagService._parse_page_number(
                {"x-amz-bedrock-kb-document-page-number": "invalid"}
            )
        )

    def test_citation_marker_never_splits_accented_words(self) -> None:
        settings = _make_settings()
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.presigned/doc.pdf"
        presigner = S3Presigner(
            bucket_name=settings.docs_bucket_name,
            allowed_prefix=settings.docs_prefix,
            s3_client=mock_s3,
        )
        rag = BedrockRagService(settings=settings, presigner=presigner, bedrock_client=MagicMock())
        answer = "A locação por diárias é proibida.\n\nResumo:\n- Smart Studio permite Airbnb."
        raw_citations = [
            {
                "generatedResponsePart": {
                    "textResponsePart": {
                        "text": "A locação por diárias é proibida.",
                        "span": {"start": 0, "end": 35},
                    }
                },
                "retrievedReferences": [
                    {
                        "content": {"text": "Airbnb proibido"},
                        "location": {
                            "s3Location": {
                                "uri": "s3://imobismart-kb-docs-111122223333/documents/convencao-condominio-regimento-imobi-cond-002.pdf"
                            }
                        },
                        "metadata": {"codigo_doc": "IMOBI-COND-002", "dominio_kb": "condominio"},
                    }
                ],
            }
        ]
        marked, _ = rag._extract_citations(answer, raw_citations)
        self.assertIn("Resumo:", marked)
        self.assertNotIn("R [1] esumo", marked)
        self.assertIn("proibida. [1]", marked)

    def test_expands_collapsed_gfm_table_and_keeps_citations_inside_pipes(self) -> None:
        settings = _make_settings()
        mock_s3 = MagicMock()
        mock_s3.generate_presigned_url.return_value = "https://s3.presigned/doc.pdf"
        presigner = S3Presigner(
            bucket_name=settings.docs_bucket_name,
            allowed_prefix=settings.docs_prefix,
            s3_client=mock_s3,
        )
        rag = BedrockRagService(settings=settings, presigner=presigner, bedrock_client=MagicMock())
        collapsed = (
            "Comparativo oficial:\n"
            "| Empreendimento | Preço/m² | Crédito | |---|---|---| "
            "| Horizonte Barra | R$ 16.800/m² | SFI | "
            "| Parque das Palmeiras | R$ 9.450/m² | SFH |"
        )
        raw_citations = [
            {
                "generatedResponsePart": {
                    "textResponsePart": {"text": "| Empreendimento | Preço/m² | Crédito |"}
                },
                "retrievedReferences": [
                    {
                        "content": {"text": "Header"},
                        "location": {
                            "s3Location": {
                                "uri": "s3://imobismart-kb-docs-111122223333/documents/catalogo-tecnico-empreendimentos-imobi-emp-001.pdf"
                            }
                        },
                        "metadata": {
                            "codigo_doc": "IMOBI-EMP-001",
                            "x-amz-bedrock-kb-document-page-number": 0.0,
                        },
                    }
                ],
            },
            {
                "generatedResponsePart": {
                    "textResponsePart": {"text": "| Horizonte Barra | R$ 16.800/m² | SFI |"}
                },
                "retrievedReferences": [
                    {
                        "content": {"text": "Horizonte Barra SFI"},
                        "location": {
                            "s3Location": {
                                "uri": "s3://imobismart-kb-docs-111122223333/documents/manual-credito-financiamento-imobi-fin-003.pdf"
                            }
                        },
                        "metadata": {
                            "codigo_doc": "IMOBI-FIN-003",
                            "x-amz-bedrock-kb-document-page-number": 1.0,
                        },
                    }
                ],
            },
        ]
        marked, citations = rag._extract_citations(collapsed, raw_citations)
        lines = [line for line in marked.splitlines() if line.strip().startswith("|")]
        self.assertEqual(len(lines), 4)
        self.assertEqual(lines[0], "| Empreendimento | Preço/m² | Crédito |")
        self.assertEqual(lines[1], "|---|---|---|")
        self.assertTrue(lines[2].endswith("[2] |"))
        self.assertNotIn("| [1]", marked)
        self.assertNotIn("| [2]", marked)
        self.assertEqual(citations[0]["pagina"], 1)
        self.assertEqual(citations[1]["pagina"], 2)


if __name__ == "__main__":
    unittest.main()
