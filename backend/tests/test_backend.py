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
        mock_table.put_item.assert_called_once()

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


if __name__ == "__main__":
    unittest.main()
