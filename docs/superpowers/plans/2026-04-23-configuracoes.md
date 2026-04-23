# Configurações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Criar a página `/configuracoes` com 5 tabs (Perfil, Escritório, Integrações, Notificações, Segurança) persistindo dados no Supabase.

**Architecture:** Migration cria tabela `escritorio` e coluna `notif_preferences` em `profiles`. Backend FastAPI expõe endpoints em `/api/configuracoes/perfil`, `/api/configuracoes/escritorio` e `/api/inboxes`. Frontend Next.js usa tabs com um componente por aba.

**Tech Stack:** FastAPI + Supabase Python SDK (backend), Next.js 14 App Router + TypeScript (frontend), Supabase Auth (segurança).

---

## Mapa de arquivos

| Ação | Arquivo |
|------|---------|
| Criar | `supabase/migrations/20260423000000_configuracoes.sql` |
| Criar | `backend/app/api/configuracoes/__init__.py` |
| Criar | `backend/app/api/configuracoes/router.py` |
| Criar | `backend/app/api/inboxes/__init__.py` |
| Criar | `backend/app/api/inboxes/router.py` |
| Modificar | `backend/app/main.py` |
| Criar | `frontend/types/configuracoes.ts` |
| Criar | `frontend/components/configuracoes/PerfilTab.tsx` |
| Criar | `frontend/components/configuracoes/EscritorioTab.tsx` |
| Criar | `frontend/components/configuracoes/IntegracoesTab.tsx` |
| Criar | `frontend/components/configuracoes/NotificacoesTab.tsx` |
| Criar | `frontend/components/configuracoes/SegurancaTab.tsx` |
| Criar | `frontend/app/(app)/configuracoes/page.tsx` |
| Modificar | `frontend/components/layout/AppShell.tsx` |

---

### Task 1: Migration SQL

**Files:**
- Create: `supabase/migrations/20260423000000_configuracoes.sql`

- [ ] **Step 1: Criar arquivo de migration**

```sql
-- tabela escritorio (1 row global)
create table if not exists public.escritorio (
  id          uuid primary key default gen_random_uuid(),
  nome        text not null,
  oab         text,
  logo_url    text,
  endereco    text,
  telefone    text,
  site        text,
  assinatura  text,
  rodape      text,
  created_at  timestamptz default now(),
  updated_at  timestamptz default now()
);

alter table public.escritorio enable row level security;

create policy "escritorio_select" on public.escritorio
  for select using (auth.role() = 'authenticated');

create policy "escritorio_write" on public.escritorio
  for all using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and role = 'admin'
    )
  );

-- preferências de notificação por usuário
alter table public.profiles
  add column if not exists notif_preferences jsonb not null default '{
    "dias_processo": 7,
    "dias_lead": 3,
    "dias_prazo": 5,
    "dias_oportunidade": 14,
    "canal": "whatsapp"
  }'::jsonb;
```

- [ ] **Step 2: Aplicar migration via MCP Supabase**

Chamar `mcp__supabase__apply_migration` com o conteúdo do arquivo acima.

- [ ] **Step 3: Verificar tabela criada**

Chamar `mcp__supabase__list_tables` e confirmar que `escritorio` aparece na lista e que `profiles` tem a coluna `notif_preferences`.

- [ ] **Step 4: Commit**

```bash
git add supabase/migrations/20260423000000_configuracoes.sql
git commit -m "feat(db): tabela escritorio e notif_preferences em profiles"
```

---

### Task 2: Backend — router de configurações (perfil + escritório)

**Files:**
- Create: `backend/app/api/configuracoes/__init__.py`
- Create: `backend/app/api/configuracoes/router.py`

- [ ] **Step 1: Criar `__init__.py` vazio**

```python
```

- [ ] **Step 2: Criar `router.py`**

```python
"""Endpoints de configurações — perfil e escritório."""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase

router = APIRouter(prefix="/configuracoes", tags=["configuracoes"])
logger = get_logger("configuracoes.router")


# ── Perfil ────────────────────────────────────────────────────────────────────

class NotifPreferences(BaseModel):
    dias_processo: int = 7
    dias_lead: int = 3
    dias_prazo: int = 5
    dias_oportunidade: int = 14
    canal: str = "whatsapp"


class PerfilUpdate(BaseModel):
    full_name: str | None = None
    oab_number: str | None = None
    avatar_url: str | None = None
    notif_preferences: NotifPreferences | None = None


@router.get("/perfil")
async def get_perfil(user: AuthUser) -> dict:
    supabase = await get_supabase()
    try:
        res = (
            await supabase.table("profiles")
            .select("id, full_name, oab_number, avatar_url, role, notif_preferences")
            .eq("id", user.id)
            .single()
            .execute()
        )
    except Exception as exc:
        logger.error("Erro ao buscar perfil: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc

    if not res.data:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    data = dict(res.data)
    data["email"] = user.email
    return data


@router.put("/perfil")
async def update_perfil(user: AuthUser, body: PerfilUpdate) -> dict:
    supabase = await get_supabase()
    update: dict = {}
    if body.full_name is not None:
        update["full_name"] = body.full_name
    if body.oab_number is not None:
        update["oab_number"] = body.oab_number
    if body.avatar_url is not None:
        update["avatar_url"] = body.avatar_url
    if body.notif_preferences is not None:
        update["notif_preferences"] = body.notif_preferences.model_dump()

    if not update:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        res = (
            await supabase.table("profiles")
            .update(update)
            .eq("id", user.id)
            .execute()
        )
    except Exception as exc:
        logger.error("Erro ao atualizar perfil: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc

    return res.data[0] if res.data else {}


# ── Escritório ────────────────────────────────────────────────────────────────

class EscritorioUpdate(BaseModel):
    nome: str
    oab: str | None = None
    logo_url: str | None = None
    endereco: str | None = None
    telefone: str | None = None
    site: str | None = None
    assinatura: str | None = None
    rodape: str | None = None


async def _require_admin(user_id: str) -> None:
    supabase = await get_supabase()
    res = (
        await supabase.table("profiles")
        .select("role")
        .eq("id", user_id)
        .single()
        .execute()
    )
    if not res.data or res.data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar dados do escritório")


@router.get("/escritorio")
async def get_escritorio(_user: AuthUser) -> dict:
    supabase = await get_supabase()
    try:
        res = await supabase.table("escritorio").select("*").limit(1).execute()
    except Exception as exc:
        logger.error("Erro ao buscar escritório: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc
    return res.data[0] if res.data else {}


@router.put("/escritorio")
async def update_escritorio(user: AuthUser, body: EscritorioUpdate) -> dict:
    await _require_admin(user.id)
    supabase = await get_supabase()

    payload = body.model_dump()
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        existing = await supabase.table("escritorio").select("id").limit(1).execute()
        if existing.data:
            row_id = existing.data[0]["id"]
            res = (
                await supabase.table("escritorio")
                .update(payload)
                .eq("id", row_id)
                .execute()
            )
        else:
            payload["created_at"] = payload["updated_at"]
            res = await supabase.table("escritorio").insert(payload).execute()
    except Exception as exc:
        logger.error("Erro ao atualizar escritório: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc

    return res.data[0] if res.data else {}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/configuracoes/
git commit -m "feat(backend): endpoints GET/PUT /api/configuracoes/perfil e /escritorio"
```

---

### Task 3: Backend — router de inboxes

**Files:**
- Create: `backend/app/api/inboxes/__init__.py`
- Create: `backend/app/api/inboxes/router.py`

- [ ] **Step 1: Criar `__init__.py` vazio**

```python
```

- [ ] **Step 2: Criar `router.py`**

```python
"""Endpoints de inboxes (canais de atendimento)."""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase

router = APIRouter(prefix="/inboxes", tags=["inboxes"])
logger = get_logger("inboxes.router")


class InboxCreate(BaseModel):
    nome: str
    canal: str = "whatsapp"
    evolution_instance: str | None = None


class InboxUpdate(BaseModel):
    nome: str | None = None
    evolution_instance: str | None = None
    ativo: bool | None = None


@router.get("")
async def list_inboxes(_user: AuthUser) -> dict:
    supabase = await get_supabase()
    try:
        res = await supabase.table("inboxes").select("*").order("created_at").execute()
    except Exception as exc:
        logger.error("Erro ao listar inboxes: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc
    return {"inboxes": res.data or []}


@router.post("")
async def create_inbox(_user: AuthUser, body: InboxCreate) -> dict:
    supabase = await get_supabase()
    payload = body.model_dump()
    try:
        res = await supabase.table("inboxes").insert(payload).execute()
    except Exception as exc:
        logger.error("Erro ao criar inbox: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc
    return res.data[0] if res.data else {}


@router.put("/{inbox_id}")
async def update_inbox(_user: AuthUser, inbox_id: str, body: InboxUpdate) -> dict:
    supabase = await get_supabase()
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    try:
        res = (
            await supabase.table("inboxes")
            .update(update)
            .eq("id", inbox_id)
            .execute()
        )
    except Exception as exc:
        logger.error("Erro ao atualizar inbox %s: %s", inbox_id, exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc
    return res.data[0] if res.data else {}
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/api/inboxes/
git commit -m "feat(backend): endpoints GET/POST/PUT /api/inboxes"
```

---

### Task 4: Registrar routers em main.py

**Files:**
- Modify: `backend/app/main.py`

- [ ] **Step 1: Adicionar imports e includes**

No `backend/app/main.py`, adicionar após os imports existentes:

```python
from app.api.configuracoes.router import router as configuracoes_router
from app.api.inboxes.router import router as inboxes_router
```

E após as linhas `app.include_router(...)` existentes:

```python
app.include_router(configuracoes_router, prefix="/api")
app.include_router(inboxes_router, prefix="/api")
```

- [ ] **Step 2: Verificar servidor inicia sem erros**

```bash
cd backend && python -m uvicorn app.main:app --reload --port 8000
```

Esperado: sem ImportError, `/docs` lista os novos endpoints.

- [ ] **Step 3: Commit**

```bash
git add backend/app/main.py
git commit -m "feat(backend): registrar routers configuracoes e inboxes"
```

---

### Task 5: Frontend — tipos TypeScript

**Files:**
- Create: `frontend/types/configuracoes.ts`

- [ ] **Step 1: Criar arquivo de tipos**

```typescript
export interface NotifPreferences {
  dias_processo: number;
  dias_lead: number;
  dias_prazo: number;
  dias_oportunidade: number;
  canal: "whatsapp" | "email";
}

export interface PerfilData {
  id: string;
  full_name: string;
  oab_number: string | null;
  avatar_url: string | null;
  email: string;
  role: "admin" | "advogado" | "atendente";
  notif_preferences: NotifPreferences;
}

export interface EscritorioData {
  id?: string;
  nome: string;
  oab: string | null;
  logo_url: string | null;
  endereco: string | null;
  telefone: string | null;
  site: string | null;
  assinatura: string | null;
  rodape: string | null;
}

export interface InboxData {
  id: string;
  nome: string;
  canal: "whatsapp" | "webchat" | "email";
  evolution_instance: string | null;
  ativo: boolean;
}

export const ROLE_LABELS: Record<PerfilData["role"], string> = {
  admin: "Administrador",
  advogado: "Advogado(a)",
  atendente: "Atendente",
};

export const CANAL_LABELS: Record<InboxData["canal"], string> = {
  whatsapp: "WhatsApp",
  webchat: "Web Chat",
  email: "E-mail",
};

export const DEFAULT_NOTIF_PREFERENCES: NotifPreferences = {
  dias_processo: 7,
  dias_lead: 3,
  dias_prazo: 5,
  dias_oportunidade: 14,
  canal: "whatsapp",
};
```

- [ ] **Step 2: Commit**

```bash
git add frontend/types/configuracoes.ts
git commit -m "feat(frontend): tipos TypeScript para configurações"
```

---

### Task 6: Frontend — PerfilTab

**Files:**
- Create: `frontend/components/configuracoes/PerfilTab.tsx`

- [ ] **Step 1: Criar componente**

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PerfilData } from "@/types/configuracoes";
import { ROLE_LABELS } from "@/types/configuracoes";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
    />
  );
}

export function PerfilTab() {
  const [data, setData] = useState<PerfilData | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [fullName, setFullName] = useState("");
  const [oabNumber, setOabNumber] = useState("");
  const [avatarUrl, setAvatarUrl] = useState("");

  useEffect(() => {
    api
      .get<PerfilData>("/api/configuracoes/perfil")
      .then((d) => {
        setData(d);
        setFullName(d.full_name ?? "");
        setOabNumber(d.oab_number ?? "");
        setAvatarUrl(d.avatar_url ?? "");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put("/api/configuracoes/perfil", {
        full_name: fullName || undefined,
        oab_number: oabNumber || undefined,
        avatar_url: avatarUrl || undefined,
      });
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg" style={{ background: "rgba(255,255,255,.06)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <Field label="E-mail">
        <Input value={data?.email ?? ""} disabled />
      </Field>
      <Field label="Função">
        <Input value={data ? ROLE_LABELS[data.role] : ""} disabled />
      </Field>
      <Field label="Nome completo">
        <Input value={fullName} onChange={(e) => setFullName(e.target.value)} placeholder="Seu nome" />
      </Field>
      <Field label="Nº OAB">
        <Input value={oabNumber} onChange={(e) => setOabNumber(e.target.value)} placeholder="Ex: SP 123456" />
      </Field>
      <Field label="Avatar URL">
        <Input value={avatarUrl} onChange={(e) => setAvatarUrl(e.target.value)} placeholder="https://..." />
      </Field>

      {error && (
        <p className="text-sm text-red-400">{error}</p>
      )}
      {success && (
        <p className="text-sm" style={{ color: "#c9a96e" }}>Salvo com sucesso.</p>
      )}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ background: "#c9a96e", color: "#0a0f1e" }}
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/configuracoes/PerfilTab.tsx
git commit -m "feat(frontend): componente PerfilTab"
```

---

### Task 7: Frontend — EscritorioTab

**Files:**
- Create: `frontend/components/configuracoes/EscritorioTab.tsx`

- [ ] **Step 1: Criar componente**

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { EscritorioData, PerfilData } from "@/types/configuracoes";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50"
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      rows={3}
      {...props}
      className="rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 disabled:opacity-50 resize-none"
    />
  );
}

const EMPTY: EscritorioData = {
  nome: "", oab: "", logo_url: "", endereco: "",
  telefone: "", site: "", assinatura: "", rodape: "",
};

export function EscritorioTab() {
  const [isAdmin, setIsAdmin] = useState(false);
  const [form, setForm] = useState<EscritorioData>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      api.get<EscritorioData>("/api/configuracoes/escritorio"),
      api.get<PerfilData>("/api/configuracoes/perfil"),
    ])
      .then(([esc, perfil]) => {
        setForm({ ...EMPTY, ...esc });
        setIsAdmin(perfil.role === "admin");
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function set(field: keyof EscritorioData) {
    return (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      setForm((prev) => ({ ...prev, [field]: e.target.value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put("/api/configuracoes/escritorio", form);
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-10 animate-pulse rounded-lg" style={{ background: "rgba(255,255,255,.06)" }} />
        ))}
      </div>
    );
  }

  const disabled = !isAdmin;

  return (
    <div className="space-y-6 max-w-lg">
      {!isAdmin && (
        <p className="rounded-lg border border-border/60 px-4 py-3 text-sm text-muted-foreground">
          Somente administradores podem editar dados do escritório.
        </p>
      )}
      <Field label="Nome do escritório">
        <Input value={form.nome} onChange={set("nome")} disabled={disabled} placeholder="Ex: Silva & Associados" />
      </Field>
      <Field label="OAB do escritório">
        <Input value={form.oab ?? ""} onChange={set("oab")} disabled={disabled} placeholder="Ex: SP 0000/OAB" />
      </Field>
      <Field label="Logo URL">
        <Input value={form.logo_url ?? ""} onChange={set("logo_url")} disabled={disabled} placeholder="https://..." />
      </Field>
      <Field label="Endereço">
        <Input value={form.endereco ?? ""} onChange={set("endereco")} disabled={disabled} placeholder="Rua, número, cidade" />
      </Field>
      <Field label="Telefone">
        <Input value={form.telefone ?? ""} onChange={set("telefone")} disabled={disabled} placeholder="(11) 99999-9999" />
      </Field>
      <Field label="Site">
        <Input value={form.site ?? ""} onChange={set("site")} disabled={disabled} placeholder="https://..." />
      </Field>
      <Field label="Assinatura padrão">
        <Textarea value={form.assinatura ?? ""} onChange={set("assinatura")} disabled={disabled} placeholder="Texto de assinatura para comunicações" />
      </Field>
      <Field label="Texto de rodapé">
        <Textarea value={form.rodape ?? ""} onChange={set("rodape")} disabled={disabled} placeholder="Ex: Este escritório está inscrito na OAB/SP..." />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm" style={{ color: "#c9a96e" }}>Salvo com sucesso.</p>}

      {isAdmin && (
        <button
          type="button"
          onClick={handleSave}
          disabled={saving}
          className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
          style={{ background: "#c9a96e", color: "#0a0f1e" }}
        >
          {saving ? "Salvando…" : "Salvar"}
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/configuracoes/EscritorioTab.tsx
git commit -m "feat(frontend): componente EscritorioTab"
```

---

### Task 8: Frontend — IntegracoesTab

**Files:**
- Create: `frontend/components/configuracoes/IntegracoesTab.tsx`

- [ ] **Step 1: Criar componente**

```tsx
"use client";

import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { InboxData } from "@/types/configuracoes";
import { CANAL_LABELS } from "@/types/configuracoes";

const CANAIS: InboxData["canal"][] = ["whatsapp", "webchat", "email"];

export function IntegracoesTab() {
  const [inboxes, setInboxes] = useState<InboxData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newCanal, setNewCanal] = useState<InboxData["canal"]>("whatsapp");
  const [newInstance, setNewInstance] = useState("");
  const [creating, setCreating] = useState(false);

  function loadInboxes() {
    setLoading(true);
    api
      .get<{ inboxes: InboxData[] }>("/api/inboxes")
      .then((d) => setInboxes(d.inboxes))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadInboxes, []);

  async function toggleAtivo(inbox: InboxData) {
    try {
      await api.put(`/api/inboxes/${inbox.id}`, { ativo: !inbox.ativo });
      setInboxes((prev) =>
        prev.map((i) => (i.id === inbox.id ? { ...i, ativo: !i.ativo } : i))
      );
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar");
    }
  }

  async function handleCreate() {
    if (!newNome.trim()) return;
    setCreating(true);
    try {
      const created = await api.post<InboxData>("/api/inboxes", {
        nome: newNome,
        canal: newCanal,
        evolution_instance: newInstance || null,
      });
      setInboxes((prev) => [...prev, created]);
      setShowForm(false);
      setNewNome("");
      setNewCanal("whatsapp");
      setNewInstance("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao criar integração");
    } finally {
      setCreating(false);
    }
  }

  const inputCls = "rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50";

  return (
    <div className="space-y-4 max-w-xl">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl" style={{ background: "rgba(255,255,255,.06)" }} />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {inboxes.map((inbox) => (
            <div
              key={inbox.id}
              className="flex items-center justify-between rounded-xl border border-border/60 bg-surface/60 px-4 py-3"
            >
              <div className="flex flex-col gap-0.5">
                <span className="text-sm font-medium">{inbox.nome}</span>
                <div className="flex items-center gap-2">
                  <span
                    className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                    style={{ background: "rgba(201,169,110,.15)", color: "#c9a96e" }}
                  >
                    {CANAL_LABELS[inbox.canal]}
                  </span>
                  {inbox.evolution_instance && (
                    <span className="text-xs text-muted-foreground">{inbox.evolution_instance}</span>
                  )}
                </div>
              </div>
              <button
                type="button"
                onClick={() => toggleAtivo(inbox)}
                className="relative h-5 w-9 rounded-full transition-colors"
                style={{ background: inbox.ativo ? "#c9a96e" : "rgba(255,255,255,.12)" }}
                title={inbox.ativo ? "Desativar" : "Ativar"}
              >
                <span
                  className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                  style={{ transform: inbox.ativo ? "translateX(18px)" : "translateX(2px)" }}
                />
              </button>
            </div>
          ))}
        </div>
      )}

      {showForm && (
        <div className="rounded-xl border border-border/60 bg-surface/60 p-4 space-y-3">
          <input
            className={inputCls + " w-full"}
            placeholder="Nome da integração"
            value={newNome}
            onChange={(e) => setNewNome(e.target.value)}
          />
          <select
            className={inputCls + " w-full"}
            value={newCanal}
            onChange={(e) => setNewCanal(e.target.value as InboxData["canal"])}
          >
            {CANAIS.map((c) => (
              <option key={c} value={c}>{CANAL_LABELS[c]}</option>
            ))}
          </select>
          <input
            className={inputCls + " w-full"}
            placeholder="Evolution Instance (opcional)"
            value={newInstance}
            onChange={(e) => setNewInstance(e.target.value)}
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !newNome.trim()}
              className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
              style={{ background: "#c9a96e", color: "#0a0f1e" }}
            >
              {creating ? "Criando…" : "Criar"}
            </button>
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-lg px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground"
            >
              Cancelar
            </button>
          </div>
        </div>
      )}

      {!showForm && (
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 rounded-lg border border-border/60 px-3 py-2 text-sm text-muted-foreground hover:bg-surface-elevated transition-colors"
        >
          <Plus className="h-4 w-4" />
          Nova integração
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/configuracoes/IntegracoesTab.tsx
git commit -m "feat(frontend): componente IntegracoesTab"
```

---

### Task 9: Frontend — NotificacoesTab

**Files:**
- Create: `frontend/components/configuracoes/NotificacoesTab.tsx`

- [ ] **Step 1: Criar componente**

```tsx
"use client";

import { useEffect, useState } from "react";
import { api } from "@/lib/api";
import type { PerfilData, NotifPreferences } from "@/types/configuracoes";
import { DEFAULT_NOTIF_PREFERENCES } from "@/types/configuracoes";

const STORAGE_KEY = "alertas_config";

const THRESHOLD_FIELDS: { key: keyof Omit<NotifPreferences, "canal">; label: string; desc: string }[] = [
  { key: "dias_processo", label: "Processos sem andamento", desc: "Alertar após X dias sem movimentação" },
  { key: "dias_lead", label: "Leads sem contato", desc: "Alertar após X dias sem atualização" },
  { key: "dias_prazo", label: "Prazo fatal — antecedência", desc: "Alertar X dias antes do vencimento" },
  { key: "dias_oportunidade", label: "Oportunidades paradas", desc: "Alertar após X dias sem movimentação" },
];

export function NotificacoesTab() {
  const [prefs, setPrefs] = useState<NotifPreferences>(DEFAULT_NOTIF_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<PerfilData>("/api/configuracoes/perfil")
      .then((d) => setPrefs({ ...DEFAULT_NOTIF_PREFERENCES, ...d.notif_preferences }))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  function setField(field: keyof NotifPreferences, value: string | number) {
    setPrefs((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    setSuccess(false);
    try {
      await api.put("/api/configuracoes/perfil", { notif_preferences: prefs });
      // Sync com localStorage para compatibilidade com página Alertas
      try {
        localStorage.setItem(STORAGE_KEY, JSON.stringify({
          dias_processo: prefs.dias_processo,
          dias_lead: prefs.dias_lead,
          dias_prazo: prefs.dias_prazo,
          dias_oportunidade: prefs.dias_oportunidade,
        }));
      } catch {
        // ignore
      }
      setSuccess(true);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao salvar");
    } finally {
      setSaving(false);
    }
  }

  const inputCls = "w-20 rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50 text-center";

  if (loading) {
    return (
      <div className="space-y-4">
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="h-12 animate-pulse rounded-lg" style={{ background: "rgba(255,255,255,.06)" }} />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-lg">
      <div className="space-y-4">
        {THRESHOLD_FIELDS.map(({ key, label, desc }) => (
          <div key={key} className="flex items-center justify-between gap-4">
            <div>
              <p className="text-sm font-medium">{label}</p>
              <p className="text-xs text-muted-foreground">{desc}</p>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="number"
                min={1}
                max={365}
                value={prefs[key]}
                onChange={(e) => setField(key, Number(e.target.value))}
                className={inputCls}
              />
              <span className="text-xs text-muted-foreground">dias</span>
            </div>
          </div>
        ))}
      </div>

      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">Canal de notificação</label>
        <div className="flex gap-2">
          {(["whatsapp", "email"] as const).map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => setField("canal", c)}
              className="rounded-lg px-4 py-2 text-sm font-semibold transition-colors"
              style={
                prefs.canal === c
                  ? { background: "#c9a96e", color: "#0a0f1e" }
                  : { background: "rgba(255,255,255,.08)", border: "1px solid rgba(255,255,255,.1)" }
              }
            >
              {c === "whatsapp" ? "WhatsApp" : "E-mail"}
            </button>
          ))}
        </div>
      </div>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm" style={{ color: "#c9a96e" }}>Salvo com sucesso.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ background: "#c9a96e", color: "#0a0f1e" }}
      >
        {saving ? "Salvando…" : "Salvar"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/configuracoes/NotificacoesTab.tsx
git commit -m "feat(frontend): componente NotificacoesTab"
```

---

### Task 10: Frontend — SegurancaTab

**Files:**
- Create: `frontend/components/configuracoes/SegurancaTab.tsx`

- [ ] **Step 1: Criar componente**

```tsx
"use client";

import { useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-xs font-medium text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className="rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50"
    />
  );
}

export function SegurancaTab() {
  const [novaSenha, setNovaSenha] = useState("");
  const [confirmSenha, setConfirmSenha] = useState("");
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSave() {
    setError(null);
    setSuccess(false);

    if (novaSenha.length < 8) {
      setError("Nova senha deve ter pelo menos 8 caracteres.");
      return;
    }
    if (novaSenha !== confirmSenha) {
      setError("As senhas não coincidem.");
      return;
    }

    setSaving(true);
    try {
      const supabase = createBrowserClient();
      const { error: authError } = await supabase.auth.updateUser({ password: novaSenha });
      if (authError) throw new Error(authError.message);
      setSuccess(true);
      setNovaSenha("");
      setConfirmSenha("");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar senha");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-6 max-w-sm">
      <Field label="Nova senha">
        <Input
          type="password"
          value={novaSenha}
          onChange={(e) => setNovaSenha(e.target.value)}
          placeholder="Mínimo 8 caracteres"
          autoComplete="new-password"
        />
      </Field>
      <Field label="Confirmar nova senha">
        <Input
          type="password"
          value={confirmSenha}
          onChange={(e) => setConfirmSenha(e.target.value)}
          placeholder="Repita a senha"
          autoComplete="new-password"
        />
      </Field>

      {error && <p className="text-sm text-red-400">{error}</p>}
      {success && <p className="text-sm" style={{ color: "#c9a96e" }}>Senha atualizada com sucesso.</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-lg px-4 py-2 text-sm font-semibold transition-opacity disabled:opacity-50"
        style={{ background: "#c9a96e", color: "#0a0f1e" }}
      >
        {saving ? "Salvando…" : "Atualizar senha"}
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/components/configuracoes/SegurancaTab.tsx
git commit -m "feat(frontend): componente SegurancaTab"
```

---

### Task 11: Frontend — página principal com tabs

**Files:**
- Create: `frontend/app/(app)/configuracoes/page.tsx`

- [ ] **Step 1: Criar page.tsx**

```tsx
"use client";

import { useState } from "react";
import { Settings } from "lucide-react";
import { PerfilTab } from "@/components/configuracoes/PerfilTab";
import { EscritorioTab } from "@/components/configuracoes/EscritorioTab";
import { IntegracoesTab } from "@/components/configuracoes/IntegracoesTab";
import { NotificacoesTab } from "@/components/configuracoes/NotificacoesTab";
import { SegurancaTab } from "@/components/configuracoes/SegurancaTab";

type Tab = "perfil" | "escritorio" | "integracoes" | "notificacoes" | "seguranca";

const TABS: { id: Tab; label: string }[] = [
  { id: "perfil", label: "Perfil" },
  { id: "escritorio", label: "Escritório" },
  { id: "integracoes", label: "Integrações" },
  { id: "notificacoes", label: "Notificações" },
  { id: "seguranca", label: "Segurança" },
];

export default function ConfiguracoesPage() {
  const [tab, setTab] = useState<Tab>("perfil");

  return (
    <div className="flex flex-col h-full overflow-y-auto bg-radial-gold">
      {/* Header */}
      <div
        className="border-b px-6 py-4 flex items-center gap-3"
        style={{ borderColor: "rgba(255,255,255,.08)" }}
      >
        <Settings className="h-5 w-5 text-primary" />
        <div>
          <h1 className="text-lg font-semibold tracking-tight">Configurações</h1>
          <p className="text-xs text-muted-foreground">Gerencie seu perfil e preferências</p>
        </div>
      </div>

      {/* Tabs */}
      <div
        className="flex gap-1 border-b px-6 pt-4"
        style={{ borderColor: "rgba(255,255,255,.08)" }}
      >
        {TABS.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            onClick={() => setTab(id)}
            className="pb-3 px-3 text-sm font-medium transition-colors relative"
            style={
              tab === id
                ? { color: "#c9a96e" }
                : { color: "rgba(255,255,255,.45)" }
            }
          >
            {label}
            {tab === id && (
              <span
                className="absolute bottom-0 left-0 right-0 h-0.5 rounded-t-full"
                style={{ background: "#c9a96e" }}
              />
            )}
          </button>
        ))}
      </div>

      {/* Conteúdo */}
      <div className="flex-1 p-6">
        {tab === "perfil" && <PerfilTab />}
        {tab === "escritorio" && <EscritorioTab />}
        {tab === "integracoes" && <IntegracoesTab />}
        {tab === "notificacoes" && <NotificacoesTab />}
        {tab === "seguranca" && <SegurancaTab />}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add frontend/app/(app)/configuracoes/page.tsx
git commit -m "feat(frontend): página /configuracoes com tabs"
```

---

### Task 12: Adicionar Configurações ao AppShell

**Files:**
- Modify: `frontend/components/layout/AppShell.tsx`

- [ ] **Step 1: Adicionar import de Settings e item de nav**

No `AppShell.tsx`, na linha do import de ícones do lucide-react, adicionar `Settings` à lista:

```tsx
import { BarChart2, Bell, FileText, Inbox, KanbanSquare, LayoutDashboard, LogOut, Scale, Settings, Users } from "lucide-react";
```

No array `NAV_ITEMS`, adicionar ao final:

```tsx
{ href: "/configuracoes", label: "Configurações", icon: Settings },
```

- [ ] **Step 2: Verificar no browser**

Iniciar o frontend (`npm run dev` dentro de `frontend/`) e navegar para `/configuracoes`. Verificar:
- Item "Configurações" aparece no sidebar
- Todas as 5 tabs renderizam
- Perfil carrega dados do Supabase
- Salvar Perfil funciona sem erro 500
- Toggle de inbox funciona

- [ ] **Step 3: Commit e push**

```bash
git add frontend/components/layout/AppShell.tsx
git commit -m "feat(frontend): adicionar Configurações ao menu lateral"
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ Perfil (full_name, oab_number, avatar_url, email read-only, role read-only) → Task 6
- ✅ Escritório (nome, oab, logo, endereço, telefone, site, assinatura, rodapé, read-only para não-admin) → Task 7
- ✅ Integrações (listar/criar/toggle inboxes) → Task 8
- ✅ Notificações (thresholds + canal, sync localStorage) → Task 9
- ✅ Segurança (troca senha via Supabase Auth) → Task 10
- ✅ Tabs no topo → Task 11
- ✅ Nav item AppShell → Task 12
- ✅ Migration escritorio + notif_preferences → Task 1
- ✅ Backend endpoints → Tasks 2–4

**Tipos consistentes:** `NotifPreferences` definido em Task 5, usado em Tasks 9 e 2. `PerfilData` definido em Task 5, usado em Tasks 6 e 7. `InboxData` definido em Task 5, usado em Task 8.
