"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";

interface Props {
  conversationId: string;
  disabled?: boolean;
  onSent?: () => void;
}

export function MessageInput({ conversationId, disabled, onSent }: Props) {
  const [text, setText] = useState("");
  const [sending, setSending] = useState(false);

  async function handleSend(e: React.FormEvent) {
    e.preventDefault();
    if (!text.trim() || sending) return;

    setSending(true);
    try {
      await api.post(`/api/conversations/${conversationId}/messages`, { content: text.trim() });
      setText("");
      onSent?.();
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={handleSend}
      className="border-t p-3 flex items-end gap-2 bg-background"
    >
      <textarea
        value={text}
        onChange={(e) => setText(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            handleSend(e as unknown as React.FormEvent);
          }
        }}
        disabled={disabled || sending}
        placeholder={disabled ? "Conversa com IA ativa — assuma para responder" : "Digite uma mensagem…"}
        rows={1}
        className={cn(
          "flex-1 resize-none rounded-lg border border-input bg-background px-3 py-2 text-sm",
          "focus:outline-none focus:ring-2 focus:ring-ring",
          "max-h-32 overflow-y-auto",
          (disabled || sending) && "opacity-50 cursor-not-allowed"
        )}
      />
      <button
        type="submit"
        disabled={!text.trim() || disabled || sending}
        className="rounded-lg bg-primary p-2 text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
      >
        <Send className="h-4 w-4" />
      </button>
    </form>
  );
}
