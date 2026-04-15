"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { InternalNote } from "@/types/chat";
import { StickyNote, Send } from "lucide-react";
import { api } from "@/lib/api";

interface Props {
  conversationId: string;
  currentUserId: string;
}

export function NotesPanel({ conversationId, currentUserId }: Props) {
  const [notes, setNotes] = useState<InternalNote[]>([]);
  const [text, setText] = useState("");
  const [saving, setSaving] = useState(false);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("internal_notes")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at");
      if (data) setNotes(data as InternalNote[]);
    }
    load();
  }, [conversationId]);

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || saving) return;
    setSaving(true);
    try {
      await api.post(`/api/conversations/${conversationId}/notes`, { content: text.trim() });
      setText("");
      // Recarregar
      const { data } = await supabase
        .from("internal_notes")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at");
      if (data) setNotes(data as InternalNote[]);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      <div className="flex items-center gap-2 px-3 py-2 border-b text-sm font-medium text-muted-foreground">
        <StickyNote className="h-4 w-4" />
        Notas internas
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-2">
        {notes.length === 0 ? (
          <p className="text-xs text-muted-foreground text-center mt-4">
            Nenhuma nota ainda. Notas são visíveis apenas para a equipe.
          </p>
        ) : (
          notes.map((note) => (
            <div key={note.id} className="rounded-lg bg-yellow-50 border border-yellow-200 px-3 py-2 text-sm">
              <p className="text-yellow-900 whitespace-pre-wrap">{note.content}</p>
              <p className="text-xs text-yellow-600 mt-1">
                {new Date(note.created_at).toLocaleString("pt-BR")}
              </p>
            </div>
          ))
        )}
      </div>

      <form onSubmit={handleSave} className="border-t p-3 flex gap-2">
        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="Adicionar nota interna…"
          rows={2}
          className="flex-1 resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
        <button
          type="submit"
          disabled={!text.trim() || saving}
          className="self-end rounded-md bg-yellow-400 p-2 text-yellow-900 hover:bg-yellow-300 disabled:opacity-40 transition-colors"
        >
          <Send className="h-4 w-4" />
        </button>
      </form>
    </div>
  );
}
