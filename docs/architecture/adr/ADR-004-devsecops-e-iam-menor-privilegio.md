# ADR-004 — Práticas DevSecOps e IAM com Menor Privilégio Rígido (Strict Least Privilege)

- **Status:** Aprovado
- **Data:** 2026-11-23
- **Pilar Well-Architected:** Segurança, Excelência Operacional

## Contexto
O código legado (`lambda_function.py`) continha AWS Account ID e Knowledge Base ID hardcoded, registrava payloads completos via `print()` no CloudWatch (risco LGPD e explosão de logs) e não possuía automação de infraestrutura nem verificações estáticas de segurança.

## Decisão
Adotar **Menor Privilégio Rígido (zero wildcards `*` em ações e recursos)**, segregação completa de identidades IAM e verificações DevSecOps *Shift-Left*.

### 1. Segregação de IAM Roles

#### Role A — `ImobiSmartBedrockKBRole` (Ingestão e Consulta da Knowledge Base)
- **Trust Policy anti-*Confused Deputy*:** Permite `sts:AssumeRole` apenas para `bedrock.amazonaws.com` com condições obrigatórias `aws:SourceAccount` = `<ACCOUNT_ID>` e `aws:SourceArn` = `arn:aws:bedrock:us-east-1:<ACCOUNT_ID>:knowledge-base/*`.
- **Permissions Policy:**
  - `s3:ListBucket` → `arn:aws:s3:::imobismart-kb-docs-<ACCOUNT_ID>` (condicionado ao prefixo `documents/*`).
  - `s3:GetObject` → `arn:aws:s3:::imobismart-kb-docs-<ACCOUNT_ID>/documents/*`.
  - `bedrock:InvokeModel` → apenas os ARNs exatos de `amazon.titan-embed-text-v2:0` e do modelo de *Foundation Model Parsing*.
  - `secretsmanager:GetSecretValue` → apenas o ARN exato de `imobismart/pinecone/api-key-*`.

#### Role B — `ImobiSmartChatLambdaRole` (Execução da API de Chat)
- **Trust Policy:** Apenas `lambda.amazonaws.com`.
- **Permissions Policy:**
  - `bedrock:Retrieve` → apenas o ARN exato da Knowledge Base (`arn:aws:bedrock:us-east-1:<ACCOUNT_ID>:knowledge-base/<KB_ID>`).
  - `bedrock:RetrieveAndGenerate`, `bedrock:Rerank` → `Resource: "*"` com condição `aws:RequestedRegion = us-east-1` *(exigência documentada da AWS IAM, pois essas duas ações de orquestração não suportam resource-level ARN; o acesso aos dados e modelos permanece estritamente travado pelos ARNs exatos de `Retrieve`, `InvokeModel` e `ApplyGuardrail`)*.
  - `bedrock:InvokeModel`, `bedrock:InvokeModelWithResponseStream`, `bedrock:GetInferenceProfile` → apenas os ARNs exatos do Inference Profile (`us.amazon.nova-pro-v1:0`), seus foundation models regionais e `cohere.rerank-v3-5:0`.
  - `bedrock:ApplyGuardrail` → apenas o ARN exato do Guardrail `imobismart-guardrail`.
  - `s3:GetObject` → apenas `arn:aws:s3:::imobismart-kb-docs-<ACCOUNT_ID>/documents/*` (exclusivamente para gerar Pre-signed URLs temporárias de 10 min; sem `PutObject` ou `DeleteObject`).
  - `dynamodb:GetItem`, `dynamodb:PutItem`, `dynamodb:Query`, `dynamodb:UpdateItem` → apenas o ARN da tabela `imobismart-sessions`.
  - `logs:CreateLogStream`, `logs:PutLogEvents` → apenas o Log Group `/aws/lambda/imobismart-chat:*`.

### 2. Controles DevSecOps e LGPD
- **Zero segredos/IDs no Git:** `.gitignore` rígido + `.env.example` com placeholders + checagem de segredos antes de commits.
- **S3 privado por padrão:** `Block All Public Access = ON`, criptografia em repouso (`SSE-S3` ou `SSE-KMS`) e versionamento ativo.
- **Bedrock Guardrails:** Mascaramento automático de PII (CPF, telefone, e-mail) e checagem de *Contextual Grounding* para evitar invenção de taxas financeiras ou metragens.
- **Logs estruturados e retenção finita:** AWS Lambda Powertools em JSON sem logar PII + retenção de `30 dias` no CloudWatch Logs e TTL de `30 dias` no DynamoDB.
- **Shift-Left Security:** Análise estática em cada alteração (`ruff` + `bandit` no backend Python, `cfn-lint` / validação IaC em `infra/template.yaml`, TypeScript `strict` + `npm audit` no frontend).
