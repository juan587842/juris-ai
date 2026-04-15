export interface ProcessosStats {
  total: number;
  ativo: number;
  suspenso: number;
  finalizado: number;
}

export interface LeadsStats {
  total: number;
  novo: number;
  contato_feito: number;
  qualificado: number;
  convertido: number;
  desqualificado: number;
}

export interface AndamentoRecente {
  id: string;
  processo_id: string;
  processo_cnj: string;
  data_andamento: string;
  texto_original: string;
  created_at: string;
}

export interface LeadRecente {
  id: string;
  nome: string | null;
  telefone: string;
  status: string;
  created_at: string;
}

export interface IntimacaoUrgente {
  id: string;
  processo_id: string;
  processo_cnj: string;
  prazo_fatal: string;
  fonte: string;
}

export interface DashboardStats {
  processos: ProcessosStats;
  leads: LeadsStats;
  intimacoes_urgentes: IntimacaoUrgente[];
  andamentos_recentes: AndamentoRecente[];
  leads_recentes: LeadRecente[];
}
