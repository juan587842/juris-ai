export type TipoAlerta =
  | "processo_sem_andamento"
  | "lead_sem_contato"
  | "prazo_fatal"
  | "oportunidade_parada";

export type SeveridadeAlerta = "alta" | "media" | "baixa";

export interface Alerta {
  tipo: TipoAlerta;
  id: string;
  titulo: string;
  descricao: string;
  link: string;
  severidade: SeveridadeAlerta;
  dias: number;
}

export interface AlertasConfig {
  dias_processo: number;
  dias_lead: number;
  dias_prazo: number;
  dias_oportunidade: number;
}

export const DEFAULT_CONFIG: AlertasConfig = {
  dias_processo: 30,
  dias_lead: 7,
  dias_prazo: 5,
  dias_oportunidade: 15,
};

export const TIPO_LABELS: Record<TipoAlerta, string> = {
  processo_sem_andamento: "Processos sem andamento",
  lead_sem_contato: "Leads sem contato",
  prazo_fatal: "Prazos fatais próximos",
  oportunidade_parada: "Oportunidades paradas",
};

export const SEVERIDADE_COLORS: Record<SeveridadeAlerta, { bg: string; text: string }> = {
  alta: { bg: "rgba(239,68,68,.15)", text: "#ef4444" },
  media: { bg: "rgba(245,158,11,.15)", text: "#f59e0b" },
  baixa: { bg: "rgba(99,102,241,.15)", text: "#818cf8" },
};

export const SEVERIDADE_LABELS: Record<SeveridadeAlerta, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const CONFIG_LABELS: Record<keyof AlertasConfig, string> = {
  dias_processo: "Processos sem andamento (dias)",
  dias_lead: "Leads sem contato (dias)",
  dias_prazo: "Prazos fatais — antecedência (dias)",
  dias_oportunidade: "Oportunidades paradas (dias)",
};
