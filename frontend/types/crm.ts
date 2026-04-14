export type LeadStatus =
  | "novo"
  | "contato_feito"
  | "qualificado"
  | "desqualificado"
  | "convertido";

export type AreaJuridica =
  | "trabalhista"
  | "civil"
  | "criminal"
  | "familia"
  | "empresarial"
  | "tributario"
  | "previdenciario"
  | "imobiliario"
  | "outro";

export type OportunidadeEstagio =
  | "novo_lead"
  | "qualificado"
  | "proposta_enviada"
  | "negociacao"
  | "ganho"
  | "perdido";

export interface Lead {
  id: string;
  nome: string | null;
  telefone: string;
  email: string | null;
  origem: string | null;
  status: LeadStatus;
  area_interesse: AreaJuridica | null;
  notas: string | null;
  assigned_to: string | null;
  created_at: string;
  updated_at: string;
}

export interface Oportunidade {
  id: string;
  lead_id: string;
  titulo: string;
  estagio: OportunidadeEstagio;
  valor_estimado: number | null;
  area_juridica: AreaJuridica | null;
  assigned_to: string | null;
  data_fechamento: string | null;
  notas: string | null;
  created_at: string;
  updated_at: string;
  leads?: { id: string; nome: string | null; telefone: string };
}

export interface LeadDetail {
  lead: Lead;
  conversations: Array<{
    id: string;
    status: string;
    ai_enabled: boolean;
    last_message_at: string | null;
    created_at: string;
  }>;
  oportunidades: Oportunidade[];
}

export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  novo: "Novo",
  contato_feito: "Contato feito",
  qualificado: "Qualificado",
  desqualificado: "Desqualificado",
  convertido: "Convertido",
};

export const LEAD_STATUS_ORDER: LeadStatus[] = [
  "novo",
  "contato_feito",
  "qualificado",
  "convertido",
  "desqualificado",
];

export const AREA_JURIDICA_LABELS: Record<AreaJuridica, string> = {
  trabalhista: "Trabalhista",
  civil: "Cível",
  criminal: "Criminal",
  familia: "Família",
  empresarial: "Empresarial",
  tributario: "Tributário",
  previdenciario: "Previdenciário",
  imobiliario: "Imobiliário",
  outro: "Outro",
};
