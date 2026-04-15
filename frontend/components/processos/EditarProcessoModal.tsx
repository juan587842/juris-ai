"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Processo, ProcessoStatus } from "@/types/processos";
import type { AreaJuridica } from "@/types/crm";
import { AREA_JURIDICA_LABELS } from "@/types/crm";

interface Props {
  open: boolean;
  onClose: () => void;
  processo: Processo;
  onUpdated: (p: Processo) => void;
}

const STATUS_OPTIONS: { value: ProcessoStatus; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "suspenso", label: "Suspenso" },
  { value: "finalizado", label: "Finalizado" },
];

export function EditarProcessoModal({ open, onClose, processo, onUpdated }: Props) {
  const [tribunal, setTribunal] = useState(processo.tribunal ?? "");
  const [vara, setVara] = useState(processo.vara ?? "");
  const [areaJuridica, setAreaJuridica] = useState<AreaJuridica | "">(
    processo.area_juridica ?? ""
  );
  const [status, setStatus] = useState<ProcessoStatus>(
    processo.status === "arquivado" ? "ativo" : processo.status
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const inputClass =
    "w-full rounded-lg border border-border bg-surface-elevated/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";
  const labelClass = "label-caps mb-1.5 block";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSaving(true);
    try {
      const payload: Record<string, unknown> = { status };
      if (tribunal.trim()) payload.tribunal = tribunal.trim();
      if (vara.trim()) payload.vara = vara.trim();
      if (areaJuridica) payload.area_juridica = areaJuridica;

      const updated = await api.patch<Processo>(
        `/api/processos/${processo.id}`,
        payload
      );
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar processo" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Tribunal</label>
            <input
              type="text"
              value={tribunal}
              onChange={(e) => setTribunal(e.target.value)}
              className={inputClass}
              placeholder="ex: TJSP"
            />
          </div>
          <div>
            <label className={labelClass}>Vara</label>
            <input
              type="text"
              value={vara}
              onChange={(e) => setVara(e.target.value)}
              className={inputClass}
              placeholder="ex: 1ª Vara Cível"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Área jurídica</label>
            <select
              value={areaJuridica}
              onChange={(e) => setAreaJuridica(e.target.value as AreaJuridica | "")}
              className={inputClass}
            >
              <option value="">Selecionar…</option>
              {(Object.entries(AREA_JURIDICA_LABELS) as [AreaJuridica, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as ProcessoStatus)}
              className={inputClass}
            >
              {STATUS_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-elevated disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover hover:shadow-glow-gold disabled:opacity-50">
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
