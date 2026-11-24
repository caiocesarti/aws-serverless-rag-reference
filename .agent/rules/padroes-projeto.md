---
trigger: always_on
---

# Padrões Oficiais do Projeto — ImobiSmart AI

Este documento define as convenções obrigatórias de arquitetura, stack, segurança, FinOps e verificação do repositório **ImobiSmart AI** (monorepo Serverless RAG na AWS + Next.js BFF na Vercel).

---

## 1. Stack Identificada e Versões Principais

### Frontend & BFF (`apps/web/`)
- **Runtime:** Node.js `22.x` (`npm 10.9.x`)
- **Framework:** Next.js `15.5.x` (App Router) + React `19.3.x`
- **Linguagem:** TypeScript `5.9.x` (`strict: true`, `noUncheckedIndexedAccess: true`)
- **Estilização & UI:** Tailwind CSS `4.3.x` (`@tailwindcss/postcss`), `lucide-react 0.511.x`, `react-markdown 10.1.x`, `remark-gfm 4.0.x`
- **Validação & Observabilidade:** `zod 3.25.x`, `@vercel/functions 3.11.x` (`metric()`)
- **Hospedagem:** Vercel (Serverless BFF + Edge/Static Assets)

### Backend Serverless (`backend/` & `infra/`)
- **Runtime Produção:** AWS Lambda `Python 3.12` (`arm64` Graviton, `512 MB`, timeout `60s`)
- **Ambiente Local:** Virtualenv Python (`.\venv\Scripts\python.exe` — Python `3.13.x` no Windows)
- **SDK & Testes:** `boto3` (fornecido no runtime Lambda) e `unittest` (biblioteca padrão)
- **Camada de IA (Amazon Bedrock — `us-east-1`):**
  - Geração: Amazon Nova Pro (`us.amazon.nova-pro-v1:0`)
  - Embeddings: Amazon Titan Text Embeddings v2 (`1024d`, `cosine`)
  - Reranking: Cohere Rerank 3.5 (`cohere.rerank-v3-5:0`)
  - Guardrails: Amazon Bedrock Guardrail Standard (`us.guardrail.v1:0`, PT-BR, PII Block + Contextual Grounding `0.70`)
- **Dados & Infraestrutura como Código:**
  - Vector Store: Pinecone Serverless (índice denso clássico `1024d`, API key no AWS Secrets Manager)
  - Storage: Amazon S3 privado (Block Public Access, Versionamento, SSE-S3 AES256, `DenyInsecureTransport`)
  - Persistência de Sessão/Feedback: Amazon DynamoDB On-Demand + SSE + TTL `30 dias`
  - API & Throttling: Amazon API Gateway REST + Usage Plan (`5 req/s`, `Burst 10`, quota mensal, `x-api-key`)
  - IaC & CI/CD: AWS CloudFormation (`infra/template.yaml`, `infra/deploy.ps1`) + GitHub Actions DevSecOps com OIDC

---

## 2. Arquitetura, Organização de Pastas e Nomenclatura

### Estrutura Canônica do Monorepo
- `apps/web/`: Aplicação Next.js 15 + BFF Route Handlers (`src/app/api/*`), componentes UI (`src/components/*`) e utilitários/segurança (`src/lib/*`). Imagens de imóveis ficam self-hosted em `apps/web/public/images/properties/`.
- `backend/src/`: Código Python modular empacotado para AWS Lambda:
  - `handlers/`: Roteamento HTTP e serialização de respostas (`chat.py`).
  - `schemas/`: Validação estrita de payloads de entrada (`chat.py`).
  - `services/`: Integrações isoladas (`bedrock_rag.py`, `s3_presigner.py`, `session_store.py`).
  - `config.py`: Carregamento centralizado de variáveis de ambiente (zero valores hardcoded).
- `backend/tests/`: Testes unitários `unittest` com mocks (sem chamadas externas à AWS).
- `infra/`: Template CloudFormation (`template.yaml`) e script de deploy (`deploy.ps1`).
- `knowledge-base/`: Documentos PDF oficiais (`documents/*.pdf`), sidecars `.metadata.json` e script `scripts/sync_kb.ps1`.
- `docs/`: Architecture Decision Records (`architecture/adr/ADR-001` a `ADR-007`) e avaliação (`evaluation/golden_dataset.json`, `run_eval.py`).
- `.agent/`: Regras (`rules/`), workflows `/` (`workflows/`) e runbooks especializados (`skills/`).
- `.github/workflows/`: Pipelines de CI DevSecOps (`ci.yml`) e deploy OIDC (`deploy-aws.yml`).

### Convenções Obrigatórias
- **Padrão BFF (`ADR-003`):** O navegador comunica-se exclusivamente via same-origin com `/api/health`, `/api/chat` e `/api/feedback`. O cliente nunca chama diretamente o API Gateway da AWS.
- **Serverless-First (`ADR-007`):** Manter empacotamento Lambda Zip (`arm64`) e deploy Vercel sem adicionar containers Docker em produção.
- **Nomenclatura:**
  - Python: `snake_case` para arquivos, funções e variáveis; `PascalCase` para classes; `UPPER_SNAKE_CASE` para constantes e variáveis de ambiente.
  - TypeScript/React: `PascalCase` para componentes `.tsx`; `camelCase` ou `kebab-case` para utilitários em `src/lib/`.
  - Slugs de empreendimentos e arquivos da KB: ASCII minúsculo em `kebab-case` sem acentos nem espaços.
- **Metadados da Knowledge Base (`ADR-005`):** Arquivos `.metadata.json` devem conter apenas atributos **escalares planos** (`string`, `number`, `boolean`). **Nunca** usar arrays JSON em `.metadata.json`, pois o conector Bedrock + Pinecone Serverless rejeita listas na ingestão.
- **Métricas & Logs:** No BFF Next.js, manter métricas `@vercel/functions` (`metric()`). Na Lambda, emitir exclusivamente logs JSON estruturados sem PII.
- **Shell no Windows:** O ambiente local utiliza Windows PowerShell 5.1; não usar `&&` em comandos PowerShell (encadear comandos verificando `$LASTEXITCODE` ou em instruções separadas).

---

## 3. Segurança, LGPD e FinOps (Obrigatório)

1. **Zero Segredos ou IDs Reais no Código:** Nunca hardcodear nem commitar `AWS_API_KEY`, chaves Pinecone, credenciais AWS, AWS Account IDs, Knowledge Base IDs ou Guardrail IDs em código-fonte, testes ou documentação. Usar placeholders em `.env.example` e variáveis de ambiente/GitHub Secrets em runtime.
2. **Proteção de Arquivos Sensíveis:** Respeitar rigorosamente `.gitignore` — nunca adicionar, expor ou imprimir o conteúdo real de `.env`, `.env.local`, `.env.*.local`, `*.pem` ou `*.key`. Nunca prefixar URLs da AWS ou chaves de API com `NEXT_PUBLIC_`.
3. **Validação Estrita de Entradas:** Todo payload deve ser validado nas duas bordas: `zod` + limites de tamanho/tipo (`Content-Type: application/json`, payload ≤ 4 KB) no BFF (`apps/web/src/lib/security.ts`) e `backend/src/schemas/chat.py` na Lambda (prompt ≤ 1.000 caracteres).
4. **Hardening Web & CORS:** Nunca relaxar os Security Headers em `apps/web/next.config.ts` (`CSP`, `HSTS`, `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`, `COOP`/`CORP`), nunca configurar CORS com `*` (`ADR-003`) e preservar a verificação de `Origin`/`Sec-Fetch-Site` e rate limit no BFF.
5. **IAM Menor Privilégio (`ADR-004`) e S3 Seguro:** Nunca usar `Action: "*"` ou permissões amplas em `infra/template.yaml`; preservar trava contra *path traversal* em `backend/src/services/s3_presigner.py` e expiração curta (`600s`) nas Pre-signed URLs.
6. **Zero PII em Logs e Telemetria:** Nunca registrar CPF, telefone, e-mail, headers de autorização ou textos completos de usuários contendo dados sensíveis no CloudWatch Logs ou DynamoDB.
7. **Guarda-Corpo FinOps (`ADR-001` / `ADR-002`):** Não executar scripts que disparem chamadas em massa ou pagas ao Amazon Bedrock (como `docs/evaluation/run_eval.py` ou `start-ingestion-job`) sem confirmação explícita do usuário. Para verificações de conectividade, preferir `GET /v1/health` (custo zero).

---

## 4. Verificação Obrigatória Antes de Concluir Qualquer Tarefa

Nenhuma alteração de código ou infraestrutura pode ser dada como concluída sem executar as verificações reais aplicáveis à camada modificada:

- **Alterações em `backend/`:**
  ```powershell
  .\venv\Scripts\python.exe -m compileall -q backend/src backend/tests
  .\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
  ```
- **Alterações em `apps/web/`:**
  ```powershell
  npm --prefix apps/web run typecheck
  npm --prefix apps/web run build
  ```
  > *Nota sobre linter no frontend:* `eslint` / `eslint-config-next` ainda não estão instalados em `apps/web/package.json`. Não executar `npm --prefix apps/web run lint` enquanto não houver configuração ESLint ativa (o comando aciona prompt interativo).
- **Alterações em `infra/template.yaml`:**
  Validar o template CloudFormation (quando houver sessão AWS SSO ativa no perfil `imobismart`):
  ```powershell
  aws cloudformation validate-template --template-body file://infra/template.yaml --region us-east-1 --profile imobismart
  ```
- **Checagem Final de Higiene:** Conferir `git status --short` garantindo que nenhum arquivo sensível (`.env.local`, `*.zip`, `venv/`, `node_modules/`) esteja sendo rastreado e que nenhum teste válido tenha sido pulado ou mascarado.
