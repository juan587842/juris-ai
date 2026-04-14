"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Message } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Bot, User, Wrench } from "lucide-react";

interface Props {
  conversationId: string;
}

const SENDER_STYLES: Record<string, string> = {
  lead: "bg-muted text-foreground self-start",
  ai: "bg-violet-100 text-violet-900 self-start",
  agent: "bg-primary text-primary-foreground self-end",
  system: "bg-yellow-50 text-yellow-800 self-center text-xs italic",
};

function SenderIcon({ type }: { type: string }) {
  if (type === "ai") return <Bot className="h-3 w-3" />;
  if (type === "agent") return <User className="h-3 w-3" />;
  if (type === "system") return <Wrench className="h-3 w-3" />;
  return null;
}

export function MessageThread({ conversationId }: Props) {
  const [messages, setMessages] = useState<Message[]>([]);
  const bottomRef = useRef<HTMLDivElement>(null);
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at");
      if (data) setMessages(data as Message[]);
    }
    load();

    const channel = supabase
      .channel(`messages-${conversationId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "messages",
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          setMessages((prev) => [...prev, payload.new as Message]);
        }
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [conversationId]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  return (
    <div className="flex-1 overflow-y-auto p-4 flex flex-col gap-2">
      {messages.map((msg) => (
        <div
          key={msg.id}
          className={cn(
            "max-w-[75%] rounded-xl px-3 py-2 text-sm flex flex-col gap-0.5",
            SENDER_STYLES[msg.sender_type] ?? "bg-muted self-start"
          )}
        >
          {msg.sender_type !== "lead" && (
            <div className="flex items-center gap-1 text-xs opacity-60 mb-0.5">
              <SenderIcon type={msg.sender_type} />
              <span>{msg.sender_type === "ai" ? "IA" : msg.sender_type === "agent" ? "Agente" : "Sistema"}</span>
            </div>
          )}
          <span className="whitespace-pre-wrap break-words">{msg.content}</span>
          <span className="text-xs opacity-50 self-end mt-0.5">
            {new Date(msg.created_at).toLocaleTimeString("pt-BR", {
              hour: "2-digit",
              minute: "2-digit",
            })}
          </span>
        </div>
      ))}
      <div ref={bottomRef} />
    </div>
  );
}
