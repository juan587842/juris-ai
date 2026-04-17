# Chat — Lacunas (Filtro, Busca, Retomar IA) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar filtro de status, busca por nome/telefone e botão "Retomar IA" no módulo de chat existente.

**Architecture:** Três modificações em componentes React existentes. Toda filtragem é client-side sobre o array já carregado via Supabase Realtime — sem novos endpoints. O `InboxView` ganha um novo handler que propaga para `ConversationHeader`.

**Tech Stack:** Next.js 14, React, TypeScript, Tailwind CSS, Supabase Realtime (já configurado)

---

## File Map

| Arquivo | Tipo | Mudança |
|---|---|---|
| `frontend/components/chat/ConversationList.tsx` | Modify | + estado `filter`/`search`, + barra de busca, + tabs pill com badges |
| `frontend/components/chat/ConversationHeader.tsx` | Modify | + prop `onResumeAI`, lógica condicional "Assumir" vs "Retomar IA" |
| `frontend/components/chat/InboxView.tsx` | Modify | + handler `handleResumeAI`, passa `onResumeAI` para `ConversationHeader` |

---

## Task 1: ConversationList — Busca + Filtro de Status

**Files:**
- Modify: `frontend/components/chat/ConversationList.tsx`

- [ ] **Step 1: Substituir o conteúdo de `ConversationList.tsx` pelo código abaixo**

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Conversation, ConversationStatus } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Bot, User, Search } from "lucide-react";

interface Props {
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
}

type FilterOption = ConversationStatus | "todos";

const FILTER_TABS: { value: FilterOption; label: string }[] = [
  { value: "todos", label: "Todos" },
  { value: "aberta", label: "Aberta" },
  { value: "em_atendimento", label: "Atendimento" },
  { value: "pendente", label: "Pendente" },
];

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
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const [filter, setFilter] = useState<FilterOption>("todos");
  const [search, setSearch] = useState("");
  const selectedIdRef = useRef(selectedId);
  const supabase = createBrowserClient();

  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (selectedId) {
      setUnreadCounts((prev) => {
        const next = new Map(prev);
        next.delete(selectedId);
        return next;
      });
    }
  }, [selectedId]);

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

    const convChannel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => load()
      )
      .subscribe();

    const msgChannel = supabase
      .channel("messages-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { conversation_id: string; sender_type: string };
          if (msg.sender_type !== "lead") return;
          if (msg.conversation_id === selectedIdRef.current) return;
          setUnreadCounts((prev) => {
            const next = new Map(prev);
            next.set(msg.conversation_id, (next.get(msg.conversation_id) ?? 0) + 1);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
      supabase.removeChannel(msgChannel);
    };
  }, []);

  const countByStatus = (status: ConversationStatus) =>
    conversations.filter((c) => c.status === status).length;

  const visible = conversations
    .filter((c) => filter === "todos" || c.status === filter)
    .filter((c) => {
      if (!search) return true;
      const q = search.toLowerCase();
      return (
        c.leads?.nome?.toLowerCase().includes(q) ||
        c.leads?.telefone?.includes(q)
      );
    });

  return (
    <div className="flex flex-col h-full">
      {/* Busca */}
      <div className="px-3 pt-3 pb-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por nome ou telefone…"
            className="w-full rounded-md border border-input bg-background pl-8 pr-3 py-1.5 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
      </div>

      {/* Tabs de filtro */}
      <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
        {FILTER_TABS.map(({ value, label }) => {
          const count =
            value === "todos"
              ? conversations.length
              : countByStatus(value as ConversationStatus);
          return (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={cn(
                "flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium whitespace-nowrap transition-colors",
                filter === value
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-muted-foreground hover:bg-muted/80"
              )}
            >
              {label}
              {count > 0 && (
                <span
                  className={cn(
                    "rounded-full px-1.5 py-0.5 text-[10px] leading-none",
                    filter === value
                      ? "bg-primary-foreground/20 text-primary-foreground"
                      : "bg-background text-foreground"
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Lista */}
      <div className="flex-1 overflow-y-auto">
        {visible.length === 0 ? (
          <div className="flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
            {search || filter !== "todos"
              ? "Nenhuma conversa encontrada."
              : "Nenhuma conversa ativa.\nAguardando mensagens via WhatsApp."}
          </div>
        ) : (
          visible.map((conv) => {
            const name = conv.leads?.nome || conv.leads?.telefone || "Lead";
            const unread = unreadCounts.get(conv.id) ?? 0;
            return (
              <button
                key={conv.id}
                onClick={() => onSelect(conv)}
                className={cn(
                  "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-muted/50 transition-colors border-b border-border/40",
                  selectedId === conv.id && "bg-muted"
                )}
              >
                <div className="relative flex-shrink-0">
                  <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center text-sm font-semibold">
                    {name.charAt(0).toUpperCase()}
                  </div>
                  <span
                    className={cn(
                      "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-background",
                      STATUS_COLORS[conv.status] ?? "bg-gray-400"
                    )}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-1">
                    <p className="text-sm font-medium truncate">{name}</p>
                    <span className="text-xs text-muted-foreground flex-shrink-0">
                      {formatTime(conv.last_message_at)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between gap-1">
                    <div className="flex items-center gap-1 text-xs text-muted-foreground">
                      {conv.ai_enabled ? (
                        <Bot className="h-3 w-3" />
                      ) : (
                        <User className="h-3 w-3" />
                      )}
                      <span>{conv.ai_enabled ? "IA" : "Humano"}</span>
                    </div>
                    {unread > 0 && (
                      <span className="rounded-full bg-primary text-primary-foreground text-[10px] leading-none px-1.5 py-0.5 font-semibold">
                        {unread}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros relacionados a `ConversationList`.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/chat/ConversationList.tsx
git commit -m "feat(chat): adicionar busca e filtro de status na lista de conversas"
```

---

## Task 2: ConversationHeader — Botão "Retomar IA"

**Files:**
- Modify: `frontend/components/chat/ConversationHeader.tsx`

- [ ] **Step 1: Substituir o conteúdo de `ConversationHeader.tsx` pelo código abaixo**

```tsx
"use client";

import type { Conversation } from "@/types/chat";
import { Bot, UserCheck, CheckCheck, Phone, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  conversation: Conversation;
  onTakeOver: () => Promise<void>;
  onResumeAI: () => Promise<void>;
  onResolve: () => Promise<void>;
  loading?: boolean;
}

const STATUS_LABELS: Record<string, string> = {
  aberta: "Aberta",
  em_atendimento: "Em atendimento",
  resolvida: "Resolvida",
  pendente: "Pendente",
};

export function ConversationHeader({
  conversation,
  onTakeOver,
  onResumeAI,
  onResolve,
  loading,
}: Props) {
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

        {conversation.status !== "resolvida" && (
          <>
            {conversation.ai_enabled ? (
              <button
                onClick={onTakeOver}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                <UserCheck className="h-3.5 w-3.5" />
                Assumir
              </button>
            ) : (
              <button
                onClick={onResumeAI}
                disabled={loading}
                className="flex items-center gap-1.5 rounded-md bg-violet-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Retomar IA
              </button>
            )}

            <button
              onClick={onResolve}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs font-medium hover:bg-muted disabled:opacity-50 transition-colors"
            >
              <CheckCheck className="h-3.5 w-3.5" />
              Resolver
            </button>
          </>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar tipos TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: erro de tipo em `InboxView.tsx` reclamando que `onResumeAI` está faltando — isso é esperado e será corrigido na Task 3.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/chat/ConversationHeader.tsx
git commit -m "feat(chat): adicionar botão Retomar IA no header da conversa"
```

---

## Task 3: InboxView — Handler `handleResumeAI`

**Files:**
- Modify: `frontend/components/chat/InboxView.tsx`

- [ ] **Step 1: Adicionar `handleResumeAI` e passar `onResumeAI` para `ConversationHeader`**

Localizar o bloco de handlers em `InboxView.tsx` (após `handleTakeOver`) e adicionar:

```tsx
async function handleResumeAI() {
  if (!selected) return;
  await apiAction(`/api/conversations/${selected.id}/resume-ai`);
  setSelected((prev) =>
    prev ? { ...prev, ai_enabled: true } : prev
  );
}
```

Localizar a renderização de `<ConversationHeader` e adicionar a prop `onResumeAI`:

```tsx
<ConversationHeader
  conversation={selected}
  onTakeOver={handleTakeOver}
  onResumeAI={handleResumeAI}
  onResolve={handleResolve}
  loading={actionLoading}
/>
```

- [ ] **Step 2: Verificar tipos TypeScript**

```bash
cd frontend && npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros de tipo.

- [ ] **Step 3: Verificar build**

```bash
cd frontend && npx next build 2>&1 | tail -20
```

Esperado: `✓ Compiled successfully` sem erros.

- [ ] **Step 4: Commit e push**

```bash
git add frontend/components/chat/InboxView.tsx
git commit -m "feat(chat): conectar handler Retomar IA no InboxView"
git push
```

---

## Verificação Manual

Após os 3 commits:

1. Abrir `/inbox` no browser
2. **Busca:** Digitar parte de um nome ou telefone → lista filtra em tempo real
3. **Tabs:** Clicar em "Atendimento" → mostra só conversas `em_atendimento`; badges exibem contagens corretas
4. **Retomar IA:** Assumir uma conversa → badge muda para "Humano" e botão "Retomar IA" aparece; clicar → badge volta para "IA ativa" e botão muda para "Assumir"
