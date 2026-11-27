import assert from "node:assert/strict";
import test from "node:test";

import {
  buildDemoChatResponse,
  isDemoModeEnabled,
  resolveDemoPdfEntry,
} from "../src/lib/demo-rag.ts";
import {
  assertSameOrigin,
  enforceRateLimit,
  readBoundedJsonBody,
} from "../src/lib/security.ts";
import { formatForWhatsApp } from "../src/lib/whatsapp-formatter.ts";

function makeReq({ headers = {}, body = "" } = {}) {
  const map = new Map(
    Object.entries(headers).map(([k, v]) => [k.toLowerCase(), String(v)])
  );
  return {
    headers: {
      get(name) {
        return map.get(name.toLowerCase()) ?? null;
      },
    },
    async text() {
      return body;
    },
  };
}

test("assertSameOrigin blocks cross-site Sec-Fetch-Site and untrusted Origin", () => {
  const prevOrigins = process.env.ALLOWED_ORIGINS;
  process.env.ALLOWED_ORIGINS = "https://imobismart.vercel.app";
  try {
    const crossSite = assertSameOrigin(
      makeReq({
        headers: {
          "sec-fetch-site": "cross-site",
          origin: "https://imobismart.vercel.app",
        },
      })
    );
    assert.equal(crossSite.ok, false);

    const evilOrigin = assertSameOrigin(
      makeReq({
        headers: {
          "sec-fetch-site": "same-origin",
          origin: "https://evil.example",
          host: "imobismart.vercel.app",
        },
      })
    );
    assert.equal(evilOrigin.ok, false);

    const validOrigin = assertSameOrigin(
      makeReq({
        headers: {
          "sec-fetch-site": "same-origin",
          origin: "https://imobismart.vercel.app",
          host: "imobismart.vercel.app",
        },
      })
    );
    assert.equal(validOrigin.ok, true);
  } finally {
    if (prevOrigins === undefined) delete process.env.ALLOWED_ORIGINS;
    else process.env.ALLOWED_ORIGINS = prevOrigins;
  }
});

test("enforceRateLimit blocks requests above configured threshold with Retry-After", () => {
  const prevMax = process.env.RATE_LIMIT_MAX_REQUESTS;
  const prevWin = process.env.RATE_LIMIT_WINDOW_SECONDS;
  process.env.RATE_LIMIT_MAX_REQUESTS = "2";
  process.env.RATE_LIMIT_WINDOW_SECONDS = "60";
  try {
    const req = makeReq({ headers: { "x-forwarded-for": "198.51.100.42" } });
    const r1 = enforceRateLimit(req, "test-scope");
    const r2 = enforceRateLimit(req, "test-scope");
    const r3 = enforceRateLimit(req, "test-scope");

    assert.equal(r1.allowed, true);
    assert.equal(r2.allowed, true);
    assert.equal(r3.allowed, false);
    assert.equal(r3.remaining, 0);
    assert.ok(Number(r3.headers["Retry-After"]) >= 1);
  } finally {
    if (prevMax === undefined) delete process.env.RATE_LIMIT_MAX_REQUESTS;
    else process.env.RATE_LIMIT_MAX_REQUESTS = prevMax;
    if (prevWin === undefined) delete process.env.RATE_LIMIT_WINDOW_SECONDS;
    else process.env.RATE_LIMIT_WINDOW_SECONDS = prevWin;
  }
});

test("readBoundedJsonBody enforces Content-Type 415, max 4KB 413, and valid JSON 400", async () => {
  const wrongType = await readBoundedJsonBody(
    makeReq({ headers: { "content-type": "text/plain" }, body: "hello" })
  );
  assert.equal(wrongType.ok, false);
  if (!wrongType.ok) assert.equal(wrongType.status, 415);

  const hugeBody = JSON.stringify({ prompt: "x".repeat(5000) });
  const oversized = await readBoundedJsonBody(
    makeReq({
      headers: {
        "content-type": "application/json",
        "content-length": String(Buffer.byteLength(hugeBody)),
      },
      body: hugeBody,
    }),
    4096
  );
  assert.equal(oversized.ok, false);
  if (!oversized.ok) assert.equal(oversized.status, 413);

  const malformed = await readBoundedJsonBody(
    makeReq({ headers: { "content-type": "application/json" }, body: "{bad json" })
  );
  assert.equal(malformed.ok, false);
  if (!malformed.ok) assert.equal(malformed.status, 400);

  const valid = await readBoundedJsonBody(
    makeReq({
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ prompt: "Teste OK" }),
    })
  );
  assert.equal(valid.ok, true);
});

test("buildDemoChatResponse enforces LGPD PII guardrail for CPF, email, and phone", () => {
  for (const prompt of [
    "Meu CPF é 123.456.789-00, quero financiar",
    "Envie a proposta para corretor@imobismart.example",
    "Me chama no (71) 99999-8888 sobre o Horizonte Barra",
  ]) {
    const res = buildDemoChatResponse({ prompt, persona: "corretor" }, "req-pii");
    assert.equal(res.guardrail_action, "INTERVENED");
    assert.equal(res.citations.length, 0);
    assert.equal(res.mode, "demo");
  }
});

test("buildDemoChatResponse routes portfolio comparison correctly even with 'condominio'", () => {
  const res = buildDemoChatResponse(
    {
      prompt:
        "Monte uma tabela comparando os 3 empreendimentos da ImobiSmart (preço médio por m², estágio da obra, entrega, condomínio estimado e enquadramento SFH/SFI/MCMV).",
      persona: "corretor",
    },
    "req-comp"
  );
  assert.equal(res.guardrail_action, "NONE");
  assert.match(res.answer, /Comparativo Oficial do Portfólio/);
  assert.deepEqual(
    res.citations.map((c) => [c.codigo_doc, c.pagina]),
    [
      ["IMOBI-EMP-001", 2],
      ["IMOBI-EMP-001", 3],
      ["IMOBI-COND-002", 2],
    ]
  );
});

test("buildDemoChatResponse returns verified PDF page numbers for credit and condo scenarios", () => {
  const credit = buildDemoChatResponse(
    {
      prompt: "Como funciona SAC vs Price, INCC-M na planta e ITBI em Salvador?",
      persona: "comprador",
    },
    "req-fin"
  );
  assert.deepEqual(
    credit.citations.map((c) => [c.codigo_doc, c.pagina]),
    [
      ["IMOBI-FIN-003", 2],
      ["IMOBI-FIN-003", 4],
      ["IMOBI-FIN-003", 5],
    ]
  );

  const condo = buildDemoChatResponse(
    {
      prompt: "Quais as regras de reforma ART/RRT, pets e envidraçamento de varanda?",
      persona: "corretor",
    },
    "req-cond"
  );
  assert.deepEqual(
    condo.citations.map((c) => [c.codigo_doc, c.pagina]),
    [
      ["IMOBI-COND-002", 1],
      ["IMOBI-COND-002", 2],
      ["IMOBI-COND-002", 3],
      ["IMOBI-COND-002", 4],
    ]
  );
});

test("formatForWhatsApp strips inline markers and appends official source version and page", () => {
  const formatted = formatForWhatsApp("**SFH** aceita FGTS até R$ 1,5M. [1]", [
    {
      index: 1,
      codigo_doc: "IMOBI-FIN-003",
      titulo: "Manual Técnico de Crédito",
      pagina: 1,
      dominio_kb: "credito",
      versao: "4.0",
      vigencia: "2026-11-01",
      snippet: "",
      presigned_url: null,
      s3_key: null,
    },
  ]);
  assert.ok(!formatted.includes("[1]"));
  assert.ok(formatted.includes("*SFH*"));
  assert.ok(formatted.includes("IMOBI-FIN-003 (v4.0 · Pág. 1)"));
});

test("isDemoModeEnabled defaults to false for AWS production parity", () => {
  const prev = process.env.DEMO_MODE;
  try {
    delete process.env.DEMO_MODE;
    assert.equal(isDemoModeEnabled(), false);

    process.env.DEMO_MODE = "false";
    assert.equal(isDemoModeEnabled(), false);

    process.env.DEMO_MODE = "1";
    assert.equal(isDemoModeEnabled(), false);

    process.env.DEMO_MODE = " true ";
    assert.equal(isDemoModeEnabled(), true);
  } finally {
    if (prev === undefined) delete process.env.DEMO_MODE;
    else process.env.DEMO_MODE = prev;
  }
});

test("resolveDemoPdfEntry enforces strict 3-document allowlist and blocks traversal/SSRF/prototype keys", () => {
  const emp = resolveDemoPdfEntry("IMOBI-EMP-001");
  const cond = resolveDemoPdfEntry("imobi-cond-002");
  const fin = resolveDemoPdfEntry(" IMOBI-FIN-003 ");

  assert.equal(emp?.filename, "catalogo-tecnico-empreendimentos-imobi-emp-001.pdf");
  assert.equal(cond?.filename, "convencao-condominio-regimento-imobi-cond-002.pdf");
  assert.equal(fin?.filename, "manual-credito-financiamento-imobi-fin-003.pdf");

  for (const entry of [emp, cond, fin]) {
    assert.ok(
      entry?.rawUrl.startsWith(
        "https://raw.githubusercontent.com/caiocesarti/aws-serverless-rag-reference/main/knowledge-base/documents/"
      )
    );
  }

  for (const malicious of [
    null,
    undefined,
    "",
    "../.env.local",
    "IMOBI-EMP-001/../secrets.pdf",
    "https://evil.example/payload.pdf",
    "__proto__",
    "constructor",
    "toString",
    "IMOBI-UNKNOWN-999",
  ]) {
    assert.equal(resolveDemoPdfEntry(malicious), null);
  }

  const demoRes = buildDemoChatResponse(
    { prompt: "Compare SAC vs Price", persona: "corretor" },
    "req-demo-pdf"
  );
  for (const citation of demoRes.citations) {
    assert.equal(citation.presigned_url, null);
    assert.equal(citation.demo_pdf_url, `/api/demo-pdf?doc=${citation.codigo_doc}`);
  }
});
