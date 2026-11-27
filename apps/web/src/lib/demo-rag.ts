import "server-only";

import crypto from "node:crypto";

import type { Citation, DominioKb, Persona } from "./types";

export function isDemoModeEnabled(): boolean {
  return (process.env.DEMO_MODE ?? "").trim().toLowerCase() === "true";
}

export interface DemoPdfEntry {
  codigo_doc: "IMOBI-EMP-001" | "IMOBI-COND-002" | "IMOBI-FIN-003";
  filename: string;
  rawUrl: string;
}

const GITHUB_KB_RAW_BASE =
  "https://raw.githubusercontent.com/caiocesarti/aws-serverless-rag-reference/main/knowledge-base/documents";

const DEMO_PDF_ALLOWLIST: Readonly<Record<string, DemoPdfEntry>> = Object.freeze({
  "IMOBI-EMP-001": Object.freeze({
    codigo_doc: "IMOBI-EMP-001",
    filename: "catalogo-tecnico-empreendimentos-imobi-emp-001.pdf",
    rawUrl: `${GITHUB_KB_RAW_BASE}/catalogo-tecnico-empreendimentos-imobi-emp-001.pdf`,
  }),
  "IMOBI-COND-002": Object.freeze({
    codigo_doc: "IMOBI-COND-002",
    filename: "convencao-condominio-regimento-imobi-cond-002.pdf",
    rawUrl: `${GITHUB_KB_RAW_BASE}/convencao-condominio-regimento-imobi-cond-002.pdf`,
  }),
  "IMOBI-FIN-003": Object.freeze({
    codigo_doc: "IMOBI-FIN-003",
    filename: "manual-credito-financiamento-imobi-fin-003.pdf",
    rawUrl: `${GITHUB_KB_RAW_BASE}/manual-credito-financiamento-imobi-fin-003.pdf`,
  }),
});

export function resolveDemoPdfEntry(docCode: string | null | undefined): DemoPdfEntry | null {
  if (!docCode) return null;
  const normalized = docCode.trim().toUpperCase();
  if (!Object.hasOwn(DEMO_PDF_ALLOWLIST, normalized)) {
    return null;
  }
  return DEMO_PDF_ALLOWLIST[normalized] ?? null;
}

interface DemoChatInput {
  prompt: string;
  persona: Persona;
  session_id?: string;
  empreendimento?: string;
  dominios?: DominioKb[];
}

interface DemoChatResponse {
  answer: string;
  session_id: string;
  message_id: string;
  citations: Citation[];
  guardrail_action: "NONE" | "INTERVENED";
  filters_applied: {
    persona: string;
    empreendimento: string;
    dominios: string[];
  };
  latency_ms: number;
  request_id: string;
  mode: "demo";
}

const DEMO_DISCLAIMER =
  "\n\n---\n_Modo Portfólio (FinOps): resposta demonstrativa fiel à base oficial ImobiSmart com a stack AWS Bedrock/S3 em standby._";

const PII_CPF_RE = /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/;
const PII_EMAIL_RE = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const PII_PHONE_RE = /(?:\+55\s?)?(?:\(?\d{2}\)?\s?)?9\d{4}-?\d{4}\b/;

function normalizeText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
}

function makeCitation(
  index: number,
  doc: "EMP" | "COND" | "FIN",
  pagina: number,
  snippet: string
): Citation {
  const catalog = {
    EMP: {
      codigo_doc: "IMOBI-EMP-001",
      titulo: "Catálogo Técnico de Empreendimentos e Memoriais Descritivos",
      arquivo: "catalogo-tecnico-empreendimentos-imobi-emp-001.pdf",
      dominio_kb: "empreendimentos",
      versao: "2.1",
      vigencia: "2026-11-01",
      s3_key: "documents/catalogo-tecnico-empreendimentos-imobi-emp-001.pdf",
    },
    COND: {
      codigo_doc: "IMOBI-COND-002",
      titulo: "Convenção Padrão de Condomínio e Regimento Interno",
      arquivo: "convencao-condominio-regimento-imobi-cond-002.pdf",
      dominio_kb: "condominio",
      versao: "3.0",
      vigencia: "2026-10-15",
      s3_key: "documents/convencao-condominio-regimento-imobi-cond-002.pdf",
    },
    FIN: {
      codigo_doc: "IMOBI-FIN-003",
      titulo: "Manual Técnico de Crédito Imobiliário e Financiamento Habitacional",
      arquivo: "manual-credito-financiamento-imobi-fin-003.pdf",
      dominio_kb: "credito",
      versao: "4.0",
      vigencia: "2026-11-01",
      s3_key: "documents/manual-credito-financiamento-imobi-fin-003.pdf",
    },
  }[doc];

  return {
    index,
    ...catalog,
    pagina,
    snippet,
    presigned_url: null,
    demo_pdf_url: `/api/demo-pdf?doc=${catalog.codigo_doc}`,
  };
}

export function buildDemoChatResponse(
  input: DemoChatInput,
  requestId: string
): DemoChatResponse {
  const sessionId = input.session_id || `demo-${crypto.randomUUID().slice(0, 12)}`;
  const messageId = crypto.randomUUID();
  const filtersApplied = {
    persona: input.persona,
    empreendimento: input.empreendimento && input.empreendimento !== "todos" ? input.empreendimento : "todos",
    dominios: input.dominios && input.dominios.length > 0 ? input.dominios : ["todos"],
  };

  // 1. Live LGPD PII Guardrail simulation
  if (
    PII_CPF_RE.test(input.prompt) ||
    PII_EMAIL_RE.test(input.prompt) ||
    PII_PHONE_RE.test(input.prompt)
  ) {
    return {
      answer:
        "Por motivos de segurança e conformidade com a **LGPD**, não processei esta solicitação porque foram detectados dados pessoais sensíveis (CPF, e-mail ou telefone). Remova os dados pessoais e refaça sua consulta técnica sobre empreendimentos, condomínio ou crédito." +
        DEMO_DISCLAIMER,
      session_id: sessionId,
      message_id: messageId,
      citations: [],
      guardrail_action: "INTERVENED",
      filters_applied: filtersApplied,
      latency_ms: 140,
      request_id: requestId,
      mode: "demo",
    };
  }

  const q = normalizeText(input.prompt);
  const isPortfolioComparison =
    (q.includes("compar") ||
      q.includes("tabela") ||
      q.includes("portfolio") ||
      q.includes("3 empreendimentos")) &&
    !q.includes("sac") &&
    !q.includes("price");

  // 2. Multi-doc scenario: FGTS + Paredes + Airbnb
  if (
    !isPortfolioComparison &&
    ((q.includes("fgts") && (q.includes("parede") || q.includes("airbnb"))) ||
      (q.includes("parede") && q.includes("airbnb")))
  ) {
    return {
      answer:
        `### Cruzamento Técnico Multi-Documento (Crédito, Engenharia & Convenção)\n\n` +
        `**1. Uso do FGTS (Enquadramento Bancário):**\n` +
        `- **Parque das Palmeiras Residence (Tipo 2Q · R$ 612.000):** **Sim**, aceita FGTS por estar abaixo do teto do SFH (R$ 1.500.000), enquadrando-se em SBPE/SFH e Pró-Cotista. [1]\n` +
        `- **Residencial Horizonte Barra (Tipo A · R$ 2.490.000):** **Não**, enquadra-se exclusivamente no **SFI** (acima de R$ 1,5 milhão), que não permite uso de FGTS. [1]\n\n` +
        `**2. Remoção de Paredes Internas:**\n` +
        `- **Parque das Palmeiras:** **Proibido** — sistema construtivo em alvenaria estrutural autoportante. [2]\n` +
        `- **Residencial Horizonte Barra:** **Permitido** para paredes de vedação (não estruturais), mediante aprovação prévia e emissão de **ART/RRT**. [2]\n` +
        `- **Smart Studio Metrópole:** paredes internas em drywall acústico remanejáveis mediante projeto aprovado. [2]\n\n` +
        `**3. Locação por Temporada / Airbnb (Short-Stay):**\n` +
        `- **Parque das Palmeiras (mín. 30 dias)** e **Horizonte Barra (mín. 90 dias):** Airbnb / diárias **expressamente proibidos**. [3]\n` +
        `- **Smart Studio Metrópole:** **Permitido** (a partir de 1 diária, operação short-stay prevista em convenção). [3]\n\n` +
        `_Valores e condições sujeitos à análise de crédito e tabela vigente._` +
        DEMO_DISCLAIMER,
      session_id: sessionId,
      message_id: messageId,
      citations: [
        makeCitation(
          1,
          "FIN",
          1,
          "O SFH contempla imóveis até R$ 1.500.000,00 com uso de FGTS (SBPE/SFH e Pró-Cotista). Unidades acima desse teto, como o Residencial Horizonte Barra, enquadram-se exclusivamente no SFI sem FGTS."
        ),
        makeCitation(
          2,
          "EMP",
          3,
          "Parque das Palmeiras adota alvenaria estrutural autoportante (proibida remoção de paredes). Horizonte Barra utiliza concreto armado com vedação removível mediante ART/RRT."
        ),
        makeCitation(
          3,
          "COND",
          2,
          "Locação por plataformas digitais (Airbnb/Booking) é proibida no Horizonte Barra (mín. 90 dias) e Parque das Palmeiras (mín. 30 dias), sendo autorizada apenas no Smart Studio Metrópole."
        ),
      ],
      guardrail_action: "NONE",
      filters_applied: filtersApplied,
      latency_ms: 210,
      request_id: requestId,
      mode: "demo",
    };
  }

  // 3. SAC vs Price / Financiamento / Fluxo na Planta / INCC / ITBI
  if (
    !isPortfolioComparison &&
    (q.includes("sac") ||
      q.includes("price") ||
      q.includes("incc") ||
      q.includes("itbi") ||
      q.includes("planta") ||
      q.includes("financiamento") ||
      q.includes("fgts") ||
      q.includes("credito"))
  ) {
    return {
      answer:
        `### Condições Oficiais de Crédito, Fluxo na Planta & Custos de Escritura\n\n` +
        `| Indicador | Sistema SAC | Tabela Price |\n` +
        `| :--- | :--- | :--- |\n` +
        `| **Amortização** | Constante (parcelas decrescentes) | Crescente (parcela fixa + TR) |\n` +
        `| **LTV Máximo (SBPE)** | Até 80% do valor do imóvel | Em geral até 70% em bancos comerciais |\n` +
        `| **Custo Total de Juros** | Menor custo final no contrato | Maior total pago, menor 1ª parcela |\n` +
        `| **Regra Bancária** | Comprometimento ≤ 30% da renda; idade + prazo ≤ 80 anos e 6 meses | Mesma regra de renda e idade |\n\n` +
        `- **Sistemas de Amortização:** no SAC o saldo devedor cai de forma constante (menor juros total e LTV de até 80%); na Tabela Price a parcela inicial é menor, com LTV típico de até 70% no SBPE. [1]\n` +
        `- **Regras de Renda, Idade e Documentação (Salvador/BA):** comprometimento máximo de **30% da renda**, limite **idade + prazo ≤ 80 anos e 6 meses**, **ITBI padrão de 3%** e **50% de desconto no 1º RGI** para imóveis financiados no SFH (Lei nº 6.015/1973, art. 290). [2]\n` +
        `- **Fluxo na planta:** entrada parcelada durante a obra (**35%** divididos em 10% ato, 15% mensais e 10% semestrais corrigidos pelo **INCC-M**) e **65%** na entrega das chaves via financiamento bancário ou recursos próprios. [3]\n\n` +
        `_Valores e condições sujeitos à análise de crédito e tabela vigente._` +
        DEMO_DISCLAIMER,
      session_id: sessionId,
      message_id: messageId,
      citations: [
        makeCitation(
          1,
          "FIN",
          2,
          "Sistemas de Amortização: SAC (prestações decrescentes, menor custo total de juros, cota de até 80% no SBPE) versus Tabela Price (prestações fixas, cota limitada a 70% no SBPE)."
        ),
        makeCitation(
          2,
          "FIN",
          4,
          "Comprometimento máximo de 30% da renda, regra de idade + prazo ≤ 80 anos e 6 meses, ITBI padrão de 3% em Salvador/BA e desconto legal de 50% no 1º RGI no SFH (Lei nº 6.015/1973, art. 290)."
        ),
        makeCitation(
          3,
          "FIN",
          5,
          "Fluxo Padrão ImobiSmart na planta: 35% durante a obra (10% ato, 15% mensais, 10% semestrais) corrigidos mensalmente pelo INCC-M (FGV) e 65% na entrega das chaves."
        ),
      ],
      guardrail_action: "NONE",
      filters_applied: filtersApplied,
      latency_ms: 195,
      request_id: requestId,
      mode: "demo",
    };
  }

  // 4. Reforma / Pets / Fachada / Condomínio / Airbnb
  if (
    !isPortfolioComparison &&
    (q.includes("reforma") ||
      q.includes("art") ||
      q.includes("rrt") ||
      q.includes("pet") ||
      q.includes("fachada") ||
      q.includes("varanda") ||
      q.includes("airbnb") ||
      q.includes("condominio"))
  ) {
    return {
      answer:
        `### Normas de Reforma (ABNT NBR 16280), Fachada, Pets & Locação\n\n` +
        `- **Horário permitido de obras:** segunda a sexta das 08h às 17h (proibido aos sábados, domingos e feriados; envio prévio de Plano de Reforma + ART ou RRT). [1]\n` +
        `- **Aprovação de Reformas & Airbnb:** protocolar o Plano de Reforma no app com **mínimo de 5 dias úteis de antecedência**, anexando **ART/RRT** e relação de prestadores. Locação **short-stay / Airbnb** permitida apenas no **Smart Studio Metrópole** (mín. 1 diária); proibida no *Parque das Palmeiras* (mín. 30 dias) e *Horizonte Barra* (mín. 90 dias). [2]\n` +
        `- **Regras para Pets:** circulação nas áreas comuns com **guia curta (máx. 1,5 m)** e transporte exclusivo pelo **elevador de serviço**; cães acima de 25 kg ou raças de guarda devem usar **focinheira** (exceto no Pet Place de 120 m²). [3]\n` +
        `- **Envidraçamento de varanda & fachada:** vidro laminado incolor **8 mm** (Parque das Palmeiras e Smart Studio) ou **10 mm** (Horizonte Barra), sistema retrátil sem esquadrias verticais e trilhos na cor da fachada (bronze, branco ou preto). [4]` +
        DEMO_DISCLAIMER,
      session_id: sessionId,
      message_id: messageId,
      citations: [
        makeCitation(
          1,
          "COND",
          1,
          "Tabela de horários (Seção 1): obras e reformas permitidas de segunda a sexta das 08h00 às 17h00, proibidas aos sábados, domingos e feriados, mediante Plano de Reforma + ART/RRT (NBR 16280)."
        ),
        makeCitation(
          2,
          "COND",
          2,
          "Aprovação de Reformas com antecedência mínima de 5 dias úteis (ART/RRT) e Política de Locação Short-Stay: Airbnb autorizado apenas no Smart Studio Metrópole (proibido no Horizonte Barra e Parque das Palmeiras)."
        ),
        makeCitation(
          3,
          "COND",
          3,
          "Política de Pets nas áreas comuns: guia curta (até 1,5 m), uso do elevador de serviço, focinheira obrigatória para cães acima de 25 kg ou raças de guarda e áreas restritas."
        ),
        makeCitation(
          4,
          "COND",
          4,
          "Padrão de Fachada e Envidraçamento (Seção 5.2): vidro laminado incolor 8 mm (Palmeiras/Smart) ou 10 mm (Horizonte), sistema retrátil sem esquadrias verticais e trilhos na cor da fachada."
        ),
      ],
      guardrail_action: "NONE",
      filters_applied: filtersApplied,
      latency_ms: 185,
      request_id: requestId,
      mode: "demo",
    };
  }

  // 5. Default / Comparativo de Portfólio (also respects empreendimento filter)
  const scopedHeader =
    filtersApplied.empreendimento !== "todos"
      ? `### Ficha Técnica & Comparativo do Portfólio ImobiSmart (${filtersApplied.empreendimento})\n\n`
      : `### Comparativo Oficial do Portfólio ImobiSmart (Salvador/BA)\n\n`;

  return {
    answer:
      scopedHeader +
      `| Empreendimento | Bairro | Preço Médio/m² | Entrega | Condomínio Est. | Crédito |\n` +
      `| :--- | :--- | :--- | :--- | :--- | :--- |\n` +
      `| **Residencial Horizonte Barra** (\`EMP-HB-2027\`) | Barra | R$ 16.800/m² | Dez/2027 (42% obras) | R$ 1.850–3.400 | SFI (sem FGTS) |\n` +
      `| **Parque das Palmeiras Residence** (\`EMP-PP-2026\`) | Horto Florestal | R$ 9.450/m² | Pronto (Habite-se) | R$ 620–890 | SBPE/SFH · FGTS |\n` +
      `| **Smart Studio Metrópole** (\`EMP-SM-2028\`) | Caminho das Árvores | R$ 13.200/m² | Jun/2028 (12% obras) | R$ 410–680 | MCMV 3/4 · SFH |\n\n` +
      `- **Quadro de Preços & Metragens:** valores médios por m², condomínio estimado e todas as 9 tipologias (26,40 m² a 312,00 m²) constam no quadro oficial do catálogo técnico. [1]\n` +
      `- **Reformas:** Horizonte Barra permite remoção de vedação c/ ART/RRT; Parque das Palmeiras é alvenaria estrutural (proibido remover paredes); Smart Studio usa drywall acústico remanejável. [2]\n` +
      `- **Locação:** apenas o Smart Studio Metrópole autoriza locação de curta temporada (Airbnb). [3]\n\n` +
      `_Valores e condições sujeitos à análise de crédito e tabela vigente._` +
      DEMO_DISCLAIMER,
    session_id: sessionId,
    message_id: messageId,
    citations: [
      makeCitation(
        1,
        "EMP",
        2,
        "Valor médio por m², condomínio estimado e Quadro Técnico de Tipologias, Metragens, Vagas e Preços Base dos 3 empreendimentos da ImobiSmart em Salvador/BA."
      ),
      makeCitation(
        2,
        "EMP",
        3,
        "Regra Crítica sobre Remoção de Paredes: Horizonte Barra (permite vedação c/ ART/RRT), Parque das Palmeiras (alvenaria estrutural — proibido) e Smart Studio (drywall acústico remanejável)."
      ),
      makeCitation(
        3,
        "COND",
        2,
        "Política de Locação de Curta Temporada: Airbnb permitido exclusivamente no Smart Studio Metrópole (mín. 1 diária); proibido no Horizonte Barra (mín. 90 dias) e Parque das Palmeiras (mín. 30 dias)."
      ),
    ],
    guardrail_action: "NONE",
    filters_applied: filtersApplied,
    latency_ms: 175,
    request_id: requestId,
    mode: "demo",
  };
}
