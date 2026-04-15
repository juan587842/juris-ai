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
  onCreated: (p: Processo) => void;
}

function applyCnjMask(raw: string): string {
  const digits = raw.replace(/\D/g, "").slice(0, 20);
  let out = digits;
  if (digits.length > 7) out = digits.slice(0, 7) + "-" + digits.slice(7);
  if (digits.length > 9) out = out.slice(0, 10) + "." + out.slice(10);
  if (digits.length > 13) out = out.slice(0, 15) + "." + out.slice(15);
  if (digits.length > 14) out = out.slice(0, 17) + "." + out.slice(17);
  if (digits.length > 16) out = out.slice(0, 20) + "." + out.slice(20);
  return out;
}

const STATUS_OPTIONS: { value: ProcessoStatus; label: string }[] = [
  { value: "ativo", label: "Ativo" },
  { value: "suspenso", label: "Suspenso" },
  { value: "finalizado", label: "Finalizado" },
];

export function NovoProcessoModal({ open, onClose, onCreated }: Props) {
  const [numeroCnj, setNumeroCnj] = useState("");
  const [tribunal, setTribunal] = useState("");
  const [vara, setVara] = useState("");
  const [areaJuridica, setAreaJuridica] = useState<AreaJuridica | "">("");
  const [status, setStatus] = useState<ProcessoStatus>("ativo");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setNumeroCnj("");
    setTribunal("");
    setVara("");
    setAreaJuridica("");
    setStatus("ativo");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const digits = numeroCnj.replace(/\D/g, "");
    if (digits.length !== 20) {
      setError("Número CNJ inválido. Informe todos os 20 dígitos.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        numero_cnj: numeroCnj,
        status,
      };
      if (tribunal.trim()) payload.tribunal = tribunal.trim();
      if (vara.trim()) payload.vara = vara.trim();
      if (areaJuridica) payload.area_juridica = areaJuridica;

      const novo = await api.post<Processo>("/api/processos", payload);
      onCreated(novo);
      handleClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erro ao criar processo.";
      setError(msg.includes("409") ? "Já existe um processo com esse número CNJ." : msg);
    } finally {
      setSaving(false);
    }
  }

  const inputClass =
    "w-full rounded-lg border border-border bg-surface-elevated/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";
  const labelClass = "label-caps mb-1.5 block";

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Novo processo"
      description="Preencha os dados do processo judicial"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Número CNJ *</label>
          <input
            type="text"
            value={numeroCnj}
            onChange={(e) => setNumeroCnj(applyCnjMask(e.target.value))}
            placeholder="0000000-00.0000.0.00.0000"
            className={`${inputClass} font-mono`}
            required
          />
          <p className="mt-1 text-xs text-muted-foreground">
            Formato: NNNNNNN-NN.NNNN.N.NN.NNNN
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Tribunal</label>
            <input
              type="text"
              value={tribunal}
              onChange={(e) => setTribunal(e.target.value)}
              placeholder="ex: TJSP"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Vara</label>
            <input
              type="text"
              value={vara}
              onChange={(e) => setVara(e.target.value)}
              placeholder="ex: 1ª Vara Cível"
              className={inputClass}
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
              {(Object.entries(AREA_JURIDICA_LABELS) as [AreaJuridica, string][]).map(
                ([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                )
              )}
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
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
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
            disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover hover:shadow-glow-gold disabled:opacity-50"
          >
            {saving ? "Salvando..." : "Criar processo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
