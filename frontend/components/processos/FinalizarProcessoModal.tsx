"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Processo, ResultadoProcesso } from "@/types/processos";
import { RESULTADO_LABELS } from "@/types/processos";

interface Props {
  open: boolean;
  onClose: () => void;
  processo: Processo;
  onUpdated: (p: Processo) => void;
}

const RESULTADO_OPTIONS = (Object.keys(RESULTADO_LABELS) as ResultadoProcesso[]).map(
  (v) => ({ value: v, label: RESULTADO_LABELS[v] })
);

const inputClass =
  "w-full rounded-lg border border-border bg-surface-elevated/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";

export function FinalizarProcessoModal({ open, onClose, processo, onUpdated }: Props) {
  const [resultado, setResultado] = useState<ResultadoProcesso | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setResultado("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resultado) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await api.patch<Processo>(`/api/processos/${processo.id}`, {
        status: "finalizado",
        resultado,
      });
      onUpdated(updated);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar processo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Finalizar processo"
      description={`Registre o resultado do processo ${processo.numero_cnj}`}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label htmlFor="resultado-select" className="label-caps mb-1.5 block">Resultado *</label>
          <select
            id="resultado-select"
            value={resultado}
            onChange={(e) => setResultado(e.target.value as ResultadoProcesso | "")}
            className={inputClass}
            required
          >
            <option value="">Selecionar resultado…</option>
            {RESULTADO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-elevated disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !resultado}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover hover:shadow-glow-gold disabled:opacity-50"
          >
            {saving ? "Finalizando..." : "Finalizar processo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
