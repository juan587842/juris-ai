"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Alerta, TipoAlerta } from "@/types/alertas";
import { TIPO_LABELS } from "@/types/alertas";
import { AlertaCard } from "./AlertaCard";

interface Props {
  tipo: TipoAlerta;
  alertas: Alerta[];
}

export function AlertasSection({ tipo, alertas }: Props) {
  const [aberto, setAberto] = useState(true);

  if (alertas.length === 0) return null;

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        background: "rgba(255,255,255,.03)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {aberto ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">{TIPO_LABELS[tipo]}</span>
          <span
            className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold px-1.5 min-w-5 h-5"
            style={{ background: "rgba(255,255,255,.1)" }}
          >
            {alertas.length}
          </span>
        </div>
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-2">
          {alertas.map((a) => (
            <AlertaCard key={a.id} alerta={a} />
          ))}
        </div>
      )}
    </div>
  );
}
