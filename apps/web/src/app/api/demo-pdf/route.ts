import { readFile } from "node:fs/promises";
import path from "node:path";

import { metric } from "@vercel/functions";
import { NextRequest, NextResponse } from "next/server";

import { isDemoModeEnabled, resolveDemoPdfEntry } from "@/lib/demo-rag";
import { createRequestId, enforceRateLimit } from "@/lib/security";

export const dynamic = "force-dynamic";

const MAX_DEMO_PDF_BYTES = 2 * 1024 * 1024; // 2 MiB hard cap (canonical PDFs are ~220 KB)
const PDF_MAGIC_HEADER = "%PDF-";

async function loadDemoPdfBuffer(filename: string, rawUrl: string): Promise<Buffer | null> {
  // 1. Traced monorepo KB documents (bundled into /api/demo-pdf via outputFileTracingIncludes)
  // Checks both apps/web cwd and repo-root cwd with strict directory containment.
  const candidateDirs = [
    path.resolve(process.cwd(), "..", "..", "knowledge-base", "documents"),
    path.resolve(process.cwd(), "knowledge-base", "documents"),
  ];

  for (const kbDir of candidateDirs) {
    const candidatePath = path.resolve(kbDir, filename);
    if (!candidatePath.startsWith(`${kbDir}${path.sep}`)) {
      continue;
    }
    try {
      const localBytes = await readFile(candidatePath);
      if (
        localBytes.byteLength > 0 &&
        localBytes.byteLength <= MAX_DEMO_PDF_BYTES &&
        localBytes.subarray(0, PDF_MAGIC_HEADER.length).toString("ascii") === PDF_MAGIC_HEADER
      ) {
        return localBytes;
      }
    } catch {
      // Try next candidate directory
    }
  }

  // 2. Fallback: hardcoded allowlisted GitHub raw URL (if repo is public & tracing outside root is disabled)
  const upstream = await fetch(rawUrl, {
    method: "GET",
    redirect: "error",
    cache: "no-store",
    signal: AbortSignal.timeout(10000),
  });

  if (!upstream.ok) {
    return null;
  }

  const declaredLength = Number.parseInt(upstream.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_DEMO_PDF_BYTES) {
    return null;
  }

  const arrayBuffer = await upstream.arrayBuffer();
  const remoteBytes = Buffer.from(arrayBuffer);

  if (
    remoteBytes.byteLength === 0 ||
    remoteBytes.byteLength > MAX_DEMO_PDF_BYTES ||
    remoteBytes.subarray(0, PDF_MAGIC_HEADER.length).toString("ascii") !== PDF_MAGIC_HEADER
  ) {
    return null;
  }

  return remoteBytes;
}

export async function GET(req: NextRequest) {
  const startedAt = performance.now();
  const requestId = createRequestId();

  // 1. Hard gate: route is completely inactive in AWS production (DEMO_MODE !== "true")
  if (!isDemoModeEnabled()) {
    metric("imobismart.demo_pdf.requests", 1, { outcome: "disabled" });
    return NextResponse.json(
      { error: "Endpoint indisponivel fora do modo demonstracao.", request_id: requestId },
      { status: 404, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }
    );
  }

  // 2. Block cross-site hotlinking while permitting same-origin tab opens and direct navigation
  const secFetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    metric("imobismart.demo_pdf.requests", 1, { outcome: "forbidden_origin" });
    return NextResponse.json(
      { error: "Requisicao cross-site bloqueada pela politica BFF.", request_id: requestId },
      { status: 403, headers: { "X-Request-Id": requestId, "Cache-Control": "no-store" } }
    );
  }

  // 3. BFF Rate Limiting (ADR-002)
  const rate = enforceRateLimit(req, "demo-pdf");
  if (!rate.allowed) {
    metric("imobismart.demo_pdf.requests", 1, { outcome: "rate_limited" });
    return NextResponse.json(
      {
        error: `Limite de visualizacoes atingido. Aguarde ${rate.resetSeconds}s e tente novamente.`,
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

  // 4. Strict 3-document allowlist (zero SSRF / zero path traversal)
  const entry = resolveDemoPdfEntry(req.nextUrl.searchParams.get("doc"));
  if (!entry) {
    metric("imobismart.demo_pdf.requests", 1, { outcome: "invalid_doc" });
    return NextResponse.json(
      { error: "Documento nao autorizado no modo demonstracao.", request_id: requestId },
      {
        status: 400,
        headers: {
          ...rate.headers,
          "X-Request-Id": requestId,
          "Cache-Control": "no-store",
        },
      }
    );
  }

  let outcome = "error";
  try {
    const pdfBytes = await loadDemoPdfBuffer(entry.filename, entry.rawUrl);
    if (!pdfBytes) {
      outcome = "upstream_unavailable";
      return NextResponse.json(
        { error: "Nao foi possivel carregar o PDF de demonstracao no momento.", request_id: requestId },
        {
          status: 502,
          headers: {
            ...rate.headers,
            "X-Request-Id": requestId,
            "Cache-Control": "no-store",
          },
        }
      );
    }

    outcome = "success";
    return new NextResponse(new Uint8Array(pdfBytes), {
      status: 200,
      headers: {
        ...rate.headers,
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename="${entry.filename}"`,
        "X-Content-Type-Options": "nosniff",
        "X-Robots-Tag": "noindex, nofollow",
        "X-Demo-Only": "true",
        "X-Request-Id": requestId,
        "Cache-Control": "no-store, max-age=0",
      },
    });
  } catch {
    outcome = "upstream_error";
    return NextResponse.json(
      { error: "Falha ao obter o PDF de demonstracao.", request_id: requestId },
      {
        status: 502,
        headers: {
          ...rate.headers,
          "X-Request-Id": requestId,
          "Cache-Control": "no-store",
        },
      }
    );
  } finally {
    const latencyMs = Math.round(performance.now() - startedAt);
    metric("imobismart.demo_pdf.requests", 1, { outcome, doc: entry.codigo_doc });
    metric("imobismart.demo_pdf.latency_ms", latencyMs, { outcome });
  }
}
