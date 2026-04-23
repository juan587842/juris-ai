"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PerfilData } from "@/types/configuracoes";
import { ROLE_LABELS } from "@/types/configuracoes";

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

export function PerfilTab() {
  const [data, setData] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    api
      .get<PerfilData>("/api/configuracoes/perfil")
      .then((d) => {
        setData(d);
        setFullName(d.full_name ?? "");
        setOabNumber(d.oab_number ?? "");
        setAvatarUrl(d.avatar_url ?? "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put("/api/configuracoes/perfil", {
        full_name: fullName || undefined,
        oab_number: oabNumber || undefined,
        avatar_url: avatarUrl || undefined,
      });
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
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg" style={{ background: "rgba(255,255,255,.06)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <Field label="E-mail">
        <Input value={data?.email ?? ""} disabled />
      </Field>
      <Field label="Função">
        <Input value={data ? ROLE_LABELS[data.role] : ""} disabled />
      </Field>
      <Field label="Nome completo">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
      </Field>
      <Field label="Nº OAB">
        <Input value={oabNumber} onChange={(e) => setOabNumber(e.target.value)} placeholder="Ex: SP 123456" />
      </Field>
      <Field label="Avatar URL">
        <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
      </Field>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-sm" style={{ color: "#c9a96e" }}>Salvo com sucesso.</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ background: "#c9a96e", color: "#0a0f1e" }}
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
