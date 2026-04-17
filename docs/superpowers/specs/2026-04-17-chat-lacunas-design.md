# Chat — Completar Lacunas (Filtro, Busca, Retomar IA)

**Data:** 2026-04-17  
**Escopo:** Grupo a de melhorias no módulo de Chat existente

---

## Problema

O módulo de Chat está funcional mas apresenta três lacunas operacionais:

1. Sem filtro por status na lista de conversas — o agente não consegue focar nas conversas "Em atendimento" sem percorrer a lista inteira.
2. Sem busca por nome/telefone — localizar um lead específico exige scroll manual.
3. Sem botão "Retomar IA" — depois de assumir manualmente uma conversa (`ai_enabled = false`), não há como devolvê-la à IA pela UI.

---

## Abordagem

Client-side filtering sobre o array já carregado via Supabase Realtime.  
Sem novos endpoints. Sem quebra de realtime.

---

## Design

### 1. `ConversationList` — Filtro de status + Busca

**Novo estado local:**
```ts
const [filter, setFilter] = useState<ConversationStatus | "todos">("todos")
const [search, setSearch] = useState("")
```

**Pipeline de filtragem (em memória, a cada render):**
```ts
const visible = conversations
  .filter(c => filter === "todos" || c.status === filter)
  .filter(c => {
    if (!search) return true
    const q = search.toLowerCase()
    return (
      c.leads?.nome?.toLowerCase().includes(q) ||
      c.leads?.telefone?.includes(q)
    )
  })
```

**Layout da aside (de cima para baixo):**
1. Campo de busca com ícone `Search` — `placeholder="Buscar por nome ou telefone…"`
2. Tabs pill: `Todos · Aberta · Atendimento · Pendente`
   - Cada tab exibe badge com contagem do status correspondente (calculada sobre `conversations` completo, não sobre `visible`)
   - Tab ativa: borda inferior `border-primary text-primary`
3. Lista filtrada abaixo

**Busca:** `includes` case-insensitive em `lead.nome` e `lead.telefone`. Sem debounce (lista ≤ 60 itens).

---

### 2. `ConversationHeader` — Botão Retomar IA

**Lógica de renderização dos botões de ação:**

```
ai_enabled === true  → [Assumir conversa] [Resolver]
ai_enabled === false → [Retomar IA]       [Resolver]
```

- "Assumir conversa": chama `POST /api/conversations/{id}/pause-ai` → `ai_enabled = false`
- "Retomar IA": chama `POST /api/conversations/{id}/resume-ai` → `ai_enabled = true`
- "Resolver": chama `POST /api/conversations/{id}/resolve` → `status = "resolvida"`

**Novos props em `ConversationHeader`:**
```ts
onResumeAI: () => void   // novo
```

**`InboxView` — novo handler:**
```ts
async function handleResumeAI() {
  if (!selected) return
  await apiAction(`/api/conversations/${selected.id}/resume-ai`)
  setSelected(prev => prev ? { ...prev, ai_enabled: true } : prev)
}
```

---

## Arquivos Modificados

| Arquivo | Mudança |
|---|---|
| `frontend/components/chat/ConversationList.tsx` | + estado filter/search, + barra de busca, + tabs pill |
| `frontend/components/chat/ConversationHeader.tsx` | + prop `onResumeAI`, lógica condicional de botões |
| `frontend/components/chat/InboxView.tsx` | + handler `handleResumeAI`, passa prop para ConversationHeader |

---

## Fora de Escopo

- Filtro server-side / paginação
- Busca full-text no banco
- Drawer de detalhes do lead
- Suporte a mídia (fase c)
- Melhorias no agente IA (fase b)
