"use client";

import { useState } from "react";
import { Bot, RefreshCw, FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Processo, Andamento } from "@/types/processos";

interface Props {
  processo: Processo;
  andamentosRpa: Andamento[];
  onProcessoUpdated: (p: Processo) => void;
}

export function MonitoramentoTab({ processo, andamentosRpa, onProcessoUpdated }: Props) {
  const [verificando, setVerificando] = useState(false);
  const [togglingMonitorar, setTogglingMonitorar] = useState(false);
  const [togglingCliente, setTogglingCliente] = useState(false);

  async function handleToggleMonitorar() {
    setTogglingMonitorar(true);
    try {
      const updated = await api.put<Processo>(
        `/api/processos/${processo.id}/monitoramento`,
        { monitorar: !processo.monitorar }
      );
      onProcessoUpdated(updated);
    } finally {
      setTogglingMonitorar(false);
    }
  }

  async function handleToggleCliente() {
    setTogglingCliente(true);
    try {
      const updated = await api.put<Processo>(
        `/api/processos/${processo.id}/monitoramento`,
        { notificar_cliente: !processo.notificar_cliente }
      );
      onProcessoUpdated(updated);
    } finally {
      setTogglingCliente(false);
    }
  }

  async function handleVerificarAgora() {
    setVerificando(true);
    try {
      await api.post(`/api/processos/${processo.id}/verificar`, {});
    } finally {
      setVerificando(false);
    }
  }

  const ultimaVerificacao = processo.ultima_verificacao_at
    ? new Date(processo.ultima_verificacao_at).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Configuração */}
      <div>
        <p className="label-caps mb-3">Configuração</p>
        <div className="rounded-xl border border-border bg-surface/50 divide-y divide-border">
          <ToggleRow
            label="Monitorar automaticamente"
            description="Verifica novas movimentações a cada hora via DataJud/CNJ"
            checked={processo.monitorar}
            disabled={togglingMonitorar}
            onChange={handleToggleMonitorar}
          />
          <ToggleRow
            label="Notificar cliente via WhatsApp"
            description="Envia resumo em linguagem simples ao cliente quando houver novidade"
            checked={processo.notificar_cliente}
            disabled={togglingCliente || !processo.monitorar}
            onChange={handleToggleCliente}
          />
        </div>
      </div>

      {/* Status + ação manual */}
      <div className="flex items-stretch gap-3">
        <div className="flex-1 rounded-xl border border-border bg-surface/50 px-4 py-3">
          <p className="label-caps mb-1">Última verificação</p>
          <p className="text-sm font-medium">
            {ultimaVerificacao ?? "Nunca verificado"}
          </p>
        </div>
        <div className="flex items-center">
          <button
            onClick={handleVerificarAgora}
            disabled={verificando || !processo.monitorar}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover hover:shadow-glow-gold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", verificando && "animate-spin")} />
            {verificando ? "Verificando..." : "Verificar agora"}
          </button>
        </div>
      </div>

      {/* Movimentações detectadas pelo robô */}
      <div>
        <p className="label-caps mb-3">
          Movimentações detectadas pelo robô ({andamentosRpa.length})
        </p>
        {andamentosRpa.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/50 px-4 py-8 text-center">
            <Bot className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">
              {processo.monitorar
                ? "Nenhuma movimentação detectada ainda. O robô verifica a cada hora."
                : "Ative o monitoramento para que o robô comece a verificar este processo."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface/50 divide-y divide-border">
            {andamentosRpa.map((a) => (
              <MovimentacaoItem key={a.id} andamento={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none disabled:opacity-40",
          checked ? "bg-green-500" : "bg-muted"
        )}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}

function MovimentacaoItem({ andamento }: { andamento: Andamento }) {
  const data = new Date(andamento.data_andamento + "T12:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-violet-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{andamento.texto_original}</p>
          <span className="flex-shrink-0 text-xs text-muted-foreground">{data}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {andamento.pdf_url && (
            <Badge icon={<FileText className="h-3 w-3" />} label="PDF extraído" color="gold" />
          )}
          {andamento.notificado_advogado_at && (
            <Badge icon={<MessageSquare className="h-3 w-3" />} label="Advogado notificado" color="green" />
          )}
          {andamento.notificado_cliente_at && (
            <Badge icon={<Bot className="h-3 w-3" />} label="Cliente notificado" color="violet" />
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: "gold" | "green" | "violet";
}) {
  const colors = {
    gold: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-400",
    violet: "bg-violet-500/10 text-violet-400",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium", colors[color])}>
      {icon}
      {label}
    </span>
  );
}
