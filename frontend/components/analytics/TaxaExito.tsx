import type { TaxaExitoItem } from "@/types/analytics";
import { AREA_LABELS } from "@/types/analytics";

interface Props {
  dados: TaxaExitoItem[];
}

export function TaxaExito({ dados }: Props) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold">Taxa de êxito</div>
      {dados.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">Sem processos finalizados</div>
      ) : (
        <div className="flex flex-col gap-2">
          {dados.map((item) => (
            <div key={item.area} className="flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground">
                {AREA_LABELS[item.area] ?? item.area}
              </span>
              <span
                className="font-semibold"
                style={{ color: item.exito_pct >= 60 ? "#22c55e" : "#f59e0b" }}
              >
                {item.exito_pct}%
              </span>
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-muted-foreground">Processos com resultado registrado</div>
    </div>
  );
}
