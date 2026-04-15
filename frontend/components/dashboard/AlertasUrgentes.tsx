import Link from "next/link";
import { AlertTriangle, CheckCircle } from "lucide-react";
import type { IntimacaoUrgente } from "@/types/dashboard";
import { cn } from "@/lib/utils";

interface Props {
  intimacoes: IntimacaoUrgente[];
}

function diffDias(prazo: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const d = new Date(prazo + "T00:00:00");
  return Math.round((d.getTime() - hoje.getTime()) / 86_400_000);
}

export function AlertasUrgentes({ intimacoes }: Props) {
  if (intimacoes.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-32 gap-2 text-muted-foreground">
        <CheckCircle className="h-7 w-7 opacity-40" />
        <p className="text-sm">Nenhum prazo urgente</p>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {intimacoes.map((i) => {
        const diff = diffDias(i.prazo_fatal);
        const isHoje = diff === 0;
        const isVencido = diff < 0;

        return (
          <div
            key={i.id}
            className={cn(
              "flex items-center justify-between rounded-lg border px-3 py-2.5 gap-3",
              isVencido
                ? "border-red-500/30 bg-red-500/5"
                : isHoje
                ? "border-orange-500/30 bg-orange-500/5"
                : "border-yellow-500/20 bg-yellow-500/5"
            )}
          >
            <div className="flex items-center gap-2 min-w-0">
              <AlertTriangle
                className={cn(
                  "h-3.5 w-3.5 shrink-0",
                  isVencido ? "text-red-400" : isHoje ? "text-orange-400" : "text-yellow-400"
                )}
              />
              <Link
                href={`/processos/${i.processo_id}`}
                className="font-mono text-xs font-medium hover:text-primary transition-colors truncate"
              >
                {i.processo_cnj}
              </Link>
            </div>

            <span
              className={cn(
                "shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold",
                isVencido
                  ? "bg-red-500/15 text-red-400"
                  : isHoje
                  ? "bg-orange-500/15 text-orange-400"
                  : "bg-yellow-500/15 text-yellow-500"
              )}
            >
              {isVencido
                ? `Vencido há ${Math.abs(diff)}d`
                : isHoje
                ? "Vence hoje"
                : `${diff}d`}
            </span>
          </div>
        );
      })}
    </div>
  );
}
