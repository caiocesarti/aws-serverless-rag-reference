---
name: imobismart-kb-sync
description: Manages updates to the ImobiSmart AI official PDF corpus in knowledge-base/documents/, enforces flat scalar .metadata.json sidecars required by Amazon Bedrock and Pinecone Serverless, syncs to private S3 via sync_kb.ps1, and safely triggers Bedrock ingestion jobs. Use when adding, editing, or re-indexing PDFs or metadata in the Knowledge Base.
---

# Runbook de Sincronização da Knowledge Base — ImobiSmart AI

Use este runbook sempre que atualizar os documentos oficiais da base de conhecimento (`knowledge-base/documents/`) ou precisar reindexar vetores no **Amazon Bedrock Knowledge Base + Pinecone Serverless**.

## Regras Críticas da KB (Evita Falhas de Ingestão)

1. **Fonte Canônica (`ADR-005`):** Manter apenas os PDFs oficiais curados em `knowledge-base/documents/` (sem duplicatas `.md` conflitantes). Nomes de arquivos devem usar ASCII `kebab-case`.
2. **Sidecars `.metadata.json` Estritamente Escalares:**
   - Para cada `<arquivo>.pdf`, deve existir `<arquivo>.pdf.metadata.json` no formato:
     ```json
     {
       "metadataAttributes": {
         "codigo_documento": "IMOBI-EMP-001",
         "versao": "2.1",
         "categoria": "catalogo-tecnico",
         "empreendimentos": "horizonte-barra,parque-das-palmeiras,smart-studio-metropole"
       }
     }
     ```
   - **PROIBIDO usar arrays JSON** (ex.: `["a", "b"]`) ou objetos aninhados em `metadataAttributes`. O conector Bedrock Knowledge Base + Pinecone Serverless (índice denso clássico `1024d`) rejeita listas e falha a ingestão do documento inteiro. Use strings escalares separadas por vírgula.
3. **Validação Local Obrigatória Antes do Upload:**
   ```powershell
   .\venv\Scripts\python.exe -c "import json, glob; [print(f, {k: type(v).__name__ for k, v in json.load(open(f, encoding='utf-8'))['metadataAttributes'].items()}) for f in glob.glob('knowledge-base/documents/*.metadata.json')]"
   ```
   Confirmar que todos os valores são `str`, `int`, `float` ou `bool` (nenhum `list` ou `dict`).

## Sincronização com S3 e Ingestão Bedrock

1. **Verificar sessão AWS SSO ativa:**
   ```powershell
   aws sts get-caller-identity --profile imobismart
   ```
2. **Sincronizar apenas S3 (sem custo Bedrock):**
   Defina `$env:AWS_PROFILE = "imobismart"` (ou passe credenciais SSO ativas) e execute:
   ```powershell
   .\knowledge-base\scripts\sync_kb.ps1 -BucketName "<BUCKET_S3>"
   ```
   O script usa `--delete --exclude "*" --include "*.pdf" --include "*.metadata.json"`, mantendo o prefixo `documents/` limpo sem tocar em `artifacts/`.
3. **Disparar Ingestão Bedrock (SOMENTE com aprovação FinOps do usuário):**
   A ingestão invoca **FM Parsing (Nova Pro)** e **Titan Text Embeddings v2** (custo proporcional ao número de páginas). Solicite confirmação antes de rodar:
   ```powershell
   .\knowledge-base\scripts\sync_kb.ps1 `
     -BucketName "<BUCKET_S3>" `
     -KnowledgeBaseId "<KB_ID>" `
     -DataSourceId "<DATA_SOURCE_ID>"
   ```
4. **Conferir Conclusão do Job:**
   ```powershell
   aws bedrock-agent list-ingestion-jobs `
     --knowledge-base-id "<KB_ID>" `
     --data-source-id "<DATA_SOURCE_ID>" `
     --max-results 3 `
     --region us-east-1 `
     --profile imobismart
   ```
   Verificar `status: COMPLETE` e `numberOfDocumentsFailed: 0`.
