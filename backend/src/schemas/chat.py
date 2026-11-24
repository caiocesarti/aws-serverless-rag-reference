"""Strict input/output validation schemas for ImobiSmart AI API."""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from typing import Any

VALID_PERSONAS = frozenset({"corretor", "comprador"})
VALID_EMPREENDIMENTOS = frozenset(
    {"horizonte-barra", "parque-das-palmeiras", "smart-studio-metropole"}
)
VALID_DOMINIOS = frozenset({"empreendimentos", "condominio", "credito"})
VALID_RATINGS = frozenset({"up", "down"})

MAX_PROMPT_CHARS = 1000
MIN_PROMPT_CHARS = 2
MAX_COMMENT_CHARS = 300
_SAFE_ID_RE = re.compile(r"^[A-Za-z0-9_\-]{4,128}$")


class ValidationError(ValueError):
    """Raised when an incoming API payload violates contract rules."""


@dataclass(frozen=True)
class ChatRequest:
    prompt: str
    session_id: str | None = None
    persona: str = "corretor"
    empreendimento: str | None = None
    dominios: tuple[str, ...] = field(default_factory=tuple)

    @classmethod
    def from_dict(cls, data: Any) -> "ChatRequest":
        if not isinstance(data, dict):
            raise ValidationError("Corpo da requisicao deve ser um objeto JSON.")

        raw_prompt = data.get("prompt")
        if not isinstance(raw_prompt, str):
            raise ValidationError("Campo 'prompt' e obrigatorio e deve ser texto.")
        prompt = raw_prompt.strip()
        if len(prompt) < MIN_PROMPT_CHARS:
            raise ValidationError(
                f"Campo 'prompt' deve conter ao menos {MIN_PROMPT_CHARS} caracteres."
            )
        if len(prompt) > MAX_PROMPT_CHARS:
            raise ValidationError(
                f"Campo 'prompt' excede o limite maximo de {MAX_PROMPT_CHARS} caracteres."
            )

        session_id = data.get("session_id")
        if session_id is not None:
            if not isinstance(session_id, str) or not _SAFE_ID_RE.match(session_id.strip()):
                raise ValidationError("Campo 'session_id' possui formato invalido.")
            session_id = session_id.strip()

        persona = str(data.get("persona", "corretor")).strip().lower()
        if persona not in VALID_PERSONAS:
            raise ValidationError(
                f"Campo 'persona' invalido. Valores aceitos: {sorted(VALID_PERSONAS)}."
            )

        filters = data.get("filters") or {}
        if not isinstance(filters, dict):
            raise ValidationError("Campo 'filters' deve ser um objeto JSON.")

        emp_raw = data.get("empreendimento") or filters.get("empreendimento")
        empreendimento: str | None = None
        if emp_raw is not None and str(emp_raw).strip() not in ("", "todos", "all"):
            emp_norm = str(emp_raw).strip().lower()
            if emp_norm not in VALID_EMPREENDIMENTOS:
                raise ValidationError(
                    f"Empreendimento invalido. Valores aceitos: {sorted(VALID_EMPREENDIMENTOS)}."
                )
            empreendimento = emp_norm

        dom_raw = data.get("dominios") or filters.get("dominio_kb") or []
        if isinstance(dom_raw, str):
            dom_raw = [dom_raw]
        if not isinstance(dom_raw, list):
            raise ValidationError("Campo 'dominios' deve ser uma lista de strings.")

        dominios_clean: list[str] = []
        for d in dom_raw:
            d_norm = str(d).strip().lower()
            if d_norm in ("", "todos", "all"):
                continue
            if d_norm not in VALID_DOMINIOS:
                raise ValidationError(
                    f"Dominio KB invalido: '{d}'. Aceitos: {sorted(VALID_DOMINIOS)}."
                )
            if d_norm not in dominios_clean:
                dominios_clean.append(d_norm)

        return cls(
            prompt=prompt,
            session_id=session_id,
            persona=persona,
            empreendimento=empreendimento,
            dominios=tuple(dominios_clean),
        )


@dataclass(frozen=True)
class FeedbackRequest:
    session_id: str
    message_id: str
    rating: str
    comment: str | None = None

    @classmethod
    def from_dict(cls, data: Any) -> "FeedbackRequest":
        if not isinstance(data, dict):
            raise ValidationError("Corpo da requisicao deve ser um objeto JSON.")

        session_id = str(data.get("session_id", "")).strip()
        message_id = str(data.get("message_id", "")).strip()
        rating = str(data.get("rating", "")).strip().lower()

        if not _SAFE_ID_RE.match(session_id):
            raise ValidationError("Campo 'session_id' obrigatorio e com formato valido.")
        if not _SAFE_ID_RE.match(message_id):
            raise ValidationError("Campo 'message_id' obrigatorio e com formato valido.")
        if rating not in VALID_RATINGS:
            raise ValidationError("Campo 'rating' deve ser 'up' ou 'down'.")

        comment_raw = data.get("comment")
        comment: str | None = None
        if comment_raw is not None:
            comment = str(comment_raw).strip()[:MAX_COMMENT_CHARS] or None

        return cls(
            session_id=session_id,
            message_id=message_id,
            rating=rating,
            comment=comment,
        )
