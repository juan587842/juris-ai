import type { FunilConversao } from "@/types/analytics";

interface Props {
  dados: FunilConversao;
}

const BARRAS = [
  { key: "novo" as const, label: "Novos", cor: "#818cf8" },
  { key: "qualificado" as const, label: "Qualificados", cor: "#a78bfa" },
  { key: "convertido" as const, label: "Convertidos", cor: "#c9a96e" },
];

export function FunilConversao({ dados }: Props) {
  const max = Math.max(dados.novo, dados.qualificado, dados.convertido, 1);

  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold">Funil de conversão</div>
      <div className="flex flex-col gap-2">
        {BARRAS.map(({ key, label, cor }) => {
          const val = dados[key];
          const pct = Math.round((val / max) * 100);
          return (
            <div key={key} className="flex items-center gap-2">
              <div
                className="flex-1 rounded overflow-hidden"
                style={{ height: 20, background: "rgba(255,255,255,.06)" }}
              >
                <div
                  className="h-full flex items-center pl-2 rounded"
                  style={{ width: `${pct}%`, background: cor, minWidth: val > 0 ? 40 : 0 }}
                >
                  <span
                    className="text-[10px] font-semibold truncate"
                    style={{ color: key === "convertido" ? "#0a0f1e" : "#fff" }}
                  >
                    {label} — {val}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="text-[10px] text-muted-foreground">
        Taxa de conversão: {dados.taxa_conversao_pct}%
      </div>
    </div>
  );
}
