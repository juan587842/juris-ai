// frontend/types/analytics.ts

export interface FunilConversao {
  novo: number;
  contato_feito: number;
  qualificado: number;
  convertido: number;
  perdido: number;
  taxa_conversao_pct: number;
}

export interface ReceitaItem {
  area: string;
  total: number;
}

export interface TaxaExitoItem {
  area: string;
  exito_pct: number;
  total: number;
}

export interface TempoMedioItem {
  area: string;
  media_dias: number;
  total: number;
}

export interface TribunalItem {
  tribunal: string;
  count: number;
}

export interface OrigemItem {
  origem: string;
  count: number;
  pct: number;
}

export interface CarteiraAtiva {
  ativo: number;
  suspenso: number;
  finalizado: number;
  arquivado: number;
  total: number;
}

export interface AtendimentoData {
  volume_conversas: number;
  pct_transbordo: number | null;
  tempo_medio_resposta_segundos: number | null;
}

export interface AnalyticsData {
  funil_conversao: FunilConversao;
  receita_por_area: ReceitaItem[];
  taxa_exito: TaxaExitoItem[];
  taxa_exito_geral: number | null;
  tempo_medio: TempoMedioItem[];
  tempo_medio_geral: number | null;
  distribuicao_tribunal: TribunalItem[];
  origem_leads: OrigemItem[];
  carteira_ativa: CarteiraAtiva;
  atendimento: AtendimentoData;
}

export type Periodo = "30d" | "90d" | "365d";

export const PERIODO_LABELS: Record<Periodo, string> = {
  "30d": "30 dias",
  "90d": "90 dias",
  "365d": "1 ano",
};

export const AREA_LABELS: Record<string, string> = {
  trabalhista: "Trabalhista",
  civil: "Civil",
  criminal: "Criminal",
  familia: "Família",
  empresarial: "Empresarial",
  tributario: "Tributário",
  previdenciario: "Previdenciário",
  imobiliario: "Imobiliário",
  outro: "Outro",
};
