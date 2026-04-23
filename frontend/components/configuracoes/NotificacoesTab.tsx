"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PerfilData, NotifPreferences } from "@/types/configuracoes";
import { DEFAULT_NOTIF_PREFERENCES } from "@/types/configuracoes";

const STORAGE_KEY = "alertas_config";

const THRESHOLD_FIELDS: { key: keyof Omit<NotifPreferences, "canal">; label: string; desc: string }[] = [
  { key: "dias_processo", label: "Processos sem andamento", desc: "Alertar após X dias sem movimentação" },
  { key: "dias_lead", label: "Leads sem contato", desc: "Alertar após X dias sem atualização" },
  { key: "dias_prazo", label: "Prazo fatal — antecedência", desc: "Alertar X dias antes do vencimento" },
  { key: "dias_oportunidade", label: "Oportunidades paradas", desc: "Alertar após X dias sem movimentação" },
];

export function NotificacoesTab() {
  const [prefs, setPrefs] = useState<NotifPreferences>(DEFAULT_NOTIF_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PerfilData>("/api/configuracoes/perfil")
      .then((d) => setPrefs({ ...DEFAULT_NOTIF_PREFERENCES, ...d.notif_preferences }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function setField(field: keyof NotifPreferences, value: string | number) {
    setPrefs((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put("/api/configuracoes/perfil", { notif_preferences: prefs });
      // Sync com localStorage para compatibilidade com página Alertas
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          dias_processo: prefs.dias_processo,
          dias_lead: prefs.dias_lead,
          dias_prazo: prefs.dias_prazo,
          dias_oportunidade: prefs.dias_oportunidade,
        }));
      } catch {
        // ignore
      }
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-20 rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 text-center";

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg" style={{ background: "rgba(255,255,255,.06)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-4">
        {THRESHOLD_FIELDS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={prefs[key]}
                onChange={(e) => setField(key, Number(e.target.value))}
                className={inputCls}
              />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Canal de notificação</label>
        <div className="flex gap-2">
          {(["whatsapp", "email"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setField("canal", c)}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              style={
                prefs.canal === c
                  ? { background: "#c9a96e", color: "#0a0f1e" }
                  : { background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)" }
              }
            >
              {c === "whatsapp" ? "WhatsApp" : "E-mail"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm" style={{ color: "#c9a96e" }}>Salvo com sucesso.</p>}

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
