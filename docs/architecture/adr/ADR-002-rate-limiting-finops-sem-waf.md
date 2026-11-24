# ADR-002 — Rate Limiting e Proteção contra Denial of Wallet (Sem AWS WAF)

- **Status:** Aprovado
- **Data:** 2026-11-23
- **Pilar Well-Architected:** Segurança, Otimização de Custos (FinOps), Confiabilidade

## Contexto
No protótipo legado, o endpoint do API Gateway estava exposto publicamente sem autenticação, sem cota e sem limitação de taxa, criando risco severo de abuso de custos no Amazon Bedrock (*Denial of Wallet*). Entretanto, adicionar **AWS WAF** geraria custo fixo mensal desproporcional ao orçamento do protótipo.

## Decisão
Implementar uma estratégia de **defesa em profundidade em 4 camadas gratuitas / nativas**, sem uso de AWS WAF:

1. **Camada 1 — Borda e BFF na Vercel (`/api/chat`):**
   - Proteção DDoS L3/L4/L7 nativa da infraestrutura Vercel.
   - Validação de payload na borda: bloqueio de prompts vazios ou maiores que `1.000` caracteres antes de atingir a AWS.
   - Rate Limiting por IP/sessão na rota `/api/chat` (padrão: `15 requisições / 60 segundos`).
2. **Camada 2 — Amazon API Gateway REST (Usage Plan + Throttling + API Key):**
   - `ApiKeyRequired: true` no recurso `POST /v1/chat`.
   - `Usage Plan` vinculado à chave da aplicação com:
     - `RateLimit`: `5 req/s`
     - `BurstLimit`: `10 req`
     - `Quota`: `1.000 req/mês` (ajustável conforme necessidade de testes).
   - Header `x-api-key` consumido **exclusivamente** server-side pelo BFF da Vercel (nunca enviado pelo navegador).
   - Rejeições automáticas na borda da AWS: `403 Forbidden` (sem chave válida) e `429 Too Many Requests` (excesso de taxa/cota) sem invocar a Lambda nem o Bedrock.
3. **Camada 3 — Proteção no Compute (AWS Lambda):**
   - `ReservedConcurrentExecutions` limitado (ex.: `5`) para conter rajadas simultâneas.
   - Validação de contrato com **Pydantic** antes da chamada ao Bedrock.
   - Rota dedicada `GET /v1/health` sem invocação de LLM (substitui o antigo `call_backend("ping")`).
4. **Camada 4 — Governança Financeira Preventiva (AWS Budgets — US$ 0):**
   - Alertas configurados por e-mail em **US$ 5**, **US$ 15** e **US$ 30** (gasto real e previsto).

## Consequências
- **Positivas:** Proteção robusta contra abuso acidental e *Denial of Wallet* com custo adicional de **US$ 0/mês**.
- **Trade-offs:** Sem inspeção avançada de assinatura OWASP em camada WAF; caso o produto vá a tráfego público comercial massivo, o AWS WAF poderá ser acoplado diretamente ao estágio `prod` do API Gateway sem refatorar a aplicação.
