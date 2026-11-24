---
description: Identifica arquivos alterados, executa os comandos reais de validação, testes e build do projeto, corrige apenas a causa raiz e revalida.
---

# Workflow `/testar`

Execute os passos abaixo para validar as alterações atuais sem mascarar falhas e sem disparar chamadas pagas ao Amazon Bedrock:

// turbo
1. Identificar os arquivos alterados no repositório:
```powershell
git status --short
```

// turbo
2. Se houver alterações em `backend/` (ou se o usuário pedir validação completa), verificar sintaxe e executar todos os testes unitários Python no virtualenv local:
```powershell
.\venv\Scripts\python.exe -m compileall -q backend/src backend/tests
.\venv\Scripts\python.exe -m unittest discover -s backend/tests -v
```

// turbo
3. Se houver alterações em `apps/web/` (ou se o usuário pedir validação completa), executar type-check estrito e build de produção Next.js *(não executar `npm run lint` enquanto `eslint` não estiver instalado em `apps/web/package.json`)*:
```powershell
npm --prefix apps/web run typecheck
npm --prefix apps/web run build
```

4. Se `infra/template.yaml` foi alterado e houver sessão AWS SSO ativa no perfil `imobismart`, validar o template CloudFormation *(pedir confirmação se o login SSO precisar ser renovado)*:
```powershell
aws cloudformation validate-template --template-body file://infra/template.yaml --region us-east-1 --profile imobismart
```

5. Caso ocorra qualquer erro de compilação, tipagem, build ou teste:
   - Diagnosticar e corrigir **exclusivamente a causa raiz**.
   - **Nunca** remover, pular (`@unittest.skip`), enfraquecer asserções válidas, adicionar `@ts-ignore`/`any` injustificado ou relaxar controles de segurança.
   - **Nunca** executar `docs/evaluation/run_eval.py` automaticamente (evita consumo não autorizado de orçamento Bedrock).

6. Reexecutar os comandos dos passos afetados até obter 100% de aprovação e apresentar um resumo conciso dos resultados obtidos.
