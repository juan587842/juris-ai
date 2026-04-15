"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Lead, LeadStatus, AreaJuridica } from "@/types/crm";
import {
  AREA_JURIDICA_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_ORDER,
} from "@/types/crm";

interface Props {
  open: boolean;
  onClose: () => void;
  lead: Lead;
  onUpdated: (lead: Lead) => void;
}

export function EditarLeadModal({ open, onClose, lead, onUpdated }: Props) {
  const [nome, setNome] = useState(lead.nome ?? "");
  const [email, setEmail] = useState(lead.email ?? "");
  const [origem, setOrigem] = useState(lead.origem ?? "");
  const [areaInteresse, setAreaInteresse] = useState<AreaJuridica | "">(
    lead.area_interesse ?? ""
  );
  const [status, setStatus] = useState<LeadStatus>(lead.status);
  const [notas, setNotas] = useState(lead.notas ?? "");
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
      if (nome.trim()) payload.nome = nome.trim();
      if (email.trim()) payload.email = email.trim();
      if (origem.trim()) payload.origem = origem.trim();
      if (areaInteresse) payload.area_interesse = areaInteresse;
      payload.notas = notas.trim() || null;

      const updated = await api.patch<Lead>(`/api/crm/leads/${lead.id}`, payload);
      onUpdated(updated);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="Editar lead" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              className={inputClass}
              placeholder="Nome completo"
            />
          </div>
          <div>
            <label className={labelClass}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className={inputClass}
              placeholder="email@exemplo.com"
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Origem</label>
            <input
              type="text"
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              className={inputClass}
              placeholder="ex: indicação, site…"
            />
          </div>
          <div>
            <label className={labelClass}>Status</label>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value as LeadStatus)}
              className={inputClass}
            >
              {LEAD_STATUS_ORDER.map((s) => (
                <option key={s} value={s}>
                  {LEAD_STATUS_LABELS[s]}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label className={labelClass}>Área de interesse</label>
          <select
            value={areaInteresse}
            onChange={(e) => setAreaInteresse(e.target.value as AreaJuridica | "")}
            className={inputClass}
          >
            <option value="">Selecionar…</option>
            {(Object.entries(AREA_JURIDICA_LABELS) as [AreaJuridica, string][]).map(
              ([k, v]) => (
                <option key={k} value={k}>{v}</option>
              )
            )}
          </select>
        </div>

        <div>
          <label className={labelClass}>Notas</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            className={`${inputClass} resize-none`}
            placeholder="Observações sobre o lead…"
          />
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onClose}
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
            {saving ? "Salvando..." : "Salvar alterações"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
