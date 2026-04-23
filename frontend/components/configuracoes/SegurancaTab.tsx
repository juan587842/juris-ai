"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

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
      className="rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50"
    />
  );
}

export function SegurancaTab() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSuccess(false);

    if (novaSenha.length < 8) {
      setError("Nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmSenha) {
      setError("As senhas não coincidem.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createBrowserClient();
      const { error: authError } = await supabase.auth.updateUser({ password: novaSenha });
      if (authError) throw new Error(authError.message);
      setSuccess(true);
      setNovaSenha("");
      setConfirmSenha("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar senha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-sm">
      <Field label="Nova senha">
        <Input
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirmar nova senha">
        <Input
          type="password"
          value={confirmSenha}
          onChange={(e) => setConfirmSenha(e.target.value)}
          placeholder="Repita a senha"
          autoComplete="new-password"
        />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm" style={{ color: "#c9a96e" }}>Senha atualizada com sucesso.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ background: "#c9a96e", color: "#0a0f1e" }}
      >
        {saving ? "Salvando…" : "Atualizar senha"}
      </button>
    </div>
  );
}
