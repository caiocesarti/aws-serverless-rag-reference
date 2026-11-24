---
description: Executa code review rigoroso do git diff atual focado em bugs, segurança, performance, tipagem e aderência às regras do projeto, listado por severidade.
---

# Workflow `/revisar`

Execute uma auditoria técnica somente leitura sobre as alterações atuais (**não modifique código durante a revisão**):

// turbo
1. Inspecionar o estado do repositório e coletar o diff completo (unstaged e staged):
```powershell
git status --short
git diff
git diff --cached
```

2. Ler `.agent/rules/padroes-projeto.md`, os arquivos explicitamente mencionados com `@` (se houver) e as ADRs aplicáveis em `docs/architecture/adr/`.

3. Auditar criteriosamente cada mudança sob 5 eixos:
   - **Bugs & Contratos:** lógica incorreta, condições de borda, tratamento de erros HTTP/AWS, incompatibilidade entre BFF (`apps/web/src/app/api/*`) e Lambda (`backend/src/handlers/chat.py`).
   - **Segurança & LGPD:** exposição de segredos/chaves/IDs reais, proteção de `.env*`, validação de inputs (Zod e `backend/src/schemas/chat.py`), Security Headers (`next.config.ts`), CORS sem `*`, anti-CSRF/Origin, anti-path-traversal em `s3_presigner.py`, IAM Menor Privilégio (`ADR-004`) e zero PII em logs.
   - **Performance & FinOps:** re-renders ou aumento desnecessário de bundle no Next.js, *cold start* ou dependências desnecessárias na Lambda, chamadas redundantes ao Bedrock.
   - **Tipagem & Manutenibilidade:** aderência ao TypeScript `strict` + `noUncheckedIndexedAccess`, clareza de funções e cobertura de testes unitários para comportamentos novos.
   - **Conformidade com Regras e ADRs:** respeito a `.agent/rules/padroes-projeto.md` e `ADR-001`–`ADR-007`.

4. Apresentar o parecer final estruturado por severidade (**Crítico**, **Alto**, **Médio**, **Baixo**):
   - Para cada achado, informar: arquivo + linha, risco/impacto concreto e sugestão objetiva de correção.
   - Caso nenhum problema seja encontrado, confirmar explicitamente a aprovação e citar o escopo revisado e eventuais lacunas de teste observadas.
