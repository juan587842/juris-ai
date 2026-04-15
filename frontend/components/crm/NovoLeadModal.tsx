"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Lead, AreaJuridica } from "@/types/crm";
import { AREA_JURIDICA_LABELS } from "@/types/crm";

interface Props {
  open: boolean;
  onClose: () => void;
  onCreated: (lead: Lead) => void;
}

export function NovoLeadModal({ open, onClose, onCreated }: Props) {
  const [nome, setNome] = useState("");
  const [telefone, setTelefone] = useState("");
  const [email, setEmail] = useState("");
  const [origem, setOrigem] = useState("");
  const [areaInteresse, setAreaInteresse] = useState<AreaJuridica | "">("");
  const [notas, setNotas] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setNome("");
    setTelefone("");
    setEmail("");
    setOrigem("");
    setAreaInteresse("");
    setNotas("");
    setError(null);
  }

  function handleClose() {
    reset();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!telefone.trim()) {
      setError("Telefone é obrigatório.");
      return;
    }

    setSaving(true);
    try {
      const payload: Record<string, unknown> = {
        telefone: telefone.trim(),
        status: "novo",
      };
      if (nome.trim()) payload.nome = nome.trim();
      if (email.trim()) payload.email = email.trim();
      if (origem.trim()) payload.origem = origem.trim();
      if (areaInteresse) payload.area_interesse = areaInteresse;
      if (notas.trim()) payload.notas = notas.trim();

      const novo = await api.post<Lead>("/api/leads", payload);
      onCreated(novo);
      handleClose();
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Erro ao criar lead.";
      setError(msg);
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
      title="Novo lead"
      description="Cadastre um novo contato no funil"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Nome</label>
            <input
              type="text"
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              placeholder="Nome completo"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Telefone *</label>
            <input
              type="tel"
              value={telefone}
              onChange={(e) => setTelefone(e.target.value)}
              placeholder="+55 11 99999-9999"
              className={inputClass}
              required
            />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>E-mail</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="email@exemplo.com"
              className={inputClass}
            />
          </div>
          <div>
            <label className={labelClass}>Origem</label>
            <input
              type="text"
              value={origem}
              onChange={(e) => setOrigem(e.target.value)}
              placeholder="ex: indicação, site…"
              className={inputClass}
            />
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
                <option key={k} value={k}>
                  {v}
                </option>
              )
            )}
          </select>
        </div>

        <div>
          <label className={labelClass}>Observações</label>
          <textarea
            value={notas}
            onChange={(e) => setNotas(e.target.value)}
            rows={3}
            placeholder="Contexto inicial, necessidade, urgência…"
            className={`${inputClass} resize-none`}
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
            {saving ? "Salvando..." : "Criar lead"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
