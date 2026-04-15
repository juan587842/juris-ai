"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Oportunidade, OportunidadeEstagio, AreaJuridica } from "@/types/crm";
import { OPORTUNIDADE_ESTAGIO_LABELS, AREA_JURIDICA_LABELS } from "@/types/crm";

interface Props {
  open: boolean;
  onClose: () => void;
  leadId: string;
  onCreated: (op: Oportunidade) => void;
}

const ESTAGIOS = Object.entries(OPORTUNIDADE_ESTAGIO_LABELS) as [OportunidadeEstagio, string][];

export function NovaOportunidadeModal({ open, onClose, leadId, onCreated }: Props) {
  const [titulo, setTitulo] = useState("");
  const [estagio, setEstagio] = useState<OportunidadeEstagio>("novo_lead");
  const [valor, setValor] = useState("");
  const [areaJuridica, setAreaJuridica] = useState<AreaJuridica | "">("");
  const [dataFechamento, setDataFechamento] = useState("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setTitulo(""); setEstagio("novo_lead"); setValor("");
    setAreaJuridica(""); setDataFechamento(""); setNotas(""); setError(null);
  }

  function handleClose() { reset(); onClose(); }

  const inputClass =
    "w-full rounded-lg border border-border bg-surface-elevated/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";
  const labelClass = "label-caps mb-1.5 block";

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!titulo.trim()) { setError("Título é obrigatório."); return; }
    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        lead_id: leadId,
        titulo: titulo.trim(),
        estagio,
      };
      if (valor) payload.valor_estimado = parseFloat(valor.replace(",", "."));
      if (areaJuridica) payload.area_juridica = areaJuridica;
      if (dataFechamento) payload.data_fechamento = dataFechamento;
      if (notas.trim()) payload.notas = notas.trim();

      const nova = await api.post<Oportunidade>("/api/crm/oportunidades", payload);
      onCreated(nova);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao criar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={handleClose} title="Nova oportunidade" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className={labelClass}>Título *</label>
          <input
            type="text"
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            className={inputClass}
            placeholder="ex: Ação trabalhista — João Silva"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Estágio</label>
            <select
              value={estagio}
              onChange={(e) => setEstagio(e.target.value as OportunidadeEstagio)}
              className={inputClass}
            >
              {ESTAGIOS.map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
          </div>
          <div>
            <label className={labelClass}>Valor estimado (R$)</label>
            <input
              type="number"
              min="0"
              step="0.01"
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              className={inputClass}
              placeholder="0,00"
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
            <label className={labelClass}>Data de fechamento</label>
            <input
              type="date"
              value={dataFechamento}
              onChange={(e) => setDataFechamento(e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
            placeholder="Detalhes da oportunidade…"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={handleClose} disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-elevated disabled:opacity-50">
            Cancelar
          </button>
          <button type="submit" disabled={saving}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover hover:shadow-glow-gold disabled:opacity-50">
            {saving ? "Salvando..." : "Criar oportunidade"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
