"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Loader2, Pencil, Plus, Trash2 } from "lucide-react";

import { api, ApiError } from "@/lib/api";
import {
  AREA_JURIDICA_LABELS,
  LEAD_STATUS_LABELS,
  LEAD_STATUS_ORDER,
  OPORTUNIDADE_ESTAGIO_LABELS,
  type LeadDetail as LeadDetailType,
  type LeadStatus,
  type Oportunidade,
} from "@/types/crm";
import { EditarLeadModal } from "./EditarLeadModal";
import { NovaOportunidadeModal } from "./NovaOportunidadeModal";
import { EditarOportunidadeModal } from "./EditarOportunidadeModal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";

interface LeadDetailProps {
  leadId: string;
}

export function LeadDetail({ leadId }: LeadDetailProps) {
  const router = useRouter();
  const [data, setData] = useState<LeadDetailType | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notas, setNotas] = useState("");
  const [showEditarLead, setShowEditarLead] = useState(false);
  const [showNovaOp, setShowNovaOp] = useState(false);
  const [editingOp, setEditingOp] = useState<Oportunidade | null>(null);
  const [deletingOp, setDeletingOp] = useState<Oportunidade | null>(null);
  const [deletingOpLoading, setDeletingOpLoading] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await api.get<LeadDetailType>(`/api/crm/leads/${leadId}`);
        if (!cancelled) {
          setData(res);
          setNotas(res.lead.notas ?? "");
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Erro ao carregar");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  async function updateStatus(status: LeadStatus) {
    if (!data) return;
    setSaving(true);
    try {
      const updated = await api.patch<LeadDetailType["lead"]>(
        `/api/crm/leads/${leadId}`,
        { status }
      );
      setData({ ...data, lead: updated });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao atualizar");
    } finally {
      setSaving(false);
    }
  }

  async function deleteOportunidade() {
    if (!deletingOp || !data) return;
    setDeletingOpLoading(true);
    try {
      await api.delete(`/api/crm/oportunidades/${deletingOp.id}`);
      setData({ ...data, oportunidades: data.oportunidades.filter((o) => o.id !== deletingOp.id) });
      setDeletingOp(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao excluir.");
    } finally {
      setDeletingOpLoading(false);
    }
  }

  async function saveNotas() {
    if (!data) return;
    setSaving(true);
    try {
      const updated = await api.patch<LeadDetailType["lead"]>(
        `/api/crm/leads/${leadId}`,
        { notas }
      );
      setData({ ...data, lead: updated });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : "Falha ao salvar notas");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        <Loader2 className="h-5 w-5 animate-spin" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-6 text-destructive">
        {error ?? "Lead não encontrado"}
      </div>
    );
  }

  const { lead, conversations, oportunidades } = data;

  return (
    <div className="flex h-full flex-col overflow-y-auto">
      {/* Modais */}
      <EditarLeadModal
        open={showEditarLead}
        onClose={() => setShowEditarLead(false)}
        lead={lead}
        onUpdated={(updated) => { setData({ ...data, lead: updated }); setNotas(updated.notas ?? ""); }}
      />
      <NovaOportunidadeModal
        open={showNovaOp}
        onClose={() => setShowNovaOp(false)}
        leadId={leadId}
        onCreated={(op) => setData({ ...data, oportunidades: [op, ...oportunidades] })}
      />
      {editingOp && (
        <EditarOportunidadeModal
          open={!!editingOp}
          onClose={() => setEditingOp(null)}
          oportunidade={editingOp}
          onUpdated={(updated) => {
            setData({ ...data, oportunidades: oportunidades.map((o) => o.id === updated.id ? updated : o) });
            setEditingOp(null);
          }}
        />
      )}
      <ConfirmDialog
        open={!!deletingOp}
        onClose={() => setDeletingOp(null)}
        onConfirm={deleteOportunidade}
        title="Excluir oportunidade"
        description={`Deseja excluir a oportunidade "${deletingOp?.titulo}"? Esta ação não pode ser desfeita.`}
        confirmLabel="Excluir"
        loading={deletingOpLoading}
      />

      <header className="flex items-center justify-between border-b px-6 py-4">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/crm")}
            className="rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground"
            aria-label="Voltar"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="text-xl font-semibold text-foreground">
              {lead.nome ?? "Sem nome"}
            </h1>
            <p className="text-sm text-muted-foreground">{lead.telefone}</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowEditarLead(true)}
            className="flex items-center gap-1.5 rounded-lg border border-border px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-surface-elevated hover:text-foreground"
          >
            <Pencil className="h-3.5 w-3.5" />
            Editar
          </button>
          <select
            value={lead.status}
            onChange={(e) => updateStatus(e.target.value as LeadStatus)}
            disabled={saving}
            className="rounded-lg border border-border bg-surface-elevated/50 px-3 py-2 text-sm font-medium focus:outline-none focus:ring-1 focus:ring-primary/30"
          >
            {LEAD_STATUS_ORDER.map((s) => (
              <option key={s} value={s}>{LEAD_STATUS_LABELS[s]}</option>
            ))}
          </select>
        </div>
      </header>

      <div className="grid flex-1 gap-6 p-6 lg:grid-cols-3">
        <section className="space-y-4 lg:col-span-2">
          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Informações
            </h2>
            <dl className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <dt className="text-xs text-muted-foreground">Email</dt>
                <dd className="text-foreground">{lead.email ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Origem</dt>
                <dd className="text-foreground">{lead.origem ?? "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Área de interesse</dt>
                <dd className="text-foreground">
                  {lead.area_interesse
                    ? AREA_JURIDICA_LABELS[lead.area_interesse]
                    : "—"}
                </dd>
              </div>
              <div>
                <dt className="text-xs text-muted-foreground">Criado em</dt>
                <dd className="text-foreground">
                  {new Date(lead.created_at).toLocaleString("pt-BR")}
                </dd>
              </div>
            </dl>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">Notas</h2>
            <textarea
              value={notas}
              onChange={(e) => setNotas(e.target.value)}
              rows={5}
              className="w-full resize-none rounded-md border bg-background px-3 py-2 text-sm"
              placeholder="Anotações sobre o lead..."
            />
            <div className="mt-2 flex justify-end">
              <button
                type="button"
                onClick={saveNotas}
                disabled={saving || notas === (lead.notas ?? "")}
                className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground disabled:opacity-50"
              >
                Salvar
              </button>
            </div>
          </div>

          <div className="rounded-lg border bg-card p-4">
            <h2 className="mb-3 text-sm font-semibold text-foreground">
              Conversas ({conversations.length})
            </h2>
            {conversations.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma conversa vinculada.
              </p>
            ) : (
              <ul className="space-y-2">
                {conversations.map((c) => (
                  <li key={c.id}>
                    <Link
                      href={`/inbox?conversation=${c.id}`}
                      className="flex items-center justify-between rounded-md border p-3 text-sm hover:bg-accent"
                    >
                      <div>
                        <div className="font-medium text-foreground">
                          Conversa {c.id.slice(0, 8)}
                        </div>
                        <div className="text-xs text-muted-foreground">
                          Status: {c.status} · IA{" "}
                          {c.ai_enabled ? "ativa" : "pausada"}
                        </div>
                      </div>
                      <div className="text-xs text-muted-foreground">
                        {c.last_message_at
                          ? new Date(c.last_message_at).toLocaleString("pt-BR")
                          : "—"}
                      </div>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <aside className="space-y-4">
          <div className="rounded-lg border bg-card p-4">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-foreground">
                Oportunidades ({oportunidades.length})
              </h2>
              <button
                type="button"
                onClick={() => setShowNovaOp(true)}
                className="flex items-center gap-1 rounded-md px-2 py-1 text-xs text-primary hover:bg-primary/10 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar
              </button>
            </div>
            {oportunidades.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Nenhuma oportunidade aberta.
              </p>
            ) : (
              <ul className="space-y-2">
                {oportunidades.map((o) => (
                  <li key={o.id} className="rounded-lg border border-border bg-surface-elevated/30 p-3 text-sm">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate">{o.titulo}</div>
                        <div className="mt-0.5 text-xs text-muted-foreground">
                          {OPORTUNIDADE_ESTAGIO_LABELS[o.estagio]}
                          {o.valor_estimado != null
                            ? ` · R$ ${Number(o.valor_estimado).toLocaleString("pt-BR")}`
                            : ""}
                        </div>
                      </div>
                      <div className="flex shrink-0 gap-1">
                        <button
                          type="button"
                          onClick={() => setEditingOp(o)}
                          className="rounded p-1 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setDeletingOp(o)}
                          className="rounded p-1 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </aside>
      </div>
    </div>
  );
}
