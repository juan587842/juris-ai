import type { AtendimentoData } from "@/types/analytics";

interface Props {
  dados: AtendimentoData;
}

function segundosParaTexto(s: number): string {
  if (s < 60) return `${Math.round(s)}s`;
  const min = Math.round(s / 60);
  return `${min} min`;
}

function MetricCard({
  titulo,
  valor,
  descricao,
}: {
  titulo: string;
  valor: string;
  descricao: string;
}) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold">{titulo}</div>
      <div className="text-3xl font-bold">{valor}</div>
      <div className="text-[10px] text-muted-foreground">{descricao}</div>
    </div>
  );
}

export function AtendimentoSection({ dados }: Props) {
  const transbordo =
    dados.pct_transbordo !== null ? `${dados.pct_transbordo}%` : "—";
  const tempoResposta =
    dados.tempo_medio_resposta_segundos !== null
      ? segundosParaTexto(dados.tempo_medio_resposta_segundos)
      : "—";

  return (
    <div className="grid grid-cols-3 gap-4">
      <MetricCard
        titulo="Volume de conversas"
        valor={String(dados.volume_conversas)}
        descricao="Conversas iniciadas no período"
      />
      <MetricCard
        titulo="Transbordo para humano"
        valor={transbordo}
        descricao="Conversas assumidas pelo atendente"
      />
      <MetricCard
        titulo="Tempo médio de resposta"
        valor={tempoResposta}
        descricao="1ª resposta da IA após mensagem do lead"
      />
    </div>
  );
}
