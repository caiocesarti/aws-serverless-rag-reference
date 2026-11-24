import type { DominioKb, EmpreendimentoId } from "./types";

export interface TipologiaSpec {
  id: string;
  empreendimentoId: Exclude<EmpreendimentoId, "todos">;
  empreendimentoNome: string;
  nome: string;
  dormitorios: string;
  privativaCobertaM2: number;
  varandaM2: number;
  privativaTotalM2: number;
  vagas: string;
  precoBase: number;
  aceitaFgts: boolean;
  enquadramento: string;
}

export interface EmpreendimentoSpec {
  id: Exclude<EmpreendimentoId, "todos">;
  codigo: string;
  nome: string;
  nomeCurto: string;
  image: string;
  imageAlt: string;
  statusCurto: string;
  bairro: string;
  endereco: string;
  segmento: string;
  estagio: string;
  entrega: string;
  torres: string;
  unidades: string;
  precoM2: string;
  condominioEstimado: string;
  enquadramentoCredito: string;
  aceitaFgts: boolean;
  aceitaAirbnb: boolean;
  prazoMinLocacao: string;
  permiteRemoverParede: "sim-art" | "proibido" | "drywall";
  regraParedeResumo: string;
  destaqueLazer: string;
  taxaSalaoFestas: string;
  tipologias: TipologiaSpec[];
}

export const PORTFOLIO: EmpreendimentoSpec[] = [
  {
    id: "horizonte-barra",
    codigo: "EMP-HB-2027",
    nome: "Residencial Horizonte Barra",
    nomeCurto: "Horizonte Barra",
    image: "/images/properties/horizonte-barra.jpg",
    imageAlt: "Fachada de alto padrão com piscina e varandas do Residencial Horizonte Barra",
    statusCurto: "Obras · 42%",
    bairro: "Barra · Salvador/BA",
    endereco: "Av. Oceânica, 1.450 — Barra",
    segmento: "Alto Padrão (Luxo Frente Mar)",
    estagio: "Em Obras (42% concluído)",
    entrega: "Dezembro de 2027",
    torres: "1 Torre · 28 pavimentos",
    unidades: "52 unidades (2/andar)",
    precoM2: "R$ 16.800/m²",
    condominioEstimado: "R$ 1.850 a R$ 3.400/mês",
    enquadramentoCredito: "SFI Exclusivo (sem FGTS)",
    aceitaFgts: false,
    aceitaAirbnb: false,
    prazoMinLocacao: "Mín. 90 dias",
    permiteRemoverParede: "sim-art",
    regraParedeResumo: "Concreto armado · Permite remoção não estrutural c/ ART/RRT",
    destaqueLazer: "Raia 25m aquecida borda infinita · Academia 180m² Technogym · Gerador Full 450 kVA",
    taxaSalaoFestas: "R$ 350,00 (80 pessoas)",
    tipologias: [
      {
        id: "hb-tipo-a",
        empreendimentoId: "horizonte-barra",
        empreendimentoNome: "Residencial Horizonte Barra",
        nome: "Tipo A — 3 Suítes + Lavabo + Dep.",
        dormitorios: "3 suítes + lavabo + dep.",
        privativaCobertaM2: 126.5,
        varandaM2: 22.0,
        privativaTotalM2: 148.5,
        vagas: "3 vagas soltas",
        precoBase: 2490000,
        aceitaFgts: false,
        enquadramento: "SFI",
      },
      {
        id: "hb-tipo-b",
        empreendimentoId: "horizonte-barra",
        empreendimentoNome: "Residencial Horizonte Barra",
        nome: "Tipo B — 4 Suítes + Lavabo + Dep.",
        dormitorios: "4 suítes + lavabo + dep.",
        privativaCobertaM2: 158.2,
        varandaM2: 28.0,
        privativaTotalM2: 186.2,
        vagas: "3 vagas + dep. 4,5 m²",
        precoBase: 3150000,
        aceitaFgts: false,
        enquadramento: "SFI",
      },
      {
        id: "hb-duplex",
        empreendimentoId: "horizonte-barra",
        empreendimentoNome: "Residencial Horizonte Barra",
        nome: "Cobertura Duplex — 4 Suítes + Piscina",
        dormitorios: "4 suítes + piscina priv.",
        privativaCobertaM2: 242.0,
        varandaM2: 70.0,
        privativaTotalM2: 312.0,
        vagas: "4 vagas + dep. 6,0 m²",
        precoBase: 5480000,
        aceitaFgts: false,
        enquadramento: "SFI",
      },
    ],
  },
  {
    id: "parque-das-palmeiras",
    codigo: "EMP-PP-2026",
    nome: "Parque das Palmeiras Residence",
    nomeCurto: "Parque das Palmeiras",
    image: "/images/properties/parque-das-palmeiras.jpg",
    imageAlt: "Área de lazer com piscina e palmeiras do Parque das Palmeiras Residence",
    statusCurto: "Pronto p/ Morar",
    bairro: "Horto Florestal · Salvador/BA",
    endereco: "Rua das Acácias, 820 — Horto Florestal",
    segmento: "Médio Padrão (Condomínio Clube)",
    estagio: "Pronto para Morar (Habite-se Mar/2026)",
    entrega: "Imediata",
    torres: "3 Torres (Ipê, Jacarandá, Aroeira)",
    unidades: "324 unidades (6/andar)",
    precoM2: "R$ 9.450/m²",
    condominioEstimado: "R$ 620 a R$ 890/mês",
    enquadramentoCredito: "SBPE / SFH e Pró-Cotista (FGTS)",
    aceitaFgts: true,
    aceitaAirbnb: false,
    prazoMinLocacao: "Mín. 30 dias",
    permiteRemoverParede: "proibido",
    regraParedeResumo: "Alvenaria estrutural autoportante · PROIBIDO remover paredes",
    destaqueLazer: "Pet Place 120m² · 2 Salões + 3 Churrasqueiras · Quadra Poliesportiva · Pista Cooper 350m",
    taxaSalaoFestas: "R$ 220,00 (60 pessoas)",
    tipologias: [
      {
        id: "pp-2q",
        empreendimentoId: "parque-das-palmeiras",
        empreendimentoNome: "Parque das Palmeiras Residence",
        nome: "Tipo 2Q — 2 Quartos (1 Suíte)",
        dormitorios: "2 quartos (1 suíte)",
        privativaCobertaM2: 56.3,
        varandaM2: 8.5,
        privativaTotalM2: 64.8,
        vagas: "1 vaga coberta",
        precoBase: 612000,
        aceitaFgts: true,
        enquadramento: "SBPE / SFH · Pró-Cotista",
      },
      {
        id: "pp-3q",
        empreendimentoId: "parque-das-palmeiras",
        empreendimentoNome: "Parque das Palmeiras Residence",
        nome: "Tipo 3Q — 3 Quartos (1 Suíte + Lav.)",
        dormitorios: "3 quartos (1 suíte + lav.)",
        privativaCobertaM2: 72.9,
        varandaM2: 11.5,
        privativaTotalM2: 84.4,
        vagas: "2 vagas (1 presa)",
        precoBase: 798000,
        aceitaFgts: true,
        enquadramento: "SBPE / SFH · Pró-Cotista",
      },
      {
        id: "pp-garden",
        empreendimentoId: "parque-das-palmeiras",
        empreendimentoNome: "Parque das Palmeiras Residence",
        nome: "Garden — 2 Quartos + Quintal 36 m²",
        dormitorios: "2 quartos (1 suíte)",
        privativaCobertaM2: 72.6,
        varandaM2: 36.0,
        privativaTotalM2: 108.6,
        vagas: "1 vaga coberta",
        precoBase: 865000,
        aceitaFgts: true,
        enquadramento: "SBPE / SFH · Pró-Cotista",
      },
    ],
  },
  {
    id: "smart-studio-metropole",
    codigo: "EMP-SM-2028",
    nome: "Smart Studio Metrópole",
    nomeCurto: "Smart Studio Metrópole",
    image: "/images/properties/smart-studio-metropole.jpg",
    imageAlt: "Torre urbana moderna em vidro e alumínio escuro do Smart Studio Metrópole",
    statusCurto: "Lançamento · 12%",
    bairro: "Caminho das Árvores · Salvador/BA",
    endereco: "Av. Tancredo Neves, 2.100 — Caminho das Árvores",
    segmento: "Compacto / Investidor (Short-Stay)",
    estagio: "Lançamento / Fundação (12%)",
    entrega: "Junho de 2028",
    torres: "1 Torre · 22 pavimentos",
    unidades: "240 unidades (12/andar)",
    precoM2: "R$ 13.200/m²",
    condominioEstimado: "R$ 410 a R$ 680/mês",
    enquadramentoCredito: "MCMV Faixa 3/4 ou SBPE / SFH",
    aceitaFgts: true,
    aceitaAirbnb: true,
    prazoMinLocacao: "1 diária (Short-Stay OK)",
    permiteRemoverParede: "drywall",
    regraParedeResumo: "Drywall acústico (lã de rocha) · Remanejável c/ projeto aprovado",
    destaqueLazer: "Piscina Rooftop 22º andar aquecida · Academia 24h · Hub Coworking 40 pos. · Lavanderia OMO",
    taxaSalaoFestas: "R$ 180,00 (Lounge Rooftop 35 p.)",
    tipologias: [
      {
        id: "sm-compacto",
        empreendimentoId: "smart-studio-metropole",
        empreendimentoNome: "Smart Studio Metrópole",
        nome: "Compacto — Studio Integrado",
        dormitorios: "Studio integrado (1 banh.)",
        privativaCobertaM2: 26.4,
        varandaM2: 0,
        privativaTotalM2: 26.4,
        vagas: "Sem vaga",
        precoBase: 348000,
        aceitaFgts: true,
        enquadramento: "MCMV Faixa 3/4 · SBPE/SFH",
      },
      {
        id: "sm-plus",
        empreendimentoId: "smart-studio-metropole",
        empreendimentoNome: "Smart Studio Metrópole",
        nome: "Plus Varanda — Studio + Varanda",
        dormitorios: "Studio integrado (1 banh.)",
        privativaCobertaM2: 29.4,
        varandaM2: 5.5,
        privativaTotalM2: 34.9,
        vagas: "Sem vaga (rotativa)",
        precoBase: 462000,
        aceitaFgts: true,
        enquadramento: "MCMV Faixa 4 · SBPE/SFH",
      },
      {
        id: "sm-loft",
        empreendimentoId: "smart-studio-metropole",
        empreendimentoNome: "Smart Studio Metrópole",
        nome: "Loft Duplex — 1 Suíte Pé-Direito 5,20m",
        dormitorios: "1 suíte mezanino + lav.",
        privativaCobertaM2: 42.2,
        varandaM2: 6.0,
        privativaTotalM2: 48.2,
        vagas: "1 vaga carro compacto",
        precoBase: 645000,
        aceitaFgts: true,
        enquadramento: "SBPE / SFH · Pró-Cotista",
      },
    ],
  },
];

export const ALL_TIPOLOGIAS: TipologiaSpec[] = PORTFOLIO.flatMap((p) => p.tipologias);

export const DOMINIOS_KB: { id: DominioKb; label: string; docCode: string; version: string }[] = [
  { id: "empreendimentos", label: "Catálogo & Plantas", docCode: "IMOBI-EMP-001", version: "v2.1" },
  { id: "condominio", label: "Condomínio & Normas", docCode: "IMOBI-COND-002", version: "v3.0" },
  { id: "credito", label: "Crédito & Financiamento", docCode: "IMOBI-FIN-003", version: "v4.0" },
];

export const QUICK_PROMPTS: {
  title: string;
  subtitle: string;
  tag: string;
  prompt: string;
}[] = [
  {
    title: "FGTS, Paredes e Airbnb (3 PDFs)",
    subtitle: "Cruzamento multi-documento entre crédito, engenharia e convenção",
    tag: "Multi-Documento",
    prompt:
      "Posso usar FGTS para comprar o Parque das Palmeiras Tipo 2Q e o Residencial Horizonte Barra Tipo A? E em qual deles posso remover paredes internas e fazer Airbnb?",
  },
  {
    title: "Comparativo de Portfólio",
    subtitle: "Metragens, preço/m², entrega e enquadramento bancário",
    tag: "IMOBI-EMP-001",
    prompt:
      "Monte uma tabela comparando os 3 empreendimentos da ImobiSmart (preço médio por m², estágio da obra, entrega, condomínio estimado e enquadramento SFH/SFI/MCMV).",
  },
  {
    title: "Regras de Reforma, Pets & Fachada",
    subtitle: "ABNT NBR 16280, horários, focinheira e envidraçamento de varanda",
    tag: "IMOBI-COND-002",
    prompt:
      "Quais são os prazos e exigências para aprovar uma reforma (ART/RRT), qual o padrão de envidraçamento de varanda por empreendimento e quais as regras para pets?",
  },
  {
    title: "Fluxo na Planta, INCC & Escritura",
    subtitle: "Entrada 35%/65%, correção INCC-M, ITBI em Salvador e desconto 50% RGI",
    tag: "IMOBI-FIN-003",
    prompt:
      "Como funciona o fluxo de pagamento na planta (ato, mensais, semestrais e chaves), como incide o INCC-M e quais os custos de ITBI em Salvador e desconto de 50% no registro?",
  },
];

export function formatBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    maximumFractionDigits: 0,
  }).format(value);
}
