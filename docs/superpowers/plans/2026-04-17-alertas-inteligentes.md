# Alertas Inteligentes — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar página `/alertas` com 4 tipos de alertas operacionais (processos sem andamento, leads sem contato, prazos fatais, oportunidades paradas) com thresholds configuráveis persistidos em localStorage e badge no menu lateral.

**Architecture:** Backend FastAPI com endpoint `GET /api/alertas` que executa 4 queries Supabase e retorna lista unificada de alertas com severidade calculada por funções puras. Frontend Next.js com 3 componentes reutilizáveis (AlertaCard, AlertasSection, ConfigPanel) e badge no AppShell buscando contagem com thresholds padrão.

**Tech Stack:** FastAPI + Pydantic v2 + supabase-py (backend); Next.js 14 + TypeScript + lucide-react (frontend); localStorage (persistência de configuração).

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `backend/app/api/alertas/__init__.py` | Criar | Módulo vazio |
| `backend/app/api/alertas/router.py` | Criar | Funções puras de severidade + endpoint GET /api/alertas |
| `backend/tests/api/test_alertas.py` | Criar | 12 testes unitários das 4 funções de severidade |
| `backend/app/main.py` | Modificar | Registrar o router de alertas |
| `frontend/types/alertas.ts` | Criar | Tipos Alerta, TipoAlerta, SeveridadeAlerta, AlertasConfig, constantes |
| `frontend/components/alertas/AlertaCard.tsx` | Criar | Card individual com badge de severidade e link |
| `frontend/components/alertas/AlertasSection.tsx` | Criar | Seção colapsável com lista de AlertaCards |
| `frontend/components/alertas/ConfigPanel.tsx` | Criar | 4 inputs numéricos + botões Aplicar/Restaurar |
| `frontend/app/(app)/alertas/page.tsx` | Criar | Página principal com fetch, skeleton, ConfigPanel e seções |
| `frontend/components/layout/AppShell.tsx` | Modificar | Adicionar item Alertas + badge numérico vermelho |

---

## Task 1: Backend — funções puras de severidade + módulo + testes

**Files:**
- Create: `backend/app/api/alertas/__init__.py`
- Create: `backend/app/api/alertas/router.py` (apenas funções puras, sem endpoint)
- Create: `backend/tests/api/test_alertas.py`

- [ ] **Step 1: Criar o módulo vazio**

```bash
mkdir -p "C:\Users\Juan Paulo\Desktop\Juris AI\backend\app\api\alertas"
```

Criar `backend/app/api/alertas/__init__.py` (vazio):
```python
```

- [ ] **Step 2: Criar o router com apenas as funções puras de severidade**

Criar `backend/app/api/alertas/router.py`:

```python
"""Endpoint de alertas inteligentes."""
from typing import Literal

from fastapi import APIRouter

from app.core.logging import get_logger

router = APIRouter(prefix="/alertas", tags=["alertas"])
logger = get_logger("alertas.router")

SeveridadeType = Literal["alta", "media", "baixa"]


# ─── Funções puras de severidade (testáveis sem Supabase) ─────────────────────

def _severidade_processo(dias: int) -> SeveridadeType:
    """Alta se >60 dias, média se 30–60, baixa se <30."""
    if dias > 60:
        return "alta"
    if dias >= 30:
        return "media"
    return "baixa"


def _severidade_lead(dias: int) -> SeveridadeType:
    """Alta se >14 dias, média se 7–14, baixa se <7."""
    if dias > 14:
        return "alta"
    if dias >= 7:
        return "media"
    return "baixa"


def _severidade_prazo(dias_ate_vencimento: int) -> SeveridadeType:
    """Alta se ≤2 dias, média se 3–5, baixa se >5."""
    if dias_ate_vencimento <= 2:
        return "alta"
    if dias_ate_vencimento <= 5:
        return "media"
    return "baixa"


def _severidade_oportunidade(dias: int) -> SeveridadeType:
    """Alta se >30 dias, média se 15–30, baixa se <15."""
    if dias > 30:
        return "alta"
    if dias >= 15:
        return "media"
    return "baixa"
```

- [ ] **Step 3: Escrever os testes com falha**

Criar `backend/tests/api/test_alertas.py`:

```python
"""Testes unitários das funções de severidade de alertas."""
from app.api.alertas.router import (
    _severidade_processo,
    _severidade_lead,
    _severidade_prazo,
    _severidade_oportunidade,
)


# ─── _severidade_processo ─────────────────────────────────────────────────────

def test_severidade_processo_alta():
    assert _severidade_processo(61) == "alta"
    assert _severidade_processo(100) == "alta"


def test_severidade_processo_media():
    assert _severidade_processo(30) == "media"
    assert _severidade_processo(60) == "media"


def test_severidade_processo_baixa():
    assert _severidade_processo(1) == "baixa"
    assert _severidade_processo(29) == "baixa"


# ─── _severidade_lead ─────────────────────────────────────────────────────────

def test_severidade_lead_alta():
    assert _severidade_lead(15) == "alta"
    assert _severidade_lead(30) == "alta"


def test_severidade_lead_media():
    assert _severidade_lead(7) == "media"
    assert _severidade_lead(14) == "media"


def test_severidade_lead_baixa():
    assert _severidade_lead(1) == "baixa"
    assert _severidade_lead(6) == "baixa"


# ─── _severidade_prazo ────────────────────────────────────────────────────────

def test_severidade_prazo_alta():
    assert _severidade_prazo(0) == "alta"
    assert _severidade_prazo(2) == "alta"


def test_severidade_prazo_media():
    assert _severidade_prazo(3) == "media"
    assert _severidade_prazo(5) == "media"


def test_severidade_prazo_baixa():
    assert _severidade_prazo(6) == "baixa"
    assert _severidade_prazo(30) == "baixa"


# ─── _severidade_oportunidade ─────────────────────────────────────────────────

def test_severidade_oportunidade_alta():
    assert _severidade_oportunidade(31) == "alta"
    assert _severidade_oportunidade(100) == "alta"


def test_severidade_oportunidade_media():
    assert _severidade_oportunidade(15) == "media"
    assert _severidade_oportunidade(30) == "media"


def test_severidade_oportunidade_baixa():
    assert _severidade_oportunidade(1) == "baixa"
    assert _severidade_oportunidade(14) == "baixa"
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
cd backend && python -m pytest tests/api/test_alertas.py -v
```

Esperado: 12 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/alertas/__init__.py backend/app/api/alertas/router.py backend/tests/api/test_alertas.py
git commit -m "feat(alertas): módulo de alertas com funções puras de severidade e testes"
```

---

## Task 2: Backend — endpoint GET /api/alertas + registro em main.py

**Files:**
- Modify: `backend/app/api/alertas/router.py` (adicionar endpoint completo)
- Modify: `backend/app/main.py`

- [ ] **Step 1: Adicionar o endpoint ao router**

Adicionar ao final de `backend/app/api/alertas/router.py` (após as funções de severidade):

```python
from datetime import date, datetime, timedelta, timezone

from app.core.auth import AuthUser
from app.integrations.supabase import get_supabase


@router.get("")
async def get_alertas(
    _user: AuthUser,
    dias_processo: int = Query(default=30, ge=1),
    dias_lead: int = Query(default=7, ge=1),
    dias_prazo: int = Query(default=5, ge=1),
    dias_oportunidade: int = Query(default=15, ge=1),
) -> dict:
    """Retorna alertas operacionais agrupados por tipo e ordenados por severidade."""
    from fastapi import HTTPException, Query as Q

    now = datetime.now(timezone.utc)
    cutoff_processo = (now - timedelta(days=dias_processo)).isoformat()
    cutoff_lead = (now - timedelta(days=dias_lead)).isoformat()
    cutoff_oportunidade = (now - timedelta(days=dias_oportunidade)).isoformat()
    hoje = date.today().isoformat()
    prazo_limite = (date.today() + timedelta(days=dias_prazo)).isoformat()

    try:
        supabase = await get_supabase()

        # C1: processos sem andamento — duas etapas
        recent_and_res = (
            await supabase.table("andamentos")
            .select("processo_id")
            .gte("created_at", cutoff_processo)
            .execute()
        )
        recent_ids = {row["processo_id"] for row in recent_and_res.data or []}

        proc_res = (
            await supabase.table("processos")
            .select("id, numero_cnj, updated_at")
            .eq("status", "ativo")
            .execute()
        )
        processos_inativos = [p for p in (proc_res.data or []) if p["id"] not in recent_ids]

        # C2: leads sem contato
        leads_res = (
            await supabase.table("leads")
            .select("id, nome, telefone, updated_at")
            .lt("updated_at", cutoff_lead)
            .not_.in_("status", ["convertido", "desqualificado"])
            .execute()
        )
        leads_inativos = leads_res.data or []

        # C3: prazos fatais próximos (join com processos para obter numero_cnj)
        prazos_res = (
            await supabase.table("intimacoes")
            .select("id, processo_id, prazo_fatal, processos(numero_cnj)")
            .gte("prazo_fatal", hoje)
            .lte("prazo_fatal", prazo_limite)
            .execute()
        )
        prazos = prazos_res.data or []

        # C4: oportunidades paradas
        ops_res = (
            await supabase.table("oportunidades")
            .select("id, titulo, updated_at, lead_id")
            .lt("updated_at", cutoff_oportunidade)
            .not_.in_("estagio", ["ganho", "perdido"])
            .execute()
        )
        ops_paradas = ops_res.data or []

    except Exception as exc:
        logger.error("Erro ao buscar alertas: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc

    alertas: list[dict] = []

    for p in processos_inativos:
        try:
            updated = datetime.fromisoformat(str(p["updated_at"]).replace("Z", "+00:00"))
            dias = max((now - updated).days, dias_processo)
        except (ValueError, TypeError, KeyError):
            dias = dias_processo
        alertas.append({
            "tipo": "processo_sem_andamento",
            "id": p["id"],
            "titulo": p["numero_cnj"],
            "descricao": f"Sem andamentos há {dias} dias",
            "link": f"/processos/{p['id']}",
            "severidade": _severidade_processo(dias),
            "dias": dias,
        })

    for lead in leads_inativos:
        try:
            updated = datetime.fromisoformat(str(lead["updated_at"]).replace("Z", "+00:00"))
            dias = max((now - updated).days, dias_lead)
        except (ValueError, TypeError, KeyError):
            dias = dias_lead
        nome = lead.get("nome") or lead.get("telefone") or "Lead"
        alertas.append({
            "tipo": "lead_sem_contato",
            "id": lead["id"],
            "titulo": nome,
            "descricao": f"Sem atualização há {dias} dias",
            "link": f"/crm/{lead['id']}",
            "severidade": _severidade_lead(dias),
            "dias": dias,
        })

    for intimacao in prazos:
        try:
            prazo = date.fromisoformat(str(intimacao["prazo_fatal"]))
            dias_restantes = max((prazo - date.today()).days, 0)
        except (ValueError, TypeError, KeyError):
            dias_restantes = 0
        processo_data = intimacao.get("processos") or {}
        cnj = processo_data.get("numero_cnj") or "Processo"
        alertas.append({
            "tipo": "prazo_fatal",
            "id": intimacao["id"],
            "titulo": cnj,
            "descricao": f"Prazo fatal em {dias_restantes} dia{'s' if dias_restantes != 1 else ''}",
            "link": f"/processos/{intimacao['processo_id']}",
            "severidade": _severidade_prazo(dias_restantes),
            "dias": dias_restantes,
        })

    for op in ops_paradas:
        try:
            updated = datetime.fromisoformat(str(op["updated_at"]).replace("Z", "+00:00"))
            dias = max((now - updated).days, dias_oportunidade)
        except (ValueError, TypeError, KeyError):
            dias = dias_oportunidade
        alertas.append({
            "tipo": "oportunidade_parada",
            "id": op["id"],
            "titulo": op.get("titulo") or "Oportunidade",
            "descricao": f"Sem movimentação há {dias} dias",
            "link": f"/crm/{op['lead_id']}",
            "severidade": _severidade_oportunidade(dias),
            "dias": dias,
        })

    _ORDER = {"alta": 0, "media": 1, "baixa": 2}
    alertas.sort(key=lambda a: _ORDER[a["severidade"]])

    return {"alertas": alertas, "total": len(alertas)}
```

O import de `Query` já deve estar no topo do arquivo. Adicionar ao bloco de imports existente em `router.py`:

```python
from fastapi import APIRouter, Query
```

E mover os imports `from datetime...` e `from app.core.auth...` para o topo do arquivo (fora da função), junto com o `from app.integrations.supabase...`.

O arquivo completo final de `backend/app/api/alertas/router.py` fica:

```python
"""Endpoint de alertas inteligentes."""
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase

router = APIRouter(prefix="/alertas", tags=["alertas"])
logger = get_logger("alertas.router")

SeveridadeType = Literal["alta", "media", "baixa"]


# ─── Funções puras de severidade (testáveis sem Supabase) ─────────────────────

def _severidade_processo(dias: int) -> SeveridadeType:
    """Alta se >60 dias, média se 30–60, baixa se <30."""
    if dias > 60:
        return "alta"
    if dias >= 30:
        return "media"
    return "baixa"


def _severidade_lead(dias: int) -> SeveridadeType:
    """Alta se >14 dias, média se 7–14, baixa se <7."""
    if dias > 14:
        return "alta"
    if dias >= 7:
        return "media"
    return "baixa"


def _severidade_prazo(dias_ate_vencimento: int) -> SeveridadeType:
    """Alta se ≤2 dias, média se 3–5, baixa se >5."""
    if dias_ate_vencimento <= 2:
        return "alta"
    if dias_ate_vencimento <= 5:
        return "media"
    return "baixa"


def _severidade_oportunidade(dias: int) -> SeveridadeType:
    """Alta se >30 dias, média se 15–30, baixa se <15."""
    if dias > 30:
        return "alta"
    if dias >= 15:
        return "media"
    return "baixa"


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("")
async def get_alertas(
    _user: AuthUser,
    dias_processo: int = Query(default=30, ge=1),
    dias_lead: int = Query(default=7, ge=1),
    dias_prazo: int = Query(default=5, ge=1),
    dias_oportunidade: int = Query(default=15, ge=1),
) -> dict:
    """Retorna alertas operacionais agrupados por tipo e ordenados por severidade."""
    now = datetime.now(timezone.utc)
    cutoff_processo = (now - timedelta(days=dias_processo)).isoformat()
    cutoff_lead = (now - timedelta(days=dias_lead)).isoformat()
    cutoff_oportunidade = (now - timedelta(days=dias_oportunidade)).isoformat()
    hoje = date.today().isoformat()
    prazo_limite = (date.today() + timedelta(days=dias_prazo)).isoformat()

    try:
        supabase = await get_supabase()

        # C1: processos sem andamento — duas etapas
        recent_and_res = (
            await supabase.table("andamentos")
            .select("processo_id")
            .gte("created_at", cutoff_processo)
            .execute()
        )
        recent_ids = {row["processo_id"] for row in recent_and_res.data or []}

        proc_res = (
            await supabase.table("processos")
            .select("id, numero_cnj, updated_at")
            .eq("status", "ativo")
            .execute()
        )
        processos_inativos = [p for p in (proc_res.data or []) if p["id"] not in recent_ids]

        # C2: leads sem contato
        leads_res = (
            await supabase.table("leads")
            .select("id, nome, telefone, updated_at")
            .lt("updated_at", cutoff_lead)
            .not_.in_("status", ["convertido", "desqualificado"])
            .execute()
        )
        leads_inativos = leads_res.data or []

        # C3: prazos fatais próximos
        prazos_res = (
            await supabase.table("intimacoes")
            .select("id, processo_id, prazo_fatal, processos(numero_cnj)")
            .gte("prazo_fatal", hoje)
            .lte("prazo_fatal", prazo_limite)
            .execute()
        )
        prazos = prazos_res.data or []

        # C4: oportunidades paradas
        ops_res = (
            await supabase.table("oportunidades")
            .select("id, titulo, updated_at, lead_id")
            .lt("updated_at", cutoff_oportunidade)
            .not_.in_("estagio", ["ganho", "perdido"])
            .execute()
        )
        ops_paradas = ops_res.data or []

    except Exception as exc:
        logger.error("Erro ao buscar alertas: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc

    alertas: list[dict] = []

    for p in processos_inativos:
        try:
            updated = datetime.fromisoformat(str(p["updated_at"]).replace("Z", "+00:00"))
            dias = max((now - updated).days, dias_processo)
        except (ValueError, TypeError, KeyError):
            dias = dias_processo
        alertas.append({
            "tipo": "processo_sem_andamento",
            "id": p["id"],
            "titulo": p["numero_cnj"],
            "descricao": f"Sem andamentos há {dias} dias",
            "link": f"/processos/{p['id']}",
            "severidade": _severidade_processo(dias),
            "dias": dias,
        })

    for lead in leads_inativos:
        try:
            updated = datetime.fromisoformat(str(lead["updated_at"]).replace("Z", "+00:00"))
            dias = max((now - updated).days, dias_lead)
        except (ValueError, TypeError, KeyError):
            dias = dias_lead
        nome = lead.get("nome") or lead.get("telefone") or "Lead"
        alertas.append({
            "tipo": "lead_sem_contato",
            "id": lead["id"],
            "titulo": nome,
            "descricao": f"Sem atualização há {dias} dias",
            "link": f"/crm/{lead['id']}",
            "severidade": _severidade_lead(dias),
            "dias": dias,
        })

    for intimacao in prazos:
        try:
            prazo = date.fromisoformat(str(intimacao["prazo_fatal"]))
            dias_restantes = max((prazo - date.today()).days, 0)
        except (ValueError, TypeError, KeyError):
            dias_restantes = 0
        processo_data = intimacao.get("processos") or {}
        cnj = processo_data.get("numero_cnj") or "Processo"
        alertas.append({
            "tipo": "prazo_fatal",
            "id": intimacao["id"],
            "titulo": cnj,
            "descricao": f"Prazo fatal em {dias_restantes} dia{'s' if dias_restantes != 1 else ''}",
            "link": f"/processos/{intimacao['processo_id']}",
            "severidade": _severidade_prazo(dias_restantes),
            "dias": dias_restantes,
        })

    for op in ops_paradas:
        try:
            updated = datetime.fromisoformat(str(op["updated_at"]).replace("Z", "+00:00"))
            dias = max((now - updated).days, dias_oportunidade)
        except (ValueError, TypeError, KeyError):
            dias = dias_oportunidade
        alertas.append({
            "tipo": "oportunidade_parada",
            "id": op["id"],
            "titulo": op.get("titulo") or "Oportunidade",
            "descricao": f"Sem movimentação há {dias} dias",
            "link": f"/crm/{op['lead_id']}",
            "severidade": _severidade_oportunidade(dias),
            "dias": dias,
        })

    _ORDER = {"alta": 0, "media": 1, "baixa": 2}
    alertas.sort(key=lambda a: _ORDER[a["severidade"]])

    return {"alertas": alertas, "total": len(alertas)}
```

- [ ] **Step 2: Registrar o router em main.py**

Em `backend/app/main.py`, adicionar o import após os outros imports de routers:

```python
from app.api.alertas.router import router as alertas_router
```

E registrar após `app.include_router(analytics_router, prefix="/api")`:

```python
app.include_router(alertas_router, prefix="/api")
```

- [ ] **Step 3: Rodar os testes para confirmar que ainda passam**

```bash
cd backend && python -m pytest tests/api/test_alertas.py -v
```

Esperado: 12 testes PASS.

- [ ] **Step 4: Commit**

```bash
git add backend/app/api/alertas/router.py backend/app/main.py
git commit -m "feat(alertas): endpoint GET /api/alertas com 4 tipos de alerta"
```

---

## Task 3: Frontend — tipos TypeScript

**Files:**
- Create: `frontend/types/alertas.ts`

- [ ] **Step 1: Criar o arquivo de tipos**

Criar `frontend/types/alertas.ts`:

```typescript
export type TipoAlerta =
  | "processo_sem_andamento"
  | "lead_sem_contato"
  | "prazo_fatal"
  | "oportunidade_parada";

export type SeveridadeAlerta = "alta" | "media" | "baixa";

export interface Alerta {
  tipo: TipoAlerta;
  id: string;
  titulo: string;
  descricao: string;
  link: string;
  severidade: SeveridadeAlerta;
  dias: number;
}

export interface AlertasConfig {
  dias_processo: number;
  dias_lead: number;
  dias_prazo: number;
  dias_oportunidade: number;
}

export const DEFAULT_CONFIG: AlertasConfig = {
  dias_processo: 30,
  dias_lead: 7,
  dias_prazo: 5,
  dias_oportunidade: 15,
};

export const TIPO_LABELS: Record<TipoAlerta, string> = {
  processo_sem_andamento: "Processos sem andamento",
  lead_sem_contato: "Leads sem contato",
  prazo_fatal: "Prazos fatais próximos",
  oportunidade_parada: "Oportunidades paradas",
};

export const SEVERIDADE_COLORS: Record<SeveridadeAlerta, { bg: string; text: string }> = {
  alta: { bg: "rgba(239,68,68,.15)", text: "#ef4444" },
  media: { bg: "rgba(245,158,11,.15)", text: "#f59e0b" },
  baixa: { bg: "rgba(99,102,241,.15)", text: "#818cf8" },
};

export const SEVERIDADE_LABELS: Record<SeveridadeAlerta, string> = {
  alta: "Alta",
  media: "Média",
  baixa: "Baixa",
};

export const CONFIG_LABELS: Record<keyof AlertasConfig, string> = {
  dias_processo: "Processos sem andamento (dias)",
  dias_lead: "Leads sem contato (dias)",
  dias_prazo: "Prazos fatais — antecedência (dias)",
  dias_oportunidade: "Oportunidades paradas (dias)",
};
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend/types/alertas.ts
git commit -m "feat(alertas): adicionar tipos TypeScript de alertas"
```

---

## Task 4: Frontend — componentes AlertaCard, AlertasSection, ConfigPanel

**Files:**
- Create: `frontend/components/alertas/AlertaCard.tsx`
- Create: `frontend/components/alertas/AlertasSection.tsx`
- Create: `frontend/components/alertas/ConfigPanel.tsx`

- [ ] **Step 1: Criar AlertaCard**

Criar `frontend/components/alertas/AlertaCard.tsx`:

```typescript
import Link from "next/link";
import type { Alerta } from "@/types/alertas";
import { SEVERIDADE_COLORS, SEVERIDADE_LABELS } from "@/types/alertas";

interface Props {
  alerta: Alerta;
}

export function AlertaCard({ alerta }: Props) {
  const colors = SEVERIDADE_COLORS[alerta.severidade];

  return (
    <div
      className="flex items-center justify-between rounded-lg border px-4 py-3 gap-3"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="flex items-center gap-3 min-w-0">
        <span
          className="shrink-0 inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold"
          style={{ background: colors.bg, color: colors.text }}
        >
          {SEVERIDADE_LABELS[alerta.severidade]}
        </span>
        <div className="min-w-0">
          <p className="text-sm font-medium truncate">{alerta.titulo}</p>
          <p className="text-xs text-muted-foreground">{alerta.descricao}</p>
        </div>
      </div>
      <Link
        href={alerta.link}
        className="shrink-0 text-xs text-primary hover:underline"
      >
        Ver →
      </Link>
    </div>
  );
}
```

- [ ] **Step 2: Criar AlertasSection**

Criar `frontend/components/alertas/AlertasSection.tsx`:

```typescript
"use client";

import { useState } from "react";
import { ChevronDown, ChevronRight } from "lucide-react";
import type { Alerta, TipoAlerta } from "@/types/alertas";
import { TIPO_LABELS } from "@/types/alertas";
import { AlertaCard } from "./AlertaCard";

interface Props {
  tipo: TipoAlerta;
  alertas: Alerta[];
}

export function AlertasSection({ tipo, alertas }: Props) {
  const [aberto, setAberto] = useState(true);

  if (alertas.length === 0) return null;

  return (
    <div
      className="rounded-lg border overflow-hidden"
      style={{
        background: "rgba(255,255,255,.03)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <button
        onClick={() => setAberto((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-white/5 transition-colors"
      >
        <div className="flex items-center gap-2">
          {aberto ? (
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          ) : (
            <ChevronRight className="h-4 w-4 text-muted-foreground" />
          )}
          <span className="text-sm font-semibold">{TIPO_LABELS[tipo]}</span>
          <span
            className="inline-flex items-center justify-center rounded-full text-[10px] font-semibold px-1.5 min-w-5 h-5"
            style={{ background: "rgba(255,255,255,.1)" }}
          >
            {alertas.length}
          </span>
        </div>
      </button>

      {aberto && (
        <div className="px-4 pb-4 space-y-2">
          {alertas.map((a) => (
            <AlertaCard key={a.id} alerta={a} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Criar ConfigPanel**

Criar `frontend/components/alertas/ConfigPanel.tsx`:

```typescript
"use client";

import { useState } from "react";
import type { AlertasConfig } from "@/types/alertas";
import { CONFIG_LABELS, DEFAULT_CONFIG } from "@/types/alertas";

interface Props {
  config: AlertasConfig;
  onApply: (c: AlertasConfig) => void;
}

export function ConfigPanel({ config, onApply }: Props) {
  const [local, setLocal] = useState<AlertasConfig>(config);

  const inputClass =
    "w-24 rounded-lg border border-border bg-surface-elevated/50 px-3 py-1.5 text-sm text-foreground focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";

  function handleChange(key: keyof AlertasConfig, value: string) {
    const num = parseInt(value, 10);
    if (num >= 1) setLocal((prev) => ({ ...prev, [key]: num }));
  }

  function handleRestore() {
    setLocal(DEFAULT_CONFIG);
    onApply(DEFAULT_CONFIG);
  }

  return (
    <div
      className="rounded-lg border p-4 space-y-4"
      style={{
        background: "rgba(255,255,255,.04)",
        borderColor: "rgba(255,255,255,.06)",
      }}
    >
      <div className="text-xs font-semibold text-muted-foreground uppercase tracking-widest">
        Configurar limites
      </div>
      <div className="grid grid-cols-2 gap-4">
        {(Object.keys(DEFAULT_CONFIG) as (keyof AlertasConfig)[]).map((key) => (
          <div key={key} className="flex flex-col gap-1">
            <label className="text-xs text-muted-foreground">
              {CONFIG_LABELS[key]}
            </label>
            <input
              type="number"
              min={1}
              value={local[key]}
              onChange={(e) => handleChange(key, e.target.value)}
              className={inputClass}
            />
          </div>
        ))}
      </div>
      <div className="flex gap-2 justify-end">
        <button
          onClick={handleRestore}
          className="rounded-lg border border-border px-3 py-1.5 text-xs transition-colors hover:bg-surface-elevated"
        >
          Restaurar padrões
        </button>
        <button
          onClick={() => onApply(local)}
          className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground transition-colors hover:bg-primary-hover hover:shadow-glow-gold"
        >
          Aplicar
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 5: Commit**

```bash
git add frontend/components/alertas/AlertaCard.tsx frontend/components/alertas/AlertasSection.tsx frontend/components/alertas/ConfigPanel.tsx
git commit -m "feat(alertas): componentes AlertaCard, AlertasSection e ConfigPanel"
```

---

## Task 5: Frontend — página /alertas

**Files:**
- Create: `frontend/app/(app)/alertas/page.tsx`

- [ ] **Step 1: Criar a página**

Criar `frontend/app/(app)/alertas/page.tsx`:

```typescript
"use client";

import { useEffect, useState } from "react";
import { Bell, SlidersHorizontal } from "lucide-react";
import { api } from "@/lib/api";
import type { Alerta, AlertasConfig, TipoAlerta } from "@/types/alertas";
import { DEFAULT_CONFIG } from "@/types/alertas";
import { AlertasSection } from "@/components/alertas/AlertasSection";
import { ConfigPanel } from "@/components/alertas/ConfigPanel";

const TIPOS: TipoAlerta[] = [
  "processo_sem_andamento",
  "lead_sem_contato",
  "prazo_fatal",
  "oportunidade_parada",
];

const STORAGE_KEY = "alertas_config";

function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={`animate-pulse rounded-lg ${className ?? ""}`}
      style={{ background: "rgba(255,255,255,.06)" }}
    />
  );
}

function loadConfig(): AlertasConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) return { ...DEFAULT_CONFIG, ...JSON.parse(raw) };
  } catch {
    // ignore
  }
  return DEFAULT_CONFIG;
}

function saveConfig(config: AlertasConfig) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
  } catch {
    // ignore
  }
}

export default function AlertasPage() {
  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [config, setConfig] = useState<AlertasConfig>(DEFAULT_CONFIG);
  const [showConfig, setShowConfig] = useState(false);

  useEffect(() => {
    setConfig(loadConfig());
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({
      dias_processo: String(config.dias_processo),
      dias_lead: String(config.dias_lead),
      dias_prazo: String(config.dias_prazo),
      dias_oportunidade: String(config.dias_oportunidade),
    });
    api
      .get<{ alertas: Alerta[]; total: number }>(`/api/alertas?${params}`)
      .then((data) => { if (!cancelled) setAlertas(data.alertas); })
      .catch((err) => {
        if (!cancelled)
          setError(err instanceof Error ? err.message : "Erro ao carregar alertas");
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [config]);

  function handleApply(newConfig: AlertasConfig) {
    saveConfig(newConfig);
    setConfig(newConfig);
    setShowConfig(false);
  }

  const porTipo = (tipo: TipoAlerta) => alertas.filter((a) => a.tipo === tipo);

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-radial-gold">
      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center justify-between gap-3"
        style={{ borderColor: "rgba(255,255,255,.08)" }}
      >
        <div className="flex items-center gap-3">
          <Bell className="h-5 w-5 text-primary" />
          <div>
            <h1 className="text-lg font-semibold tracking-tight">Alertas</h1>
            <p className="text-xs text-muted-foreground">
              Situações que precisam de atenção
            </p>
          </div>
          {!loading && (
            <span
              className="inline-flex items-center justify-center rounded-full text-xs font-semibold px-2 h-5"
              style={{ background: "rgba(255,255,255,.1)" }}
            >
              {alertas.length} alerta{alertas.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>
        <button
          onClick={() => setShowConfig((v) => !v)}
          className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated transition-colors"
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          Configurar limites
        </button>
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-6 space-y-4">
        {showConfig && (
          <ConfigPanel config={config} onApply={handleApply} />
        )}

        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {error}
          </div>
        )}

        {loading ? (
          <div className="space-y-3">
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
            <Skeleton className="h-12" />
          </div>
        ) : alertas.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3">
            <Bell className="h-8 w-8 text-muted-foreground/40" />
            <p className="text-sm text-muted-foreground">Nenhum alerta no momento</p>
          </div>
        ) : (
          <div className="space-y-3">
            {TIPOS.map((tipo) => (
              <AlertasSection key={tipo} tipo={tipo} alertas={porTipo(tipo)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend/app/(app)/alertas/page.tsx
git commit -m "feat(alertas): criar página /alertas com configuração e seções por tipo"
```

---

## Task 6: Frontend — AppShell com item Alertas e badge

**Files:**
- Modify: `frontend/components/layout/AppShell.tsx`

- [ ] **Step 1: Ler o arquivo atual**

Ler `frontend/components/layout/AppShell.tsx` para confirmar o conteúdo antes de editar.

- [ ] **Step 2: Adicionar imports**

Linha atual:
```typescript
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, FileText, Inbox, KanbanSquare, LayoutDashboard, LogOut, Scale, Users } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
```

Substituir por:
```typescript
import Link from "next/link";
import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { BarChart2, Bell, FileText, Inbox, KanbanSquare, LayoutDashboard, LogOut, Scale, Users } from "lucide-react";
import { createBrowserClient } from "@/lib/supabase/client";
import { api } from "@/lib/api";
```

- [ ] **Step 3: Adicionar Bell ao NAV_ITEMS**

Linha atual (fim do array):
```typescript
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
];
```

Substituir por:
```typescript
  { href: "/analytics", label: "Analytics", icon: BarChart2 },
  { href: "/alertas", label: "Alertas", icon: Bell },
];
```

- [ ] **Step 4: Adicionar state e useEffect para badge**

Após a linha `const router = useRouter();` dentro do componente `AppShell`, adicionar:

```typescript
  const [alertasCount, setAlertasCount] = useState(0);

  useEffect(() => {
    api
      .get<{ total: number }>("/api/alertas")
      .then((data) => setAlertasCount(data.total))
      .catch(() => {});
  }, []);
```

- [ ] **Step 5: Renderizar o badge no item Alertas**

Dentro do `{NAV_ITEMS.map((item) => { ... })}`, encontrar o trecho que renderiza o label e adicionar o badge condicional.

O trecho atual do Link é:
```tsx
              <Icon
                className={`h-4 w-4 transition-colors ${
                  active ? "text-primary" : "group-hover:text-primary/80"
                }`}
              />
              {item.label}
```

Substituir por:
```tsx
              <Icon
                className={`h-4 w-4 transition-colors ${
                  active ? "text-primary" : "group-hover:text-primary/80"
                }`}
              />
              {item.label}
              {item.href === "/alertas" && alertasCount > 0 && (
                <span className="ml-auto flex h-5 min-w-5 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
                  {alertasCount > 99 ? "99+" : alertasCount}
                </span>
              )}
```

- [ ] **Step 6: Verificar TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/layout/AppShell.tsx
git commit -m "feat(alertas): adicionar item Alertas com badge no menu lateral"
```

---

## Verificação final

Após as 6 tasks, o fluxo completo deve funcionar:

1. Menu lateral mostra "Alertas" com badge vermelho se houver alertas
2. Acessar `/alertas` → lista carregada dividida por tipo
3. Clicar "Configurar limites" → painel expande com 4 inputs
4. Alterar um valor e clicar "Aplicar" → nova busca com os novos thresholds
5. Recarregar a página → thresholds persiste (localStorage)
6. Clicar "Restaurar padrões" → volta para 30/7/5/15 dias
7. Clicar "Ver →" em qualquer alerta → navega para a entidade correta
