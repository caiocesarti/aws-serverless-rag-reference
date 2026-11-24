---
name: imobismart-security-audit
description: Performs a structured DevSecOps, OWASP, IAM Least Privilege, and LGPD audit across the ImobiSmart AI monorepo (Next.js Security Headers, BFF Origin/CSRF/rate-limit, Lambda S3 pre-signer, CloudFormation IAM, and secret hygiene). Use when auditing security posture, before opening a PR/release, or after modifying auth, headers, BFF, or IAM.
---

# Runbook de Auditoria DevSecOps — ImobiSmart AI

Use este runbook para auditar a postura de segurança e conformidade LGPD do monorepo antes de PRs, releases ou alterações em rotas BFF, headers HTTP, S3 ou IAM.

## Checklist de 6 Camadas

### 1. Higiene de Segredos & Git
- Conferir `git status --short` e `git diff` garantindo ausência de `.env`, `.env.local`, chaves de API (`x-api-key`, Pinecone), tokens SSO, AWS Account IDs, Knowledge Base IDs ou Guardrail IDs reais.
- Verificar que nenhuma variável em `apps/web/` contendo URL da AWS ou segredo usa prefixo `NEXT_PUBLIC_`.

### 2. Security Headers & CSP (`apps/web/next.config.ts`)
- Confirmar presença e integridade de:
  - `Content-Security-Policy` (`default-src 'self'`, `connect-src 'self'`, `frame-ancestors 'none'`, `object-src 'none'`, `frame-src` restrito a S3 HTTPS, `img-src 'self' data: blob:` com fotos self-hosted em `public/images/properties/`).
  - `Strict-Transport-Security` (com `includeSubDomains; preload`).
  - `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy`, `Cross-Origin-Opener-Policy`, `Cross-Origin-Resource-Policy`.
  - `Permissions-Policy` sem diretivas depreciadas (não incluir `browsing-topics`).
  - `poweredByHeader: false`.

### 3. Hardening do BFF (`apps/web/src/lib/security.ts` e `apps/web/src/app/api/*`)
- Validar que `POST /api/chat` e `POST /api/feedback` aplicam:
  - Checagem de `Origin` contra `ALLOWED_ORIGINS` e `Sec-Fetch-Site` (anti-CSRF, `403`).
  - Exigência de `Content-Type: application/json` (`415`) e limite de corpo ≤ 4 KB (`413`).
  - Rate limiting por IP (`429`, padrão `15 req / 60s`).
  - Validação de schema com `zod` e encaminhamento server-side de `x-api-key` sem vazar stack traces ao cliente.

### 4. Backend Lambda & Proteção S3 (`backend/src/`)
- Conferir em `backend/src/schemas/chat.py` a validação estrita de prompt (≤ 1.000 chars), `mode` e filtros permitidos.
- Conferir em `backend/src/services/s3_presigner.py` o bloqueio contra *path traversal* (`..`, bucket incorreto ou chave fora de `documents/`) e expiração curta (`600s`, SigV4).
- Confirmar ausência de `print()` com payloads brutos ou PII nos logs JSON (`ADR-004`).

### 5. IAM Menor Privilégio & IaC (`infra/template.yaml`)
- Verificar `ADR-004`: zero `Action: "*"` e zero CORS `*`.
- Confirmar que somente `bedrock:RetrieveAndGenerate` e `bedrock:Rerank` usam `Resource: "*"` (com `Condition` obrigatória `aws:RequestedRegion`), enquanto `bedrock:Retrieve`, `InvokeModel`, `ApplyGuardrail`, `s3:GetObject` (`documents/*` com `aws:ResourceAccount`), `dynamodb:*` e `logs:*` permanecem travados em ARNs exatos.
- Verificar SSE habilitado no DynamoDB (`SSEEnabled: true`), TTL `30d`, retenção `30d` no CloudWatch Logs e `ApiKeyRequired: true` em `/v1/chat` e `/v1/feedback`.

### 6. Proteção LGPD & Guardrails
- Confirmar que `backend/src/services/bedrock_rag.py` mantém `guardrailConfiguration` ativo e trata `GUARDRAIL_INTERVENED` sem expor dados sensíveis.

## Formato do Relatório
Apresentar os achados ordenados por severidade (**Crítico**, **Alto**, **Médio**, **Baixo**) com arquivo, linha e remediação objetiva, ou declarar explicitamente **Aprovado sem pendências críticas/altas** listando os checks verificados.
