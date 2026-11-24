# ADR-003 — Política de CORS Restritiva e Padrão BFF (Zero Exposição no Browser)

- **Status:** Aprovado
- **Data:** 2026-11-23
- **Pilar Well-Architected:** Segurança, Excelência Operacional

## Contexto
A interface Streamlit anterior mantinha a URL do API Gateway hardcoded no código e orientava habilitar CORS genérico (`Access-Control-Allow-Origin: *`). Em um aplicativo Web moderno, chamar a AWS diretamente do navegador com chaves embutidas no JavaScript expõe segredos no DevTools e permite abuso a partir de qualquer domínio externo.

## Decisão
Adotar o padrão **Backend-for-Frontend (BFF)** via Next.js Route Handlers na Vercel combinado a **CORS restritivo**:

1. **Comunicação Browser → BFF (Mesma Origem):**
   - O cliente React chama exclusivamente `/api/chat` e `/api/health` no mesmo domínio da Vercel.
   - O Route Handler valida o cabeçalho `Origin` (e `Referer` quando aplicável) contra a lista explícita `ALLOWED_ORIGINS` (`https://<app>.vercel.app`, mais `http://localhost:3000` apenas em desenvolvimento). Requisições de origens não autorizadas recebem `403 Forbidden`.
2. **Comunicação BFF → AWS API Gateway (Server-to-Server):**
   - A URL real da AWS (`AWS_API_BASE_URL`) e a chave (`AWS_API_KEY`) existem apenas como variáveis de ambiente server-side na Vercel.
   - Como a requisição sai do servidor da Vercel, não há exposição de `x-api-key` nem do endpoint AWS no navegador.
3. **Política de CORS no Amazon API Gateway:**
   - **É terminantemente proibido `Access-Control-Allow-Origin: *`.**
   - Em produção com BFF puro, o CORS do recurso `/v1/chat` permanece fechado para navegadores (ou, se explicitamente necessário em ambiente controlado, restrito à origem exata `https://<app>.vercel.app`, métodos `POST,OPTIONS`, headers `Content-Type,X-Amz-Date,X-Api-Key` e `Max-Age: 600`).

## Consequências
- **Positivas:** Elimina vazamento de credenciais no frontend, bloqueia abuso *cross-origin* e centraliza auditoria, rate limit e formatação de erros no BFF.
- **Trade-offs:** Adiciona um salto HTTP de baixíssima latência (Vercel Edge/Serverless `us-east-1` → AWS API Gateway `us-east-1`).
