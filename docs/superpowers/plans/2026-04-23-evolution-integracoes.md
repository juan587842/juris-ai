# Evolution Integrações Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Expandir a aba Integrações com criação de instâncias Evolution, teste de conexão e exibição de QR code diretamente no card de cada inbox.

**Architecture:** `EvolutionClient` ganha 4 métodos que aceitam `instance` por parâmetro. Router de inboxes ganha 4 endpoints aninhados (`/evolution/*`). `IntegracoesTab` expande cada card com painel de gestão inline.

**Tech Stack:** FastAPI + httpx (backend), Next.js 14 + TypeScript (frontend), Evolution API v2.

---

## Mapa de arquivos

| Ação | Arquivo |
|------|---------|
| Modificar | `backend/app/integrations/evolution.py` |
| Modificar | `backend/app/api/inboxes/router.py` |
| Modificar | `frontend/types/configuracoes.ts` |
| Modificar | `frontend/components/configuracoes/IntegracoesTab.tsx` |

---

### Task 1: Adicionar métodos ao EvolutionClient

**Files:**
- Modify: `backend/app/integrations/evolution.py`

- [ ] **Step 1: Ler o arquivo atual**

Ler `backend/app/integrations/evolution.py` para ter o conteúdo exato em contexto antes de editar.

- [ ] **Step 2: Adicionar 4 métodos à classe `EvolutionClient`**

Inserir após o método `check_connection` (antes de `# ─── HTTP helpers`):

```python
async def create_instance(self, instance: str) -> dict[str, Any]:
    """Cria instância no Evolution e retorna qrcode base64."""
    payload = {
        "instanceName": instance,
        "qrcode": True,
        "integration": "WHATSAPP-BAILEYS",
    }
    return await self._post("/instance/create", payload)

async def get_connection_state(self, instance: str) -> str:
    """Retorna 'open' | 'close' | 'connecting'."""
    try:
        data = await self._get(f"/instance/connectionState/{instance}")
        return data.get("instance", {}).get("state", "close")
    except Exception:
        return "close"

async def get_qr_code(self, instance: str) -> str:
    """Retorna base64 do QR code. Levanta ValueError se já conectado."""
    data = await self._get(f"/instance/connect/{instance}")
    if "base64" not in data:
        raise ValueError("Instância já conectada ou QR indisponível")
    return data["base64"]

async def delete_instance(self, instance: str) -> dict[str, Any]:
    """Remove instância do servidor Evolution."""
    return await self._delete(f"/instance/delete/{instance}")
```

Também adicionar o método `_delete` nos HTTP helpers:

```python
async def _delete(self, path: str) -> dict[str, Any]:
    async with httpx.AsyncClient(timeout=10) as client:
        resp = await client.delete(
            f"{self._base_url}{path}",
            headers=self._headers,
        )
        resp.raise_for_status()
        return resp.json()
```

- [ ] **Step 3: Commit**

```bash
git add backend/app/integrations/evolution.py
git commit -m "feat(evolution): create_instance, get_connection_state, get_qr_code, delete_instance"
```

---

### Task 2: Endpoints Evolution no router de inboxes

**Files:**
- Modify: `backend/app/api/inboxes/router.py`

- [ ] **Step 1: Ler o arquivo atual**

Ler `backend/app/api/inboxes/router.py` para ter conteúdo exato em contexto.

- [ ] **Step 2: Adicionar import de EvolutionClient e Pydantic model**

No topo do arquivo, adicionar após os imports existentes:

```python
from app.integrations.evolution import get_evolution_client
```

Adicionar modelo Pydantic após `InboxUpdate`:

```python
class EvolutionCreateBody(BaseModel):
    instance_name: str
```

- [ ] **Step 3: Adicionar helper `_get_inbox`**

Adicionar função helper após `InboxUpdate`:

```python
async def _get_inbox(inbox_id: str) -> dict:
    supabase = await get_supabase()
    res = (
        await supabase.table("inboxes")
        .select("*")
        .eq("id", inbox_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Inbox não encontrado")
    return res.data
```

- [ ] **Step 4: Adicionar 4 endpoints Evolution**

Adicionar ao final do arquivo:

```python
# ── Evolution API ─────────────────────────────────────────────────────────────

@router.post("/{inbox_id}/evolution/create")
async def evolution_create(
    _user: AuthUser, inbox_id: str, body: EvolutionCreateBody
) -> dict:
    await _get_inbox(inbox_id)
    evo = get_evolution_client()
    try:
        result = await evo.create_instance(body.instance_name)
    except Exception as exc:
        logger.error("Erro ao criar instância Evolution %s: %s", body.instance_name, exc)
        raise HTTPException(status_code=502, detail="Erro ao comunicar com Evolution API") from exc

    supabase = await get_supabase()
    await (
        supabase.table("inboxes")
        .update({"evolution_instance": body.instance_name})
        .eq("id", inbox_id)
        .execute()
    )

    qrcode = result.get("qrcode", {}).get("base64") or ""
    return {"state": "connecting", "qrcode": qrcode}


@router.get("/{inbox_id}/evolution/status")
async def evolution_status(_user: AuthUser, inbox_id: str) -> dict:
    inbox = await _get_inbox(inbox_id)
    instance = inbox.get("evolution_instance")
    if not instance:
        raise HTTPException(status_code=400, detail="Inbox não tem instância Evolution configurada")
    evo = get_evolution_client()
    state = await evo.get_connection_state(instance)
    return {"state": state}


@router.get("/{inbox_id}/evolution/qrcode")
async def evolution_qrcode(_user: AuthUser, inbox_id: str) -> dict:
    inbox = await _get_inbox(inbox_id)
    instance = inbox.get("evolution_instance")
    if not instance:
        raise HTTPException(status_code=400, detail="Inbox não tem instância Evolution configurada")
    evo = get_evolution_client()
    try:
        qr = await evo.get_qr_code(instance)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Erro ao obter QR code para %s: %s", instance, exc)
        raise HTTPException(status_code=502, detail="Erro ao comunicar com Evolution API") from exc
    return {"qrcode": qr}


@router.delete("/{inbox_id}/evolution/delete")
async def evolution_delete(_user: AuthUser, inbox_id: str) -> dict:
    inbox = await _get_inbox(inbox_id)
    instance = inbox.get("evolution_instance")
    if not instance:
        raise HTTPException(status_code=400, detail="Inbox não tem instância Evolution configurada")
    evo = get_evolution_client()
    try:
        await evo.delete_instance(instance)
    except Exception as exc:
        logger.error("Erro ao deletar instância Evolution %s: %s", instance, exc)
        raise HTTPException(status_code=502, detail="Erro ao comunicar com Evolution API") from exc

    supabase = await get_supabase()
    await (
        supabase.table("inboxes")
        .update({"evolution_instance": None})
        .eq("id", inbox_id)
        .execute()
    )
    return {"ok": True}
```

- [ ] **Step 5: Commit**

```bash
git add backend/app/api/inboxes/router.py
git commit -m "feat(backend): endpoints Evolution create/status/qrcode/delete por inbox"
```

---

### Task 3: Adicionar EvolutionState ao tipos frontend

**Files:**
- Modify: `frontend/types/configuracoes.ts`

- [ ] **Step 1: Ler o arquivo atual**

Ler `frontend/types/configuracoes.ts`.

- [ ] **Step 2: Adicionar tipo**

Ao final do arquivo, adicionar:

```typescript
export type EvolutionState = "open" | "close" | "connecting" | "unknown";
```

- [ ] **Step 3: Commit**

```bash
git add frontend/types/configuracoes.ts
git commit -m "feat(frontend): tipo EvolutionState"
```

---

### Task 4: Expandir IntegracoesTab com painel Evolution

**Files:**
- Modify: `frontend/components/configuracoes/IntegracoesTab.tsx`

- [ ] **Step 1: Ler o arquivo atual**

Ler `frontend/components/configuracoes/IntegracoesTab.tsx` completo.

- [ ] **Step 2: Reescrever o arquivo completo**

Substituir o conteúdo inteiro por:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, ChevronRight, Plus } from "lucide-react";
import { api } from "@/lib/api";
import type { InboxData, EvolutionState } from "@/types/configuracoes";
import { CANAL_LABELS } from "@/types/configuracoes";

const CANAIS: InboxData["canal"][] = ["whatsapp", "webchat", "email"];

// ── Estado por inbox ──────────────────────────────────────────────────────────

interface InboxPanelState {
  instanceName: string;
  state: EvolutionState;
  qrcode: string | null;
  creating: boolean;
  testing: boolean;
  deleting: boolean;
  loadingQr: boolean;
}

function makePanel(inbox: InboxData): InboxPanelState {
  return {
    instanceName: inbox.evolution_instance ?? "",
    state: "unknown",
    qrcode: null,
    creating: false,
    testing: false,
    deleting: false,
    loadingQr: false,
  };
}

// ── Badge de estado ───────────────────────────────────────────────────────────

function StateBadge({ state }: { state: EvolutionState }) {
  const map: Record<EvolutionState, { label: string; color: string }> = {
    open:       { label: "Conectado",    color: "#22c55e" },
    connecting: { label: "Conectando…", color: "#f59e0b" },
    close:      { label: "Desconectado", color: "rgba(255,255,255,.35)" },
    unknown:    { label: "Desconhecido", color: "rgba(255,255,255,.35)" },
  };
  const { label, color } = map[state];
  return (
    <span className="flex items-center gap-1.5 text-xs font-medium" style={{ color }}>
      <span className="h-1.5 w-1.5 rounded-full" style={{ background: color }} />
      {label}
    </span>
  );
}

// ── Painel Evolution por inbox ────────────────────────────────────────────────

function EvolutionPanel({
  inbox,
  panel,
  onChange,
  onInboxUpdate,
}: {
  inbox: InboxData;
  panel: InboxPanelState;
  onChange: (patch: Partial<InboxPanelState>) => void;
  onInboxUpdate: (patch: Partial<InboxData>) => void;
}) {
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  function stopPolling() {
    if (pollRef.current) {
      clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();
    pollRef.current = setInterval(async () => {
      try {
        const res = await api.get<{ state: EvolutionState }>(
          `/api/inboxes/${inbox.id}/evolution/status`
        );
        onChange({ state: res.state });
        if (res.state === "open") {
          onChange({ qrcode: null });
          stopPolling();
        }
      } catch {
        // ignore transient errors
      }
    }, 3000);
  }

  useEffect(() => () => stopPolling(), []);

  async function handleCreate() {
    if (!panel.instanceName.trim()) return;
    onChange({ creating: true });
    try {
      const res = await api.post<{ state: EvolutionState; qrcode: string }>(
        `/api/inboxes/${inbox.id}/evolution/create`,
        { instance_name: panel.instanceName.trim() }
      );
      onInboxUpdate({ evolution_instance: panel.instanceName.trim() });
      onChange({ state: res.state, qrcode: res.qrcode || null, creating: false });
      if (res.state !== "open") startPolling();
    } catch (e: unknown) {
      onChange({ creating: false });
      alert(e instanceof Error ? e.message : "Erro ao criar instância");
    }
  }

  async function handleTest() {
    onChange({ testing: true });
    try {
      const res = await api.get<{ state: EvolutionState }>(
        `/api/inboxes/${inbox.id}/evolution/status`
      );
      onChange({ state: res.state, testing: false });
    } catch {
      onChange({ state: "unknown", testing: false });
    }
  }

  async function handleDelete() {
    if (!confirm(`Remover instância "${inbox.evolution_instance}" do Evolution?`)) return;
    onChange({ deleting: true });
    try {
      await api.delete(`/api/inboxes/${inbox.id}/evolution/delete`);
      onInboxUpdate({ evolution_instance: null });
      onChange({ instanceName: "", state: "unknown", qrcode: null, deleting: false });
      stopPolling();
    } catch (e: unknown) {
      onChange({ deleting: false });
      alert(e instanceof Error ? e.message : "Erro ao remover instância");
    }
  }

  const inputCls =
    "rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50";

  const hasInstance = !!inbox.evolution_instance;

  return (
    <div
      className="mt-2 rounded-xl border border-border/40 bg-surface/40 p-4 space-y-4"
    >
      {/* Nome da instância */}
      <div className="flex flex-col gap-1.5">
        <label className="text-xs font-medium text-muted-foreground">
          Nome da instância Evolution
        </label>
        <input
          className={inputCls + " w-full"}
          value={panel.instanceName}
          onChange={(e) => onChange({ instanceName: e.target.value })}
          placeholder="Ex: juris-escritorio"
          disabled={hasInstance}
        />
      </div>

      {/* Status + botões */}
      <div className="flex items-center gap-3 flex-wrap">
        {hasInstance && <StateBadge state={panel.state} />}

        {!hasInstance && (
          <button
            type="button"
            onClick={handleCreate}
            disabled={panel.creating || !panel.instanceName.trim()}
            className="rounded-lg px-3 py-1.5 text-sm font-semibold disabled:opacity-50"
            style={{ background: "#c9a96e", color: "#0a0f1e" }}
          >
            {panel.creating ? "Criando…" : "Criar instância"}
          </button>
        )}

        {hasInstance && (
          <button
            type="button"
            onClick={handleTest}
            disabled={panel.testing}
            className="rounded-lg border border-border/60 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {panel.testing ? "Testando…" : "Testar conexão"}
          </button>
        )}

        {hasInstance && panel.state !== "open" && (
          <button
            type="button"
            onClick={async () => {
              onChange({ loadingQr: true });
              try {
                const res = await api.get<{ qrcode: string }>(
                  `/api/inboxes/${inbox.id}/evolution/qrcode`
                );
                onChange({ qrcode: res.qrcode, loadingQr: false });
                startPolling();
              } catch {
                onChange({ loadingQr: false });
              }
            }}
            disabled={panel.loadingQr}
            className="rounded-lg border border-border/60 px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50"
          >
            {panel.loadingQr ? "Carregando…" : "Ver QR Code"}
          </button>
        )}
      </div>

      {/* QR Code */}
      {panel.qrcode && panel.state !== "open" && (
        <div className="flex flex-col items-start gap-2">
          <p className="text-xs text-muted-foreground">
            Escaneie com o WhatsApp para conectar
          </p>
          <img
            src={panel.qrcode}
            alt="QR Code WhatsApp"
            className="rounded-lg"
            style={{ width: 200, height: 200 }}
          />
        </div>
      )}

      {/* Remover instância */}
      {hasInstance && (
        <div className="pt-2 border-t border-border/40">
          <button
            type="button"
            onClick={handleDelete}
            disabled={panel.deleting}
            className="text-xs text-red-400 hover:text-red-300 transition-colors disabled:opacity-50"
          >
            {panel.deleting ? "Removendo…" : "Remover instância"}
          </button>
        </div>
      )}
    </div>
  );
}

// ── IntegracoesTab ─────────────────────────────────────────────────────────────

export function IntegracoesTab() {
  const [inboxes, setInboxes] = useState<InboxData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [newNome, setNewNome] = useState("");
  const [newCanal, setNewCanal] = useState<InboxData["canal"]>("whatsapp");
  const [newInstance, setNewInstance] = useState("");
  const [creating, setCreating] = useState(false);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [panels, setPanels] = useState<Record<string, InboxPanelState>>({});

  function loadInboxes() {
    setLoading(true);
    api
      .get<{ inboxes: InboxData[] }>("/api/inboxes")
      .then((d) => {
        setInboxes(d.inboxes);
        const initial: Record<string, InboxPanelState> = {};
        for (const inbox of d.inboxes) initial[inbox.id] = makePanel(inbox);
        setPanels(initial);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(loadInboxes, []);

  function patchPanel(id: string, patch: Partial<InboxPanelState>) {
    setPanels((prev) => ({ ...prev, [id]: { ...prev[id], ...patch } }));
  }

  function patchInbox(id: string, patch: Partial<InboxData>) {
    setInboxes((prev) =>
      prev.map((i) => (i.id === id ? { ...i, ...patch } : i))
    );
  }

  async function toggleAtivo(inbox: InboxData) {
    try {
      await api.put(`/api/inboxes/${inbox.id}`, { ativo: !inbox.ativo });
      patchInbox(inbox.id, { ativo: !inbox.ativo });
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
      setPanels((prev) => ({ ...prev, [created.id]: makePanel(created) }));
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

  const inputCls =
    "rounded-lg border border-border/60 bg-surface-elevated px-3 py-2 text-sm outline-none focus:ring-1 focus:ring-primary/50";

  return (
    <div className="space-y-4 max-w-xl">
      {error && <p className="text-sm text-red-400">{error}</p>}

      {loading ? (
        <div className="space-y-3">
          {[1, 2].map((i) => (
            <div
              key={i}
              className="h-14 animate-pulse rounded-xl"
              style={{ background: "rgba(255,255,255,.06)" }}
            />
          ))}
        </div>
      ) : (
        <div className="space-y-2">
          {inboxes.map((inbox) => {
            const expanded = expandedId === inbox.id;
            return (
              <div key={inbox.id}>
                <div
                  className="flex items-center justify-between rounded-xl border border-border/60 bg-surface/60 px-4 py-3 cursor-pointer hover:bg-surface-elevated/40 transition-colors"
                  onClick={() => setExpandedId(expanded ? null : inbox.id)}
                >
                  <div className="flex items-center gap-2">
                    {expanded ? (
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    ) : (
                      <ChevronRight className="h-3.5 w-3.5 text-muted-foreground" />
                    )}
                    <div className="flex flex-col gap-0.5">
                      <span className="text-sm font-medium">{inbox.nome}</span>
                      <div className="flex items-center gap-2">
                        <span
                          className="rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider"
                          style={{
                            background: "rgba(201,169,110,.15)",
                            color: "#c9a96e",
                          }}
                        >
                          {CANAL_LABELS[inbox.canal]}
                        </span>
                        {inbox.evolution_instance && (
                          <span className="text-xs text-muted-foreground">
                            {inbox.evolution_instance}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleAtivo(inbox);
                    }}
                    className="relative h-5 w-9 rounded-full transition-colors"
                    style={{
                      background: inbox.ativo
                        ? "#c9a96e"
                        : "rgba(255,255,255,.12)",
                    }}
                    title={inbox.ativo ? "Desativar" : "Ativar"}
                  >
                    <span
                      className="absolute top-0.5 h-4 w-4 rounded-full bg-white transition-transform"
                      style={{
                        transform: inbox.ativo
                          ? "translateX(18px)"
                          : "translateX(2px)",
                      }}
                    />
                  </button>
                </div>

                {expanded && panels[inbox.id] && (
                  <EvolutionPanel
                    inbox={inbox}
                    panel={panels[inbox.id]}
                    onChange={(patch) => patchPanel(inbox.id, patch)}
                    onInboxUpdate={(patch) => patchInbox(inbox.id, patch)}
                  />
                )}
              </div>
            );
          })}
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
              <option key={c} value={c}>
                {CANAL_LABELS[c]}
              </option>
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

- [ ] **Step 3: Commit e push**

```bash
git add frontend/components/configuracoes/IntegracoesTab.tsx
git commit -m "feat(frontend): painel Evolution inline no card de cada inbox"
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ `EvolutionClient.create_instance` → Task 1
- ✅ `EvolutionClient.get_connection_state` → Task 1
- ✅ `EvolutionClient.get_qr_code` → Task 1
- ✅ `EvolutionClient.delete_instance` → Task 1
- ✅ `POST /evolution/create` salva `evolution_instance` → Task 2
- ✅ `GET /evolution/status` → Task 2
- ✅ `GET /evolution/qrcode` → Task 2 (retorna 409 se já conectado)
- ✅ `DELETE /evolution/delete` limpa `evolution_instance` → Task 2
- ✅ `EvolutionState` tipo → Task 3
- ✅ Card expandível com painel → Task 4
- ✅ Campo nome instância (disabled se já existe) → Task 4
- ✅ Botão "Criar instância" → Task 4
- ✅ Badge de estado (open/connecting/close/unknown) → Task 4
- ✅ Botão "Testar conexão" → Task 4
- ✅ QR code inline → Task 4
- ✅ Polling a cada 3s, para quando `state === "open"` → Task 4
- ✅ `clearInterval` no cleanup do useEffect → Task 4
- ✅ Botão "Remover instância" (vermelho) → Task 4
- ✅ Toggle ativo/inativo preservado → Task 4

**Tipos consistentes:**
- `EvolutionState` definido em Task 3, usado em Task 4 ✓
- `InboxPanelState.state: EvolutionState` ✓
- `api.post<{ state: EvolutionState; qrcode: string }>` bate com `evolution_create` retornando `{"state": ..., "qrcode": ...}` ✓
- `api.get<{ state: EvolutionState }>` bate com `evolution_status` retornando `{"state": ...}` ✓
- `api.get<{ qrcode: string }>` bate com `evolution_qrcode` retornando `{"qrcode": ...}` ✓
