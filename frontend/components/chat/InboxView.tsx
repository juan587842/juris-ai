"use client";

import { useState } from "react";
import { Scale, MessageSquare, Kanban, FileText, LogOut } from "lucide-react";
import Link from "next/link";
import { createBrowserClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import type { Conversation } from "@/types/chat";
import { ConversationList } from "./ConversationList";
import { ConversationHeader } from "./ConversationHeader";
import { MessageThread } from "./MessageThread";
import { MessageInput } from "./MessageInput";
import { NotesPanel } from "./NotesPanel";
import { cn } from "@/lib/utils";

interface Props {
  currentUserId: string;
}

type Tab = "mensagens" | "notas";

export function InboxView({ currentUserId }: Props) {
  const [selected, setSelected] = useState<Conversation | null>(null);
  const [tab, setTab] = useState<Tab>("mensagens");
  const [actionLoading, setActionLoading] = useState(false);
  const router = useRouter();
  const supabase = createBrowserClient();

  async function apiAction(path: string, body?: object) {
    setActionLoading(true);
    try {
      await fetch(`${process.env.NEXT_PUBLIC_API_URL}${path}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: body ? JSON.stringify(body) : undefined,
      });
      // Atualizar conversa selecionada localmente
      if (selected) {
        setSelected((prev) => prev ? { ...prev, ai_enabled: false, status: "em_atendimento" } : prev);
      }
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

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <div className="flex h-screen bg-background overflow-hidden">
      {/* ── Nav lateral ── */}
      <nav className="w-14 border-r flex flex-col items-center py-3 gap-4 bg-card">
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-primary text-primary-foreground">
          <Scale className="h-4 w-4" />
        </div>
        <div className="flex-1 flex flex-col items-center gap-1 mt-2">
          <NavItem href="/inbox" icon={<MessageSquare className="h-5 w-5" />} label="Inbox" active />
          <NavItem href="/crm" icon={<Kanban className="h-5 w-5" />} label="CRM" />
          <NavItem href="/processos" icon={<FileText className="h-5 w-5" />} label="Processos" />
        </div>
        <button
          onClick={handleLogout}
          className="p-2 rounded-lg text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
          title="Sair"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </nav>

      {/* ── Lista de conversas ── */}
      <aside className="w-72 border-r flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
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

function NavItem({
  href,
  icon,
  label,
  active,
}: {
  href: string;
  icon: React.ReactNode;
  label: string;
  active?: boolean;
}) {
  return (
    <Link
      href={href}
      title={label}
      className={cn(
        "p-2 rounded-lg transition-colors",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-muted"
      )}
    >
      {icon}
    </Link>
  );
}
