# ADR-006 — Substituição do Streamlit por Next.js 15 + Vercel AI SDK (Frontend 2026)

- **Status:** Aprovado
- **Data:** 2026-11-23
- **Pilar Well-Architected:** Eficiência de Performance, Segurança, Otimização de Custos

## Contexto
O protótipo inicial utilizava `streamlit_app.py`, que requer processo Python stateful com WebSocket contínuo (incompatível com hospedagem nativa serverless na Vercel/Cloudflare), simulava streaming via `time.sleep`, expunha configurações de endpoint no cliente e gerava links de citação apontando para o Console AWS S3.

## Decisão
Excluir `streamlit_app.py` e construir o novo frontend em `apps/web/` com:
- **Stack:** Next.js 15+ (App Router), React 19, TypeScript (`strict`), Tailwind CSS v4, shadcn/ui e **Vercel AI SDK**.
- **Hospedagem:** **Vercel** (Hobby/Pro), mantendo toda a camada de dados e IA 100% na AWS.
- **Experiência PropTech 2026 (*Architectural Intelligence*):**
  - Layout responsivo em **3 zonas**: Sidebar de contexto (portfólio dos 3 empreendimentos reais + filtros `dominio_kb` + persona *Corretor/Comprador*), Canvas Central conversacional com *Generative UI* (ficha técnica rápida + mini-simulador SAC vs Price) e *Citation PDF Drawer* lateral usando S3 Pre-signed URLs.
  - Ação comercial dedicada **"Copiar para WhatsApp"** e coleta de feedback `👍 / 👎` persistida no DynamoDB.

## Consequências
- **Positivas:** UX de nível produto comercial, deploy zero-ops em HTTPS global na Vercel, proteção BFF nativa e custo de hospedagem US$ 0 no plano Hobby.
- **Trade-offs:** Introduz stack TypeScript/Node.js no monorepo (`apps/web/`) separada do backend Python (`backend/`).
