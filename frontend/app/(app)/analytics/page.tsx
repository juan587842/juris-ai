"use client";

import { useEffect, useState } from "react";
import { BarChart2 } from "lucide-react";

import { api } from "@/lib/api";
import type { AnalyticsData, Periodo } from "@/types/analytics";
import { PERIODO_LABELS } from "@/types/analytics";

import { FunilConversao } from "@/components/analytics/FunilConversao";
import { ReceitaPorArea } from "@/components/analytics/ReceitaPorArea";
import { TaxaExito } from "@/components/analytics/TaxaExito";
import { TempoMedio } from "@/components/analytics/TempoMedio";
import { DistribuicaoTribunal } from "@/components/analytics/DistribuicaoTribunal";
import { OrigemLeads } from "@/components/analytics/OrigemLeads";
import { CarteiraAtiva } from "@/components/analytics/CarteiraAtiva";
import { AtendimentoSection } from "@/components/analytics/AtendimentoSection";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className ?? ""}`}
      style={{ background: "rgba(255,255,255,.06)" }}
    />
  );
}

const PERIODOS: Periodo[] = ["30d", "90d", "365d"];

export default function AnalyticsPage() {
  const [dados, setDados] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("30d");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<AnalyticsData>(`/api/analytics?periodo=${periodo}`)
      .then((data) => { if (!cancelled) setDados(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar analytics");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periodo]);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-radial-gold">
      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center justify-between gap-3"
        style={{ borderColor: "rgba(255,255,255,.08)" }}
      >
        <div className="flex items-center gap-3">
          <BarChart2 className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
            <p className="text-xs text-muted-foreground">Visão estratégica do escritório</p>
          </div>
        </div>
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="rounded-md text-xs font-semibold px-3 py-1.5 transition-colors"
              style={
                periodo === p
                  ? { background: "#c9a96e", color: "#0a0f1e" }
                  : {
                      background: "rgba(255,255,255,.08)",
                      color: "inherit",
                      border: "1px solid rgba(255,255,255,.1)",
                    }
              }
            >
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-6 space-y-8">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Seção CRM */}
        <div>
          <div
            className="text-[10px] uppercase tracking-widest font-semibold mb-4"
            style={{ opacity: 0.4 }}
          >
            CRM / Negócio
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-36" />
              <Skeleton className="h-36" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : dados ? (
            <div className="grid grid-cols-2 gap-4">
              <FunilConversao dados={dados.funil_conversao} />
              <ReceitaPorArea dados={dados.receita_por_area} />
              <OrigemLeads dados={dados.origem_leads} />
              <CarteiraAtiva dados={dados.carteira_ativa} />
            </div>
          ) : null}
        </div>

        {/* Seção Jurídico */}
        <div>
          <div
            className="text-[10px] uppercase tracking-widest font-semibold mb-4"
            style={{ opacity: 0.4 }}
          >
            Jurídico / Processos
          </div>
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : dados ? (
            <div className="grid grid-cols-3 gap-4">
              <TaxaExito dados={dados.taxa_exito} geral={dados.taxa_exito_geral} />
              <TempoMedio dados={dados.tempo_medio} geral={dados.tempo_medio_geral} />
              <DistribuicaoTribunal dados={dados.distribuicao_tribunal} />
            </div>
          ) : null}
        </div>

        {/* Seção Atendimento */}
        <div>
          <div
            className="text-[10px] uppercase tracking-widest font-semibold mb-4"
            style={{ opacity: 0.4 }}
          >
            Atendimento / Chat
          </div>
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : dados ? (
            <AtendimentoSection dados={dados.atendimento} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
