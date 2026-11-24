# ADR-005 — Fonte Canônica da Base de Conhecimento (3 PDFs Oficiais, Remoção dos .md)

- **Status:** Aprovado
- **Data:** 2026-11-23
- **Pilar Well-Architected:** Confiabilidade, Eficiência de Performance, Excelência Operacional

## Contexto
A auditoria da pasta `KB-Documents/` identificou a coexistência de 3 arquivos `.md` legados (referentes ao empreendimento fictício *Residencial Horizonte Azul*) junto aos 3 novos PDFs oficiais corporativos da ImobiSmart (`IMOBI-EMP-001 v2.1`, `IMOBI-COND-002 v3.0` e `IMOBI-FIN-003 v4.0`), que contemplam 3 empreendimentos reais e coerentes em Salvador/BA (*Residencial Horizonte Barra*, *Parque das Palmeiras Residence* e *Smart Studio Metrópole*).

Os arquivos `.md` antigos apresentavam contradições diretas com os PDFs (nomes de empreendimentos, metragens, valores de taxa de salão de festas, horários de piscina/mudanças/coworking e prazo de aprovação de reformas).

## Decisão
1. **Remover definitivamente** os 3 arquivos `.md` antigos do repositório e do bucket S3 indexado pela Knowledge Base.
2. Adotar os **3 PDFs oficiais** como única fonte de verdade (*Single Source of Truth*) sob `knowledge-base/documents/` com nomes normalizados em ASCII (sem espaços nem acentos, evitando problemas de URL-encoding em S3 Pre-signed URLs):
   - `catalogo-tecnico-empreendimentos-imobi-emp-001.pdf`
   - `convencao-condominio-regimento-imobi-cond-002.pdf`
   - `manual-credito-financiamento-imobi-fin-003.pdf`
3. Acompanhar cada PDF de um arquivo sidecar `.metadata.json` (`codigo_doc`, `versao`, `dominio_kb`, `vigencia`, `cidade`, `empreendimentos`) para habilitar **Metadata Filtering** no Pinecone.
4. Configurar **Bedrock Foundation Model Parsing** + **Hierarchical Chunking** (`1500/300/60`) na ingestão para preservar integralmente tabelas multipágina (ex.: Matriz de Linhas de Crédito pág. 1→2 e Simulação SAC vs Price pág. 2→3).

## Consequências
- **Positivas:** Elimina alucinações por contradição de fatos, evita duplicação de chunks e garante que cada citação abra o PDF oficial exato via S3 Pre-signed URL.
- **Trade-offs:** A ingestão com FM Parsing gera um custo mínimo pontual por sincronização (~US$ 0,05 para 16 páginas), amplamente compensado pelo ganho de precisão em tabelas.
