"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Oportunidade, OportunidadeEstagio, AreaJuridica } from "@/types/crm";
import { OPORTUNIDADE_ESTAGIO_LABELS, AREA_JURIDICA_LABELS } from "@/types/crm";

interface Props {
  open: boolean;
  onClose: () => void;
  oportunidade: Oportunidade;
  onUpdated: (op: Oportunidade) => void;
}

const ESTAGIOS = Object.entries(OPORTUNIDADE_ESTAGIO_LABELS) as [OportunidadeEstagio, string][];

export function EditarOportunidadeModal({ open, onClose, oportunidade, onUpdated }: Props) {
  const [titulo, setTitulo] = useState(oportunidade.titulo);
  const [estagio, setEstagio] = useState<OportunidadeEstagio>(oportunidade.estagio);
  const [valor, setValor] = useState(oportunidade.valor_estimado?.toString() ?? "");
  const [areaJuridica, setAreaJuridica] = useState<AreaJuridica | "">(oportunidade.area_juridica ?? "");
  const [dataFechamento, setDataFechamento] = useState(oportunidade.data_fechamento ?? "");
  const [notas, setNotas] = useState(oportunidade.notas ?? "");
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
      const payload: Record<string, unknown> = {
        titulo: titulo.trim(),
        estagio,
      };
      if (valor) payload.valor_estimado = parseFloat(valor.replace(",", "."));
      if (areaJuridica) payload.area_juridica = areaJuridica;
      if (dataFechamento) payload.data_fechamento = dataFechamento;
      payload.notas = notas.trim() || null;

      const updated = await api.patch<Oportunidade>(
        `/api/crm/oportunidades/${oportunidade.id}`,
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
    <Modal open={open} onClose={onClose} title="Editar oportunidade" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Título *</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={inputClass}
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Estágio</label>
            <select value={estagio} onChange={(e) => setEstagio(e.target.value as OportunidadeEstagio)} className={inputClass}>
              {ESTAGIOS.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Valor estimado (R$)</label>
            <input type="number" min="0" step="0.01" value={valor}
              onChange={(e) => setValor(e.target.value)} className={inputClass} placeholder="0,00" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Área jurídica</label>
            <select value={areaJuridica} onChange={(e) => setAreaJuridica(e.target.value as AreaJuridica | "")} className={inputClass}>
              <option value="">Selecionar…</option>
              {(Object.entries(AREA_JURIDICA_LABELS) as [AreaJuridica, string][]).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Data de fechamento</label>
            <input type="date" value={dataFechamento} onChange={(e) => setDataFechamento(e.target.value)} className={inputClass} />
          </div>
        </div>

        <div>
          <label className={labelClass}>Notas</label>
          <textarea value={notas} onChange={(e) => setNotas(e.target.value)} rows={3}
            className={`${inputClass} resize-none`} placeholder="Detalhes…" />
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
