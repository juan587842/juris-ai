import Link from "next/link";
import { FileText, UserPlus } from "lucide-react";
import type { AndamentoRecente, LeadRecente } from "@/types/dashboard";

interface Props {
  andamentos: AndamentoRecente[];
  leads: LeadRecente[];
}

type FeedItem =
  | { type: "andamento"; data: AndamentoRecente; date: Date }
  | { type: "lead"; data: LeadRecente; date: Date };

function relativeDate(iso: string): string {
  const diff = Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000);
  if (diff === 0) return "hoje";
  if (diff === 1) return "ontem";
  if (diff < 7) return `há ${diff} dias`;
  return new Date(iso).toLocaleDateString("pt-BR");
}

export function AtividadeRecente({ andamentos, leads }: Props) {
  const feed: FeedItem[] = [
    ...andamentos.map((a) => ({
      type: "andamento" as const,
      data: a,
      date: new Date(a.created_at),
    })),
    ...leads.map((l) => ({
      type: "lead" as const,
      data: l,
      date: new Date(l.created_at),
    })),
  ].sort((a, b) => b.date.getTime() - a.date.getTime());

  if (feed.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-6">
        Nenhuma atividade recente.
      </p>
    );
  }

  return (
    <div className="space-y-0">
      {feed.map((item, idx) => (
        <div key={`${item.type}-${item.data.id}`} className="flex gap-3 py-3 border-b border-border/50 last:border-0">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-surface-elevated mt-0.5">
            {item.type === "andamento" ? (
              <FileText className="h-3.5 w-3.5 text-primary/70" />
            ) : (
              <UserPlus className="h-3.5 w-3.5 text-blue-400/70" />
            )}
          </div>

          <div className="flex-1 min-w-0">
            {item.type === "andamento" ? (
              <>
                <Link
                  href={`/processos/${item.data.processo_id}`}
                  className="font-mono text-xs font-medium hover:text-primary transition-colors"
                >
                  {(item.data as AndamentoRecente).processo_cnj}
                </Link>
                <p className="text-xs text-muted-foreground truncate mt-0.5">
                  {(item.data as AndamentoRecente).texto_original}
                </p>
              </>
            ) : (
              <>
                <Link
                  href={`/crm/${item.data.id}`}
                  className="text-xs font-medium hover:text-primary transition-colors"
                >
                  {(item.data as LeadRecente).nome || (item.data as LeadRecente).telefone}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Novo lead — {(item.data as LeadRecente).status.replace("_", " ")}
                </p>
              </>
            )}
          </div>

          <span className="shrink-0 text-xs text-muted-foreground/60 mt-0.5">
            {relativeDate(item.data.created_at)}
          </span>
        </div>
      ))}
    </div>
  );
}
