"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { EscritorioData, PerfilData } from "@/types/configuracoes";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className="rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 resize-none"
    />
  );
}

const EMPTY: EscritorioData = {
  nome: "", oab: "", logo_url: "", endereco: "",
  telefone: "", site: "", assinatura: "", rodape: "",
};

export function EscritorioTab() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState<EscritorioData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<EscritorioData>("/api/configuracoes/escritorio"),
      api.get<PerfilData>("/api/configuracoes/perfil"),
    ])
      .then(([esc, perfil]) => {
        setForm({ ...EMPTY, ...esc });
        setIsAdmin(perfil.role === "admin");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function set(field: keyof EscritorioData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put("/api/configuracoes/escritorio", form);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg" style={{ background: "rgba(255,255,255,.06)" }} />
        ))}
      </div>
    );
  }

  const disabled = !isAdmin;

  return (
    <div className="space-y-6 max-w-lg">
      {!isAdmin && (
        <p className="rounded-lg border border-border/60 px-4 py-3 text-sm text-muted-foreground">
          Somente administradores podem editar dados do escritório.
        </p>
      )}
      <Field label="Nome do escritório">
        <Input value={form.nome} onChange={set("nome")} disabled={disabled} placeholder="Ex: Silva & Associados" />
      </Field>
      <Field label="OAB do escritório">
        <Input value={form.oab ?? ""} onChange={set("oab")} disabled={disabled} placeholder="Ex: SP 0000/OAB" />
      </Field>
      <Field label="Logo URL">
        <Input value={form.logo_url ?? ""} onChange={set("logo_url")} disabled={disabled} placeholder="https://..." />
      </Field>
      <Field label="Endereço">
        <Input value={form.endereco ?? ""} onChange={set("endereco")} disabled={disabled} placeholder="Rua, número, cidade" />
      </Field>
      <Field label="Telefone">
        <Input value={form.telefone ?? ""} onChange={set("telefone")} disabled={disabled} placeholder="(11) 99999-9999" />
      </Field>
      <Field label="Site">
        <Input value={form.site ?? ""} onChange={set("site")} disabled={disabled} placeholder="https://..." />
      </Field>
      <Field label="Assinatura padrão">
        <Textarea value={form.assinatura ?? ""} onChange={set("assinatura")} disabled={disabled} placeholder="Texto de assinatura para comunicações" />
      </Field>
      <Field label="Texto de rodapé">
        <Textarea value={form.rodape ?? ""} onChange={set("rodape")} disabled={disabled} placeholder="Ex: Este escritório está inscrito na OAB/SP..." />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm" style={{ color: "#c9a96e" }}>Salvo com sucesso.</p>}

      {isAdmin && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ background: "#c9a96e", color: "#0a0f1e" }}
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      )}
    </div>
  );
}
