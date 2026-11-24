"""Unified AWS Lambda handler for /v1/health, /v1/chat, and /v1/feedback.

Implements ADR-002 (validation + healthcheck without LLM cost),
ADR-003 (restrictive CORS — never '*'), and ADR-004 (structured JSON logs without PII).
"""

from __future__ import annotations

import json
import logging
import os
import time
import uuid
from datetime import datetime, timezone
from typing import Any

from botocore.exceptions import ClientError

from src.config import Settings
from src.schemas.chat import ChatRequest, FeedbackRequest, ValidationError
from src.services.bedrock_rag import BedrockRagService
from src.services.s3_presigner import S3Presigner
from src.services.session_store import SessionStore

logger = logging.getLogger("imobismart.api")
logger.setLevel(os.environ.get("LOG_LEVEL", "INFO").upper())

_SETTINGS: Settings | None = None
_RAG_SERVICE: BedrockRagService | None = None
_SESSION_STORE: SessionStore | None = None


def _log_json(level: str, event_name: str, **fields: Any) -> None:
    record = {
        "ts": datetime.now(timezone.utc).isoformat(),
        "level": level,
        "event": event_name,
        **fields,
    }
    msg = json.dumps(record, ensure_ascii=False, default=str)
    if level == "ERROR":
        logger.error(msg)
    elif level == "WARNING":
        logger.warning(msg)
    else:
        logger.info(msg)


def _get_services() -> tuple[Settings, BedrockRagService, SessionStore]:
    global _SETTINGS, _RAG_SERVICE, _SESSION_STORE
    if _SETTINGS is None:
        _SETTINGS = Settings.from_env()
    if _RAG_SERVICE is None:
        presigner = S3Presigner(
            bucket_name=_SETTINGS.docs_bucket_name,
            allowed_prefix=_SETTINGS.docs_prefix,
            expires_seconds=_SETTINGS.presigned_url_expires_seconds,
            region_name=_SETTINGS.aws_region,
        )
        _RAG_SERVICE = BedrockRagService(settings=_SETTINGS, presigner=presigner)
    if _SESSION_STORE is None:
        _SESSION_STORE = SessionStore(
            table_name=_SETTINGS.sessions_table_name,
            region_name=_SETTINGS.aws_region,
        )
    return _SETTINGS, _RAG_SERVICE, _SESSION_STORE


def _build_cors_headers(
    event: dict[str, Any], allowed_origins: tuple[str, ...]
) -> dict[str, str]:
    """Return strict CORS headers — NEVER wildcard '*' (ADR-003)."""
    headers: dict[str, str] = {
        "Content-Type": "application/json; charset=utf-8",
        "X-Content-Type-Options": "nosniff",
        "Cache-Control": "no-store",
    }
    req_headers = {k.lower(): v for k, v in (event.get("headers") or {}).items()}
    origin = req_headers.get("origin", "").rstrip("/")
    if origin and origin in allowed_origins:
        headers["Access-Control-Allow-Origin"] = origin
        headers["Vary"] = "Origin"
        headers["Access-Control-Allow-Methods"] = "GET,POST,OPTIONS"
        headers["Access-Control-Allow-Headers"] = "Content-Type,X-Api-Key"
    return headers


def _json_response(
    status_code: int,
    body: dict[str, Any],
    headers: dict[str, str],
) -> dict[str, Any]:
    return {
        "statusCode": status_code,
        "headers": headers,
        "body": json.dumps(body, ensure_ascii=False, default=str),
    }


def _parse_json_body(event: dict[str, Any]) -> Any:
    raw = event.get("body")
    if raw is None or raw == "":
        raise ValidationError("Corpo da requisicao vazio.")
    if isinstance(raw, dict):
        return raw
    try:
        return json.loads(raw)
    except (ValueError, TypeError) as exc:
        raise ValidationError("JSON invalido no corpo da requisicao.") from exc


def lambda_handler(
    event: dict[str, Any],
    context: Any = None,
    *,
    settings: Settings | None = None,
    rag_service: BedrockRagService | None = None,
    session_store: SessionStore | None = None,
) -> dict[str, Any]:
    """Entrypoint for API Gateway REST Proxy Integration."""
    started = time.perf_counter()
    correlation_id = getattr(context, "aws_request_id", None) or str(uuid.uuid4())

    method = (
        event.get("httpMethod")
        or (event.get("requestContext") or {}).get("http", {}).get("method")
        or "POST"
    ).upper()
    path = (event.get("path") or event.get("rawPath") or "/v1/chat").rstrip("/")

    # Healthcheck never invokes Bedrock (zero LLM cost — ADR-002)
    if method == "GET" and path.endswith("/health"):
        raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
        allowed = (
            settings.allowed_origins
            if settings
            else tuple(o.strip().rstrip("/") for o in raw_origins.split(",") if o.strip())
        )
        resp_headers = _build_cors_headers(event, allowed)
        return _json_response(
            200,
            {
                "status": "ok",
                "service": "imobismart-ai-api",
                "version": "1.0.0",
                "timestamp": datetime.now(timezone.utc).isoformat(),
                "kb_configured": bool(
                    (settings.knowledge_base_id if settings else os.environ.get("KNOWLEDGE_BASE_ID"))
                ),
                "guardrail_configured": bool(
                    (settings.guardrail_id if settings else os.environ.get("GUARDRAIL_ID"))
                ),
            },
            resp_headers,
        )

    try:
        if settings is None or rag_service is None or session_store is None:
            s_env, r_env, d_env = _get_services()
            settings = settings or s_env
            rag_service = rag_service or r_env
            session_store = session_store or d_env
    except Exception as exc:
        _log_json("ERROR", "config_error", correlation_id=correlation_id, error=str(exc))
        return _json_response(
            500,
            {"error": "Erro de configuracao interna do servidor.", "request_id": correlation_id},
            {"Content-Type": "application/json; charset=utf-8"},
        )

    resp_headers = _build_cors_headers(event, settings.allowed_origins)

    if method == "OPTIONS":
        return _json_response(200, {"status": "ok"}, resp_headers)

    try:
        if method == "POST" and path.endswith("/feedback"):
            fb = FeedbackRequest.from_dict(_parse_json_body(event))
            session_store.record_feedback(
                session_id=fb.session_id,
                message_id=fb.message_id,
                rating=fb.rating,
                comment=fb.comment,
            )
            _log_json(
                "INFO",
                "feedback_recorded",
                correlation_id=correlation_id,
                session_id=fb.session_id,
                message_id=fb.message_id,
                rating=fb.rating,
            )
            return _json_response(
                200,
                {"status": "recorded", "message_id": fb.message_id, "rating": fb.rating},
                resp_headers,
            )

        if method == "POST" and path.endswith("/chat"):
            req = ChatRequest.from_dict(_parse_json_body(event))
            result = rag_service.query(req)
            latency_ms = int((time.perf_counter() - started) * 1000)
            message_id = str(uuid.uuid4())
            effective_session = result["session_id"] or str(uuid.uuid4())

            citation_codes = list(dict.fromkeys(c["codigo_doc"] for c in result["citations"]))
            try:
                session_store.record_turn(
                    session_id=effective_session,
                    message_id=message_id,
                    persona=req.persona,
                    empreendimento=req.empreendimento,
                    dominios=req.dominios,
                    prompt_length=len(req.prompt),
                    citation_codes=citation_codes,
                    guardrail_action=result["guardrail_action"],
                    latency_ms=latency_ms,
                )
            except Exception as ddb_exc:
                # Non-blocking telemetry: never fail the user answer if DynamoDB has a transient issue
                _log_json(
                    "WARNING",
                    "session_store_error",
                    correlation_id=correlation_id,
                    error=str(ddb_exc),
                )

            # LGPD-compliant structured log (NEVER logs raw user prompt or PII)
            _log_json(
                "INFO",
                "chat_completed",
                correlation_id=correlation_id,
                session_id=effective_session,
                message_id=message_id,
                persona=req.persona,
                empreendimento=req.empreendimento or "todos",
                dominios=list(req.dominios),
                prompt_length=len(req.prompt),
                citation_count=len(result["citations"]),
                citation_codes=citation_codes,
                guardrail_action=result["guardrail_action"],
                latency_ms=latency_ms,
            )

            return _json_response(
                200,
                {
                    "answer": result["answer"],
                    "session_id": effective_session,
                    "message_id": message_id,
                    "citations": result["citations"],
                    "guardrail_action": result["guardrail_action"],
                    "filters_applied": result["filters_applied"],
                    "latency_ms": latency_ms,
                    "request_id": correlation_id,
                },
                resp_headers,
            )

        return _json_response(
            404,
            {"error": "Rota nao encontrada.", "request_id": correlation_id},
            resp_headers,
        )

    except ValidationError as exc:
        _log_json(
            "WARNING",
            "validation_error",
            correlation_id=correlation_id,
            path=path,
            reason=str(exc),
        )
        return _json_response(
            400,
            {"error": str(exc), "request_id": correlation_id},
            resp_headers,
        )
    except ClientError as exc:
        code = exc.response.get("Error", {}).get("Code", "AWSClientError")
        err_msg = str(exc.response.get("Error", {}).get("Message", ""))[:260]
        _log_json(
            "ERROR",
            "aws_client_error",
            correlation_id=correlation_id,
            aws_error_code=code,
            aws_error_message=err_msg,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
        status = 429 if code == "ThrottlingException" else 502
        msg = (
            "Servico temporariamente sobrecarregado. Tente novamente em alguns segundos."
            if status == 429
            else "Nao foi possivel consultar a base de conhecimento no momento."
        )
        return _json_response(status, {"error": msg, "request_id": correlation_id}, resp_headers)
    except Exception as exc:
        _log_json(
            "ERROR",
            "unhandled_error",
            correlation_id=correlation_id,
            error_type=type(exc).__name__,
            latency_ms=int((time.perf_counter() - started) * 1000),
        )
        return _json_response(
            500,
            {"error": "Erro interno ao processar sua consulta.", "request_id": correlation_id},
            resp_headers,
        )
