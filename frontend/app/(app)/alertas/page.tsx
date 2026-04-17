"use client";

import { useEffect, useState } from "react";
import { Bell, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import type { Alerta, AlertasConfig, TipoAlerta } from "@/types/alertas";
import { DEFAULT_CONFIG } from "@/types/alertas";
import { AlertasSection } from "@/components/alertas/AlertasSection";
import { ConfigPanel } from "@/components/alertas/ConfigPanel";

const TIPOS: TipoAlerta[] = [
  "processo_sem_andamento",
  "lead_sem_contato",
  "prazo_fatal",
  "oportunidade_parada",
];

const STORAGE_KEY = "alertas_config";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className ?? ""}`}
      style={{ background: "rgba(255,255,255,.06)" }}
    />
  );
}

function loadConfig(): AlertasConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config: AlertasConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AlertasConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      dias_processo: String(config.dias_processo),
      dias_lead: String(config.dias_lead),
      dias_prazo: String(config.dias_prazo),
      dias_oportunidade: String(config.dias_oportunidade),
    });
    api
      .get<{ alertas: Alerta[]; total: number }>(`/api/alertas?${params}`)
      .then((data) => { if (!cancelled) setAlertas(data.alertas); })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Erro ao carregar alertas");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [config]);

  function handleApply(newConfig: AlertasConfig) {
    saveConfig(newConfig);
    setConfig(newConfig);
    setShowConfig(false);
  }

  const porTipo = (tipo: TipoAlerta) => alertas.filter((a) => a.tipo === tipo);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-radial-gold">
      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center justify-between gap-3"
        style={{ borderColor: "rgba(255,255,255,.08)" }}
      >
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Alertas</h1>
            <p className="text-xs text-muted-foreground">
              Situações que precisam de atenção
            </p>
          </div>
          {!loading && (
            <span
              className="inline-flex items-center justify-center rounded-full text-xs font-semibold px-2 h-5"
              style={{ background: "rgba(255,255,255,.1)" }}
            >
              {alertas.length} alerta{alertas.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowConfig((v) => !v)}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated transition-colors"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Configurar limites
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-6 space-y-4">
        {showConfig && (
          <ConfigPanel config={config} onApply={handleApply} />
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Bell className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum alerta no momento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {TIPOS.map((tipo) => (
              <AlertasSection key={tipo} tipo={tipo} alertas={porTipo(tipo)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
