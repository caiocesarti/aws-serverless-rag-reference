"""Typed configuration loaded strictly from environment variables (zero hardcode)."""

from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    aws_region: str
    knowledge_base_id: str
    model_arn: str
    rerank_model_arn: str
    guardrail_id: str
    guardrail_version: str
    docs_bucket_name: str
    docs_prefix: str
    sessions_table_name: str
    presigned_url_expires_seconds: int
    allowed_origins: tuple[str, ...]
    log_level: str

    @classmethod
    def from_env(cls) -> "Settings":
        def _req(name: str) -> str:
            val = os.environ.get(name, "").strip()
            if not val:
                raise RuntimeError(f"Variavel de ambiente obrigatoria ausente: {name}")
            return val

        raw_origins = os.environ.get("ALLOWED_ORIGINS", "")
        origins = tuple(o.strip().rstrip("/") for o in raw_origins.split(",") if o.strip())

        prefix = os.environ.get("DOCS_PREFIX", "documents/").strip().lstrip("/")
        if prefix and not prefix.endswith("/"):
            prefix += "/"

        return cls(
            aws_region=os.environ.get("AWS_REGION", "us-east-1").strip(),
            knowledge_base_id=_req("KNOWLEDGE_BASE_ID"),
            model_arn=_req("MODEL_ARN"),
            rerank_model_arn=os.environ.get(
                "RERANK_MODEL_ARN",
                "arn:aws:bedrock:us-east-1::foundation-model/cohere.rerank-v3-5:0",
            ).strip(),
            guardrail_id=os.environ.get("GUARDRAIL_ID", "").strip(),
            guardrail_version=os.environ.get("GUARDRAIL_VERSION", "DRAFT").strip(),
            docs_bucket_name=_req("DOCS_BUCKET_NAME"),
            docs_prefix=prefix,
            sessions_table_name=os.environ.get("SESSIONS_TABLE_NAME", "").strip(),
            presigned_url_expires_seconds=int(
                os.environ.get("PRESIGNED_URL_EXPIRES_SECONDS", "600")
            ),
            allowed_origins=origins,
            log_level=os.environ.get("LOG_LEVEL", "INFO").upper(),
        )
