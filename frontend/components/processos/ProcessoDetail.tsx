"use client";

import { useState } from "react";
import type { ProcessoDetail as ProcessoDetailType } from "@/types/processos";
import { PROCESSO_STATUS_LABELS, PROCESSO_STATUS_COLORS } from "@/types/processos";
import { AREA_JURIDICA_LABELS } from "@/types/crm";
import { AndamentoTimeline } from "./AndamentoTimeline";
import { IntimacaoCard } from "./IntimacaoCard";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import { useRouter } from "next/navigation";
import { Scale, Archive, Plus, Pencil } from "lucide-react";
import { Modal } from "@/components/ui/Modal";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { EditarProcessoModal } from "./EditarProcessoModal";

interface Props {
  data: ProcessoDetailType;
}

type Tab = "andamentos" | "intimacoes";

export function ProcessoDetail({ data }: Props) {
  const { processo, andamentos, intimacoes } = data;
  const [tab, setTab] = useState<Tab>("andamentos");
  const [showForm, setShowForm] = useState(false);
  const [formDate, setFormDate] = useState("");
  const [formText, setFormText] = useState("");
  const [saving, setSaving] = useState(false);
  const [archiving, setArchiving] = useState(false);
  const [showArchiveConfirm, setShowArchiveConfirm] = useState(false);
  const [showEditarProcesso, setShowEditarProcesso] = useState(false);
  const [localProcesso, setLocalProcesso] = useState(processo);
  const [localAndamentos, setLocalAndamentos] = useState(andamentos);
  const router = useRouter();

  async function handleArchive() {
    setArchiving(true);
    try {
      await api.delete(`/api/processos/${processo.id}`);
      router.push("/processos");
    } finally {
      setArchiving(false);
      setShowArchiveConfirm(false);
    }
  }

  async function handleAddAndamento(e: React.FormEvent) {
    e.preventDefault();
    if (!formDate || !formText.trim() || saving) return;
    setSaving(true);
    try {
      const novo = await api.post<typeof andamentos[0]>(
        `/api/processos/${processo.id}/andamentos`,
        { data_andamento: formDate, texto_original: formText.trim() }
      );
      setLocalAndamentos((prev) => [novo, ...prev]);
      setFormDate("");
      setFormText("");
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="flex flex-col h-full">
      {/* EditarProcessoModal */}
      <EditarProcessoModal
        open={showEditarProcesso}
        onClose={() => setShowEditarProcesso(false)}
        processo={localProcesso}
        onUpdated={(updated) => setLocalProcesso(updated)}
      />

      {/* Header */}
      <div className="border-b px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <h1 className="font-mono text-lg font-semibold">{localProcesso.numero_cnj}</h1>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                PROCESSO_STATUS_COLORS[localProcesso.status]
              )}
            >
              {PROCESSO_STATUS_LABELS[localProcesso.status]}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {localProcesso.tribunal && <span>Tribunal: {localProcesso.tribunal}</span>}
            {localProcesso.vara && <span>Vara: {localProcesso.vara}</span>}
            {localProcesso.area_juridica && (
              <span>Área: {AREA_JURIDICA_LABELS[localProcesso.area_juridica]}</span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {localProcesso.status !== "arquivado" && (
            <button
              onClick={() => setShowEditarProcesso(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated transition-colors"
            >
              <Pencil className="h-3.5 w-3.5" />
              Editar
            </button>
          )}
          {localProcesso.status !== "arquivado" && (
            <button
              onClick={() => setShowArchiveConfirm(true)}
              className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated transition-colors"
            >
              <Archive className="h-3.5 w-3.5" />
              Arquivar
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="border-b flex text-sm">
        {(["andamentos", "intimacoes"] as Tab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={cn(
              "px-4 py-2 font-medium capitalize transition-colors",
              tab === t
                ? "border-b-2 border-primary text-primary"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t === "andamentos"
              ? `Andamentos (${localAndamentos.length})`
              : `Intimações (${intimacoes.length})`}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 overflow-y-auto p-6">
        {tab === "andamentos" ? (
          <>
            <div className="flex justify-end mb-4">
              <button
                onClick={() => setShowForm(true)}
                className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:bg-primary-hover hover:shadow-glow-gold transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar andamento
              </button>
            </div>
            <AndamentoTimeline andamentos={localAndamentos} />
          </>
        ) : (
          <div className="space-y-3">
            {intimacoes.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-8">
                Nenhuma intimação registrada.
              </p>
            ) : (
              intimacoes.map((i) => <IntimacaoCard key={i.id} intimacao={i} />)
            )}
          </div>
        )}
      </div>

      {/* Modal — Novo andamento */}
      <Modal
        open={showForm}
        onClose={() => { setShowForm(false); setFormDate(""); setFormText(""); }}
        title="Novo andamento"
        description="Registre um andamento manual no processo"
        size="md"
      >
        <form onSubmit={handleAddAndamento} className="space-y-4">
          <div>
            <label className="label-caps mb-1.5 block">Data *</label>
            <input
              type="date"
              value={formDate}
              onChange={(e) => setFormDate(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface-elevated/50 px-3.5 py-2.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
            />
          </div>
          <div>
            <label className="label-caps mb-1.5 block">Texto do andamento *</label>
            <textarea
              value={formText}
              onChange={(e) => setFormText(e.target.value)}
              required
              rows={4}
              className="w-full resize-none rounded-lg border border-border bg-surface-elevated/50 px-3.5 py-2.5 text-sm focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30"
              placeholder="Descreva o andamento processual…"
            />
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => { setShowForm(false); setFormDate(""); setFormText(""); }}
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
              {saving ? "Salvando..." : "Salvar andamento"}
            </button>
          </div>
        </form>
      </Modal>

      {/* ConfirmDialog — Arquivar */}
      <ConfirmDialog
        open={showArchiveConfirm}
        onClose={() => setShowArchiveConfirm(false)}
        onConfirm={handleArchive}
        title="Arquivar processo"
        description={`Tem certeza que deseja arquivar o processo ${localProcesso.numero_cnj}? Ele não aparecerá mais na lista principal.`}
        confirmLabel="Arquivar"
        loading={archiving}
      />
    </div>
  );
}
