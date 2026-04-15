"use client";

import { useEffect, useState } from "react";
import {
  Scale,
  Users,
  TrendingUp,
  AlertTriangle,
  LayoutDashboard,
} from "lucide-react";
import { api } from "@/lib/api";
import type { DashboardStats } from "@/types/dashboard";
import { StatsCard } from "@/components/dashboard/StatsCard";
import { ProcessosBarChart } from "@/components/dashboard/ProcessosBarChart";
import { AlertasUrgentes } from "@/components/dashboard/AlertasUrgentes";
import { AtividadeRecente } from "@/components/dashboard/AtividadeRecente";

function Skeleton({ className }: { className?: string }) {
  return (
    <div className={`animate-pulse rounded-lg bg-surface-elevated ${className}`} />
  );
}

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<DashboardStats>("/api/dashboard/stats")
      .then(setStats)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar métricas")
      )
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-radial-gold">
      {/* Header */}
      <div className="border-b border-border/60 px-6 py-4 flex items-center gap-3">
        <LayoutDashboard className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Dashboard</h1>
          <p className="text-xs text-muted-foreground">
            Visão geral do escritório em tempo real
          </p>
        </div>
      </div>

      <div className="flex-1 p-6 space-y-6">
        {error && (
          <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            {error}
          </div>
        )}

        {/* KPI Cards */}
        {loading ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-24" />
            ))}
          </div>
        ) : stats ? (
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatsCard
              icon={Scale}
              label="Processos ativos"
              value={stats.processos.ativo}
              subtitle={`${stats.processos.total} no total`}
              variant="default"
            />
            <StatsCard
              icon={Users}
              label="Leads totais"
              value={stats.leads.total}
              subtitle={`${stats.leads.novo} novos`}
              variant="default"
            />
            <StatsCard
              icon={TrendingUp}
              label="Convertidos"
              value={stats.leads.convertido}
              subtitle={`${stats.leads.qualificado} qualificados`}
              variant="success"
            />
            <StatsCard
              icon={AlertTriangle}
              label="Prazos urgentes"
              value={stats.intimacoes_urgentes.length}
              subtitle="Vencimento em ≤ 5 dias"
              variant={
                stats.intimacoes_urgentes.length === 0
                  ? "default"
                  : stats.intimacoes_urgentes.length >= 3
                  ? "danger"
                  : "warning"
              }
            />
          </div>
        ) : null}

        {/* Corpo principal */}
        {loading ? (
          <div className="grid gap-4 lg:grid-cols-2">
            <Skeleton className="h-64" />
            <Skeleton className="h-64" />
            <Skeleton className="col-span-full h-48" />
          </div>
        ) : stats ? (
          <>
            <div className="grid gap-4 lg:grid-cols-2">
              {/* Processos por status */}
              <div className="glass-card rounded-xl border border-border/60 p-5">
                <p className="label-caps mb-4">Processos por status</p>
                <ProcessosBarChart processos={stats.processos} />
              </div>

              {/* Alertas de prazo */}
              <div className="glass-card rounded-xl border border-border/60 p-5">
                <p className="label-caps mb-4">
                  Alertas de prazo
                  {stats.intimacoes_urgentes.length > 0 && (
                    <span className="ml-2 rounded-full bg-red-500/15 px-1.5 py-0.5 text-red-400 normal-case text-[10px]">
                      {stats.intimacoes_urgentes.length}
                    </span>
                  )}
                </p>
                <AlertasUrgentes intimacoes={stats.intimacoes_urgentes} />
              </div>
            </div>

            {/* Atividade recente */}
            <div className="glass-card rounded-xl border border-border/60 p-5">
              <p className="label-caps mb-4">Atividade recente</p>
              <AtividadeRecente
                andamentos={stats.andamentos_recentes}
                leads={stats.leads_recentes}
              />
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
