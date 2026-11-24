# 🏢 ImobiSmart AI — Central de Inteligência Imobiliária (AWS Well-Architected RAG)

![AWS Well-Architected](https://img.shields.io/badge/AWS-Well--Architected-FF9900?style=flat-square&logo=amazonaws&logoColor=white)
![Amazon Bedrock](https://img.shields.io/badge/Amazon_Bedrock-Nova_Pro_+_Cohere_Rerank_3.5-01A88D?style=flat-square)
![Pinecone Serverless](https://img.shields.io/badge/Pinecone-Serverless_1024d-4F46E5?style=flat-square)
![Next.js](https://img.shields.io/badge/Next.js-15.5_+_React_19-0F172A?style=flat-square&logo=nextdotjs&logoColor=white)
![Python](https://img.shields.io/badge/AWS_Lambda-Python_3.12_ARM64-ED7100?style=flat-square&logo=python&logoColor=white)
![DevSecOps](https://img.shields.io/badge/DevSecOps-OIDC_+_Zero_Wildcard_IAM-DD344C?style=flat-square)
![License](https://img.shields.io/badge/License-MIT-16A34A?style=flat-square)

> **Copiloto técnico-comercial RAG pronto para produção** para consulta auditável de empreendimentos, memoriais descritivos, convenção condominial e financiamento habitacional — arquitetado sob os **6 Pilares do AWS Well-Architected Framework**, com **citações determinísticas por documento e página (`#page=N`)**, **DevSecOps / IAM Menor Privilégio Rígido**, **FinOps (>97% de economia vs. OpenSearch Serverless)** e **Frontend PropTech em Next.js 15 + BFF Seguro (Security Headers Nota A+)**.

**Navegação rápida:** [Visão Geral](#-1-visão-geral--funcionalidades) · [Arquitetura AWS (PNG)](#-2-arquitetura-aws-well-architected) · [Fluxos & Sequências](#-3-diagramas-de-fluxo-rag-segurança--cicd) · [6 Pilares & FinOps](#-4-aws-well-architected-framework--finops) · [ADRs](#-5-registro-de-decisões-de-arquitetura-adrs) · [Evidências QA (.mp4)](#-6-evidências-de-qa-em-produção-mp4--screenshots) · [Stack & Monorepo](#-7-stack-verificada--estrutura-do-monorepo) · [Replicar do Zero](#-8-passo-a-passo-para-replicar-o-projeto) · [Como Testar](#-9-guia-de-testes-e-verificação)

---

## 🎯 1. Visão Geral & Funcionalidades

Corretores e compradores frequentemente cruzam informações dispersas em três documentos técnicos distintos (catálogo de plantas, convenção de condomínio e manual de crédito bancário). O **ImobiSmart AI** resolve esse gargalo com **RAG ancorado multi-documento** e rastreabilidade jurídica ponta a ponta:

- **Consultas Multi-Documento com Reranking:** Amazon Bedrock Knowledge Base (*FM Parsing* com Nova Pro + *Hierarchical Chunking* `1500/300/60` + *Query Decomposition*) sobre Pinecone Serverless (`1024d`, *cosine*) com **Cohere Rerank 3.5** (`top 12 → 6`) e geração via **Amazon Nova Pro** (`temperature: 0.1`).
- **Citações Exatas com Documento, Página e Deep-Link `#page=N`:** extração determinística de `x-amz-bedrock-kb-document-page-number`, badges inline `[1 · p.N]`, cards de fontes oficiais com título/arquivo `.pdf` e inspetor lateral (`CitationDrawer`) abrindo o PDF do S3 privado direto na página citada via **Pre-signed URL SigV4 (10 min)**.
- **Proteção LGPD & Anti-Alucinação:** Amazon Bedrock Guardrail (`Standard`, PT-BR) bloqueando PII (`CPF_BR`, `EMAIL`, `PHONE`) e validando *Contextual Grounding* (`≥ 0.70`).
- **Portfólio Fotográfico & Simulador SAC vs. Tabela Price:** 3 empreendimentos reais em Salvador/BA (*Residencial Horizonte Barra*, *Parque das Palmeiras Residence*, *Smart Studio Metrópole*) com enquadramento automático **SFH/FGTS vs. SFI**, desconto de 50% no 1º RGI (Lei 6.015/73), ITBI (3%), alerta de LTV > 70% na Price e regra etária bancária (`idade + prazo ≤ 80 anos e 6 meses`).
- **Produtividade do Corretor & FinOps Standby:** filtros por persona (`Corretor`/`Comprador`) e domínio Pinecone, exportação formatada para **WhatsApp** (com fontes/páginas), feedback 👍/👎 no DynamoDB e modo opcional **`DEMO_MODE=true`** para manter o site na Vercel a **US\$ 0,00/mês** quando a AWS estiver em standby.

---

## 🏛️ 2. Arquitetura AWS Well-Architected

![Arquitetura Serverless RAG AWS Well-Architected — ImobiSmart AI](docs/architecture/diagrams/aws-well-architected-architecture.png)

<details>
<summary>Ver versão em texto (Mermaid) da arquitetura</summary>

```mermaid
flowchart LR
    subgraph Vercel["▲ Edge & Frontend (Vercel · Next.js 15)"]
        UI["ImobiSmart Workspace\nReact 19 · Tailwind v4 · Dark Mode\nGaleria + Simulador SAC/Price\nCitation PDF Drawer (#page=N)"]
        BFF["BFF Route Handlers\n/api/chat · /api/feedback · /api/health\nZod + Origin/CSRF + Rate Limit (15/min)\nx-api-key Server-Only + DEMO_MODE opcional"]
        UI <-->|"Same-Origin HTTPS"| BFF
    end

    subgraph AWS_API["⚙️ Perímetro FinOps & Compute (AWS us-east-1 · Sem WAF)"]
        APIGW["Amazon API Gateway REST\nUsage Plan (5 req/s · Burst 10 · 1k/mês)\nx-api-key Obrigatória · Zero CORS *"]
        Lambda["AWS Lambda (Python 3.12 · ARM64)\nImobiSmartChatLambdaRole (13 KB Zip)\nPage Extractor + S3 Pre-signer + Logs JSON"]
        DDB[("Amazon DynamoDB\nOn-Demand + SSE + TTL 30d\nSessões & Feedback 👍/👎")]
    end

    subgraph AWS_AI["🧠 Amazon Bedrock"]
        Guard["Bedrock Guardrail (Standard PT-BR)\nLGPD PII (CPF/Email/Tel)\n+ Contextual Grounding 0.70"]
        KB["Bedrock Knowledge Base\nFM Parsing (Nova Pro) + Hierarchical\nQuery Decomposition + Cohere Rerank 3.5"]
        LLM["Amazon Nova Pro\nus.amazon.nova-pro-v1:0"]
    end

    subgraph Vector["🌲 Vector Store FinOps"]
        Pinecone[("Pinecone Serverless\nAWS us-east-1 · 1024d · cosine\nStarter Free Tier ($0/mês)")]
        Secrets["AWS Secrets Manager\nimobismart/pinecone/api-key"]
        Secrets -.-> KB
    end

    subgraph DataObs["📁 Dados Privados & Observabilidade"]
        S3[("Amazon S3 Privado\nBlock Public Access + Versioning\nSSE-S3 + DenyInsecureTransport\ndocuments/ (3 PDFs + .metadata.json)")]
        Obs["CloudWatch Logs (30d)\n+ AWS Budgets Alert ($5/mês)"]
    end

    BFF -->|"HTTPS + x-api-key"| APIGW --> Lambda
    Lambda <--> DDB
    Lambda --> Guard --> KB
    KB <--> Pinecone
    KB <--> LLM
    Lambda -.->|"Pre-signed URL (10 min · SigV4)"| S3
    S3 -->|"Sync"| KB
    Lambda --> Obs
```

</details>

---

## 🔄 3. Diagramas de Fluxo (RAG, Segurança & CI/CD)

![Fluxos Operacionais, Defesa em 4 Camadas, Ingestão KB e CI/CD OIDC](docs/architecture/diagrams/rag-security-data-flow.png)

### 3.1 Fluxo de Sequência — Consulta RAG Segura & Abertura de PDF em `#page=N`

```mermaid
sequenceDiagram
    autonumber
    actor User as Corretor / Comprador
    participant UI as Next.js 15 UI
    participant BFF as Next.js BFF (/api/chat)
    participant APIGW as API Gateway (Usage Plan)
    participant Lambda as AWS Lambda (Python 3.12 ARM64)
    participant Bedrock as Bedrock (Guardrail + KB + Rerank + Nova Pro)
    participant S3 as Amazon S3 Privado
    participant DDB as DynamoDB (TTL 30d)

    User->>UI: Envia pergunta + filtros (persona, imóvel, domínio)
    UI->>BFF: POST /api/chat (Same-Origin HTTPS)
    Note over BFF: Camadas 1–3: Origin/CSRF (403) · Rate Limit 15/min (429) · JSON ≤ 4KB + Zod (415/413/400)
    BFF->>APIGW: POST /v1/chat + x-api-key (server-only)
    Note over APIGW: Camada 4: Usage Plan (5 req/s · Burst 10 · 1.000/mês)
    APIGW->>Lambda: AWS_PROXY Invocation
    Lambda->>Bedrock: RetrieveAndGenerate (Guardrail LGPD + Query Decomposition + Cohere Rerank 3.5)
    Bedrock-->>Lambda: Resposta Markdown + Citations + x-amz-bedrock-kb-document-page-number
    Lambda->>S3: Gera Pre-signed URL SigV4 (TTL 600s, trava anti-path-traversal em documents/*)
    Lambda--)DDB: Registra telemetria sem PII (latência, códigos citados, guardrail_action)
    Lambda-->>BFF: JSON com answer ([1]), citations (codigo_doc, titulo, arquivo, pagina, presigned_url)
    BFF-->>UI: Repassa resposta + emite métricas @vercel/functions
    UI-->>User: Exibe badges [1 · p.N] e cards de fontes oficiais
    User->>UI: Clica na citação [1 · p.N]
    UI->>S3: Carrega PDF direto no iframe via Pre-signed URL + #page=N (zero proxy)
```

### 3.2 Fluxo de Sequência — Esteira DevSecOps & Deploy Keyless (GitHub OIDC)

```mermaid
sequenceDiagram
    autonumber
    actor Dev as Engenheiro
    participant GH as GitHub Actions (ci.yml / deploy-aws.yml)
    participant OIDC as AWS IAM OIDC Provider
    participant S3 as S3 Bucket (artifacts/)
    participant CFN as AWS CloudFormation
    participant API as GET /v1/health

    Dev->>GH: Push / Pull Request em main
    par Shift-Left Security & Quality (4 jobs paralelos)
        GH->>GH: secret-scan (Gitleaks CLI)
        GH->>GH: backend-ci (Python 3.12: compileall, ruff, bandit, 11 unittest)
        GH->>GH: frontend-ci (Node 22: npm ci, typecheck, next build, npm audit)
        GH->>GH: iac-security (cfn-lint + Checkov em infra/template.yaml)
    end
    Dev->>GH: Aciona workflow_dispatch (deploy-aws.yml)
    GH->>GH: Bloqueia wildcard '*' em allowed_origins (ADR-003) + roda unittest
    GH->>OIDC: Solicita credencial temporária via JWT (id-token: write · zero chaves estáticas)
    OIDC-->>GH: Credenciais STS efêmeras (AssumeRole)
    GH->>S3: Upload do pacote Lambda Zip (~13 KB) em artifacts/
    GH->>CFN: validate-template + cloudformation deploy (CAPABILITY_NAMED_IAM)
    CFN-->>GH: Outputs da stack (ApiBaseUrl, HealthEndpoint)
    GH->>API: Smoke test GET /v1/health (HTTP 200 · custo zero Bedrock)
```

---

## 🛡️ 4. AWS Well-Architected Framework & FinOps

### 4.1 Mapeamento dos 6 Pilares

| Pilar Well-Architected | Implementação Concreta no ImobiSmart AI | Referência |
| :--- | :--- | :--- |
| **1. Excelência Operacional** | Infraestrutura 100% IaC em CloudFormation (`infra/template.yaml`), deploy automatizado via `deploy.ps1` e GitHub Actions OIDC, logs JSON estruturados sem PII, métricas `@vercel/functions`, governança `.agent/` (regras, workflows `/` e skills) e 11 testes unitários automatizados. | [ADR-004](docs/architecture/adr/ADR-004-devsecops-e-iam-menor-privilegio.md), [ADR-007](docs/architecture/adr/ADR-007-estrategia-containers-e-ci-cd.md) |
| **2. Segurança** | Duas roles IAM segregadas de menor privilégio (trust policy anti-*Confused Deputy* via `aws:SourceAccount`/`aws:SourceArn`), S3 privado (*Block Public Access*, `SSE-S3`, `DenyInsecureTransport`, Pre-signed URL 10 min com trava anti-*path traversal*), BFF sem `x-api-key` no browser, Security Headers Nota A+ (`CSP`, `HSTS`, `X-Frame-Options: DENY`), zero CORS `*` e Bedrock Guardrail LGPD. | [ADR-003](docs/architecture/adr/ADR-003-cors-restritivo-e-padrao-bff.md), [ADR-004](docs/architecture/adr/ADR-004-devsecops-e-iam-menor-privilegio.md) |
| **3. Confiabilidade** | Serviços 100% gerenciados e Multi-AZ nativos (API Gateway, Lambda, DynamoDB On-Demand, S3 Versionado, Bedrock), fallback automático de `sessionId` desconhecido no Bedrock, telemetria DynamoDB não-bloqueante e fonte canônica de 3 PDFs sem conflitos. | [ADR-005](docs/architecture/adr/ADR-005-fonte-canonica-kb-3-pdfs.md) |
| **4. Eficiência de Performance** | Lambda Python 3.12 em **ARM64 (Graviton)** com pacote enxuto de **~13 KB** (sem container pesado), Cohere Rerank 3.5 + Query Decomposition, cache de Pre-signed URL por arquivo e Next.js 15 App Router com imagens self-hosted e modal lazy-loaded (`next/dynamic`). | [ADR-006](docs/architecture/adr/ADR-006-frontend-2026-nextjs-vercel-ai-sdk.md), [ADR-007](docs/architecture/adr/ADR-007-estrategia-containers-e-ci-cd.md) |
| **5. Otimização de Custos (FinOps)** | Pinecone Serverless Starter (**US\$ 0/mês** vs. ~US\$ 350–700 do OpenSearch Serverless), defesa anti-*Denial of Wallet* em 4 camadas **sem AWS WAF**, AWS Budgets Alert (US\$ 5/mês), retenção 30d (CloudWatch/DynamoDB TTL) e `DEMO_MODE=true` na Vercel (**US\$ 0/mês** em standby). | [ADR-001](docs/architecture/adr/ADR-001-vector-store-pinecone-serverless.md), [ADR-002](docs/architecture/adr/ADR-002-rate-limiting-finops-sem-waf.md) |
| **6. Sustentabilidade** | Arquitetura 100% Serverless *scale-to-zero* (nenhuma instância EC2, NAT Gateway ou ECS Fargate ociosa 24/7) executando compute em processadores **AWS Graviton (ARM64)** de maior eficiência energética. | [ADR-007](docs/architecture/adr/ADR-007-estrategia-containers-e-ci-cd.md) |

### 4.2 FinOps — Economia Real > 97% no Custo Fixo

| Camada | Abordagem Tradicional (PoC) | Arquitetura ImobiSmart AI |
| :--- | :--- | :--- |
| **Vector Database** | OpenSearch Serverless: ~US\$ 350–700/mês | **Pinecone Serverless Starter: US\$ 0,00/mês** |
| **Proteção de Borda** | AWS WAF: ~US\$ 6–15+/mês | **API GW Usage Plan + BFF Vercel: US\$ 0,00/mês** |
| **Hospedagem Frontend** | Streamlit em EC2/App Runner: ~US\$ 15–30/mês | **Vercel Hobby (Next.js 15): US\$ 0,00/mês** |
| **Compute, Storage & IA** | Instâncias 24/7 + Pay-per-use | **Secrets Manager (US\$ 0,40) + Bedrock/Lambda `arm64`/DynamoDB sob demanda** |
| **Total Estimado (Piloto)** | **~US\$ 375 – US\$ 750 / mês** | **~US\$ 2,50 – US\$ 11,50 / mês** *(ou **US\$ 0,00/mês** em `DEMO_MODE=true`)* |

---

## 📋 5. Registro de Decisões de Arquitetura (ADRs)

Todas as decisões e trade-offs estão formalmente documentados em [docs/architecture/adr/](docs/architecture/adr/README.md):

| ADR | Decisão | Pilares Principais |
| :--- | :--- | :--- |
| [ADR-001](docs/architecture/adr/ADR-001-vector-store-pinecone-serverless.md) | Pinecone Serverless + FM Parsing + Cohere Rerank 3.5 em vez de OpenSearch Serverless | FinOps, Performance, Sustentabilidade |
| [ADR-002](docs/architecture/adr/ADR-002-rate-limiting-finops-sem-waf.md) | Rate Limiting em 4 camadas e proteção contra *Denial of Wallet* sem AWS WAF | Segurança, FinOps, Confiabilidade |
| [ADR-003](docs/architecture/adr/ADR-003-cors-restritivo-e-padrao-bff.md) | Política de CORS restritiva (zero `*`) e padrão BFF na Vercel | Segurança, Excelência Operacional |
| [ADR-004](docs/architecture/adr/ADR-004-devsecops-e-iam-menor-privilegio.md) | Práticas DevSecOps *Shift-Left* e IAM com Menor Privilégio Rígido | Segurança, Excelência Operacional |
| [ADR-005](docs/architecture/adr/ADR-005-fonte-canonica-kb-3-pdfs.md) | Fonte Canônica da Base de Conhecimento (3 PDFs oficiais + sidecars `.metadata.json` escalares) | Confiabilidade, Performance |
| [ADR-006](docs/architecture/adr/ADR-006-frontend-2026-nextjs-vercel-ai-sdk.md) | Substituição do Streamlit por Next.js 15 + React 19 + Tailwind CSS v4 | Performance, Segurança, FinOps |
| [ADR-007](docs/architecture/adr/ADR-007-estrategia-containers-e-ci-cd.md) | Estratégia Serverless-First (sem Docker) e CI/CD DevSecOps com GitHub OIDC | Excelência Operacional, Segurança, FinOps |

---

## 🎬 6. Evidências de QA em Produção (`.mp4` & Screenshots)

Todas as gravações em vídeo (`.mp4`), capturas de tela e evidências da infraestrutura AWS estão catalogadas em **[docs/evidence/README.md](docs/evidence/README.md)**:

| Preview Visual | Fluxo Validado (Chrome + AWS `us-east-1`) | Gravação `.mp4` |
| :---: | :--- | :--- |
| ![Landing Dark Mode](docs/evidence/screenshots/01-landing-portfolio-dark.png) | **Portfólio Fotográfico & Fichas Técnicas:** 3 empreendimentos, regras construtivas, badges SFH/SFI/Airbnb | [demo-01a-portfolio-empreendimentos.mp4](docs/evidence/demo-01a-portfolio-empreendimentos.mp4) |
| ![Simulador SAC vs Price](docs/evidence/screenshots/03-simulador-sac-price-sfh-idade.png) | **Simulador SAC vs. Price:** troca `SFI ↔ SFH`, entrada `20% → 30%`, regra etária `80a6m` (60a → 246m) | [demo-01b-simulador-sac-price.mp4](docs/evidence/demo-01b-simulador-sac-price.mp4) |
| ![Filtros e Light Mode](docs/evidence/screenshots/04-filtros-perfil-light.png) | **Filtros Pinecone, Persona & Tema:** `Corretor → Comprador`, `2 filtros ativos`, Dark ↔ Light Mode | [demo-01c-filtros-perfil-darkmode.mp4](docs/evidence/demo-01c-filtros-perfil-darkmode.mp4) |
| ![PDF Drawer #page=1](docs/evidence/screenshots/06-pdf-drawer-presigned-page.png) | **Chat RAG + Citações `[1 · p.1]` + PDF `#page=1`:** resposta real Bedrock + PDF inline via S3 Pre-signed URL | [demo-rag-citacoes-pagina-pdf.mp4](docs/evidence/demo-rag-citacoes-pagina-pdf.mp4) |

---

## 🗂️ 7. Stack Verificada & Estrutura do Monorepo

| Camada | Tecnologias & Versões Exatas |
| :--- | :--- |
| **Frontend & BFF (`apps/web/`)** | Next.js `15.5.29` (App Router) · React `19.3.1` · TypeScript `5.9.3` (`strict`) · Tailwind CSS `4.3.5` · Zod `3.25.76` · `@vercel/functions 3.11.3` · Node.js `22.x` |
| **Backend Serverless (`backend/`)** | AWS Lambda `Python 3.12` (`arm64` Graviton, `512 MB`, `~13 KB Zip`) · `boto3` · `unittest` (`11/11` testes) |
| **IA & Vector Store** | Amazon Bedrock (`us.amazon.nova-pro-v1:0`, `amazon.titan-embed-text-v2:0`, `cohere.rerank-v3-5:0`, Guardrail Standard `us.guardrail.v1:0`) · Pinecone Serverless (`1024d`, `cosine`) |
| **Dados, IaC & DevSecOps** | Amazon S3 privado · Amazon DynamoDB (On-Demand + TTL 30d) · API Gateway REST (Usage Plan) · AWS Secrets Manager · CloudFormation · GitHub Actions (Gitleaks, Ruff, Bandit, cfn-lint, Checkov, OIDC) |

```text
imobismart-ai/
├── .agent/                       # Governança Google Antigravity (rules, workflows /, skills)
├── .github/workflows/            # CI DevSecOps (ci.yml) + Deploy AWS OIDC (deploy-aws.yml)
├── apps/web/                     # Frontend PropTech + BFF Seguro (Next.js 15 + Tailwind v4)
│   ├── public/images/properties/ # Fotos arquitetônicas self-hosted (compatíveis com CSP 'self')
│   └── src/
│       ├── app/api/              # BFF Route Handlers (/api/chat, /api/feedback, /api/health)
│       ├── components/           # PortfolioSidebar, PropertyBriefCard, SacPriceSimulatorModal, MessageBubble, CitationDrawer
│       └── lib/                  # security.ts (Origin/CSRF/RateLimit), demo-rag.ts (FinOps Standby), portfolio.ts, whatsapp-formatter.ts
├── backend/                      # Serverless Python 3.12 (ARM64 Graviton)
│   ├── src/handlers/             # Lambda HTTP Router (/v1/health, /v1/chat, /v1/feedback)
│   ├── src/services/             # bedrock_rag.py (page extraction + dedupe), s3_presigner.py, session_store.py
│   ├── src/schemas/              # Validação estrita de contratos (prompt ≤ 1.000 chars)
│   └── tests/                    # 11 testes unitários automatizados (unittest, sem chamadas externas)
├── infra/                        # Infrastructure as Code (template.yaml + deploy.ps1)
├── knowledge-base/               # 3 PDFs oficiais (IMOBI-EMP-001, COND-002, FIN-003) + .metadata.json + sync_kb.ps1
└── docs/
    ├── architecture/
    │   ├── adr/                  # 7 ADRs formais (ADR-001 a ADR-007)
    │   └── diagrams/             # Diagramas PNG Retina (Well-Architected + Fluxos)
    ├── evaluation/               # Golden Dataset (13 casos) + run_eval.py (env-driven)
    └── evidence/                 # Evidências QA (.mp4, screenshots e prints de infra AWS)
```

---

## 🚀 8. Passo a Passo para Replicar o Projeto

### Pré-requisitos

| Ferramenta | Versão Mínima | Obrigatório para |
| :--- | :---: | :--- |
| **Git** | `2.40+` | Clonar repositório |
| **Node.js & npm** | `22.x` / `10.x` | Rodar/buildar Frontend & BFF (`apps/web/`) |
| **Python** | `3.12+` | Rodar testes unitários do backend (`backend/tests/`) |
| **AWS CLI v2** + Conta AWS / Pinecone | `2.x` | Apenas para **Opção B** (deploy real em nuvem) |

---

### Opção A — Rodar Localmente em 2 Minutos SEM Conta AWS (`DEMO_MODE=true`)

Ideal para recrutadores, avaliadores técnicos ou testes rápidos de UX/segurança com **custo US\$ 0,00**:

```bash
# 1. Clonar o repositório
git clone https://github.com/<SEU_USUARIO>/<SEU_REPOSITORIO>.git
cd <SEU_REPOSITORIO>

# 2. Instalar dependências do frontend/BFF
npm --prefix apps/web ci

# 3. Criar apps/web/.env.local em Modo Portfólio (sem credenciais AWS)
```

Crie o arquivo `apps/web/.env.local` com:

```env
DEMO_MODE=true
ALLOWED_ORIGINS=http://localhost:3000
RATE_LIMIT_MAX_REQUESTS=15
RATE_LIMIT_WINDOW_SECONDS=60
```

Inicie a aplicação e acesse **`http://localhost:3000`**:

```bash
npm --prefix apps/web run build
npm --prefix apps/web run start
```

> **O que você consegue validar imediatamente sem AWS:** galeria fotográfica, fichas técnicas dos 3 empreendimentos, **Simulador SAC vs. Price** completo, filtros Pinecone, Dark/Light Mode, chat com citações (código + página + arquivo `.pdf`), bloqueio **LGPD** (envie um CPF fictício como `123.456.789-00`), feedback 👍/👎 e proteções anti-CSRF (`403`) / Rate Limit (`429`).

---

### Opção B — Replicação Completa na AWS + Vercel (Produção Real)

#### Passo 1 — Bucket S3 Privado & Sincronização dos 3 PDFs Canônicos
1. Crie um bucket S3 privado em `us-east-1` (`Block All Public Access = ON`, `Versioning = Enabled`, criptografia `SSE-S3` e bucket policy `DenyInsecureTransport`).
2. Autentique no AWS CLI (SSO recomendado) e sincronize os 3 PDFs + sidecars `.metadata.json` escalares:
```powershell
aws sso login --profile imobismart
$env:AWS_PROFILE = "imobismart"
.\knowledge-base\scripts\sync_kb.ps1 -BucketName "<SEU_BUCKET_S3>"
```
> **Atenção (`ADR-005`):** todos os atributos em `.metadata.json` devem permanecer **escalares planos** (`string`/`number`/`boolean` — nunca arrays JSON).

#### Passo 2 — Pinecone Serverless + AWS Secrets Manager
1. Crie um índice denso clássico (**`1024` dimensões**, métrica **`cosine`**, AWS **`us-east-1`**, Starter Free Tier) no Pinecone Serverless.
2. Armazene a API key do Pinecone no **AWS Secrets Manager** (formato `{"apiKey": "<SUA_CHAVE_PINECONE>"}`).

#### Passo 3 — Amazon Bedrock Knowledge Base & Guardrail (`us-east-1`)
1. Crie a IAM Role `ImobiSmartBedrockKBRole` seguindo o menor privilégio e a trust policy anti-*Confused Deputy* descritos na [ADR-004](docs/architecture/adr/ADR-004-devsecops-e-iam-menor-privilegio.md).
2. Crie a **Bedrock Knowledge Base** conectada ao prefixo `documents/` do S3 e ao índice Pinecone, configurando:
   - **Parsing:** Foundation Model Parsing (`Amazon Nova Pro`)
   - **Chunking:** Hierarchical (`parent: 1500`, `child: 300`, `overlap: 60`)
   - **Embeddings:** `Amazon Titan Text Embeddings v2` (`1024d`)
3. Execute o primeiro *Sync* (Ingestion Job) e confirme `0 failed documents`.
4. Crie o **Amazon Bedrock Guardrail** no tier **Standard** (suporte a PT-BR) com filtros de PII (`CPF_BR`, `EMAIL`, `PHONE`) e *Contextual Grounding* (`0.70`).
5. *(FinOps)* Configure um alerta no **AWS Budgets** (ex.: US\$ 5,00/mês).

#### Passo 4 — Deploy da Infraestrutura Serverless (CloudFormation)
Execute o script oficial [infra/deploy.ps1](infra/deploy.ps1), que roda os **11 testes unitários**, empacota `backend/src`, envia o `.zip` para `artifacts/`, valida `infra/template.yaml` e faz o deploy da stack:

```powershell
.\infra\deploy.ps1 `
  -Profile "imobismart" `
  -Region "us-east-1" `
  -StackName "imobismart-ai-prod" `
  -EnvironmentName "prod" `
  -DocsBucketName "<SEU_BUCKET_S3>" `
  -KnowledgeBaseId "<SEU_KB_ID>" `
  -GuardrailId "<SEU_GUARDRAIL_ID>" `
  -GuardrailVersion "DRAFT" `
  -AllowedOrigins "http://localhost:3000"
```

Recupere o valor da `x-api-key` gerada pelo Usage Plan usando o `ApiKeyId` exibido nos outputs da stack (nunca commite este valor):
```powershell
aws apigateway get-api-key --api-key "<API_KEY_ID>" --include-value --region us-east-1 --profile imobismart --query "value" --output text
```

#### Passo 5 — Conectar Frontend Local ou Publicar na Vercel
- **Local (`apps/web/.env.local`):** copie [.env.example](.env.example), preencha `AWS_API_BASE_URL`, `AWS_API_KEY`, `ALLOWED_ORIGINS=http://localhost:3000` e `DEMO_MODE=false`, depois rode `npm --prefix apps/web run build` e `npm --prefix apps/web run start`.
- **Produção na Vercel:**
  1. Importe o repositório na **Vercel** com **Root Directory** = `apps/web`.
  2. Configure as variáveis **server-side** (nunca use `NEXT_PUBLIC_`): `AWS_API_BASE_URL`, `AWS_API_KEY`, `ALLOWED_ORIGINS=https://<seu-dominio>.vercel.app`, `RATE_LIMIT_MAX_REQUESTS=15`, `RATE_LIMIT_WINDOW_SECONDS=60`.
  3. Atualize o parâmetro `AllowedOrigins` na stack AWS executando `.\infra\deploy.ps1 ... -AllowedOrigins "https://<seu-dominio>.vercel.app"`.
- **Standby FinOps Pós-Demo (US\$ 0/mês):** se remover a stack na AWS após demonstrações, basta remover `AWS_API_BASE_URL` e `AWS_API_KEY` na Vercel, definir `DEMO_MODE=true` e fazer redeploy.

#### Passo 6 *(Opcional)* — Habilitar Deploy Contínuo via GitHub OIDC
Para executar [.github/workflows/deploy-aws.yml](.github/workflows/deploy-aws.yml) sem chaves estáticas:
1. Configure um OIDC Identity Provider (`token.actions.githubusercontent.com`) na AWS e crie uma IAM Role restrita ao seu repositório/branch `main`.
2. No GitHub (*Settings → Environments → `prod`*): adicione o secret `AWS_DEPLOY_ROLE_ARN` e as variáveis `DOCS_BUCKET_NAME`, `KNOWLEDGE_BASE_ID` e `GUARDRAIL_ID`.

---

## 🧪 9. Guia de Testes e Verificação

### 9.1 Testes Unitários do Backend (11/11 PASS · Custo Zero AWS)
Cobre validação de schemas, trava anti-*path traversal* no S3 Pre-signer, filtros Pinecone, CORS restritivo, preservação de palavras acentuadas em citações, extração de página exata (`pagina`/`arquivo`) e cache de Pre-signed URL:

```powershell
# Criar virtualenv (primeira vez) e instalar boto3 para mocks locais
python -m venv venv
.\venv\Scripts\pip.exe install boto3

# Compilação + suíte unitária completa
.\venv\Scripts\python.exe -m compileall -q backend/src backend/tests
.\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```

### 9.2 Type-check, Build de Produção & Auditoria de Dependências (Frontend)
```powershell
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
npm --prefix apps/web audit --audit-level=high
```

### 9.3 Validação de IaC (CloudFormation)
```powershell
aws cloudformation validate-template --template-body file://infra/template.yaml --region us-east-1 --profile imobismart
```

### 9.4 Smoke Tests de API & Hardening de Segurança (Localhost ou Vercel)
Com o servidor rodando em `http://localhost:3000`:

```powershell
# 1) Healthcheck (HTTP 200 — "ok" na AWS ou "demo" em DEMO_MODE=true; custo zero Bedrock)
Invoke-RestMethod -Uri "http://localhost:3000/api/health" -Method Get

# 2) Proteção Anti-CSRF / Origin inválida (esperado: HTTP 403)
try {
  Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method Post `
    -Headers @{ "Origin" = "https://evil.example"; "Content-Type" = "application/json" } `
    -Body '{"prompt":"Teste bloqueio CSRF","persona":"corretor"}'
} catch { Write-Host "Bloqueio CSRF confirmado:" $_.Exception.Response.StatusCode.value__ }

# 3) Proteção Content-Type inválido (esperado: HTTP 415)
try {
  Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method Post `
    -Headers @{ "Origin" = "http://localhost:3000"; "Content-Type" = "text/plain" } `
    -Body "texto puro"
} catch { Write-Host "Bloqueio Content-Type confirmado:" $_.Exception.Response.StatusCode.value__ }

# 4) Consulta multi-documento com citação de documento + página (esperado: HTTP 200)
$chat = Invoke-RestMethod -Uri "http://localhost:3000/api/chat" -Method Post `
  -Headers @{ "Origin" = "http://localhost:3000"; "Content-Type" = "application/json" } `
  -Body '{"prompt":"Posso usar FGTS no Parque das Palmeiras e fazer Airbnb no Smart Studio?","persona":"corretor"}'
$chat.citations | Select-Object index, codigo_doc, pagina, titulo, arquivo | Format-Table -AutoSize
```

### 9.5 Avaliação Automatizada de Qualidade RAG (Golden Dataset — 13 Casos)
> ⚠️ **Aviso FinOps:** executa 13 consultas reais ao Amazon Bedrock (com intervalo de 6s entre chamadas para evitar *throttling*). Execute somente com a stack AWS ativa e credenciais definidas via ambiente:

```powershell
$env:AWS_API_BASE_URL = "https://<SEU_API_ID>.execute-api.us-east-1.amazonaws.com/prod"
$env:AWS_API_KEY_ID   = "<SEU_API_KEY_ID>"
.\venv\Scripts\python.exe docs/evaluation/run_eval.py
```

---

## 👤 10. Autor & Licença

- **Autor:** Caio Cesar
- **Licença:** MIT — consulte [LICENSE](LICENSE).
