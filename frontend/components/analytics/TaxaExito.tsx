import type { TaxaExitoItem } from "@/types/analytics";

interface Props {
  dados: TaxaExitoItem[];
  geral: number | null;
}

export function TaxaExito({ geral }: Props) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold">Taxa de êxito</div>
      {geral === null ? (
        <div className="text-[11px] text-muted-foreground">Sem processos finalizados</div>
      ) : (
        <div
          className="text-3xl font-bold"
          style={{ color: geral >= 60 ? "#22c55e" : "#f59e0b" }}
        >
          {geral}%
        </div>
      )}
      <div className="text-[10px] text-muted-foreground">Processos com resultado registrado</div>
    </div>
  );
}
