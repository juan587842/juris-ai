import type { TempoMedioItem } from "@/types/analytics";

interface Props {
  dados: TempoMedioItem[];
  geral: number | null;
}

function diasParaTexto(dias: number): string {
  if (dias < 30) return `${dias} dias`;
  const meses = Math.round(dias / 30);
  return `${meses} ${meses === 1 ? "mês" : "meses"}`;
}

export function TempoMedio({ geral }: Props) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold">Tempo médio</div>
      {geral === null ? (
        <div className="text-[11px] text-muted-foreground">Sem processos finalizados</div>
      ) : (
        <div className="text-3xl font-bold">{diasParaTexto(geral)}</div>
      )}
      <div className="text-[10px] text-muted-foreground">Processos finalizados</div>
    </div>
  );
}
