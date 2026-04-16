"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import type { Processo } from "@/types/processos";
import {
  PROCESSO_STATUS_LABELS,
  PROCESSO_STATUS_COLORS,
} from "@/types/processos";
import { AREA_JURIDICA_LABELS } from "@/types/crm";
import { cn } from "@/lib/utils";
import { Scale, Plus } from "lucide-react";
import { NovoProcessoModal } from "@/components/processos/NovoProcessoModal";

export default function ProcessosPage() {
  const [processos, setProcessos] = useState<Processo[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);

  useEffect(() => {
    api
      .get<Processo[]>("/api/processos?limit=200")
      .then((data) => setProcessos(data))
      .catch((err) => {
        console.error("Erro ao carregar processos:", err);
        setError(err?.message ?? "Erro ao carregar processos");
      })
      .finally(() => setLoading(false));
  }, []);

  const filtered = processos.filter((p) => {
    const q = search.toLowerCase();
    return p.numero_cnj.toLowerCase().includes(q) || p.tribunal?.toLowerCase().includes(q);
  });

  return (
    <div className="flex flex-col h-full">
      <NovoProcessoModal
        open={showModal}
        onClose={() => setShowModal(false)}
        onCreated={(p) => setProcessos((prev) => [p, ...prev])}
      />
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Processos Judiciais</h1>
        <div className="flex items-center gap-3">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Buscar por CNJ ou tribunal…"
            className="w-72 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-3 py-1.5 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover hover:shadow-glow-gold"
          >
            <Plus className="h-4 w-4" />
            Novo processo
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {loading ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            Carregando…
          </div>
        ) : error ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-destructive">
            <Scale className="h-8 w-8 opacity-30" />
            <p className="text-sm font-medium">Falha ao carregar processos</p>
            <p className="text-xs text-muted-foreground">{error}</p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full gap-2 text-muted-foreground">
            <Scale className="h-8 w-8 opacity-30" />
            <p className="text-sm">
              {search ? "Nenhum processo encontrado." : "Nenhum processo cadastrado ainda."}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50 backdrop-blur border-b">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">
                  Número CNJ
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Tribunal / Vara
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Área
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Status
                </th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                  Criado em
                </th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((p) => (
                <tr key={p.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3">
                    <Link
                      href={`/processos/${p.id}`}
                      className="font-mono text-sm font-medium hover:text-primary transition-colors"
                    >
                      {p.numero_cnj}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    <div>{p.tribunal ?? "—"}</div>
                    {p.vara && (
                      <div className="text-xs">{p.vara}</div>
                    )}
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {p.area_juridica ? AREA_JURIDICA_LABELS[p.area_juridica] : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
                        PROCESSO_STATUS_COLORS[p.status]
                      )}
                    >
                      {PROCESSO_STATUS_LABELS[p.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {new Date(p.created_at).toLocaleDateString("pt-BR")}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
