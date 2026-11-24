import { metric } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";

import { isDemoModeEnabled } from "@/lib/demo-rag";
import {
  assertSameOrigin,
  createRequestId,
  enforceRateLimit,
  getAwsBackendConfig,
  readBoundedJsonBody,
} from "@/lib/security";

export const dynamic = "force-dynamic";

const feedbackSchema = z.object({
  session_id: z.string().regex(/^[A-Za-z0-9_-]{4,128}$/),
  message_id: z.string().regex(/^[A-Za-z0-9_-]{4,128}$/),
  rating: z.enum(["up", "down"]),
  comment: z.string().trim().max(300).optional(),
});

export async function POST(req: NextRequest) {
  const requestId = createRequestId();

  const originCheck = assertSameOrigin(req);
  if (!originCheck.ok) {
    return NextResponse.json(
      { error: originCheck.reason, request_id: requestId },
      { status: 403, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }
    );
  }

  const rate = enforceRateLimit(req, "feedback");
  if (!rate.allowed) {
    return NextResponse.json(
      { error: "Muitas avaliacoes em sequencia. Aguarde um instante.", request_id: requestId },
      {
        status: 429,
        headers: { ...rate.headers, "X-Request-Id": requestId, "Cache-Control": "no-store" },
      }
    );
  }

  const bodyResult = await readBoundedJsonBody(req, 1024);
  if (!bodyResult.ok) {
    return NextResponse.json(
      { error: bodyResult.error, request_id: requestId },
      {
        status: bodyResult.status,
        headers: { ...rate.headers, "X-Request-Id": requestId, "Cache-Control": "no-store" },
      }
    );
  }

  const parsed = feedbackSchema.safeParse(bodyResult.data);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Payload de feedback invalido.", request_id: requestId },
      {
        status: 400,
        headers: { ...rate.headers, "X-Request-Id": requestId, "Cache-Control": "no-store" },
      }
    );
  }

  if (isDemoModeEnabled()) {
    metric("imobismart.feedback.recorded", 1, { outcome: "demo", rating: parsed.data.rating });
    return NextResponse.json(
      {
        status: "recorded",
        mode: "demo",
        message_id: parsed.data.message_id,
        rating: parsed.data.rating,
      },
      {
        status: 200,
        headers: { ...rate.headers, "X-Request-Id": requestId, "Cache-Control": "no-store" },
      }
    );
  }

  try {
    const { apiBaseUrl, apiKey } = getAwsBackendConfig();
    const upstream = await fetch(`${apiBaseUrl}/v1/feedback`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
      },
      body: JSON.stringify(parsed.data),
      cache: "no-store",
      signal: AbortSignal.timeout(10000),
    });

    if (!upstream.ok) {
      metric("imobismart.feedback.recorded", 1, { outcome: "error", rating: parsed.data.rating });
      return NextResponse.json(
        { error: "Nao foi possivel registrar o feedback.", request_id: requestId },
        {
          status: 502,
          headers: { ...rate.headers, "X-Request-Id": requestId, "Cache-Control": "no-store" },
        }
      );
    }

    metric("imobismart.feedback.recorded", 1, { outcome: "success", rating: parsed.data.rating });
    const data = await upstream.json();
    return NextResponse.json(data, {
      status: 200,
      headers: { ...rate.headers, "X-Request-Id": requestId, "Cache-Control": "no-store" },
    });
  } catch {
    metric("imobismart.feedback.recorded", 1, { outcome: "network_error", rating: parsed.data.rating });
    return NextResponse.json(
      { error: "Falha ao conectar com o servico de feedback.", request_id: requestId },
      {
        status: 502,
        headers: { ...rate.headers, "X-Request-Id": requestId, "Cache-Control": "no-store" },
      }
    );
  }
}
