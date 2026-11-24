import "server-only";

import crypto from "node:crypto";
import type { NextRequest } from "next/server";

interface RateBucket {
  count: number;
  resetAt: number;
}

const rateBuckets = new Map<string, RateBucket>();

function pruneStaleBuckets(now: number): void {
  if (rateBuckets.size < 250) return;
  for (const [key, bucket] of rateBuckets.entries()) {
    if (bucket.resetAt <= now) {
      rateBuckets.delete(key);
    }
  }
}

export function getClientIp(req: NextRequest): string {
  const forwarded = req.headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  const realIp = req.headers.get("x-real-ip")?.trim();
  return realIp || "local-dev";
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetSeconds: number;
  headers: Record<string, string>;
}

export function enforceRateLimit(
  req: NextRequest,
  scope: string
): RateLimitResult {
  const limit = Math.max(
    1,
    Number.parseInt(process.env.RATE_LIMIT_MAX_REQUESTS ?? "15", 10) || 15
  );
  const windowSeconds = Math.max(
    10,
    Number.parseInt(process.env.RATE_LIMIT_WINDOW_SECONDS ?? "60", 10) || 60
  );

  const now = Date.now();
  pruneStaleBuckets(now);

  const ip = getClientIp(req);
  const bucketKey = `${scope}:${ip}`;
  const existing = rateBuckets.get(bucketKey);

  let bucket: RateBucket;
  if (!existing || existing.resetAt <= now) {
    bucket = { count: 1, resetAt: now + windowSeconds * 1000 };
    rateBuckets.set(bucketKey, bucket);
  } else {
    existing.count += 1;
    bucket = existing;
  }

  const remaining = Math.max(0, limit - bucket.count);
  const resetSeconds = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));
  const allowed = bucket.count <= limit;

  const headers: Record<string, string> = {
    "X-RateLimit-Limit": String(limit),
    "X-RateLimit-Remaining": String(remaining),
    "X-RateLimit-Reset": String(Math.ceil(bucket.resetAt / 1000)),
  };
  if (!allowed) {
    headers["Retry-After"] = String(resetSeconds);
  }

  return { allowed, limit, remaining, resetSeconds, headers };
}

export function assertSameOrigin(req: NextRequest): { ok: true } | { ok: false; reason: string } {
  const secFetchSite = req.headers.get("sec-fetch-site")?.toLowerCase();
  if (secFetchSite && secFetchSite !== "same-origin" && secFetchSite !== "none") {
    return { ok: false, reason: "Requisicao cross-site bloqueada pela politica BFF." };
  }

  const origin = req.headers.get("origin")?.trim().replace(/\/+$/, "");
  if (!origin) {
    // Allow non-browser health/smoke tests in dev only; require Origin on POST in prod
    if (process.env.NODE_ENV === "production") {
      return { ok: false, reason: "Cabecalho Origin obrigatorio." };
    }
    return { ok: true };
  }

  const allowedSet = new Set<string>();
  const envOrigins = process.env.ALLOWED_ORIGINS ?? "";
  for (const item of envOrigins.split(",")) {
    const clean = item.trim().replace(/\/+$/, "");
    if (clean) allowedSet.add(clean);
  }

  // Always trust exact current deployment host (Vercel preview/prod or localhost)
  const host = req.headers.get("x-forwarded-host") || req.headers.get("host");
  const proto = req.headers.get("x-forwarded-proto") || (process.env.NODE_ENV === "production" ? "https" : "http");
  if (host) {
    allowedSet.add(`${proto}://${host}`.replace(/\/+$/, ""));
  }
  if (process.env.VERCEL_URL) {
    allowedSet.add(`https://${process.env.VERCEL_URL}`.replace(/\/+$/, ""));
  }
  if (process.env.NODE_ENV !== "production") {
    allowedSet.add("http://localhost:3000");
    allowedSet.add("http://127.0.0.1:3000");
  }

  if (!allowedSet.has(origin)) {
    return { ok: false, reason: "Origem nao autorizada pela politica CORS/BFF." };
  }

  return { ok: true };
}

export async function readBoundedJsonBody(
  req: NextRequest,
  maxBytes = 4096
): Promise<{ ok: true; data: unknown } | { ok: false; status: number; error: string }> {
  const contentType = req.headers.get("content-type")?.toLowerCase() ?? "";
  if (!contentType.includes("application/json")) {
    return { ok: false, status: 415, error: "Content-Type deve ser application/json." };
  }

  const declaredLen = Number.parseInt(req.headers.get("content-length") ?? "0", 10);
  if (Number.isFinite(declaredLen) && declaredLen > maxBytes) {
    return { ok: false, status: 413, error: "Payload excede o limite de seguranca." };
  }

  const raw = await req.text();
  if (Buffer.byteLength(raw, "utf8") > maxBytes) {
    return { ok: false, status: 413, error: "Payload excede o limite de seguranca." };
  }

  try {
    return { ok: true, data: JSON.parse(raw) };
  } catch {
    return { ok: false, status: 400, error: "JSON invalido no corpo da requisicao." };
  }
}

export function getAwsBackendConfig(): { apiBaseUrl: string; apiKey: string } {
  const apiBaseUrl = (process.env.AWS_API_BASE_URL ?? "").trim().replace(/\/+$/, "");
  const apiKey = (process.env.AWS_API_KEY ?? "").trim();
  if (!apiBaseUrl || !apiKey) {
    throw new Error("Variaveis server-side AWS_API_BASE_URL ou AWS_API_KEY nao configuradas.");
  }
  return { apiBaseUrl, apiKey };
}

export function createRequestId(): string {
  return crypto.randomUUID();
}
