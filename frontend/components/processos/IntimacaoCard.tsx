"use client";

import type { Intimacao } from "@/types/processos";
import { FONTE_INTIMACAO_LABELS } from "@/types/processos";
import { AlertTriangle, Bell, BellOff } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  intimacao: Intimacao;
}

function prazoStatus(prazoFatal: string | null): "vencido" | "urgente" | "ok" | null {
  if (!prazoFatal) return null;
  const hoje = new Date();
  const prazo = new Date(prazoFatal + "T00:00:00");
  const diffDias = Math.ceil((prazo.getTime() - hoje.getTime()) / 86400000);
  if (diffDias < 0) return "vencido";
  if (diffDias <= 5) return "urgente";
  return "ok";
}

export function IntimacaoCard({ intimacao }: Props) {
  const ps = prazoStatus(intimacao.prazo_fatal);

  return (
    <div
      className={cn(
        "rounded-lg border bg-card px-4 py-3 shadow-sm",
        ps === "vencido" && "border-red-300 bg-red-50",
        ps === "urgente" && "border-yellow-300 bg-yellow-50"
      )}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <span className="inline-flex rounded-full bg-muted px-2 py-0.5 text-xs font-medium">
              {FONTE_INTIMACAO_LABELS[intimacao.fonte]}
            </span>
            <span className="text-xs text-muted-foreground">
              Publicado em {new Date(intimacao.data_publicacao + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
            {intimacao.notificado_em ? (
              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                <Bell className="h-3 w-3" /> Notificado
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
                <BellOff className="h-3 w-3" /> Não notificado
              </span>
            )}
          </div>

          {intimacao.texto && (
            <p className="text-sm text-foreground whitespace-pre-wrap line-clamp-4">
              {intimacao.texto}
            </p>
          )}
        </div>

        {intimacao.prazo_fatal && (
          <div
            className={cn(
              "flex-shrink-0 flex flex-col items-center rounded-lg px-3 py-2 text-center min-w-[80px]",
              ps === "vencido" && "bg-red-100 text-red-700",
              ps === "urgente" && "bg-yellow-100 text-yellow-700",
              ps === "ok" && "bg-muted text-foreground"
            )}
          >
            {(ps === "vencido" || ps === "urgente") && (
              <AlertTriangle className="h-3.5 w-3.5 mb-0.5" />
            )}
            <span className="text-xs font-medium">Prazo fatal</span>
            <span className="text-xs">
              {new Date(intimacao.prazo_fatal + "T00:00:00").toLocaleDateString("pt-BR")}
            </span>
          </div>
        )}
      </div>
    </div>
  );
}
