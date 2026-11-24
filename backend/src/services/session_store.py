"""DynamoDB session & feedback store with 30-day TTL and zero PII persistence."""

from __future__ import annotations

import time
from typing import Any

import boto3

TTL_DAYS_DEFAULT = 30


class SessionStore:
    """Stores anonymized chat telemetry, Bedrock session mappings, and 👍/👎 feedback."""

    def __init__(
        self,
        table_name: str,
        region_name: str = "us-east-1",
        ttl_days: int = TTL_DAYS_DEFAULT,
        table_resource=None,
    ) -> None:
        self.table_name = table_name
        self.ttl_days = ttl_days
        self._table = table_resource
        if self._table is None and table_name:
            ddb = boto3.resource("dynamodb", region_name=region_name)
            self._table = ddb.Table(table_name)

    @property
    def enabled(self) -> bool:
        return self._table is not None

    def _expires_at(self) -> int:
        return int(time.time()) + (self.ttl_days * 86400)

    def record_turn(
        self,
        session_id: str,
        message_id: str,
        persona: str,
        empreendimento: str | None,
        dominios: tuple[str, ...],
        prompt_length: int,
        citation_codes: list[str],
        guardrail_action: str,
        latency_ms: int,
    ) -> None:
        """Persist non-PII turn metrics for RAG observability and feedback linkage."""
        if not self._table:
            return

        now = int(time.time())
        item: dict[str, Any] = {
            "pk": f"SESSION#{session_id}",
            "sk": f"MSG#{now}#{message_id}",
            "entity_type": "TURN",
            "session_id": session_id,
            "message_id": message_id,
            "persona": persona,
            "empreendimento": empreendimento or "todos",
            "dominios": list(dominios) if dominios else ["todos"],
            "prompt_length": prompt_length,
            "citation_codes": citation_codes,
            "guardrail_action": guardrail_action,
            "latency_ms": latency_ms,
            "created_at": now,
            "ttl": self._expires_at(),
        }
        self._table.put_item(Item=item)

    def record_feedback(
        self,
        session_id: str,
        message_id: str,
        rating: str,
        comment: str | None = None,
    ) -> None:
        """Persist user rating (up/down) for continuous RAG evaluation."""
        if not self._table:
            return

        now = int(time.time())
        item: dict[str, Any] = {
            "pk": f"SESSION#{session_id}",
            "sk": f"FEEDBACK#{message_id}",
            "entity_type": "FEEDBACK",
            "session_id": session_id,
            "message_id": message_id,
            "rating": rating,
            "created_at": now,
            "ttl": self._expires_at(),
        }
        if comment:
            item["comment"] = comment
        self._table.put_item(Item=item)
