import type { AreaJuridica } from "./crm";

export type ProcessoStatus = "ativo" | "suspenso" | "finalizado" | "arquivado";
export type FonteIntimacao = "DJEN" | "DJE" | "domicilio_judicial";

export interface Andamento {
  id: string;
  processo_id: string;
  data_andamento: string;
  texto_original: string;
  texto_traduzido: string | null;
  notificado_cliente: boolean;
  created_at: string;
}

export interface Intimacao {
  id: string;
  processo_id: string;
  fonte: FonteIntimacao;
  data_publicacao: string;
  prazo_fatal: string | null;
  texto: string | null;
  notificado_em: string | null;
  created_at: string;
}

export interface Processo {
  id: string;
  numero_cnj: string;
  cliente_id: string | null;
  advogado_id: string | null;
  tribunal: string | null;
  vara: string | null;
  area_juridica: AreaJuridica | null;
  status: ProcessoStatus;
  created_at: string;
  updated_at: string;
}

export interface ProcessoDetail {
  processo: Processo;
  andamentos: Andamento[];
  intimacoes: Intimacao[];
}

export const PROCESSO_STATUS_LABELS: Record<ProcessoStatus, string> = {
  ativo: "Ativo",
  suspenso: "Suspenso",
  finalizado: "Finalizado",
  arquivado: "Arquivado",
};

export const PROCESSO_STATUS_COLORS: Record<ProcessoStatus, string> = {
  ativo: "bg-green-100 text-green-700",
  suspenso: "bg-yellow-100 text-yellow-700",
  finalizado: "bg-blue-100 text-blue-700",
  arquivado: "bg-gray-100 text-gray-500",
};

export const FONTE_INTIMACAO_LABELS: Record<FonteIntimacao, string> = {
  DJEN: "DJEN",
  DJE: "DJE",
  domicilio_judicial: "Domicílio Judicial",
};
