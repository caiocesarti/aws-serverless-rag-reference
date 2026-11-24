import { metric } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import {
  assertSameOrigin,
  createRequestId,
  enforceRateLimit,
  getAwsBackendConfig,
  readBoundedJsonBody,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const chatSchema = z.object({
  prompt: z
    .string()
    .trim()
    .min(2, "Digite uma pergunta com pelo menos 2 caracteres.")
    .max(1000, "A pergunta deve ter no maximo 1.000 caracteres."),
  session_id: z
    .string()
    .regex(/^[A-Za-z0-9_-]{4,128}$/)
    .optional(),
  persona: z.enum(["corretor", "comprador"]).default("corretor"),
  empreendimento: z
    .enum(["todos", "horizonte-barra", "parque-das-palmeiras", "smart-studio-metropole"])
    .optional(),
  dominios: z
    .array(z.enum(["empreendimentos", "condominio", "credito"]))
    .max(3)
    .optional(),
});

export async function POST(req: NextRequest) {
  const startedAt = performance.now();
  const requestId = createRequestId();

  // 1. Strict Origin / Anti-CSRF check (ADR-003)
  const originCheck = assertSameOrigin(req);
  if (!originCheck.ok) {
    metric("imobismart.chat.requests", 1, { outcome: "forbidden_origin" });
    return NextResponse.json(
      { error: originCheck.reason, request_id: requestId },
      { status: 403, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }
    );
  }

  // 2. BFF Edge Rate Limiting (ADR-002)
  const rate = enforceRateLimit(req, "chat");
  if (!rate.allowed) {
    metric("imobismart.chat.requests", 1, { outcome: "rate_limited" });
    return NextResponse.json(
      {
        error: `Limite de consultas atingido. Aguarde ${rate.resetSeconds}s e tente novamente.`,
        request_id: requestId,
      },
      {
        status: 429,
        headers: {
          ...rate.headers,
          "X-Request-Id": requestId,
          "Cache-Control": "no-store",
        },
      }
    );
  }

  // 3. Content-Type & Bounded Body Parse
  const bodyResult = await readBoundedJsonBody(req, 4096);
  if (!bodyResult.ok) {
    metric("imobismart.chat.requests", 1, { outcome: "invalid_body" });
    return NextResponse.json(
      { error: bodyResult.error, request_id: requestId },
      {
        status: bodyResult.status,
        headers: { ...rate.headers, "X-Request-Id": requestId, "Cache-Control": "no-store" },
      }
    );
  }

  // 4. Strict Zod Schema Validation
  const parsed = chatSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message ?? "Parametros invalidos.";
    metric("imobismart.chat.requests", 1, { outcome: "validation_error" });
    return NextResponse.json(
      { error: firstMsg, request_id: requestId },
      {
        status: 400,
        headers: { ...rate.headers, "X-Request-Id": requestId, "Cache-Control": "no-store" },
      }
    );
  }

  // 5. Server-to-Server call to AWS API Gateway (x-api-key NEVER exposed to browser)
  let outcome = "error";
  try {
    const { apiBaseUrl, apiKey } = getAwsBackendConfig();
    const payload = {
      prompt: parsed.data.prompt,
      persona: parsed.data.persona,
      ...(parsed.data.session_id ? { session_id: parsed.data.session_id } : {}),
      ...(parsed.data.empreendimento && parsed.data.empreendimento !== "todos"
        ? { empreendimento: parsed.data.empreendimento }
        : {}),
      ...(parsed.data.dominios && parsed.data.dominios.length > 0
        ? { dominios: parsed.data.dominios }
        : {}),
    };

    const upstream = await fetch(`${apiBaseUrl}/v1/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(payload),
      cache: "no-store",
      signal: AbortSignal.timeout(55000),
    });

    const data = await upstream.json().catch(() => ({
      error: "Resposta inesperada da API AWS.",
    }));

    if (!upstream.ok) {
      outcome = upstream.status === 429 ? "aws_throttled" : "aws_error";
      return NextResponse.json(
        {
          error:
            typeof data?.error === "string"
              ? data.error
              : "Nao foi possivel processar a consulta no momento.",
          request_id: requestId,
        },
        {
          status: upstream.status >= 400 && upstream.status < 600 ? upstream.status : 502,
          headers: { ...rate.headers, "X-Request-Id": requestId, "Cache-Control": "no-store" },
        }
      );
    }

    outcome = data?.guardrail_action === "INTERVENED" ? "guardrail_intervened" : "success";
    return NextResponse.json(data, {
      status: 200,
      headers: {
        ...rate.headers,
        "X-Request-Id": requestId,
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    const isTimeout = err instanceof Error && err.name === "TimeoutError";
    outcome = isTimeout ? "timeout" : "network_error";
    return NextResponse.json(
      {
        error: isTimeout
          ? "A consulta excedeu o tempo limite. Tente refinar sua pergunta."
          : "Falha temporaria ao conectar com a infraestrutura AWS.",
        request_id: requestId,
      },
      {
        status: isTimeout ? 504 : 502,
        headers: { ...rate.headers, "X-Request-Id": requestId, "Cache-Control": "no-store" },
      }
    );
  } finally {
    const latencyMs = Math.round(performance.now() - startedAt);
    metric("imobismart.chat.requests", 1, { outcome, persona: parsed.data.persona });
    metric("imobismart.chat.latency_ms", latencyMs, { outcome });
  }
}
