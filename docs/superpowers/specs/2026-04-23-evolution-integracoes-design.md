# Spec: Gestão de Instâncias Evolution na Aba Integrações

**Data:** 2026-04-23
**Status:** Aprovado

---

## Visão Geral

Expandir a aba Integrações da página `/configuracoes` para permitir criar instâncias Evolution API, testar conexão e escanear QR code, diretamente no card de cada inbox.

---

## Backend

### Refatoração de `EvolutionClient`

Arquivo: `backend/app/integrations/evolution.py`

Adicionar 4 métodos que aceitam `instance: str` por parâmetro (ao invés do singleton do env):

```python
async def create_instance(self, instance: str) -> dict
    # POST /instance/create  body: {"instanceName": instance, "qrcode": True, "integration": "WHATSAPP-BAILEYS"}

async def get_connection_state(self, instance: str) -> str
    # GET /instance/connectionState/{instance}
    # Retorna: "open" | "close" | "connecting"

async def get_qr_code(self, instance: str) -> str
    # GET /instance/connect/{instance}
    # Retorna base64 da imagem QR (campo "base64" da resposta)

async def delete_instance(self, instance: str) -> dict
    # DELETE /instance/delete/{instance}
```

Compatibilidade: métodos existentes (`check_connection`, `send_text`, etc.) continuam usando `self._instance` do env — sem quebra.

### Novos endpoints em `backend/app/api/inboxes/router.py`

| Método | Rota | Auth | Descrição |
|--------|------|------|-----------|
| POST | `/api/inboxes/{inbox_id}/evolution/create` | AuthUser | Cria instância Evolution + salva `evolution_instance` no inbox |
| GET | `/api/inboxes/{inbox_id}/evolution/status` | AuthUser | Retorna estado da conexão |
| GET | `/api/inboxes/{inbox_id}/evolution/qrcode` | AuthUser | Retorna QR code base64 |
| DELETE | `/api/inboxes/{inbox_id}/evolution/delete` | AuthUser | Remove instância do Evolution |

**Lógica comum:** cada endpoint busca o inbox pelo `inbox_id` → pega `evolution_instance` → passa para `EvolutionClient`. Retorna 404 se inbox não existir, 400 se `evolution_instance` for null quando necessário.

**POST create:** aceita body `{"instance_name": str}` → cria no Evolution → atualiza `inboxes.evolution_instance = instance_name` no Supabase → retorna `{"state": "connecting", "qrcode": "<base64>"}`.

**GET status:** retorna `{"state": "open" | "close" | "connecting" | "unknown"}`.

**GET qrcode:** retorna `{"qrcode": "<base64>"}` ou 409 se já conectado (`state == "open"`).

**DELETE delete:** chama Evolution API → limpa `inboxes.evolution_instance = null` no Supabase.

---

## Frontend

### Tipos

Adicionar em `frontend/types/configuracoes.ts`:

```typescript
export type EvolutionState = "open" | "close" | "connecting" | "unknown";
```

### `IntegracoesTab.tsx` — expansão

Cada inbox card passa a ter estado `expanded: boolean`. Clicar no card alterna expanded.

**Card collapsed** (estado atual — sem mudança visual):
- Nome, badge canal, evolution_instance, toggle ativo/inativo

**Card expanded** (novo painel abaixo do card):

```
┌─────────────────────────────────────────────┐
│ Nome da instância: [___________________]    │
│                                             │
│ Status: ● Conectado / ○ Desconectado        │
│                                             │
│ [Criar instância]  [Testar conexão]         │
│                                             │
│ ┌─────────────────┐  ← QR code (quando     │
│ │   [QR CODE IMG] │     state != "open")    │
│ └─────────────────┘                         │
│                                             │
│ [Remover instância]  ← vermelho, perigoso   │
└─────────────────────────────────────────────┘
```

**Comportamentos:**
- "Criar instância": `POST /api/inboxes/{id}/evolution/create` com `{instance_name}` → atualiza inbox local + inicia polling de status a cada 3s
- Polling para quando `state === "open"` ou usuário fecha o painel
- "Testar conexão": `GET /api/inboxes/{id}/evolution/status` → atualiza badge
- QR code: `GET /api/inboxes/{id}/evolution/qrcode` → exibido como `<img src="data:image/png;base64,{qr}">` — buscado automaticamente após criar instância
- QR some quando `state === "open"`
- "Remover instância": confirmação inline → `DELETE /api/inboxes/{id}/evolution/delete` → limpa `evolution_instance` no estado local

**Estados do badge:**
- `"open"` → `● Conectado` (verde)
- `"connecting"` → `↻ Conectando` (amarelo)
- `"close"` / `"unknown"` → `○ Desconectado` (muted)

---

## Restrições

- Evolution API URL + chave permanecem no `.env` — não expostos na UI
- `EvolutionClient` usa service account (chave global) para todas as instâncias
- Polling usa `setInterval` + `clearInterval` no `useEffect` com cleanup
- QR code base64 não é persistido no banco — buscado on-demand
- "Remover instância" não deleta o inbox, só desvincula a instância Evolution
