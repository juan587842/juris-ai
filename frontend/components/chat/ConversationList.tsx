"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

interface Props {
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const STATUS_COLORS: Record<string, string> = {
  aberta: "bg-blue-500",
  em_atendimento: "bg-yellow-500",
  resolvida: "bg-green-500",
  pendente: "bg-gray-400",
};

export function ConversationList({ selectedId, onSelect }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("conversations")
        .select("*, leads(id, nome, telefone)")
        .neq("status", "resolvida")
        .order("last_message_at", { ascending: false })
        .limit(60);
      if (data) setConversations(data as Conversation[]);
    }
    load();

    const channel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => load()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, []);

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
        Nenhuma conversa ativa.
        <br />
        Aguardando mensagens via WhatsApp.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => {
        const name = conv.leads?.nome || conv.leads?.telefone || "Sem nome";
        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={cn(
              "w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors",
              selectedId === conv.id && "bg-muted"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full flex-shrink-0",
                    STATUS_COLORS[conv.status] ?? "bg-gray-400"
                  )}
                />
                <span className="font-medium text-sm truncate">{name}</span>
              </div>
              <span className="text-xs text-muted-foreground flex-shrink-0">
                {formatTime(conv.last_message_at)}
              </span>
            </div>
            <div className="flex items-center gap-1 mt-0.5 pl-4">
              {conv.ai_enabled ? (
                <Bot className="h-3 w-3 text-violet-500 flex-shrink-0" />
              ) : (
                <User className="h-3 w-3 text-blue-500 flex-shrink-0" />
              )}
              <span className="text-xs text-muted-foreground truncate">
                {conv.ai_enabled ? "IA ativa" : "Atendimento humano"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
