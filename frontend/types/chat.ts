export type SenderType = "lead" | "ai" | "agent" | "system";
export type ConversationStatus = "aberta" | "em_atendimento" | "resolvida" | "pendente";

export interface Lead {
  id: string;
  nome: string | null;
  telefone: string;
  email: string | null;
  status: string;
}

export interface Conversation {
  id: string;
  inbox_id: string;
  lead_id: string;
  status: ConversationStatus;
  assigned_user_id: string | null;
  ai_enabled: boolean;
  last_message_at: string | null;
  created_at: string;
  leads?: Pick<Lead, "id" | "nome" | "telefone">;
}

export interface Message {
  id: string;
  conversation_id: string;
  sender_type: SenderType;
  sender_id: string | null;
  content: string | null;
  media_url: string | null;
  media_type: string | null;
  created_at: string;
}

export interface InternalNote {
  id: string;
  conversation_id: string;
  user_id: string;
  content: string;
  created_at: string;
}
