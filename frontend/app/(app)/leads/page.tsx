"use client";

import { useEffect, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import Link from "next/link";
import type { Lead } from "@/types/crm";
import { LEAD_STATUS_LABELS, AREA_JURIDICA_LABELS } from "@/types/crm";
import { Phone, Mail, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";

const STATUS_COLORS: Record<string, string> = {
  novo: "bg-blue-100 text-blue-700",
  contato_feito: "bg-yellow-100 text-yellow-700",
  qualificado: "bg-violet-100 text-violet-700",
  desqualificado: "bg-gray-100 text-gray-500",
  convertido: "bg-green-100 text-green-700",
};

export default function LeadsPage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [search, setSearch] = useState("");
  const supabase = createBrowserClient();

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("leads")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(200);
      if (data) setLeads(data as Lead[]);
    }
    load();
  }, []);

  const filtered = leads.filter((l) => {
    const q = search.toLowerCase();
    return (
      l.nome?.toLowerCase().includes(q) ||
      l.telefone.includes(q) ||
      l.email?.toLowerCase().includes(q)
    );
  });

  return (
    <div className="flex flex-col h-full">
      <div className="border-b px-6 py-4 flex items-center justify-between gap-4">
        <h1 className="text-lg font-semibold">Leads</h1>
        <input
          type="search"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Buscar por nome, telefone ou e-mail…"
          className="w-72 rounded-md border border-input bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
        />
      </div>

      <div className="flex-1 overflow-y-auto">
        {filtered.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted-foreground text-sm">
            {search ? "Nenhum lead encontrado." : "Nenhum lead cadastrado ainda."}
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-muted/50 backdrop-blur border-b">
              <tr>
                <th className="text-left px-6 py-3 font-medium text-muted-foreground">Nome</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Contato</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Área</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Status</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Origem</th>
                <th className="text-left px-4 py-3 font-medium text-muted-foreground">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {filtered.map((lead) => (
                <tr key={lead.id} className="hover:bg-muted/30 transition-colors">
                  <td className="px-6 py-3">
                    <Link
                      href={`/crm/${lead.id}`}
                      className="font-medium hover:text-primary transition-colors"
                    >
                      {lead.nome || "—"}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {new Date(lead.created_at).toLocaleDateString("pt-BR")}
                    </p>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col gap-0.5">
                      <span className="flex items-center gap-1 text-xs">
                        <Phone className="h-3 w-3 text-muted-foreground" />
                        {lead.telefone}
                      </span>
                      {lead.email && (
                        <span className="flex items-center gap-1 text-xs text-muted-foreground">
                          <Mail className="h-3 w-3" />
                          {lead.email}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground">
                    {lead.area_interesse
                      ? AREA_JURIDICA_LABELS[lead.area_interesse]
                      : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium",
                        STATUS_COLORS[lead.status] ?? "bg-gray-100 text-gray-600"
                      )}
                    >
                      {LEAD_STATUS_LABELS[lead.status]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-muted-foreground capitalize">
                    {lead.origem ?? "—"}
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href="/inbox"
                      title="Ver conversas"
                      className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                    >
                      <MessageSquare className="h-3.5 w-3.5" />
                      Inbox
                    </Link>
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
