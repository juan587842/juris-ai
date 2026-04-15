import type { ProcessosStats } from "@/types/dashboard";

interface Props {
  processos: ProcessosStats;
}

const bars = [
  { key: "ativo" as const, label: "Ativo", color: "bg-green-500" },
  { key: "suspenso" as const, label: "Suspenso", color: "bg-yellow-500" },
  { key: "finalizado" as const, label: "Finalizado", color: "bg-blue-500" },
];

export function ProcessosBarChart({ processos }: Props) {
  const max = Math.max(...bars.map((b) => processos[b.key]), 1);

  return (
    <div className="space-y-4">
      <div className="flex items-end gap-3 h-32">
        {bars.map((bar) => {
          const val = processos[bar.key];
          const pct = Math.round((val / max) * 100);
          return (
            <div key={bar.key} className="flex-1 flex flex-col items-center gap-1">
              <span className="text-sm font-semibold text-foreground">{val}</span>
              <div className="w-full rounded-t-md bg-surface-elevated overflow-hidden" style={{ height: "80px" }}>
                <div
                  className={`w-full rounded-t-md transition-all duration-500 ${bar.color} opacity-80`}
                  style={{ height: `${pct}%`, marginTop: `${100 - pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex gap-3">
        {bars.map((bar) => (
          <div key={bar.key} className="flex-1 flex items-center gap-1.5">
            <span className={`h-2 w-2 rounded-full ${bar.color}`} />
            <span className="text-xs text-muted-foreground">{bar.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
