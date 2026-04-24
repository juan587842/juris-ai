export interface NotifPreferences {
  dias_processo: number;
  dias_lead: number;
  dias_prazo: number;
  dias_oportunidade: number;
  canal: "whatsapp" | "email";
}

export interface PerfilData {
  id: string;
  full_name: string;
  oab_number: string | null;
  avatar_url: string | null;
  email: string;
  role: "admin" | "advogado" | "atendente";
  notif_preferences: NotifPreferences;
}

export interface EscritorioData {
  id?: string;
  nome: string;
  oab: string | null;
  logo_url: string | null;
  endereco: string | null;
  telefone: string | null;
  site: string | null;
  assinatura: string | null;
  rodape: string | null;
}

export interface InboxData {
  id: string;
  nome: string;
  canal: "whatsapp" | "webchat" | "email";
  evolution_instance: string | null;
  ativo: boolean;
}

export const ROLE_LABELS: Record<PerfilData["role"], string> = {
  admin: "Administrador",
  advogado: "Advogado(a)",
  atendente: "Atendente",
};

export const CANAL_LABELS: Record<InboxData["canal"], string> = {
  whatsapp: "WhatsApp",
  webchat: "Web Chat",
  email: "E-mail",
};

export type EvolutionState = "open" | "close" | "connecting" | "unknown";

export const DEFAULT_NOTIF_PREFERENCES: NotifPreferences = {
  dias_processo: 7,
  dias_lead: 3,
  dias_prazo: 5,
  dias_oportunidade: 14,
  canal: "whatsapp",
};
