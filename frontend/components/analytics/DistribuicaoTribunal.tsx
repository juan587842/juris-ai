import type { TribunalItem } from "@/types/analytics";

interface Props {
  dados: TribunalItem[];
}

export function DistribuicaoTribunal({ dados }: Props) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold">Por tribunal</div>
      {dados.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">Nenhum processo cadastrado</div>
      ) : (
        <div className="flex flex-col gap-2">
          {dados.map((item) => (
            <div key={item.tribunal} className="flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground">{item.tribunal}</span>
              <span className="font-semibold">{item.count}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
