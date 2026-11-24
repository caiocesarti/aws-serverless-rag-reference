"""Amazon Bedrock Knowledge Base RAG service (Query Decomposition + Rerank + Guardrail)."""

from __future__ import annotations

from typing import Any

import boto3
from botocore.config import Config
from botocore.exceptions import ClientError

from src.config import Settings
from src.schemas.chat import ChatRequest
from src.services.s3_presigner import S3Presigner

EMPREENDIMENTO_LABELS: dict[str, str] = {
    "horizonte-barra": "Residencial Horizonte Barra (EMP-HB-2027, Alto Padrao, Barra, SFI)",
    "parque-das-palmeiras": "Parque das Palmeiras Residence (EMP-PP-2026, Condominio Clube, Horto Florestal, SFH)",
    "smart-studio-metropole": "Smart Studio Metropole (EMP-SM-2028, Compacto/Investidor, Caminho das Arvores, Short-Stay)",
}

DOCUMENT_DISPLAY_TITLES: dict[str, str] = {
    "IMOBI-EMP-001": "Catálogo Técnico de Empreendimentos e Memoriais Descritivos",
    "IMOBI-COND-002": "Convenção Padrão de Condomínio e Regimento Interno",
    "IMOBI-FIN-003": "Manual Técnico de Crédito Imobiliário e Financiamento Habitacional",
}

SYSTEM_PROMPT_TEMPLATE = """Voce e o ImobiSmart AI, assistente tecnico oficial da ImobiSmart Incorporadora (Salvador/BA).
Responda SEMPRE em portugues do Brasil claro, objetivo e estruturado em Markdown (use listas e tabelas quando comparar empreendimentos ou condicoes).

REGRAS OBRIGATORIAS:
1. Baseie sua resposta EXCLUSIVAMENTE nos trechos recuperados em $search_results$.
2. NUNCA invente metragens, valores de tabela, taxas de juros, multas, horarios ou normas que nao estejam nos documentos oficiais.
3. Quando citar valores ou enquadramento de financiamento (SFH, SFI, MCMV, FGTS, SAC/Price), informe claramente o empreendimento correspondente e inclua ao final uma linha curta de aviso: "_Valores e condicoes sujeitos a analise de credito e tabela vigente._"
4. Se a informacao solicitada nao constar nos documentos recuperados, diga explicitamente que ela nao esta disponivel na base tecnica oficial atual.

Contexto de pesquisa recuperado:
$search_results$

$output_format_instructions$
"""


class BedrockRagService:
    """Executes grounded multi-document RAG against Bedrock KB + Pinecone Serverless."""

    def __init__(
        self,
        settings: Settings,
        presigner: S3Presigner,
        bedrock_client=None,
    ) -> None:
        self.settings = settings
        self.presigner = presigner
        self._client = bedrock_client or boto3.client(
            "bedrock-agent-runtime",
            region_name=settings.aws_region,
            config=Config(
                read_timeout=55,
                connect_timeout=10,
                retries={"max_attempts": 2, "mode": "standard"},
            ),
        )

    @staticmethod
    def build_metadata_filter(dominios: tuple[str, ...]) -> dict[str, Any] | None:
        """Build Pinecone-compatible Bedrock metadata filter for dominio_kb."""
        if not dominios or len(dominios) >= 3:
            return None
        if len(dominios) == 1:
            return {"equals": {"key": "dominio_kb", "value": dominios[0]}}
        return {"in": {"key": "dominio_kb", "value": list(dominios)}}

    @staticmethod
    def build_effective_prompt(req: ChatRequest) -> str:
        """Enrich query with persona and selected property scope without polluting user input."""
        hints: list[str] = []
        if req.persona == "corretor":
            hints.append(
                "Perfil de resposta: Corretor de imoveis (foco tecnico-comercial objetivo com numeros exatos)."
            )
        else:
            hints.append(
                "Perfil de resposta: Comprador (linguagem didatica explicando siglas como SFH, SFI, ART/RRT, INCC-M)."
            )

        if req.empreendimento and req.empreendimento in EMPREENDIMENTO_LABELS:
            hints.append(
                f"Empreendimento selecionado no filtro: {EMPREENDIMENTO_LABELS[req.empreendimento]}."
            )

        return f"{' '.join(hints)}\n\nPergunta do usuario: {req.prompt}"

    def _build_request_payload(
        self, req: ChatRequest, include_session: bool = True
    ) -> dict[str, Any]:
        vector_cfg: dict[str, Any] = {
            "numberOfResults": 12,
        }
        meta_filter = self.build_metadata_filter(req.dominios)
        if meta_filter:
            vector_cfg["filter"] = meta_filter

        if self.settings.rerank_model_arn:
            vector_cfg["rerankingConfiguration"] = {
                "type": "BEDROCK_RERANKING_MODEL",
                "bedrockRerankingConfiguration": {
                    "modelConfiguration": {
                        "modelArn": self.settings.rerank_model_arn,
                    },
                    "numberOfRerankedResults": 6,
                },
            }

        gen_cfg: dict[str, Any] = {
            "promptTemplate": {"textPromptTemplate": SYSTEM_PROMPT_TEMPLATE},
            "inferenceConfig": {
                "textInferenceConfig": {
                    "temperature": 0.1,
                    "topP": 0.9,
                    "maxTokens": 1200,
                }
            },
        }
        if self.settings.guardrail_id:
            gen_cfg["guardrailConfiguration"] = {
                "guardrailId": self.settings.guardrail_id,
                "guardrailVersion": self.settings.guardrail_version,
            }

        kb_cfg: dict[str, Any] = {
            "knowledgeBaseId": self.settings.knowledge_base_id,
            "modelArn": self.settings.model_arn,
            "orchestrationConfiguration": {
                "queryTransformationConfiguration": {
                    "type": "QUERY_DECOMPOSITION",
                }
            },
            "retrievalConfiguration": {
                "vectorSearchConfiguration": vector_cfg,
            },
            "generationConfiguration": gen_cfg,
        }

        payload: dict[str, Any] = {
            "input": {"text": self.build_effective_prompt(req)},
            "retrieveAndGenerateConfiguration": {
                "type": "KNOWLEDGE_BASE",
                "knowledgeBaseConfiguration": kb_cfg,
            },
        }
        if include_session and req.session_id:
            payload["sessionId"] = req.session_id
        return payload

    @staticmethod
    def _parse_page_number(meta: dict[str, Any]) -> int | None:
        """Extract 1-based PDF page number from Bedrock KB metadata."""
        raw = meta.get("x-amz-bedrock-kb-document-page-number")
        if raw is None or isinstance(raw, bool):
            return None
        try:
            page = int(float(raw))
            return page if page >= 1 else None
        except (TypeError, ValueError):
            return None

    @staticmethod
    def _extract_filename(s3_key: str | None, s3_uri: str) -> str:
        """Return the PDF basename from an S3 key or URI."""
        source = (s3_key or s3_uri or "").strip().rstrip("/")
        if not source:
            return ""
        return source.rsplit("/", 1)[-1]

    def _extract_citations(
        self, answer: str, raw_citations: list[dict[str, Any]]
    ) -> tuple[str, list[dict[str, Any]]]:
        """Deduplicate source PDFs by (document, page), attach S3 Pre-signed URLs, and insert [n] markers."""
        citations: list[dict[str, Any]] = []
        index_by_source_page: dict[tuple[str, int | None], int] = {}
        presigned_cache: dict[str, tuple[str | None, str | None]] = {}
        inserts: list[tuple[int, str]] = []

        for cite in raw_citations:
            refs = cite.get("retrievedReferences") or []
            if not refs:
                continue

            span_nums: list[int] = []
            for ref in refs:
                meta = ref.get("metadata") or {}
                s3_uri = (
                    (ref.get("location") or {}).get("s3Location", {}).get("uri")
                    or str(meta.get("x-amz-bedrock-kb-source-uri") or "")
                )
                snippet = ((ref.get("content") or {}).get("text") or "").strip()[:360]
                page_number = self._parse_page_number(meta)

                base_key = s3_uri or str(meta.get("codigo_doc") or "source")
                dedupe_key = (base_key, page_number)
                if dedupe_key in index_by_source_page:
                    num = index_by_source_page[dedupe_key]
                else:
                    if s3_uri not in presigned_cache:
                        presigned_cache[s3_uri] = self.presigner.presign_document_uri(s3_uri)
                    presigned_url, s3_key = presigned_cache[s3_uri]
                    num = len(citations) + 1
                    index_by_source_page[dedupe_key] = num

                    codigo_doc = str(meta.get("codigo_doc") or f"DOC-{num}")
                    arquivo = self._extract_filename(s3_key, s3_uri)
                    titulo = DOCUMENT_DISPLAY_TITLES.get(codigo_doc) or str(
                        meta.get("titulo") or arquivo or "Documento Oficial"
                    )
                    citations.append(
                        {
                            "index": num,
                            "codigo_doc": codigo_doc,
                            "titulo": titulo,
                            "arquivo": arquivo,
                            "pagina": page_number,
                            "dominio_kb": str(meta.get("dominio_kb") or "geral"),
                            "versao": str(meta.get("versao") or ""),
                            "vigencia": str(meta.get("vigencia") or ""),
                            "snippet": snippet,
                            "presigned_url": presigned_url,
                            "s3_key": s3_key,
                        }
                    )
                if num not in span_nums:
                    span_nums.append(num)

            text_part = (cite.get("generatedResponsePart") or {}).get("textResponsePart") or {}
            span = text_part.get("span")
            part_text = (text_part.get("text") or "").strip()

            pos: int | None = None
            if part_text:
                # Exact text match avoids UTF-8/UTF-16 offset drift with Portuguese accents (á, é, ç, ã)
                found_at = answer.find(part_text)
                if found_at != -1:
                    pos = found_at + len(part_text)
            if pos is None and isinstance(span, dict) and isinstance(span.get("end"), int):
                pos = max(0, min(span["end"] + 1, len(answer)))

            if pos is not None and span_nums:
                markers = "".join(f"[{n}]" for n in span_nums)
                # Never insert mid-word or mid-markdown token (**): snap to end of current line/sentence
                while pos < len(answer) and answer[pos] not in "\n":
                    if answer[pos] in ".!?" and (pos + 1 == len(answer) or answer[pos + 1] in " \n\r*"):
                        pos += 1
                        break
                    pos += 1
                # Keep trailing newline after the marker and avoid splitting closing **
                while pos > 0 and answer[pos - 1] in " \t":
                    pos -= 1
                if pos > 0 and pos < len(answer) and answer[pos - 1] == "*" and answer[pos] == "*":
                    pos += 1
                inserts.append((pos, f" {markers}"))

        # Insert markers right-to-left (deduping identical positions and skipping headings)
        marked_answer = answer
        used_positions: set[int] = set()
        for pos, marker in sorted(inserts, key=lambda x: x[0], reverse=True):
            if pos in used_positions:
                continue
            line_start = marked_answer.rfind("\n", 0, pos) + 1
            line_text = marked_answer[line_start:pos].strip()
            # Avoid attaching citations to bare section headers like "Airbnb:" or "Resumo:"
            if not line_text or (line_text.endswith(":") and len(line_text) < 40):
                continue
            used_positions.add(pos)
            safe_pos = max(0, min(pos, len(marked_answer)))
            marked_answer = marked_answer[:safe_pos] + marker + marked_answer[safe_pos:]

        return marked_answer, citations

    def query(self, req: ChatRequest) -> dict[str, Any]:
        """Run grounded RAG query with automatic fallback if client sessionId is unknown to Bedrock."""
        payload = self._build_request_payload(req, include_session=True)
        try:
            response = self._client.retrieve_and_generate(**payload)
        except ClientError as exc:
            err_code = exc.response.get("Error", {}).get("Code", "")
            err_msg = exc.response.get("Error", {}).get("Message", "")
            if err_code == "ValidationException" and "session" in err_msg.lower() and req.session_id:
                # Client sent a local session ID not yet known by Bedrock — start a fresh Bedrock session
                payload = self._build_request_payload(req, include_session=False)
                response = self._client.retrieve_and_generate(**payload)
            else:
                raise

        raw_answer = (response.get("output") or {}).get("text") or ""
        raw_citations = response.get("citations") or []
        marked_answer, citations = self._extract_citations(raw_answer, raw_citations)

        return {
            "answer": marked_answer,
            "session_id": response.get("sessionId") or req.session_id or "",
            "citations": citations,
            "guardrail_action": response.get("guardrailAction") or "NONE",
            "filters_applied": {
                "persona": req.persona,
                "empreendimento": req.empreendimento or "todos",
                "dominios": list(req.dominios) if req.dominios else ["todos"],
            },
        }
