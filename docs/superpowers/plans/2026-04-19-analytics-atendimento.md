# Analytics — Métricas Globais + Seção Atendimento

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar número global de taxa de êxito e tempo médio (sem breakdown por área) e nova seção "Atendimento / Chat" com 3 cards na página `/analytics`.

**Architecture:** Expandir o endpoint `GET /api/analytics` com 3 novas funções puras Python (`_calcular_taxa_exito_geral`, `_calcular_tempo_medio_geral`, `_calcular_atendimento`) e query adicional às tabelas `conversations` e `messages`. No frontend, atualizar os componentes `TaxaExito` e `TempoMedio` para exibir o número global em destaque, criar `AtendimentoSection.tsx` e registrá-lo na página.

**Tech Stack:** Python, FastAPI, Supabase, Next.js, TypeScript, Tailwind CSS.

---

## Arquivos a criar/modificar

**Backend — modificar:**
- `backend/app/api/analytics/router.py` — 3 novas funções puras + query conversations/messages + campos no response
- `backend/tests/api/test_analytics.py` — novos testes para as 3 funções

**Frontend — modificar:**
- `frontend/types/analytics.ts` — `AtendimentoData` + atualizar `AnalyticsData`
- `frontend/components/analytics/TaxaExito.tsx` — exibir número global
- `frontend/components/analytics/TempoMedio.tsx` — exibir número global

**Frontend — criar:**
- `frontend/components/analytics/AtendimentoSection.tsx` — 3 cards de atendimento

**Frontend — modificar:**
- `frontend/app/(app)/analytics/page.tsx` — importar e exibir `AtendimentoSection`

---

## Task 1: Funções puras de agregação global (backend)

**Files:**
- Modify: `backend/app/api/analytics/router.py`
- Modify: `backend/tests/api/test_analytics.py`

- [ ] **Step 1: Escrever os testes (TDD — antes da implementação)**

Abrir `backend/tests/api/test_analytics.py` e adicionar ao final:

```python
# ─── Novos testes: funções globais ───────────────────────────────────────────

from app.api.analytics.router import (
    _calcular_taxa_exito_geral,
    _calcular_tempo_medio_geral,
    _calcular_atendimento,
)


def test_taxa_exito_geral_calcula_percentual():
    processos = [
        {"resultado": "procedente"},
        {"resultado": "acordo"},
        {"resultado": "improcedente"},
        {"resultado": None},  # deve ser ignorado
    ]
    assert _calcular_taxa_exito_geral(processos) == pytest.approx(66.7, abs=0.1)


def test_taxa_exito_geral_retorna_none_sem_finalizados():
    assert _calcular_taxa_exito_geral([]) is None
    assert _calcular_taxa_exito_geral([{"resultado": None}]) is None


def test_tempo_medio_geral_calcula_media():
    processos = [
        {
            "resultado": "procedente",
            "created_at": "2024-01-01T00:00:00+00:00",
            "updated_at": "2024-04-11T00:00:00+00:00",  # 101 dias
        },
        {
            "resultado": "acordo",
            "created_at": "2024-01-01T00:00:00+00:00",
            "updated_at": "2024-02-10T00:00:00+00:00",  # 40 dias
        },
    ]
    resultado = _calcular_tempo_medio_geral(processos)
    assert resultado == pytest.approx(70, abs=2)  # média de 101 e 40


def test_tempo_medio_geral_retorna_none_sem_finalizados():
    assert _calcular_tempo_medio_geral([]) is None
    assert _calcular_tempo_medio_geral([{"resultado": None}]) is None


def test_calcular_atendimento_volume_e_transbordo():
    conversations = [
        {"id": "c1", "ai_enabled": True},
        {"id": "c2", "ai_enabled": False},
        {"id": "c3", "ai_enabled": False},
    ]
    messages = []
    resultado = _calcular_atendimento(conversations, messages)
    assert resultado["volume_conversas"] == 3
    assert resultado["pct_transbordo"] == pytest.approx(66.7, abs=0.1)
    assert resultado["tempo_medio_resposta_segundos"] is None


def test_calcular_atendimento_tempo_resposta():
    conversations = [{"id": "c1", "ai_enabled": True}]
    messages = [
        {
            "conversation_id": "c1",
            "sender_type": "lead",
            "created_at": "2024-04-01T10:00:00+00:00",
        },
        {
            "conversation_id": "c1",
            "sender_type": "bot",
            "created_at": "2024-04-01T10:00:30+00:00",  # 30 segundos depois
        },
    ]
    resultado = _calcular_atendimento(conversations, messages)
    assert resultado["tempo_medio_resposta_segundos"] == pytest.approx(30.0)


def test_calcular_atendimento_ignora_conv_sem_resposta_bot():
    conversations = [{"id": "c1", "ai_enabled": True}]
    messages = [
        {
            "conversation_id": "c1",
            "sender_type": "lead",
            "created_at": "2024-04-01T10:00:00+00:00",
        },
        # sem mensagem bot — deve ser ignorada
    ]
    resultado = _calcular_atendimento(conversations, messages)
    assert resultado["tempo_medio_resposta_segundos"] is None


def test_calcular_atendimento_vazio():
    resultado = _calcular_atendimento([], [])
    assert resultado["volume_conversas"] == 0
    assert resultado["pct_transbordo"] is None
    assert resultado["tempo_medio_resposta_segundos"] is None
```

- [ ] **Step 2: Rodar os testes — esperado: FAIL**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\backend"
.venv/Scripts/python.exe -m pytest tests/api/test_analytics.py -v 2>&1 | tail -15
```

Expected: `ImportError: cannot import name '_calcular_taxa_exito_geral'`

- [ ] **Step 3: Implementar as 3 funções em `router.py`**

Abrir `backend/app/api/analytics/router.py` e adicionar **após** a função `_calcular_carteira_ativa` (linha ~155), antes do bloco `# ─── Endpoint ───`:

```python
def _calcular_taxa_exito_geral(processos: list[dict]) -> float | None:
    """% global de processos com resultado procedente ou acordo.

    Retorna None se não houver processos com resultado registrado.
    """
    finalizados = [p for p in processos if p.get("resultado") is not None]
    if not finalizados:
        return None
    exito = sum(1 for p in finalizados if p["resultado"] in ("procedente", "acordo"))
    return round(exito / len(finalizados) * 100, 1)


def _calcular_tempo_medio_geral(processos: list[dict]) -> float | None:
    """Média global de dias entre created_at e updated_at dos processos finalizados.

    Retorna None se não houver processos com resultado registrado.
    """
    dias_list: list[float] = []
    for p in processos:
        if p.get("resultado") is None:
            continue
        try:
            created = datetime.fromisoformat(str(p["created_at"]).replace("Z", "+00:00"))
            updated = datetime.fromisoformat(str(p["updated_at"]).replace("Z", "+00:00"))
            dias_list.append(max((updated - created).days, 0))
        except (KeyError, ValueError, TypeError):
            continue
    if not dias_list:
        return None
    return round(sum(dias_list) / len(dias_list))


def _calcular_atendimento(conversations: list[dict], messages: list[dict]) -> dict:
    """Métricas de atendimento: volume, transbordo e tempo médio de 1ª resposta.

    Args:
        conversations: registros da tabela conversations no período.
        messages: todas as mensagens dessas conversas.

    Returns:
        dict com volume_conversas, pct_transbordo, tempo_medio_resposta_segundos.
    """
    total = len(conversations)
    if total == 0:
        return {
            "volume_conversas": 0,
            "pct_transbordo": None,
            "tempo_medio_resposta_segundos": None,
        }

    transbordo = sum(1 for c in conversations if not c.get("ai_enabled", True))
    pct_transbordo = round(transbordo / total * 100, 1)

    # Agrupar mensagens por conversa
    msgs_por_conv: dict[str, list[dict]] = {}
    for msg in messages:
        conv_id = msg.get("conversation_id", "")
        msgs_por_conv.setdefault(conv_id, []).append(msg)

    tempos: list[float] = []
    for msgs in msgs_por_conv.values():
        msgs_ord = sorted(msgs, key=lambda m: m.get("created_at", ""))
        primeiro_lead = next(
            (m for m in msgs_ord if m.get("sender_type") == "lead"), None
        )
        if not primeiro_lead:
            continue
        primeiro_bot = next(
            (
                m for m in msgs_ord
                if m.get("sender_type") == "bot"
                and m.get("created_at", "") > primeiro_lead.get("created_at", "")
            ),
            None,
        )
        if not primeiro_bot:
            continue
        try:
            t_lead = datetime.fromisoformat(
                str(primeiro_lead["created_at"]).replace("Z", "+00:00")
            )
            t_bot = datetime.fromisoformat(
                str(primeiro_bot["created_at"]).replace("Z", "+00:00")
            )
            diff = (t_bot - t_lead).total_seconds()
            if diff >= 0:
                tempos.append(diff)
        except (ValueError, TypeError):
            continue

    tempo_medio = round(sum(tempos) / len(tempos), 1) if tempos else None

    return {
        "volume_conversas": total,
        "pct_transbordo": pct_transbordo,
        "tempo_medio_resposta_segundos": tempo_medio,
    }
```

- [ ] **Step 4: Rodar os testes — esperado: PASS**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\backend"
.venv/Scripts/python.exe -m pytest tests/api/test_analytics.py -v 2>&1 | tail -20
```

Expected: todos os testes existentes + 8 novos passam.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/api/analytics/router.py backend/tests/api/test_analytics.py
git commit -m "feat(analytics): funções globais taxa_exito, tempo_medio e atendimento"
```

---

## Task 2: Query conversations/messages e atualizar endpoint

**Files:**
- Modify: `backend/app/api/analytics/router.py`

- [ ] **Step 1: Adicionar queries ao endpoint `get_analytics`**

Dentro da função `get_analytics`, localizar o bloco `try:` após `todos_proc_res` e adicionar as duas queries seguintes (antes do `except`):

```python
        # Conversas criadas no período
        conv_res = (
            await supabase.table("conversations")
            .select("id, ai_enabled, created_at")
            .gte("created_at", cutoff)
            .execute()
        )
        conversations = conv_res.data or []

        # Mensagens das conversas do período (limit defensivo)
        conv_ids = [c["id"] for c in conversations]
        messages: list[dict] = []
        if conv_ids:
            msgs_res = (
                await supabase.table("messages")
                .select("conversation_id, sender_type, created_at")
                .in_("conversation_id", conv_ids)
                .order("created_at")
                .limit(10000)
                .execute()
            )
            messages = msgs_res.data or []
```

- [ ] **Step 2: Adicionar os 3 novos campos ao `return` do endpoint**

Localizar o `return {` no final da função e adicionar 3 campos ao dicionário existente:

```python
    return {
        "funil_conversao": _calcular_funil(leads),
        "receita_por_area": _calcular_receita_por_area(ops),
        "taxa_exito": _calcular_taxa_exito(todos_processos),
        "taxa_exito_geral": _calcular_taxa_exito_geral(todos_processos),
        "tempo_medio": _calcular_tempo_medio(todos_processos),
        "tempo_medio_geral": _calcular_tempo_medio_geral(todos_processos),
        "distribuicao_tribunal": _calcular_distribuicao_tribunal(todos_processos),
        "origem_leads": _calcular_origem_leads(leads),
        "carteira_ativa": _calcular_carteira_ativa(todos_processos),
        "atendimento": _calcular_atendimento(conversations, messages),
    }
```

- [ ] **Step 3: Verificar que o servidor sobe sem erros**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\backend"
.venv/Scripts/python.exe -m uvicorn app.main:app --port 8000 2>&1 | head -10
```

Expected: `INFO: Application startup complete.` (Ctrl+C para parar)

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/api/analytics/router.py
git commit -m "feat(analytics): query conversations/messages e novos campos no endpoint"
```

---

## Task 3: Tipos TypeScript

**Files:**
- Modify: `frontend/types/analytics.ts`

- [ ] **Step 1: Adicionar `AtendimentoData` e atualizar `AnalyticsData`**

Abrir `frontend/types/analytics.ts` e adicionar após a interface `CarteiraAtiva`:

```typescript
export interface AtendimentoData {
  volume_conversas: number;
  pct_transbordo: number | null;
  tempo_medio_resposta_segundos: number | null;
}
```

Atualizar a interface `AnalyticsData` para incluir os 3 novos campos:

```typescript
export interface AnalyticsData {
  funil_conversao: FunilConversao;
  receita_por_area: ReceitaItem[];
  taxa_exito: TaxaExitoItem[];
  taxa_exito_geral: number | null;
  tempo_medio: TempoMedioItem[];
  tempo_medio_geral: number | null;
  distribuicao_tribunal: TribunalItem[];
  origem_leads: OrigemItem[];
  carteira_ativa: CarteiraAtiva;
  atendimento: AtendimentoData;
}
```

- [ ] **Step 2: Verificar TypeScript sem erros**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\frontend"
npx tsc --noEmit 2>&1 | head -20
```

Expected: sem saída (nenhum erro).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add frontend/types/analytics.ts
git commit -m "feat(analytics): tipos AtendimentoData e campos globais em AnalyticsData"
```

---

## Task 4: Atualizar componentes TaxaExito e TempoMedio

**Files:**
- Modify: `frontend/components/analytics/TaxaExito.tsx`
- Modify: `frontend/components/analytics/TempoMedio.tsx`

- [ ] **Step 1: Atualizar `TaxaExito.tsx`**

Substituir o conteúdo completo de `frontend/components/analytics/TaxaExito.tsx`:

```tsx
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
```

- [ ] **Step 2: Atualizar `TempoMedio.tsx`**

Substituir o conteúdo completo de `frontend/components/analytics/TempoMedio.tsx`:

```tsx
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
```

- [ ] **Step 3: Verificar TypeScript sem erros**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\frontend"
npx tsc --noEmit 2>&1 | head -20
```

Expected: erros em `page.tsx` porque falta a prop `geral` — isso é esperado agora, será corrigido na Task 6.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add frontend/components/analytics/TaxaExito.tsx frontend/components/analytics/TempoMedio.tsx
git commit -m "feat(analytics): TaxaExito e TempoMedio exibem número global em destaque"
```

---

## Task 5: Criar componente AtendimentoSection

**Files:**
- Create: `frontend/components/analytics/AtendimentoSection.tsx`

- [ ] **Step 1: Criar o arquivo**

Criar `frontend/components/analytics/AtendimentoSection.tsx`:

```tsx
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
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add frontend/components/analytics/AtendimentoSection.tsx
git commit -m "feat(analytics): componente AtendimentoSection com 3 cards de atendimento"
```

---

## Task 6: Atualizar página analytics

**Files:**
- Modify: `frontend/app/(app)/analytics/page.tsx`

- [ ] **Step 1: Atualizar imports e usar novos componentes**

Substituir o conteúdo completo de `frontend/app/(app)/analytics/page.tsx`:

```tsx
"use client";

import { useEffect, useState } from "react";
import { BarChart2 } from "lucide-react";

import { api } from "@/lib/api";
import type { AnalyticsData, Periodo } from "@/types/analytics";
import { PERIODO_LABELS } from "@/types/analytics";

import { FunilConversao } from "@/components/analytics/FunilConversao";
import { ReceitaPorArea } from "@/components/analytics/ReceitaPorArea";
import { TaxaExito } from "@/components/analytics/TaxaExito";
import { TempoMedio } from "@/components/analytics/TempoMedio";
import { DistribuicaoTribunal } from "@/components/analytics/DistribuicaoTribunal";
import { OrigemLeads } from "@/components/analytics/OrigemLeads";
import { CarteiraAtiva } from "@/components/analytics/CarteiraAtiva";
import { AtendimentoSection } from "@/components/analytics/AtendimentoSection";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className ?? ""}`}
      style={{ background: "rgba(255,255,255,.06)" }}
    />
  );
}

const PERIODOS: Periodo[] = ["30d", "90d", "365d"];

export default function AnalyticsPage() {
  const [dados, setDados] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [periodo, setPeriodo] = useState<Periodo>("30d");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    api
      .get<AnalyticsData>(`/api/analytics?periodo=${periodo}`)
      .then((data) => { if (!cancelled) setDados(data); })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Erro ao carregar analytics");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [periodo]);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-radial-gold">
      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center justify-between gap-3"
        style={{ borderColor: "rgba(255,255,255,.08)" }}
      >
        <div className="flex items-center gap-3">
          <BarChart2 className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Analytics</h1>
            <p className="text-xs text-muted-foreground">Visão estratégica do escritório</p>
          </div>
        </div>
        <div className="flex gap-2">
          {PERIODOS.map((p) => (
            <button
              key={p}
              onClick={() => setPeriodo(p)}
              className="rounded-md text-xs font-semibold px-3 py-1.5 transition-colors"
              style={
                periodo === p
                  ? { background: "#c9a96e", color: "#0a0f1e" }
                  : {
                      background: "rgba(255,255,255,.08)",
                      color: "inherit",
                      border: "1px solid rgba(255,255,255,.1)",
                    }
              }
            >
              {PERIODO_LABELS[p]}
            </button>
          ))}
        </div>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-6 space-y-8">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {/* Seção CRM */}
        <div>
          <div
            className="text-[10px] uppercase tracking-widest font-semibold mb-4"
            style={{ opacity: 0.4 }}
          >
            CRM / Negócio
          </div>
          {loading ? (
            <div className="grid grid-cols-2 gap-4">
              <Skeleton className="h-36" />
              <Skeleton className="h-36" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : dados ? (
            <div className="grid grid-cols-2 gap-4">
              <FunilConversao dados={dados.funil_conversao} />
              <ReceitaPorArea dados={dados.receita_por_area} />
              <OrigemLeads dados={dados.origem_leads} />
              <CarteiraAtiva dados={dados.carteira_ativa} />
            </div>
          ) : null}
        </div>

        {/* Seção Jurídico */}
        <div>
          <div
            className="text-[10px] uppercase tracking-widest font-semibold mb-4"
            style={{ opacity: 0.4 }}
          >
            Jurídico / Processos
          </div>
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : dados ? (
            <div className="grid grid-cols-3 gap-4">
              <TaxaExito dados={dados.taxa_exito} geral={dados.taxa_exito_geral} />
              <TempoMedio dados={dados.tempo_medio} geral={dados.tempo_medio_geral} />
              <DistribuicaoTribunal dados={dados.distribuicao_tribunal} />
            </div>
          ) : null}
        </div>

        {/* Seção Atendimento */}
        <div>
          <div
            className="text-[10px] uppercase tracking-widest font-semibold mb-4"
            style={{ opacity: 0.4 }}
          >
            Atendimento / Chat
          </div>
          {loading ? (
            <div className="grid grid-cols-3 gap-4">
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
              <Skeleton className="h-32" />
            </div>
          ) : dados ? (
            <AtendimentoSection dados={dados.atendimento} />
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript sem erros**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\frontend"
npx tsc --noEmit 2>&1 | head -20
```

Expected: sem saída (nenhum erro).

- [ ] **Step 3: Rodar todos os testes do backend**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\backend"
.venv/Scripts/python.exe -m pytest tests/ -v 2>&1 | tail -15
```

Expected: todos passam.

- [ ] **Step 4: Commit e push final**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add frontend/app/(app)/analytics/page.tsx
git commit -m "feat(analytics): adicionar seção Atendimento/Chat e métricas globais na página"
git push
```
