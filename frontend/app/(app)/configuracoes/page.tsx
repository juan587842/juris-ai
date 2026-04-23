"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { PerfilTab } from "@/components/configuracoes/PerfilTab";
import { EscritorioTab } from "@/components/configuracoes/EscritorioTab";
import { IntegracoesTab } from "@/components/configuracoes/IntegracoesTab";
import { NotificacoesTab } from "@/components/configuracoes/NotificacoesTab";
import { SegurancaTab } from "@/components/configuracoes/SegurancaTab";

type Tab = "perfil" | "escritorio" | "integracoes" | "notificacoes" | "seguranca";

const TABS: { id: Tab; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "escritorio", label: "Escritório" },
  { id: "integracoes", label: "Integrações" },
  { id: "notificacoes", label: "Notificações" },
  { id: "seguranca", label: "Segurança" },
];

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>("perfil");

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-radial-gold">
      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center gap-3"
        style={{ borderColor: "rgba(255,255,255,.08)" }}
      >
        <Settings className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Configurações</h1>
          <p className="text-xs text-muted-foreground">Gerencie seu perfil e preferências</p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 border-b px-6 pt-4"
        style={{ borderColor: "rgba(255,255,255,.08)" }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="pb-3 px-3 text-sm font-medium transition-colors relative"
            style={
              tab === id
                ? { color: "#c9a96e" }
                : { color: "rgba(255,255,255,.45)" }
            }
          >
            {label}
            {tab === id && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: "#c9a96e" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-6">
        {tab === "perfil" && <PerfilTab />}
        {tab === "escritorio" && <EscritorioTab />}
        {tab === "integracoes" && <IntegracoesTab />}
        {tab === "notificacoes" && <NotificacoesTab />}
        {tab === "seguranca" && <SegurancaTab />}
      </div>
    </div>
  );
}
