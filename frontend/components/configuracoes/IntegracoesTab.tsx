"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { InboxData } from "@/types/configuracoes";
import { CANAL_LABELS } from "@/types/configuracoes";

const CANAIS: InboxData["canal"][] = ["whatsapp", "webchat", "email"];

export function IntegracoesTab() {
  const [inboxes, setInboxes] = useState<InboxData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newCanal, setNewCanal] = useState<InboxData["canal"]>("whatsapp");
  const [newInstance, setNewInstance] = useState("");
  const [creating, setCreating] = useState(false);

  function loadInboxes() {
    setLoading(true);
    api
      .get<{ inboxes: InboxData[] }>("/api/inboxes")
      .then((d) => setInboxes(d.inboxes))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadInboxes, []);

  async function toggleAtivo(inbox: InboxData) {
    try {
      await api.put(`/api/inboxes/${inbox.id}`, { ativo: !inbox.ativo });
      setInboxes((prev) =>
        prev.map((i) => (i.id === inbox.id ? { ...i, ativo: !i.ativo } : i))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar");
    }
  }

  async function handleCreate() {
    if (!newNome.trim()) return;
    setCreating(true);
    try {
      const created = await api.post<InboxData>("/api/inboxes", {
        nome: newNome,
        canal: newCanal,
        evolution_instance: newInstance || null,
      });
      setInboxes((prev) => [...prev, created]);
      setShowForm(false);
      setNewNome("");
      setNewCanal("whatsapp");
      setNewInstance("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao criar integração");
    } finally {
      setCreating(false);
    }
  }

  const inputCls = "rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50";

  return (
    <div className="space-y-4 max-w-xl">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: "rgba(255,255,255,.06)" }} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {inboxes.map((inbox) => (
            <div
              key={inbox.id}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-surface/60 px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{inbox.nome}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: "rgba(201,169,110,.15)", color: "#c9a96e" }}
                  >
                    {CANAL_LABELS[inbox.canal]}
                  </span>
                  {inbox.evolution_instance && (
                    <span className="text-xs text-muted-foreground">{inbox.evolution_instance}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleAtivo(inbox)}
                className="relative h-5 w-9 rounded-full transition-colors"
                style={{ background: inbox.ativo ? "#c9a96e" : "rgba(255,255,255,.12)" }}
                title={inbox.ativo ? "Desativar" : "Ativar"}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                  style={{ transform: inbox.ativo ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-border/60 bg-surface/60 p-4 space-y-3">
          <input
            className={inputCls + " w-full"}
            placeholder="Nome da integração"
            value={newNome}
            onChange={(e) => setNewNome(e.target.value)}
          />
          <select
            className={inputCls + " w-full"}
            value={newCanal}
            onChange={(e) => setNewCanal(e.target.value as InboxData["canal"])}
          >
            {CANAIS.map((c) => (
              <option key={c} value={c}>{CANAL_LABELS[c]}</option>
            ))}
          </select>
          <input
            className={inputCls + " w-full"}
            placeholder="Evolution Instance (opcional)"
            value={newInstance}
            onChange={(e) => setNewInstance(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newNome.trim()}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: "#c9a96e", color: "#0a0f1e" }}
            >
              {creating ? "Criando…" : "Criar"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground hover:bg-surface-elevated transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova integração
        </button>
      )}
    </div>
  );
}
