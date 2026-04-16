import type { OrigemItem } from "@/types/analytics";

interface Props {
  dados: OrigemItem[];
}

const CORES_ORIGEM: Record<string, string> = {
  whatsapp: "#22c55e",
  indicacao: "#818cf8",
  site: "#f59e0b",
  landing_page: "#f59e0b",
  outro: "#6b7280",
};

const LABELS_ORIGEM: Record<string, string> = {
  whatsapp: "WhatsApp",
  indicacao: "Indicação",
  site: "Site",
  landing_page: "Landing Page",
  outro: "Outro",
};

export function OrigemLeads({ dados }: Props) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold">Origem dos leads</div>
      {dados.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">Sem leads no período</div>
      ) : (
        <div className="flex flex-col gap-2">
          {dados.map((item) => (
            <div key={item.origem} className="flex items-center gap-2 text-[11px]">
              <div
                className="shrink-0 rounded-full"
                style={{
                  width: 8,
                  height: 8,
                  background: CORES_ORIGEM[item.origem] ?? "#6b7280",
                }}
              />
              <span className="flex-1 text-muted-foreground">
                {LABELS_ORIGEM[item.origem] ?? item.origem}
              </span>
              <span>
                {item.count} ({item.pct}%)
              </span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
