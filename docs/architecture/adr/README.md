# Architecture Decision Records (ADRs) — ImobiSmart AI

Este diretório documenta formalmente as decisões arquiteturais do **ImobiSmart AI**, seguindo os 6 pilares do **AWS Well-Architected Framework**.

| ID | Decisão | Status | Pilares Principais |
| :--- | :--- | :---: | :--- |
| [ADR-001](./ADR-001-vector-store-pinecone-serverless.md) | Pinecone Serverless em vez de OpenSearch Serverless (+ FM Parsing & Rerank) | Aprovado | FinOps, Performance, Sustentabilidade |
| [ADR-002](./ADR-002-rate-limiting-finops-sem-waf.md) | Rate Limiting em 4 camadas e proteção *Denial of Wallet* sem AWS WAF | Aprovado | Segurança, FinOps, Confiabilidade |
| [ADR-003](./ADR-003-cors-restritivo-e-padrao-bff.md) | Política de CORS Restritiva (zero `*`) e padrão BFF na Vercel | Aprovado | Segurança, Excelência Operacional |
| [ADR-004](./ADR-004-devsecops-e-iam-menor-privilegio.md) | DevSecOps *Shift-Left* e IAM com Menor Privilégio Rígido | Aprovado | Segurança, Excelência Operacional |
| [ADR-005](./ADR-005-fonte-canonica-kb-3-pdfs.md) | Fonte Canônica da KB (3 PDFs oficiais, remoção dos `.md` conflitantes) | Aprovado | Confiabilidade, Performance |
| [ADR-006](./ADR-006-frontend-2026-nextjs-vercel-ai-sdk.md) | Substituição do Streamlit por Next.js 15 + Vercel AI SDK | Aprovado | Performance, Segurança, FinOps |
| [ADR-007](./ADR-007-estrategia-containers-e-ci-cd.md) | Estratégia Serverless-First (sem Docker) e CI/CD DevSecOps com GitHub OIDC | Aprovado | Excelência Operacional, Segurança, FinOps |
