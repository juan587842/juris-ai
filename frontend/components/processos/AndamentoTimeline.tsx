"use client";

import type { Andamento } from "@/types/processos";
import { CheckCircle, Clock } from "lucide-react";

interface Props {
  andamentos: Andamento[];
}

export function AndamentoTimeline({ andamentos }: Props) {
  if (andamentos.length === 0) {
    return (
      <p className="text-sm text-muted-foreground text-center py-8">
        Nenhum andamento registrado.
      </p>
    );
  }

  return (
    <ol className="relative border-l border-muted ml-3 space-y-6 py-2">
      {andamentos.map((a) => (
        <li key={a.id} className="ml-6">
          <span className="absolute -left-3 flex h-6 w-6 items-center justify-center rounded-full bg-background border border-muted">
            <Clock className="h-3 w-3 text-muted-foreground" />
          </span>

          <div className="rounded-lg border bg-card px-4 py-3 shadow-sm">
            <div className="flex items-center justify-between gap-2 mb-1">
              <time className="text-xs font-medium text-muted-foreground">
                {new Date(a.data_andamento + "T00:00:00").toLocaleDateString("pt-BR")}
              </time>
              {a.texto_traduzido && (
                <span className="inline-flex items-center gap-1 rounded-full bg-green-100 px-2 py-0.5 text-xs text-green-700">
                  <CheckCircle className="h-3 w-3" />
                  Traduzido
                </span>
              )}
            </div>

            {a.texto_traduzido ? (
              <>
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {a.texto_traduzido}
                </p>
                <details className="mt-2">
                  <summary className="text-xs text-muted-foreground cursor-pointer hover:text-foreground">
                    Ver texto original
                  </summary>
                  <p className="mt-1 text-xs text-muted-foreground whitespace-pre-wrap">
                    {a.texto_original}
                  </p>
                </details>
              </>
            ) : (
              <p className="text-sm text-foreground whitespace-pre-wrap">
                {a.texto_original}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}
