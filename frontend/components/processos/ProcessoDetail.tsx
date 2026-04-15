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
import { Scale, Archive, Plus } from "lucide-react";

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
  const [localAndamentos, setLocalAndamentos] = useState(andamentos);
  const router = useRouter();

  async function handleArchive() {
    if (!confirm("Arquivar este processo?")) return;
    await api.delete(`/api/processos/${processo.id}`);
    router.push("/processos");
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
      {/* Header */}
      <div className="border-b px-6 py-4 flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Scale className="h-4 w-4 text-muted-foreground" />
            <h1 className="font-mono text-lg font-semibold">{processo.numero_cnj}</h1>
            <span
              className={cn(
                "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                PROCESSO_STATUS_COLORS[processo.status]
              )}
            >
              {PROCESSO_STATUS_LABELS[processo.status]}
            </span>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {processo.tribunal && <span>Tribunal: {processo.tribunal}</span>}
            {processo.vara && <span>Vara: {processo.vara}</span>}
            {processo.area_juridica && (
              <span>Área: {AREA_JURIDICA_LABELS[processo.area_juridica]}</span>
            )}
          </div>
        </div>

        {processo.status !== "arquivado" && (
          <button
            onClick={handleArchive}
            className="flex items-center gap-1.5 rounded-md border px-3 py-1.5 text-xs text-muted-foreground hover:bg-muted transition-colors"
          >
            <Archive className="h-3.5 w-3.5" />
            Arquivar
          </button>
        )}
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
                onClick={() => setShowForm((v) => !v)}
                className="flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Adicionar andamento
              </button>
            </div>

            {showForm && (
              <form
                onSubmit={handleAddAndamento}
                className="mb-6 rounded-lg border bg-card p-4 space-y-3"
              >
                <div className="flex gap-3 items-start">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Data
                    </label>
                    <input
                      type="date"
                      value={formDate}
                      onChange={(e) => setFormDate(e.target.value)}
                      required
                      className="rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                  <div className="flex-1 flex flex-col gap-1">
                    <label className="text-xs font-medium text-muted-foreground">
                      Texto do andamento
                    </label>
                    <textarea
                      value={formText}
                      onChange={(e) => setFormText(e.target.value)}
                      required
                      rows={3}
                      className="resize-none rounded-md border border-input bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowForm(false)}
                    className="rounded-md border px-3 py-1.5 text-xs hover:bg-muted transition-colors"
                  >
                    Cancelar
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
                  >
                    Salvar
                  </button>
                </div>
              </form>
            )}

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
    </div>
  );
}
