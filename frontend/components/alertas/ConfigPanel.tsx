"use client";

import { useState } from "react";
import type { AlertasConfig } from "@/types/alertas";
import { CONFIG_LABELS, DEFAULT_CONFIG } from "@/types/alertas";

interface Props {
  config: AlertasConfig;
  onApply: (c: AlertasConfig) => void;
}

export function ConfigPanel({ config, onApply }: Props) {
  const [local, setLocal] = useState<AlertasConfig>(config);

  const inputClass =
    "w-24 rounded-lg border border-border bg-surface-elevated/50 px-3 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";

  function handleChange(key: keyof AlertasConfig, value: string) {
    const num = parseInt(value, 10);
    if (num >= 1) setLocal((prev) => ({ ...prev, [key]: num }));
  }

  function handleRestore() {
    setLocal(DEFAULT_CONFIG);
    onApply(DEFAULT_CONFIG);
  }

  return (
    <div
      className="rounded-lg border p-4 space-y-4"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        Configurar limites
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(Object.keys(DEFAULT_CONFIG) as (keyof AlertasConfig)[]).map((key) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              {CONFIG_LABELS[key]}
            </label>
            <input
              type="number"
              min={1}
              value={local[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className={inputClass}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={handleRestore}
          className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-elevated"
        >
          Restaurar padrões
        </button>
        <button
          onClick={() => onApply(local)}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover hover:shadow-glow-gold"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
