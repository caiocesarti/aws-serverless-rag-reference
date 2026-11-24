---
description: Atualiza documentação técnica relevante (README, ADRs, .env.example ou docstrings) refletindo as últimas mudanças sem alterar a lógica do código.
---

# Workflow `/documentar`

Execute os passos abaixo para sincronizar a documentação com o estado real do repositório (**proibido alterar a lógica funcional do código**):

// turbo
1. Identificar quais arquivos e camadas foram alterados recentemente:
```powershell
git status --short
git diff --stat
```

2. Ler os arquivos alterados (ou referenciados com `@`), `.agent/rules/padroes-projeto.md` e a documentação candidata a atualização:
   - `README.md` (arquitetura, estrutura de pastas, comandos reais de execução/deploy e tabela de ADRs).
   - `docs/architecture/adr/README.md` e ADRs impactadas (ou criar uma nova `ADR-00X` quando houver decisão arquitetural relevante).
   - `.env.example` (somente com placeholders seguros se novas variáveis de ambiente tiverem sido introduzidas).
   - Docstrings/comentários técnicos estritamente quando clarificarem contratos ou invariantes complexos.

3. Aplicar as atualizações de documentação seguindo estas restrições:
   - Refletir apenas scripts, caminhos e versões **reais** verificados no repositório.
   - **Nunca** incluir segredos, API keys, tokens, AWS Account IDs, KB IDs ou Guardrail IDs reais.
   - **Não** modificar comportamento, assinaturas ou lógica de execução em código Python, TypeScript ou CloudFormation.

4. Conferir que todos os links internos e blocos de comando estão consistentes e apresentar um resumo objetivo dos arquivos documentais atualizados.
