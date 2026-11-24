# ADR-001 — Adoção de Pinecone Serverless como Vector Store da Knowledge Base

- **Status:** Aprovado
- **Data:** 2026-11-23
- **Pilar Well-Architected:** Otimização de Custos (FinOps), Eficiência de Performance, Sustentabilidade

## Contexto
A criação rápida (*Quick Create*) de uma Knowledge Base no Amazon Bedrock provisiona uma coleção do **Amazon OpenSearch Serverless (AOSS)**, exigindo no mínimo 2 OCUs de indexação e 2 OCUs de busca 24/7 (~US$ 350 a US$ 700/mês), mesmo para um protótipo com baixo volume de consultas.

## Decisão
Substituir o Amazon OpenSearch Serverless pelo **Pinecone Serverless**, integrado nativamente ao Amazon Bedrock Knowledge Bases:
- **Cloud / Região:** AWS `us-east-1` (mesma região do Bedrock para minimizar latência de rede).
- **Dimensões:** `1024` (alinhado ao modelo `amazon.titan-embed-text-v2:0`).
- **Métrica de Similaridade:** `cosine`.
- **Campos mapeados:** `text` (texto do chunk) e `metadata` (metadados sidecar `.metadata.json`).
- **Gestão da Credencial:** API Key armazenada exclusivamente no **AWS Secrets Manager** (`imobismart/pinecone/api-key`).

## Compensação Técnica (Trade-off vs. BM25)
O conector nativo Bedrock + Pinecone executa busca vetorial densa + *Metadata Filtering*, sem BM25 lexical nativo. Para manter alta precisão em códigos, normas e valores numéricos exatos (`IMOBI-EMP-001`, `NBR 17170`, `Art. 290`, `148,50 m²`, `R$ 1.500.000,00`):
1. Ativar **Bedrock Foundation Model Parsing** na ingestão para preservar integralmente tabelas multipágina dos 3 PDFs.
2. Utilizar **Hierarchical Chunking** (*Parent*: 1.500 tokens / *Child*: 300 tokens / *Overlap*: 60 tokens).
3. Ativar **Cohere Rerank 3.5** (`cohere.rerank-v3-5:0`, modelo de Rerank ativo em `us-east-1`) na recuperação + `AgenticRetrieveStream` para decomposição de perguntas compostas.

## Consequências
- **Positivas:** Redução superior a 97% no custo fixo mensal do Vector Store (**US$ 0/mês** no plano Starter até 2 GB / 2M WUs / 1M RUs, somado a ~US$ 0,40/mês do Secrets Manager).
- **Trade-offs:** Dependência de serviço SaaS externo (Pinecone) e ausência de busca híbrida BM25 nativa no conector Bedrock (mitigada pelo Rerank + Metadata Filtering).
