# ADR-007 — Estratégia de Empacotamento Serverless-First (Sem Docker) e CI/CD DevSecOps com OIDC

- **Status:** Aprovado
- **Data:** 2026-11-24
- **Pilar Well-Architected:** Excelência Operacional, Segurança, Performance, FinOps, Sustentabilidade

## Contexto
Durante a preparação do repositório **ImobiSmart AI** para produção e governança contínua (CI/CD e *Agentic DevEx*), avaliamos se deveríamos introduzir containers Docker (`Dockerfile` / `docker-compose.yml` para Next.js, Lambda Container Images ou ECS Fargate) além da arquitetura Serverless existente.

A arquitetura atual já opera com:
- **Backend (`backend/src/`):** código Python puro sem dependências binárias nativas externas (usa apenas `boto3` fornecido pelo runtime AWS Lambda `python3.12` em `arm64`), gerando um pacote `.zip` de aproximadamente **12 KB**.
- **Frontend & BFF (`apps/web/`):** aplicação Next.js 15 otimizada nativamente para a plataforma Vercel (Route Handlers, métricas `@vercel/functions`, cache de ativos estáticos e HTTPS gerenciado).
- **Orçamento FinOps rígido:** meta de operação piloto abaixo de **US\$ 5–12/mês** (`ADR-001` e `ADR-002`).

## Decisão
Adotar a estratégia **Serverless-First (Caminho 1 — Sem Docker)** combinada com **CI/CD DevSecOps em GitHub Actions (Linux) com autenticação AWS OIDC** e governança local padronizada em `.agent/`:

1. **Não adotar Docker nem orquestração de containers (ECS Fargate / EKS / Lambda Container Images) neste estágio:**
   - O backend permanece empacotado como **Lambda Zip (`python3.12`, `arm64`)** publicado via CloudFormation no prefixo isolado `artifacts/` do S3.
   - O frontend permanece implantado nativamente na **Vercel** sem camada adicional de *container registry* ou imagem Node.js para manter.
2. **Garantir paridade Linux e qualidade via GitHub Actions (`.github/workflows/ci.yml`):**
   - **Paridade de runtime sem Docker local:** o job `backend-ci` executa em runner `ubuntu-latest` com **Python 3.12** (espelho exato do runtime Lambda), rodando `compileall`, `ruff`, `bandit` (SAST) e `unittest`.
   - **Segurança Shift-Left contínua:** `secret-scan` (Gitleaks CLI), `frontend-ci` (Node 22, `npm ci`, `typecheck`, `build`, `npm audit --audit-level=high`) e `iac-security` (`cfn-lint` + `checkov` sobre `infra/template.yaml`, respeitando exceções documentadas nas `ADR-002` e `ADR-004`).
3. **Deploy automatizado sem credenciais estáticas (`.github/workflows/deploy-aws.yml`):**
   - Autenticação via **GitHub OIDC → AWS IAM Role** (`permissions: id-token: write`), eliminando totalmente `AWS_ACCESS_KEY_ID` e `AWS_SECRET_ACCESS_KEY` de longa duração nos *GitHub Secrets*.
   - Bloqueio automático caso `allowed_origins` contenha `*` (`ADR-003`) e verificação pós-deploy em `GET /v1/health` (custo zero Bedrock).
4. **Governança de Engenharia Assistida por IA (`.agent/`):**
   - Regras globais (`rules/padroes-projeto.md`), workflows atômicos (`/planejar`, `/testar`, `/revisar`, `/documentar`) e runbooks modulares (`skills/imobismart-aws-deploy`, `imobismart-kb-sync`, `imobismart-security-audit`) garantindo aderência arquitetural desde o desenvolvimento local.

## Alternativas Consideradas e Rejeitadas

| Alternativa | Motivo da Rejeição |
| :--- | :--- |
| **AWS Lambda Container Image (ECR)** | Aumenta o artefato de ~12 KB para centenas de MB, exige gestão de repositório ECR e atualizações periódicas de CVEs da imagem base, com maior latência de *cold start* sem necessidade de binários nativos (como `ffmpeg`, `poppler` ou libs C++). |
| **ECS Fargate / App Runner 24/7** | Introduz custo fixo mensal contínuo de computação, balanceador e registro de imagens, violando o teto FinOps definido nas `ADR-001` e `ADR-002` para tráfego intermitente de piloto/portfólio. |
| **Docker Compose local obrigatório** | Como o projeto não depende de banco relacional local (DynamoDB, Bedrock e Pinecone são gerenciados em nuvem), adicionar `Dockerfile`/`docker-compose.yml` sem uso em produção configuraria *resume-driven development* (complexidade acidental sem retorno operacional real). |

## Consequências

### Positivas
- **FinOps preservado:** custo adicional de **US\$ 0,00/mês** (sem ECR, NAT Gateway, ALB ou tarefas Fargate ociosas; GitHub Actions gratuito no tier padrão).
- **Menor superfície de ataque e manutenção:** zero imagens base Linux/Alpine para corrigir vulnerabilidades de sistema operacional continuamente; zero chaves estáticas da AWS no CI/CD.
- **Cold start e deploy rápidos:** artefato Lambda de ~12 KB com deploy completo em segundos.
- **Maturidade arquitetural explícita:** documenta conscientemente o princípio de *não usar tecnologia sem requisito real*.

### Trade-offs e Critérios de Reavaliação
- Existe dependência gerenciada do runtime **Vercel** para o frontend e do runtime **AWS Lambda Python 3.12** para o backend.
- **Quando reavaliar esta decisão e adotar Docker:**
  1. Caso um cliente corporativo exija *self-hosting* do frontend Next.js em AWS ECS Fargate / Cloud Run / Kubernetes (adotar então `Dockerfile` multi-stage com `output: "standalone"` e usuário non-root).
  2. Caso o backend passe a processar documentos pesados ou bibliotecas binárias nativas que excedam os limites de pacote Zip da AWS Lambda (250 MB descompactado).
  3. Caso sejam adicionadas dependências stateful locais (ex.: PostgreSQL/pgvector, Redis ou LocalStack) no fluxo diário de desenvolvimento.
