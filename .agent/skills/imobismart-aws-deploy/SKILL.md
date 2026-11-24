---
name: imobismart-aws-deploy
description: Guides safe AWS CloudFormation packaging, validation, and deployment of the ImobiSmart AI Serverless backend (Lambda Python 3.12 arm64, API Gateway, DynamoDB, IAM) via infra/deploy.ps1 with AWS SSO and zero-cost health verification. Use when deploying backend or infrastructure changes to AWS or troubleshooting CloudFormation stacks.
---

# Runbook de Deploy AWS — ImobiSmart AI

Use este runbook sempre que precisar validar ou publicar alterações em `backend/` ou `infra/template.yaml` na stack CloudFormation `imobismart-ai-prod` (`us-east-1`).

## Pré-requisitos Obrigatórios

1. **Verificar sessão AWS SSO (perfil `imobismart`):**
   ```powershell
   aws sts get-caller-identity --profile imobismart
   ```
   Se o token estiver expirado, solicite ao usuário executar `aws sso login --profile imobismart` antes de continuar.

2. **Validar sintaxe e testes unitários localmente (DevSecOps Shift-Left):**
   ```powershell
   .\venv\Scripts\python.exe -m compileall -q backend/src backend/tests
   .\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
   ```
   Apenas prossiga com 100% dos testes passando.

3. **Validar template CloudFormation:**
   ```powershell
   aws cloudformation validate-template --template-body file://infra/template.yaml --region us-east-1 --profile imobismart
   ```

## Execução do Deploy

1. **Confirmar parâmetros com o usuário** antes de aplicar mudanças em produção (`DocsBucketName`, `KnowledgeBaseId`, `GuardrailId`, `GuardrailVersion` e `AllowedOrigins`). Nunca hardcodear IDs reais ou segredos em scripts ou arquivos versionados.
2. **Executar o script oficial `infra/deploy.ps1`:**
   ```powershell
   .\infra\deploy.ps1 `
     -Profile "imobismart" `
     -Region "us-east-1" `
     -StackName "imobismart-ai-prod" `
     -EnvironmentName "prod" `
     -DocsBucketName "<BUCKET_S3>" `
     -KnowledgeBaseId "<KB_ID>" `
     -GuardrailId "<GUARDRAIL_ID>" `
     -GuardrailVersion "DRAFT" `
     -AllowedOrigins "<ORIGENS_PERMITIDAS_SEM_WILDCARD>"
   ```
   O script empacota `backend/src`, remove `__pycache__`, envia o `.zip` para o prefixo isolado `artifacts/` no S3 (separado de `documents/`), executa `aws cloudformation deploy` com `CAPABILITY_NAMED_IAM` e exibe a tabela de outputs.

## Verificação Pós-Deploy (Custo Zero Bedrock)

1. Testar `GET <ApiBaseUrl>/v1/health` (não exige `x-api-key` e não invoca Amazon Bedrock) confirmando HTTP `200` e payload JSON saudável.
2. **Segurança:** Nunca imprimir no terminal nem no chat o valor retornado por `aws apigateway get-api-key --include-value`.
3. Se houver alteração de `AllowedOrigins` após publicar na Vercel, atualizar o parâmetro reexecutando `infra/deploy.ps1` com a URL HTTPS exata (nunca usar `*`, conforme `ADR-003`).
4. Lembrar que o CI/CD de produção também pode ser acionado via GitHub Actions (`.github/workflows/deploy-aws.yml`) usando autenticação **GitHub OIDC → AWS IAM Role** (zero chaves AWS estáticas).
