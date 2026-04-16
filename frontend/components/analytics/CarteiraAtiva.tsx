import type { CarteiraAtiva } from "@/types/analytics";

interface Props {
  dados: CarteiraAtiva;
}

export function CarteiraAtiva({ dados }: Props) {
  const itens = [
    { key: "ativo" as const, label: "Ativos", cor: "#22c55e", bg: "#22c55e20" },
    { key: "suspenso" as const, label: "Suspensos", cor: "#f59e0b", bg: "#f59e0b20" },
    { key: "finalizado" as const, label: "Finalizados", cor: "#9ca3af", bg: "#6b728020" },
    { key: "arquivado" as const, label: "Arquivados", cor: "#6b7280", bg: "#6b728015" },
  ];

  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold">Carteira ativa</div>
      <div className="flex flex-col gap-2">
        {itens.map(({ key, label, cor, bg }) => (
          <div key={key} className="flex justify-between items-center text-[11px]">
            <span className="text-muted-foreground">{label}</span>
            <span
              className="rounded px-1.5 text-[10px] font-semibold"
              style={{ color: cor, background: bg }}
            >
              {dados[key]}
            </span>
          </div>
        ))}
      </div>
      <div className="text-[10px] text-muted-foreground">
        Total: {dados.total} {dados.total === 1 ? "processo" : "processos"}
      </div>
    </div>
  );
}
