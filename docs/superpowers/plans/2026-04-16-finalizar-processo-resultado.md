# Finalizar Processo com Resultado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o advogado finalize um processo judicial registrando o resultado (procedente, improcedente, acordo ou desistência), alimentando as métricas de taxa de êxito e tempo médio no módulo Analytics.

**Architecture:** Campo `resultado` já existe no banco (migration `20260416120000_analytics_resultado_processos.sql`). O backend recebe o campo via `ProcessoUpdate` e o retorna via `ProcessoOut`. O frontend adiciona um modal dedicado `FinalizarProcessoModal` que faz PATCH `{ status: "finalizado", resultado }`, e exibe um badge de resultado no header do detalhe do processo.

**Tech Stack:** FastAPI + Pydantic v2 (backend), Next.js 14 + TypeScript + lucide-react (frontend), Supabase PostgreSQL (banco).

---

## Mapa de arquivos

| Arquivo | Ação | Responsabilidade |
|---|---|---|
| `backend/app/models/processos.py` | Modificar | Adicionar `resultado` a `ProcessoUpdate` e `ProcessoOut` |
| `backend/tests/api/test_processos_models.py` | Criar | Testes unitários dos modelos Pydantic |
| `frontend/types/processos.ts` | Modificar | Adicionar `ResultadoProcesso`, `RESULTADO_LABELS`, campo `resultado` em `Processo` |
| `frontend/components/processos/FinalizarProcessoModal.tsx` | Criar | Modal com select de resultado, PATCH ao salvar |
| `frontend/components/processos/ProcessoDetail.tsx` | Modificar | Botão "Finalizar" + badge de resultado no header |

---

## Task 1: Backend — campo `resultado` nos modelos Pydantic

**Files:**
- Modify: `backend/app/models/processos.py:65-78` (ProcessoOut) e `:107-113` (ProcessoUpdate)
- Create: `backend/tests/api/test_processos_models.py`

- [ ] **Step 1: Escrever os testes com falha**

Criar o arquivo `backend/tests/api/test_processos_models.py`:

```python
"""Testes unitários dos modelos Pydantic de processos."""
import pytest
from uuid import uuid4
from datetime import datetime

from app.models.processos import ProcessoUpdate, ProcessoOut


# ─── ProcessoUpdate ───────────────────────────────────────────────────────────

def test_processo_update_aceita_resultado_valido():
    """Campo resultado deve ser aceito com valores do Literal."""
    for valor in ("procedente", "improcedente", "acordo", "desistencia"):
        m = ProcessoUpdate(resultado=valor)
        assert m.resultado == valor


def test_processo_update_resultado_none_por_padrao():
    """Campo resultado deve ser None quando omitido."""
    m = ProcessoUpdate()
    assert m.resultado is None


def test_processo_update_resultado_invalido_raises():
    """Valor fora do Literal deve levantar ValidationError."""
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        ProcessoUpdate(resultado="ganho")


# ─── ProcessoOut ─────────────────────────────────────────────────────────────

def _base_processo_out_data(**kwargs):
    now = datetime.now().isoformat()
    return {
        "id": str(uuid4()),
        "numero_cnj": "1234567-89.2024.8.26.0001",
        "cliente_id": None,
        "advogado_id": None,
        "tribunal": None,
        "vara": None,
        "area_juridica": None,
        "status": "ativo",
        "monitorar": False,
        "notificar_cliente": False,
        "ultima_verificacao_at": None,
        "created_at": now,
        "updated_at": now,
        **kwargs,
    }


def test_processo_out_serializa_resultado_preenchido():
    """ProcessoOut deve expor o campo resultado quando preenchido."""
    data = _base_processo_out_data(resultado="procedente")
    p = ProcessoOut(**data)
    assert p.resultado == "procedente"


def test_processo_out_resultado_none_por_padrao():
    """ProcessoOut deve aceitar resultado ausente (None) sem erro."""
    data = _base_processo_out_data()
    p = ProcessoOut(**data)
    assert p.resultado is None
```

- [ ] **Step 2: Rodar os testes para confirmar que falham**

```bash
cd backend && python -m pytest tests/api/test_processos_models.py -v
```

Esperado: FAIL — `ProcessoUpdate` e `ProcessoOut` não têm campo `resultado`.

- [ ] **Step 3: Implementar as alterações nos modelos**

Editar `backend/app/models/processos.py`:

**ProcessoOut** (linha 65) — adicionar campo `resultado` após `status`:

```python
class ProcessoOut(BaseModel):
    id: UUID
    numero_cnj: str
    cliente_id: UUID | None
    advogado_id: UUID | None
    tribunal: str | None
    vara: str | None
    area_juridica: AreaJuridica | None
    status: str
    resultado: Literal["procedente", "improcedente", "acordo", "desistencia"] | None = None
    monitorar: bool
    notificar_cliente: bool
    ultima_verificacao_at: datetime | None
    created_at: datetime
    updated_at: datetime
```

**ProcessoUpdate** (linha 107) — adicionar campo `resultado` ao final:

```python
class ProcessoUpdate(BaseModel):
    cliente_id: UUID | None = None
    advogado_id: UUID | None = None
    tribunal: str | None = Field(default=None, max_length=200)
    vara: str | None = Field(default=None, max_length=200)
    area_juridica: AreaJuridica | None = None
    status: ProcessoStatus | None = None
    resultado: Literal["procedente", "improcedente", "acordo", "desistencia"] | None = None
```

- [ ] **Step 4: Rodar os testes para confirmar que passam**

```bash
cd backend && python -m pytest tests/api/test_processos_models.py -v
```

Esperado: 5 testes PASS.

- [ ] **Step 5: Commit**

```bash
git add backend/app/models/processos.py backend/tests/api/test_processos_models.py
git commit -m "feat(processos): adicionar campo resultado a ProcessoUpdate e ProcessoOut"
```

---

## Task 2: Frontend — tipos `ResultadoProcesso` e campo `resultado` em `Processo`

**Files:**
- Modify: `frontend/types/processos.ts`

> Nota: não há suite de testes automatizados para o frontend. A verificação é feita compilando o TypeScript (`tsc --noEmit`).

- [ ] **Step 1: Adicionar o tipo, o mapa de labels e o campo à interface**

Editar `frontend/types/processos.ts`. Inserir após a linha `export type ProcessoStatus = ...`:

```typescript
export type ResultadoProcesso =
  | "procedente"
  | "improcedente"
  | "acordo"
  | "desistencia";

export const RESULTADO_LABELS: Record<ResultadoProcesso, string> = {
  procedente: "Procedente",
  improcedente: "Improcedente",
  acordo: "Acordo",
  desistencia: "Desistência",
};
```

E adicionar `resultado` na interface `Processo` (após `updated_at`):

```typescript
export interface Processo {
  id: string;
  numero_cnj: string;
  cliente_id: string | null;
  advogado_id: string | null;
  tribunal: string | null;
  vara: string | null;
  area_juridica: AreaJuridica | null;
  status: ProcessoStatus;
  resultado: ResultadoProcesso | null;
  monitorar: boolean;
  notificar_cliente: boolean;
  ultima_verificacao_at: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Verificar o TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend/types/processos.ts
git commit -m "feat(processos): adicionar tipo ResultadoProcesso e campo resultado em Processo"
```

---

## Task 3: Frontend — componente `FinalizarProcessoModal`

**Files:**
- Create: `frontend/components/processos/FinalizarProcessoModal.tsx`

- [ ] **Step 1: Criar o componente**

Criar `frontend/components/processos/FinalizarProcessoModal.tsx`:

```typescript
"use client";

import { useState } from "react";
import { Modal } from "@/components/ui/Modal";
import { api } from "@/lib/api";
import type { Processo, ResultadoProcesso } from "@/types/processos";
import { RESULTADO_LABELS } from "@/types/processos";

interface Props {
  open: boolean;
  onClose: () => void;
  processo: Processo;
  onUpdated: (p: Processo) => void;
}

const RESULTADO_OPTIONS: { value: ResultadoProcesso; label: string }[] = [
  { value: "procedente", label: "Procedente" },
  { value: "improcedente", label: "Improcedente" },
  { value: "acordo", label: "Acordo" },
  { value: "desistencia", label: "Desistência" },
];

const inputClass =
  "w-full rounded-lg border border-border bg-surface-elevated/50 px-3.5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/60 transition-colors focus:border-primary/50 focus:outline-none focus:ring-1 focus:ring-primary/30";

export function FinalizarProcessoModal({ open, onClose, processo, onUpdated }: Props) {
  const [resultado, setResultado] = useState<ResultadoProcesso | "">("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleClose() {
    setResultado("");
    setError(null);
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!resultado) return;
    setError(null);
    setSaving(true);
    try {
      const updated = await api.patch<Processo>(`/api/processos/${processo.id}`, {
        status: "finalizado",
        resultado,
      });
      onUpdated(updated);
      handleClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro ao finalizar processo.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Finalizar processo"
      description={`Registre o resultado do processo ${processo.numero_cnj}`}
      size="sm"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label-caps mb-1.5 block">Resultado *</label>
          <select
            value={resultado}
            onChange={(e) => setResultado(e.target.value as ResultadoProcesso | "")}
            className={inputClass}
            required
          >
            <option value="">Selecionar resultado…</option>
            {RESULTADO_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <p className="rounded-lg border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive">
            {error}
          </p>
        )}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={handleClose}
            disabled={saving}
            className="rounded-lg border border-border px-4 py-2 text-sm transition-colors hover:bg-surface-elevated disabled:opacity-50"
          >
            Cancelar
          </button>
          <button
            type="submit"
            disabled={saving || !resultado}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:bg-primary-hover hover:shadow-glow-gold disabled:opacity-50"
          >
            {saving ? "Finalizando..." : "Finalizar processo"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
```

- [ ] **Step 2: Verificar o TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 3: Commit**

```bash
git add frontend/components/processos/FinalizarProcessoModal.tsx
git commit -m "feat(processos): criar FinalizarProcessoModal com select de resultado"
```

---

## Task 4: Frontend — botão "Finalizar" e badge de resultado em `ProcessoDetail`

**Files:**
- Modify: `frontend/components/processos/ProcessoDetail.tsx`

- [ ] **Step 1: Adicionar os imports necessários**

No topo do arquivo `frontend/components/processos/ProcessoDetail.tsx`, adicionar:
- `CheckCircle` ao import de `lucide-react`
- `FinalizarProcessoModal` ao import dos componentes locais
- `RESULTADO_LABELS` ao import de `@/types/processos`

Linha atual dos imports relevantes:

```typescript
import { Scale, Archive, Plus, Pencil } from "lucide-react";
import { EditarProcessoModal } from "./EditarProcessoModal";
import { PROCESSO_STATUS_LABELS, PROCESSO_STATUS_COLORS } from "@/types/processos";
```

Substituir por:

```typescript
import { Scale, Archive, Plus, Pencil, CheckCircle } from "lucide-react";
import { EditarProcessoModal } from "./EditarProcessoModal";
import { FinalizarProcessoModal } from "./FinalizarProcessoModal";
import { PROCESSO_STATUS_LABELS, PROCESSO_STATUS_COLORS, RESULTADO_LABELS } from "@/types/processos";
```

- [ ] **Step 2: Adicionar o estado `showFinalizar`**

Após a linha `const [showEditarProcesso, setShowEditarProcesso] = useState(false);` (linha 33), adicionar:

```typescript
const [showFinalizar, setShowFinalizar] = useState(false);
```

- [ ] **Step 3: Adicionar o `FinalizarProcessoModal` no JSX**

Logo após o bloco `{/* EditarProcessoModal */}` (após a tag `</EditarProcessoModal>`, por volta da linha 75), adicionar:

```tsx
{/* FinalizarProcessoModal */}
<FinalizarProcessoModal
  open={showFinalizar}
  onClose={() => setShowFinalizar(false)}
  processo={localProcesso}
  onUpdated={(updated) => setLocalProcesso(updated)}
/>
```

- [ ] **Step 4: Adicionar o botão "Finalizar" no header**

No bloco de botões do header (dentro de `<div className="flex items-center gap-2">`), adicionar o botão "Finalizar" entre "Editar" e "Arquivar". O bloco de botões deve ficar:

```tsx
<div className="flex items-center gap-2">
  {localProcesso.status !== "arquivado" && (
    <button
      onClick={() => setShowEditarProcesso(true)}
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated transition-colors"
    >
      <Pencil className="h-3.5 w-3.5" />
      Editar
    </button>
  )}
  {localProcesso.status !== "finalizado" && localProcesso.status !== "arquivado" && (
    <button
      onClick={() => setShowFinalizar(true)}
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated transition-colors"
    >
      <CheckCircle className="h-3.5 w-3.5" />
      Finalizar
    </button>
  )}
  {localProcesso.status !== "arquivado" && (
    <button
      onClick={() => setShowArchiveConfirm(true)}
      className="flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs text-muted-foreground hover:bg-surface-elevated transition-colors"
    >
      <Archive className="h-3.5 w-3.5" />
      Arquivar
    </button>
  )}
</div>
```

- [ ] **Step 5: Adicionar o badge de resultado no header**

No bloco de badges ao lado do número CNJ (após o `<span>` do status, por volta da linha 86-90), adicionar o badge condicional de resultado:

```tsx
<div className="flex items-center gap-2 mb-1">
  <Scale className="h-4 w-4 text-muted-foreground" />
  <h1 className="font-mono text-lg font-semibold">{localProcesso.numero_cnj}</h1>
  <span
    className={cn(
      "inline-flex rounded-full px-2 py-0.5 text-xs font-medium",
      PROCESSO_STATUS_COLORS[localProcesso.status]
    )}
  >
    {PROCESSO_STATUS_LABELS[localProcesso.status]}
  </span>
  {localProcesso.resultado && (
    <span
      className="inline-flex rounded-full px-2 py-0.5 text-xs font-medium"
      style={{
        background:
          localProcesso.resultado === "procedente" || localProcesso.resultado === "acordo"
            ? "rgba(34,197,94,.15)"
            : "rgba(245,158,11,.15)",
        color:
          localProcesso.resultado === "procedente" || localProcesso.resultado === "acordo"
            ? "#22c55e"
            : "#f59e0b",
      }}
    >
      {RESULTADO_LABELS[localProcesso.resultado]}
    </span>
  )}
</div>
```

- [ ] **Step 6: Verificar o TypeScript**

```bash
cd frontend && npx tsc --noEmit
```

Esperado: sem erros.

- [ ] **Step 7: Commit**

```bash
git add frontend/components/processos/ProcessoDetail.tsx
git commit -m "feat(processos): adicionar botão Finalizar e badge de resultado no detalhe"
```

---

## Verificação final

Após os 4 tasks, o fluxo completo deve funcionar:

1. Abrir `/processos/:id` com status `ativo` ou `suspenso`
2. Botão "Finalizar" aparece no header
3. Clicar — modal abre com select vazio e botão desabilitado
4. Selecionar "Procedente" — botão habilita
5. Clicar "Finalizar processo" — PATCH `{ status: "finalizado", resultado: "procedente" }`
6. Modal fecha, header atualiza: badge de status "Finalizado" + badge verde "Procedente"
7. Botão "Finalizar" some
8. Em `/analytics`, `taxa_exito` e `tempo_medio` passam a contar este processo
