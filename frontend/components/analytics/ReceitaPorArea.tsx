import type { ReceitaItem } from "@/types/analytics";
import { AREA_LABELS } from "@/types/analytics";

interface Props {
  dados: ReceitaItem[];
}

function formatBRL(valor: number): string {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function ReceitaPorArea({ dados }: Props) {
  const total = dados.reduce((acc, r) => acc + r.total, 0);

  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold">Receita por área jurídica</div>
      {dados.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">Sem dados no período</div>
      ) : (
        <div className="flex flex-col gap-2">
          {dados.map((item) => (
            <div key={item.area} className="flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground">
                {AREA_LABELS[item.area] ?? item.area}
              </span>
              <span className="font-semibold" style={{ color: "#c9a96e" }}>
                {formatBRL(item.total)}
              </span>
            </div>
          ))}
        </div>
      )}
      {dados.length > 0 && (
        <div
          className="text-[10px] text-muted-foreground border-t pt-2"
          style={{ borderColor: "rgba(255,255,255,.06)" }}
        >
          Total: {formatBRL(total)}
        </div>
      )}
    </div>
  );
}
