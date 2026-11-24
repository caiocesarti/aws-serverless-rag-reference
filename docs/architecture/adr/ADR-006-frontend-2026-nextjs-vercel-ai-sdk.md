# ADR-006 — Substituição do Streamlit por Next.js 15 App Router + BFF Serverless (Vercel)

- **Status:** Aprovado (Revisado em 2026-11-24 para refletir a stack final enxuta em código)
- **Data:** 2026-11-23
- **Pilar Well-Architected:** Eficiência de Performance, Segurança, Otimização de Custos

## Contexto
O protótipo inicial utilizava `streamlit_app.py`, que requer processo Python stateful com WebSocket contínuo (incompatível com hospedagem nativa serverless na Vercel/Cloudflare), simulava streaming via `time.sleep`, expunha configurações de endpoint no cliente e gerava links de citação apontando para o Console AWS S3.

## Decisão
Excluir `streamlit_app.py` e construir o novo frontend em `apps/web/` com:
- **Stack:** Next.js 15 (App Router), React 19, TypeScript (`strict`), Tailwind CSS v4, `lucide-react`, `react-markdown`/`remark-gfm`, `zod` e BFF Route Handlers nativos instrumentados com `@vercel/functions` (`metric()`).
  - *Nota de simplificação:* optou-se por Route Handlers nativos do Next.js + componentes próprios em Tailwind v4 (sem adicionar o pacote `ai` / Vercel AI SDK nem camadas extras de UI kit), reduzindo a superfície de dependências e mantendo controle direto sobre validação Zod, anti-CSRF, rate limiting e contrato JSON da AWS Lambda.
- **Hospedagem:** **Vercel** (Hobby/Pro), mantendo toda a camada de dados e IA 100% na AWS (com modo opcional `DEMO_MODE=true` para standby FinOps a US$ 0/mês).
- **Experiência PropTech (*Architectural Intelligence*):**
  - Layout responsivo em **3 zonas**: Sidebar de contexto (portfólio dos 3 empreendimentos + filtros `dominio_kb` + persona *Corretor/Comprador*), Canvas Central conversacional com *Generative UI* (ficha técnica rápida + Simulador SAC vs. Price com card determinístico no chat) e *Citation PDF Drawer* lateral usando S3 Pre-signed URLs (`#page=N`).
  - Ação comercial dedicada **"Copiar para WhatsApp"** e coleta de feedback `👍 / 👎` persistida no DynamoDB.

## Consequências
- **Positivas:** UX de nível produto comercial, bundle enxuto, deploy zero-ops em HTTPS global na Vercel, proteção BFF nativa e custo de hospedagem US$ 0 no plano Hobby.
- **Trade-offs:** Introduz stack TypeScript/Node.js no monorepo (`apps/web/`) separada do backend Python (`backend/`).
