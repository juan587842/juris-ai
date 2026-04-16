# Jurimetria/BI — Analytics Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar a página `/analytics` com 7 métricas estratégicas do escritório, endpoint backend dedicado e migration para o campo `resultado` em `processos`.

**Architecture:** Endpoint `GET /api/analytics?periodo=30d|90d|365d` no FastAPI agrega dados de leads, oportunidades e processos em Python usando o Supabase client. O frontend consome esse endpoint e renderiza os dados em 7 componentes CSS-only, seguindo o design system existente. A tabela `processos` recebe o campo `resultado` via migration.

**Tech Stack:** FastAPI, Supabase (supabase-py), Next.js 14 (App Router), TypeScript, Tailwind CSS, Lucide React.

---

## Mapeamento de arquivos

**Criar:**
- `supabase/migrations/<timestamp>_analytics_resultado_processos.sql`
- `backend/app/api/analytics/__init__.py`
- `backend/app/api/analytics/router.py`
- `backend/tests/api/test_analytics.py`
- `frontend/types/analytics.ts`
- `frontend/app/(app)/analytics/page.tsx`
- `frontend/components/analytics/FunilConversao.tsx`
- `frontend/components/analytics/ReceitaPorArea.tsx`
- `frontend/components/analytics/TaxaExito.tsx`
- `frontend/components/analytics/TempoMedio.tsx`
- `frontend/components/analytics/DistribuicaoTribunal.tsx`
- `frontend/components/analytics/OrigemLeads.tsx`
- `frontend/components/analytics/CarteiraAtiva.tsx`

**Modificar:**
- `backend/app/main.py` — adicionar `include_router` do analytics
- `frontend/components/layout/AppShell.tsx` — adicionar item "Analytics" no nav

---

## Notas sobre o schema atual

- `processos` **não tem** `data_distribuicao` nem `data_encerramento`. O campo `resultado` será adicionado nesta migration. Para `tempo_medio` usa-se `updated_at - created_at` como proxy de duração. Para `taxa_exito` e `tempo_medio` não há filtro de período (campo `resultado` é novo).
- `oportunidades` usa `estagio` (não `status`). Valores: `novo_lead`, `qualificado`, `proposta_enviada`, `negociacao`, `ganho`, `perdido`.
- `leads.status`: `novo`, `contato_feito`, `qualificado`, `desqualificado`, `convertido`.
- `processos.status`: `ativo`, `suspenso`, `finalizado`, `arquivado`.

---

## Task 1: Migration — campo `resultado` em `processos`

**Files:**
- Create: `supabase/migrations/<timestamp>_analytics_resultado_processos.sql`

- [ ] **Step 1: Criar o arquivo de migration**

```bash
cd /path/to/project
supabase migration new analytics_resultado_processos
```

Isso cria `supabase/migrations/<timestamp>_analytics_resultado_processos.sql`.

- [ ] **Step 2: Escrever o SQL no arquivo criado**

Abra o arquivo gerado e escreva:

```sql
-- Adiciona campo resultado em processos para calcular taxa de êxito
ALTER TABLE processos
ADD COLUMN resultado text CHECK (resultado IN (
  'procedente', 'improcedente', 'acordo', 'desistencia'
));

COMMENT ON COLUMN processos.resultado IS
  'Desfecho do processo. NULL = em andamento. Preenchido ao finalizar/arquivar.';
```

- [ ] **Step 3: Aplicar a migration no banco via MCP**

Use a ferramenta `mcp__supabase__execute_sql`:

```sql
ALTER TABLE processos
ADD COLUMN IF NOT EXISTS resultado text CHECK (resultado IN (
  'procedente', 'improcedente', 'acordo', 'desistencia'
));
```

- [ ] **Step 4: Verificar que o campo existe**

Via `mcp__supabase__execute_sql`:

```sql
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'processos' AND column_name = 'resultado';
```

Esperado: 1 linha com `column_name = resultado`, `data_type = text`, `is_nullable = YES`.

- [ ] **Step 5: Commit**

```bash
git add supabase/migrations/
git commit -m "feat(db): adicionar campo resultado em processos para analytics"
```

---

## Task 2: Backend — testes (TDD)

**Files:**
- Create: `backend/tests/api/test_analytics.py`

- [ ] **Step 1: Criar o diretório se necessário e o arquivo de teste**

```bash
mkdir -p backend/tests/api
touch backend/tests/api/__init__.py
```

- [ ] **Step 2: Escrever os testes**

```python
# backend/tests/api/test_analytics.py
"""Testes para as funções de agregação do router de analytics."""
import pytest

from app.api.analytics.router import (
    _calcular_carteira_ativa,
    _calcular_distribuicao_tribunal,
    _calcular_funil,
    _calcular_origem_leads,
    _calcular_receita_por_area,
    _calcular_taxa_exito,
    _calcular_tempo_medio,
)


def test_calcular_funil_taxa_conversao():
    leads = [
        {"status": "novo"},
        {"status": "qualificado"},
        {"status": "convertido"},
        {"status": "convertido"},
    ]
    resultado = _calcular_funil(leads)
    assert resultado["novo"] == 1
    assert resultado["qualificado"] == 1
    assert resultado["convertido"] == 2
    assert resultado["taxa_conversao_pct"] == 50.0


def test_calcular_funil_vazio():
    resultado = _calcular_funil([])
    assert resultado["taxa_conversao_pct"] == 0.0
    assert resultado["convertido"] == 0
    assert resultado["novo"] == 0


def test_calcular_receita_por_area_soma_e_ordena():
    ops = [
        {"area_juridica": "trabalhista", "valor_estimado": 10000.0},
        {"area_juridica": "trabalhista", "valor_estimado": 5000.0},
        {"area_juridica": "civil", "valor_estimado": 8000.0},
    ]
    resultado = _calcular_receita_por_area(ops)
    trabalhista = next(r for r in resultado if r["area"] == "trabalhista")
    assert trabalhista["total"] == 15000.0
    assert resultado[0]["area"] == "trabalhista"  # maior valor primeiro


def test_calcular_receita_ignora_valor_none():
    ops = [{"area_juridica": "civil", "valor_estimado": None}]
    resultado = _calcular_receita_por_area(ops)
    assert resultado[0]["total"] == 0.0


def test_calcular_taxa_exito_ignora_sem_resultado():
    processos = [
        {"area_juridica": "trabalhista", "resultado": "procedente"},
        {"area_juridica": "trabalhista", "resultado": "improcedente"},
        {"area_juridica": "trabalhista", "resultado": None},
    ]
    resultado = _calcular_taxa_exito(processos)
    assert len(resultado) == 1
    assert resultado[0]["total"] == 2  # None foi ignorado
    assert resultado[0]["exito_pct"] == 50.0


def test_calcular_taxa_exito_acordo_conta_como_exito():
    processos = [
        {"area_juridica": "civil", "resultado": "acordo"},
        {"area_juridica": "civil", "resultado": "desistencia"},
    ]
    resultado = _calcular_taxa_exito(processos)
    assert resultado[0]["exito_pct"] == 50.0


def test_calcular_taxa_exito_vazio():
    resultado = _calcular_taxa_exito([])
    assert resultado == []


def test_calcular_distribuicao_tribunal_ordena():
    processos = [
        {"tribunal": "TJSP"},
        {"tribunal": "TJSP"},
        {"tribunal": "TRT-2"},
    ]
    resultado = _calcular_distribuicao_tribunal(processos)
    assert resultado[0]["tribunal"] == "TJSP"
    assert resultado[0]["count"] == 2
    assert resultado[1]["tribunal"] == "TRT-2"


def test_calcular_distribuicao_tribunal_none_vira_nao_informado():
    processos = [{"tribunal": None}]
    resultado = _calcular_distribuicao_tribunal(processos)
    assert resultado[0]["tribunal"] == "Não informado"


def test_calcular_origem_leads_percentual():
    leads = [
        {"origem": "whatsapp"},
        {"origem": "whatsapp"},
        {"origem": "indicacao"},
    ]
    resultado = _calcular_origem_leads(leads)
    whatsapp = next(r for r in resultado if r["origem"] == "whatsapp")
    assert whatsapp["count"] == 2
    assert whatsapp["pct"] == pytest.approx(66.7, abs=0.1)


def test_calcular_origem_leads_vazio():
    resultado = _calcular_origem_leads([])
    assert resultado == []


def test_calcular_carteira_ativa():
    processos = [
        {"status": "ativo"},
        {"status": "ativo"},
        {"status": "suspenso"},
        {"status": "finalizado"},
    ]
    resultado = _calcular_carteira_ativa(processos)
    assert resultado["ativo"] == 2
    assert resultado["suspenso"] == 1
    assert resultado["finalizado"] == 1
    assert resultado["total"] == 4


def test_calcular_carteira_ativa_vazia():
    resultado = _calcular_carteira_ativa([])
    assert resultado["ativo"] == 0
    assert resultado["total"] == 0
```

- [ ] **Step 3: Rodar os testes — devem falhar (módulo não existe)**

```bash
cd backend
python -m pytest tests/api/test_analytics.py -v 2>&1 | head -30
```

Esperado: `ImportError` ou `ModuleNotFoundError` em `app.api.analytics.router`.

---

## Task 3: Backend — implementação do router

**Files:**
- Create: `backend/app/api/analytics/__init__.py`
- Create: `backend/app/api/analytics/router.py`

- [ ] **Step 1: Criar `__init__.py`**

Crie o arquivo vazio:

```python
# backend/app/api/analytics/__init__.py
```

- [ ] **Step 2: Criar o router com todas as funções de agregação**

```python
# backend/app/api/analytics/router.py
"""Endpoint de métricas estratégicas (Jurimetria / BI)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase

router = APIRouter(prefix="/analytics", tags=["analytics"])
logger = get_logger("analytics.router")

_PERIODO_DIAS: dict[str, int] = {"30d": 30, "90d": 90, "365d": 365}


def _cutoff(dias: int) -> str:
    """Retorna ISO 8601 de (agora - dias) em UTC."""
    dt = datetime.now(timezone.utc) - timedelta(days=dias)
    return dt.isoformat()


# ─── Funções de agregação puras (testáveis sem Supabase) ─────────────────────


def _calcular_funil(leads: list[dict]) -> dict:
    """Agrupa leads por status e calcula taxa de conversão."""
    contagem: dict[str, int] = {}
    for lead in leads:
        s = lead.get("status") or "novo"
        contagem[s] = contagem.get(s, 0) + 1
    total = len(leads)
    convertido = contagem.get("convertido", 0)
    taxa = round(convertido / total * 100, 1) if total > 0 else 0.0
    return {
        "novo": contagem.get("novo", 0),
        "contato_feito": contagem.get("contato_feito", 0),
        "qualificado": contagem.get("qualificado", 0),
        "convertido": convertido,
        "perdido": contagem.get("desqualificado", 0),
        "taxa_conversao_pct": taxa,
    }


def _calcular_receita_por_area(ops: list[dict]) -> list[dict]:
    """Soma valor_estimado por area_juridica, ordenado do maior para o menor."""
    totais: dict[str, float] = {}
    for op in ops:
        area = op.get("area_juridica") or "outro"
        valor = float(op.get("valor_estimado") or 0)
        totais[area] = totais.get(area, 0.0) + valor
    return [
        {"area": area, "total": round(total, 2)}
        for area, total in sorted(totais.items(), key=lambda x: -x[1])
    ]


def _calcular_taxa_exito(processos: list[dict]) -> list[dict]:
    """% de processos com resultado procedente ou acordo por area_juridica.

    Ignora processos com resultado IS NULL (em andamento).
    """
    contagem: dict[str, dict[str, int]] = {}
    for p in processos:
        if p.get("resultado") is None:
            continue
        area = p.get("area_juridica") or "outro"
        if area not in contagem:
            contagem[area] = {"total": 0, "exito": 0}
        contagem[area]["total"] += 1
        if p["resultado"] in ("procedente", "acordo"):
            contagem[area]["exito"] += 1
    resultado = []
    for area, c in contagem.items():
        pct = round(c["exito"] / c["total"] * 100, 1) if c["total"] > 0 else 0.0
        resultado.append({"area": area, "exito_pct": pct, "total": c["total"]})
    return sorted(resultado, key=lambda x: -x["exito_pct"])


def _calcular_tempo_medio(processos: list[dict]) -> list[dict]:
    """Tempo médio (dias) entre created_at e updated_at para processos finalizados.

    Usa updated_at como proxy de data_encerramento (campo não existe no schema).
    Ignora processos com resultado IS NULL.
    """
    duracao: dict[str, list[float]] = {}
    for p in processos:
        if p.get("resultado") is None:
            continue
        area = p.get("area_juridica") or "outro"
        try:
            created = datetime.fromisoformat(
                str(p["created_at"]).replace("Z", "+00:00")
            )
            updated = datetime.fromisoformat(
                str(p["updated_at"]).replace("Z", "+00:00")
            )
            dias = max((updated - created).days, 0)
        except (KeyError, ValueError, TypeError):
            continue
        duracao.setdefault(area, []).append(dias)
    resultado = []
    for area, dias_list in duracao.items():
        media_dias = round(sum(dias_list) / len(dias_list)) if dias_list else 0
        resultado.append(
            {"area": area, "media_dias": media_dias, "total": len(dias_list)}
        )
    return sorted(resultado, key=lambda x: x["media_dias"])


def _calcular_distribuicao_tribunal(processos: list[dict]) -> list[dict]:
    """Conta processos por tribunal, ordenado do maior para o menor."""
    contagem: dict[str, int] = {}
    for p in processos:
        tribunal = p.get("tribunal") or "Não informado"
        contagem[tribunal] = contagem.get(tribunal, 0) + 1
    return [
        {"tribunal": t, "count": c}
        for t, c in sorted(contagem.items(), key=lambda x: -x[1])
    ]


def _calcular_origem_leads(leads: list[dict]) -> list[dict]:
    """Conta e calcula % por origem no período."""
    contagem: dict[str, int] = {}
    for lead in leads:
        origem = lead.get("origem") or "outro"
        contagem[origem] = contagem.get(origem, 0) + 1
    total = len(leads)
    return [
        {
            "origem": o,
            "count": c,
            "pct": round(c / total * 100, 1) if total > 0 else 0.0,
        }
        for o, c in sorted(contagem.items(), key=lambda x: -x[1])
    ]


def _calcular_carteira_ativa(processos: list[dict]) -> dict:
    """Conta processos por status (sem filtro de período)."""
    contagem: dict[str, int] = {}
    for p in processos:
        s = p.get("status") or "ativo"
        contagem[s] = contagem.get(s, 0) + 1
    return {
        "ativo": contagem.get("ativo", 0),
        "suspenso": contagem.get("suspenso", 0),
        "finalizado": contagem.get("finalizado", 0),
        "total": sum(contagem.values()),
    }


# ─── Endpoint ────────────────────────────────────────────────────────────────


@router.get("")
async def get_analytics(
    _user: AuthUser,
    periodo: str = Query(default="30d", pattern="^(30d|90d|365d)$"),
) -> dict:
    """Retorna métricas estratégicas do escritório para o período especificado."""
    dias = _PERIODO_DIAS[periodo]
    cutoff = _cutoff(dias)
    supabase = await get_supabase()

    # Leads criados no período (funil + origem)
    leads_res = (
        await supabase.table("leads")
        .select("status, origem, created_at")
        .gte("created_at", cutoff)
        .execute()
    )
    leads = leads_res.data or []

    # Oportunidades criadas no período, excluindo perdidas (receita)
    ops_res = (
        await supabase.table("oportunidades")
        .select("area_juridica, valor_estimado, estagio, created_at")
        .gte("created_at", cutoff)
        .neq("estagio", "perdido")
        .execute()
    )
    ops = ops_res.data or []

    # Todos os processos (taxa de êxito, tempo médio, tribunal e carteira)
    todos_proc_res = (
        await supabase.table("processos")
        .select("area_juridica, status, tribunal, resultado, created_at, updated_at")
        .execute()
    )
    todos_processos = todos_proc_res.data or []

    return {
        "funil_conversao": _calcular_funil(leads),
        "receita_por_area": _calcular_receita_por_area(ops),
        "taxa_exito": _calcular_taxa_exito(todos_processos),
        "tempo_medio": _calcular_tempo_medio(todos_processos),
        "distribuicao_tribunal": _calcular_distribuicao_tribunal(todos_processos),
        "origem_leads": _calcular_origem_leads(leads),
        "carteira_ativa": _calcular_carteira_ativa(todos_processos),
    }
```

- [ ] **Step 3: Rodar os testes — devem passar**

```bash
cd backend
python -m pytest tests/api/test_analytics.py -v
```

Esperado: `12 passed`.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/analytics/ backend/tests/api/test_analytics.py
git commit -m "feat(analytics): router backend com 7 métricas e testes"
```

---

## Task 4: Registrar router no main.py

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Ler o arquivo atual**

Leia `backend/app/main.py` para ver as linhas de `include_router`.

- [ ] **Step 2: Adicionar o import e o include_router**

Localize o bloco de imports dos routers. Após a última importação de router, adicione:

```python
from app.api.analytics.router import router as analytics_router
```

Após a última linha `app.include_router(...)`, adicione:

```python
app.include_router(analytics_router, prefix="/api")
```

- [ ] **Step 3: Testar o endpoint**

```bash
cd backend
python -m pytest tests/ -v --tb=short 2>&1 | tail -20
```

Esperado: todos os testes passam, sem ImportError.

- [ ] **Step 4: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(analytics): registrar router de analytics no main.py"
```

---

## Task 5: Frontend — types/analytics.ts

**Files:**
- Create: `frontend/types/analytics.ts`

- [ ] **Step 1: Criar o arquivo de tipos**

```typescript
// frontend/types/analytics.ts

export interface FunilConversao {
  novo: number;
  contato_feito: number;
  qualificado: number;
  convertido: number;
  perdido: number;
  taxa_conversao_pct: number;
}

export interface ReceitaItem {
  area: string;
  total: number;
}

export interface TaxaExitoItem {
  area: string;
  exito_pct: number;
  total: number;
}

export interface TempoMedioItem {
  area: string;
  media_dias: number;
  total: number;
}

export interface TribunalItem {
  tribunal: string;
  count: number;
}

export interface OrigemItem {
  origem: string;
  count: number;
  pct: number;
}

export interface CarteiraAtiva {
  ativo: number;
  suspenso: number;
  finalizado: number;
  total: number;
}

export interface AnalyticsData {
  funil_conversao: FunilConversao;
  receita_por_area: ReceitaItem[];
  taxa_exito: TaxaExitoItem[];
  tempo_medio: TempoMedioItem[];
  distribuicao_tribunal: TribunalItem[];
  origem_leads: OrigemItem[];
  carteira_ativa: CarteiraAtiva;
}

export type Periodo = "30d" | "90d" | "365d";

export const PERIODO_LABELS: Record<Periodo, string> = {
  "30d": "30 dias",
  "90d": "90 dias",
  "365d": "1 ano",
};

export const AREA_LABELS: Record<string, string> = {
  trabalhista: "Trabalhista",
  civil: "Civil",
  criminal: "Criminal",
  familia: "Família",
  empresarial: "Empresarial",
  tributario: "Tributário",
  previdenciario: "Previdenciário",
  imobiliario: "Imobiliário",
  outro: "Outro",
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/types/analytics.ts
git commit -m "feat(analytics): tipos TypeScript para o módulo de analytics"
```

---

## Task 6: Frontend — 7 componentes de analytics

**Files:**
- Create: `frontend/components/analytics/FunilConversao.tsx`
- Create: `frontend/components/analytics/ReceitaPorArea.tsx`
- Create: `frontend/components/analytics/TaxaExito.tsx`
- Create: `frontend/components/analytics/TempoMedio.tsx`
- Create: `frontend/components/analytics/DistribuicaoTribunal.tsx`
- Create: `frontend/components/analytics/OrigemLeads.tsx`
- Create: `frontend/components/analytics/CarteiraAtiva.tsx`

- [ ] **Step 1: Criar FunilConversao.tsx**

```tsx
// frontend/components/analytics/FunilConversao.tsx
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
```

- [ ] **Step 2: Criar ReceitaPorArea.tsx**

```tsx
// frontend/components/analytics/ReceitaPorArea.tsx
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
```

- [ ] **Step 3: Criar TaxaExito.tsx**

```tsx
// frontend/components/analytics/TaxaExito.tsx
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
```

- [ ] **Step 4: Criar TempoMedio.tsx**

```tsx
// frontend/components/analytics/TempoMedio.tsx
import type { TempoMedioItem } from "@/types/analytics";
import { AREA_LABELS } from "@/types/analytics";

interface Props {
  dados: TempoMedioItem[];
}

function diasParaMeses(dias: number): string {
  if (dias < 30) return `${dias}d`;
  const meses = Math.round(dias / 30);
  return `${meses} ${meses === 1 ? "mês" : "meses"}`;
}

export function TempoMedio({ dados }: Props) {
  return (
    <div
      className="rounded-lg border p-4 flex flex-col gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold">Tempo médio</div>
      {dados.length === 0 ? (
        <div className="text-[11px] text-muted-foreground">Sem processos finalizados</div>
      ) : (
        <div className="flex flex-col gap-2">
          {dados.map((item) => (
            <div key={item.area} className="flex justify-between items-center text-[11px]">
              <span className="text-muted-foreground">
                {AREA_LABELS[item.area] ?? item.area}
              </span>
              <span className="font-semibold">{diasParaMeses(item.media_dias)}</span>
            </div>
          ))}
        </div>
      )}
      <div className="text-[10px] text-muted-foreground">Processos finalizados</div>
    </div>
  );
}
```

- [ ] **Step 5: Criar DistribuicaoTribunal.tsx**

```tsx
// frontend/components/analytics/DistribuicaoTribunal.tsx
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
```

- [ ] **Step 6: Criar OrigemLeads.tsx**

```tsx
// frontend/components/analytics/OrigemLeads.tsx
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
```

- [ ] **Step 7: Criar CarteiraAtiva.tsx**

```tsx
// frontend/components/analytics/CarteiraAtiva.tsx
import type { CarteiraAtiva } from "@/types/analytics";

interface Props {
  dados: CarteiraAtiva;
}

export function CarteiraAtiva({ dados }: Props) {
  const itens = [
    { key: "ativo" as const, label: "Ativos", cor: "#22c55e", bg: "#22c55e20" },
    { key: "suspenso" as const, label: "Suspensos", cor: "#f59e0b", bg: "#f59e0b20" },
    { key: "finalizado" as const, label: "Finalizados", cor: "#9ca3af", bg: "#6b728020" },
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
```

- [ ] **Step 8: Commit**

```bash
git add frontend/components/analytics/
git commit -m "feat(analytics): 7 componentes de visualização CSS-only"
```

---

## Task 7: Frontend — página /analytics

**Files:**
- Create: `frontend/app/(app)/analytics/page.tsx`

- [ ] **Step 1: Criar a página**

```tsx
// frontend/app/(app)/analytics/page.tsx
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
    setLoading(true);
    setError(null);
    api
      .get<AnalyticsData>(`/api/analytics?periodo=${periodo}`)
      .then(setDados)
      .catch((err) =>
        setError(err instanceof Error ? err.message : "Erro ao carregar analytics")
      )
      .finally(() => setLoading(false));
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
              <TaxaExito dados={dados.taxa_exito} />
              <TempoMedio dados={dados.tempo_medio} />
              <DistribuicaoTribunal dados={dados.distribuicao_tribunal} />
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/\(app\)/analytics/
git commit -m "feat(analytics): página /analytics com filtro de período"
```

---

## Task 8: Atualizar AppShell com item Analytics

**Files:**
- Modify: `frontend/components/layout/AppShell.tsx`

- [ ] **Step 1: Ler o arquivo atual**

Leia `frontend/components/layout/AppShell.tsx` para ver o array `NAV_ITEMS` e o import de ícones.

- [ ] **Step 2: Adicionar BarChart2 ao import de ícones**

Localize a linha:

```typescript
import { FileText, Inbox, KanbanSquare, LayoutDashboard, LogOut, Scale, Users } from "lucide-react";
```

Substitua por (adicione `BarChart2`):

```typescript
import { BarChart2, FileText, Inbox, KanbanSquare, LayoutDashboard, LogOut, Scale, Users } from "lucide-react";
```

- [ ] **Step 3: Adicionar item Analytics ao array NAV_ITEMS**

Localize o array `NAV_ITEMS`. Após o item `Processos`, adicione:

```typescript
{ href: "/analytics", label: "Analytics", icon: BarChart2 },
```

O array completo deve ficar:

```typescript
const NAV_ITEMS: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/inbox", label: "Inbox", icon: Inbox },
  { href: "/crm", label: "CRM", icon: KanbanSquare },
  { href: "/leads", label: "Leads", icon: Users },
  { href: "/processos", label: "Processos", icon: FileText },
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];
```

- [ ] **Step 4: Commit**

```bash
git add frontend/components/layout/AppShell.tsx
git commit -m "feat(analytics): adicionar item Analytics no menu lateral"
```

---

## Task 9: Push e verificação final

- [ ] **Step 1: Rodar todos os testes do backend**

```bash
cd backend
python -m pytest tests/ -v --tb=short 2>&1 | tail -30
```

Esperado: todos os testes passam.

- [ ] **Step 2: Push**

```bash
git push
```

- [ ] **Step 3: Verificar TypeScript**

```bash
cd frontend
npx tsc --noEmit 2>&1 | head -30
```

Esperado: sem erros.
