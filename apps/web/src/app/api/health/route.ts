import { NextResponse } from "next/server";

import { isDemoModeEnabled } from "@/lib/demo-rag";
import { createRequestId } from "@/lib/security";

export const dynamic = "force-dynamic";

export async function GET() {
  const requestId = createRequestId();

  if (isDemoModeEnabled()) {
    return NextResponse.json(
      {
        status: "demo",
        mode: "demo",
        service: "imobismart-ai-portfolio-demo",
        version: "1.0.0",
        kb_configured: true,
        guardrail_configured: true,
        checked_at: new Date().toISOString(),
      },
      { status: 200, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }
    );
  }

  const baseUrl = (process.env.AWS_API_BASE_URL ?? "").trim().replace(/\/+$/, "");

  if (!baseUrl) {
    return NextResponse.json(
      { status: "degraded", error: "AWS_API_BASE_URL nao configurado.", checked_at: new Date().toISOString() },
      { status: 503, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }
    );
  }

  try {
    const upstream = await fetch(`${baseUrl}/v1/health`, {
      method: "GET",
      cache: "no-store",
      signal: AbortSignal.timeout(8000),
    });

    if (!upstream.ok) {
      return NextResponse.json(
        { status: "degraded", checked_at: new Date().toISOString() },
        { status: 502, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }
      );
    }

    const data = await upstream.json();
    return NextResponse.json(
      { ...data, checked_at: new Date().toISOString() },
      { status: 200, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }
    );
  } catch {
    return NextResponse.json(
      { status: "offline", checked_at: new Date().toISOString() },
      { status: 503, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }
    );
  }
}
