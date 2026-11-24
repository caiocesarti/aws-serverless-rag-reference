---
description: Analisa requisitos ou arquivos mencionados com @, mapeia impactos técnicos/segurança/FinOps e gera um plano detalhado sem editar código.
---

# Workflow `/planejar`

Execute os passos abaixo estritamente em modo de análise e planejamento (**não edite nem crie arquivos de código** até receber aprovação explícita do usuário):

1. Ler o requisito informado, todos os arquivos referenciados com `@`, as regras do projeto em `.agent/rules/padroes-projeto.md` e as ADRs relevantes em `docs/architecture/adr/`.

// turbo
2. Inspecionar o estado atual do repositório (somente leitura):
```powershell
git status --short
```

3. Mapear todos os impactos nas camadas do monorepo:
   - **Frontend/BFF (`apps/web/`):** rotas `/api/*`, componentes UI, schemas Zod, `next.config.ts` e métricas `@vercel/functions`.
   - **Backend (`backend/src/` e `backend/tests/`):** handlers, schemas, serviços (`bedrock_rag`, `s3_presigner`, `session_store`) e cobertura de testes `unittest`.
   - **Infra & KB (`infra/`, `knowledge-base/`, `.github/workflows/`):** template CloudFormation, permissões IAM (`ADR-004`) e sidecars `.metadata.json` escalares (`ADR-005`).

4. Avaliar riscos de **Segurança/LGPD** (segredos, CSP, CORS sem `*`, IAM, PII) e **FinOps** (custo Bedrock/AWS, *cold start*, limites de quota).

5. Apresentar um **Implementation Plan** objetivo contendo:
   - Escopo e premissas (incluindo dúvidas se houver ambiguidade).
   - Lista exata de arquivos que serão criados ou modificados e o porquê de cada mudança.
   - Plano de validação usando apenas os scripts reais do projeto (`compileall`, `unittest`, `typecheck`, `build`, `validate-template`).
   - Pedido explícito de aprovação antes de iniciar a implementação.
