"use client";

import { useState } from "react";
import type { Conversation } from "@/types/chat";
import { ConversationList } from "./ConversationList";
import { ConversationHeader } from "./ConversationHeader";
import { MessageThread } from "./MessageThread";
import { MessageInput } from "./MessageInput";
import { NotesPanel } from "./NotesPanel";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface Props {
  currentUserId: string;
}

type Tab = "mensagens" | "notas";

export function InboxView({ currentUserId }: Props) {
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [tab, setTab] = useState<Tab>("mensagens");
  const [actionLoading, setActionLoading] = useState(false);

  async function apiAction(path: string, body?: object) {
    setActionLoading(true);
    try {
      await api.post(path, body);
    } finally {
      setActionLoading(false);
    }
  }

  async function handleTakeOver() {
    if (!selected) return;
    await apiAction(`/api/conversations/${selected.id}/pause-ai`);
    setSelected((prev) => prev ? { ...prev, ai_enabled: false, status: "em_atendimento" } : prev);
  }

  async function handleResolve() {
    if (!selected) return;
    await apiAction(`/api/conversations/${selected.id}/resolve`);
    setSelected((prev) => prev ? { ...prev, status: "resolvida" } : prev);
  }

  return (
    <div className="flex h-full bg-background overflow-hidden">
      {/* ── Lista de conversas ── */}
      <aside className="w-72 border-r flex flex-col">
        <div className="p-4 border-b">
          <h1 className="font-semibold">Caixa de entrada</h1>
        </div>
        <ConversationList
          selectedId={selected?.id ?? null}
          onSelect={(conv) => { setSelected(conv); setTab("mensagens"); }}
        />
      </aside>

      {/* ── Área principal ── */}
      <main className="flex-1 flex flex-col min-w-0">
        {selected ? (
          <>
            <ConversationHeader
              conversation={selected}
              onTakeOver={handleTakeOver}
              onResolve={handleResolve}
              loading={actionLoading}
            />

            {/* Tabs */}
            <div className="border-b flex text-sm">
              {(["mensagens", "notas"] as Tab[]).map((t) => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={cn(
                    "px-4 py-2 font-medium capitalize transition-colors",
                    tab === t
                      ? "border-b-2 border-primary text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  {t === "mensagens" ? "Mensagens" : "Notas internas"}
                </button>
              ))}
            </div>

            {tab === "mensagens" ? (
              <>
                <MessageThread conversationId={selected.id} />
                <MessageInput
                  conversationId={selected.id}
                  disabled={selected.ai_enabled}
                />
              </>
            ) : (
              <NotesPanel
                conversationId={selected.id}
                currentUserId={currentUserId}
              />
            )}
          </>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Selecione uma conversa para começar.
          </div>
        )}
      </main>
    </div>
  );
}

