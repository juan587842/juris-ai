"use client";

import type { Conversation } from "@/types/chat";
import { Bot, UserCheck, CheckCheck, Phone } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  conversation: Conversation;
  onTakeOver: () => Promise<void>;
  onResolve: () => Promise<void>;
  loading?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_atendimento: "Em atendimento",
  resolvida: "Resolvida",
  pendente: "Pendente",
};

export function ConversationHeader({ conversation, onTakeOver, onResolve, loading }: Props) {
  const name = conversation.leads?.nome || conversation.leads?.telefone || "Lead";

  return (
    <div className="border-b px-4 py-3 flex items-center justify-between gap-4 bg-background">
      <div className="flex items-center gap-3 min-w-0">
        <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold flex-shrink-0">
          {name.charAt(0).toUpperCase()}
        </div>
        <div className="min-w-0">
          <p className="font-medium text-sm truncate">{name}</p>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            <Phone className="h-3 w-3" />
            <span>{conversation.leads?.telefone}</span>
            <span>·</span>
            <span>{STATUS_LABELS[conversation.status] ?? conversation.status}</span>
          </div>
        </div>
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Indicador de IA */}
        <div
          className={cn(
            "flex items-center gap-1 rounded-full px-2 py-1 text-xs",
            conversation.ai_enabled
              ? "bg-violet-100 text-violet-700"
              : "bg-blue-100 text-blue-700"
          )}
        >
          <Bot className="h-3 w-3" />
          <span>{conversation.ai_enabled ? "IA ativa" : "Humano"}</span>
        </div>

        {/* Assumir conversa */}
        {conversation.ai_enabled && conversation.status !== "resolvida" && (
          <button
            onClick={onTakeOver}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <UserCheck className="h-3.5 w-3.5" />
            Assumir
          </button>
        )}

        {/* Resolver */}
        {conversation.status !== "resolvida" && (
          <button
            onClick={onResolve}
            disabled={loading}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
          >
            <CheckCheck className="h-3.5 w-3.5" />
            Resolver
          </button>
        )}
      </div>
    </div>
  );
}
