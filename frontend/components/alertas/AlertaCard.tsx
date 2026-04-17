import Link from "next/link";
import type { Alerta } from "@/types/alertas";
import { SEVERIDADE_COLORS, SEVERIDADE_LABELS } from "@/types/alertas";

interface Props {
  alerta: Alerta;
}

export function AlertaCard({ alerta }: Props) {
  const colors = SEVERIDADE_COLORS[alerta.severidade];

  return (
    <div
      className="flex items-center justify-between rounded-lg border px-4 py-3 gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: colors.bg, color: colors.text }}
        >
          {SEVERIDADE_LABELS[alerta.severidade]}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{alerta.titulo}</p>
          <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
        </div>
      </div>
      <Link
        href={alerta.link}
        className="shrink-0 text-xs text-primary hover:underline"
      >
        Ver →
      </Link>
    </div>
  );
}
