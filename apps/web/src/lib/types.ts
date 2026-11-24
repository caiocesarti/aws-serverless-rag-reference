export type Persona = "corretor" | "comprador";

export type EmpreendimentoId =
  | "todos"
  | "horizonte-barra"
  | "parque-das-palmeiras"
  | "smart-studio-metropole";

export type DominioKb = "empreendimentos" | "condominio" | "credito";

export interface Citation {
  index: number;
  codigo_doc: string;
  titulo: string;
  dominio_kb: string;
  versao: string;
  vigencia: string;
  snippet: string;
  presigned_url: string | null;
  s3_key: string | null;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: string;
  citations?: Citation[];
  guardrailAction?: string;
  latencyMs?: number;
  feedback?: "up" | "down" | null;
  filtersApplied?: {
    persona: string;
    empreendimento: string;
    dominios: string[];
  };
}

export interface HealthResponse {
  status: "ok" | "degraded" | "offline";
  service?: string;
  version?: string;
  kb_configured?: boolean;
  guardrail_configured?: boolean;
  checked_at?: string;
}
