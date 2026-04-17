# Spec — Alertas Inteligentes

**Data:** 2026-04-17
**Status:** Aprovado

---

## Objetivo

Página dedicada `/alertas` que exibe em tempo real situações que exigem atenção do advogado: processos parados, leads sem contato, prazos fatais se aproximando e oportunidades estagnadas no funil. Os limites de tempo são configuráveis pelo usuário e persistidos no `localStorage`.

---

## Contexto

O sistema já tem processos, leads, intimações e oportunidades com campos de data (`updated_at`, `prazo_fatal`) que permitem calcular inatividade e proximidade de prazo diretamente via query no Supabase, sem tabelas adicionais.

---

## Backend

### Endpoint

`GET /api/alertas`

Protegido por `AuthUser`. Recebe 4 query params com valores padrão:

| Param | Padrão | Significado |
|---|---|---|
| `dias_processo` | 30 | Dias sem novo andamento (tabela `andamentos`) |
| `dias_lead` | 7 | Dias sem mudança de status em `leads.updated_at` |
| `dias_prazo` | 5 | Intimações com `prazo_fatal` nos próximos N dias |
| `dias_oportunidade` | 15 | Dias sem mudança de estágio em `oportunidades.updated_at` |

### Estrutura de cada alerta retornado

```python
{
    "tipo": "processo_sem_andamento" | "lead_sem_contato" | "prazo_fatal" | "oportunidade_parada",
    "id": str,           # UUID da entidade
    "titulo": str,       # número CNJ, nome do lead, etc.
    "descricao": str,    # ex: "Sem andamentos há 45 dias"
    "link": str,         # ex: "/processos/abc-123"
    "severidade": "alta" | "media" | "baixa",
    "dias": int,         # dias na condição (para prazo_fatal: dias até o vencimento)
}
```

### Regras de severidade

| Tipo | Baixa | Média | Alta |
|---|---|---|---|
| `processo_sem_andamento` | < 30 dias | 30–60 dias | > 60 dias |
| `lead_sem_contato` | < 7 dias | 7–14 dias | > 14 dias |
| `prazo_fatal` | > 5 dias | 3–5 dias | ≤ 2 dias |
| `oportunidade_parada` | < 15 dias | 15–30 dias | > 30 dias |

> Nota: as regras de severidade são fixas no código. Os thresholds (dias) controlam *quais* registros aparecem, não a cor.

### Queries Supabase

**C1 — Processos sem andamento:**
Duas etapas em Python: (1) buscar todos os `processo_id` distintos em `andamentos` com `created_at >= cutoff`; (2) buscar processos com `status = "ativo"` cujo `id` não esteja nesse conjunto. Inclui processos que nunca tiveram andamento.

**C2 — Leads sem contato:**
Busca leads com `status != "convertido"` e `status != "desqualificado"` cujo `updated_at < now() - dias_lead days`.

**C3 — Prazos fatais próximos:**
Busca intimações com `prazo_fatal` entre hoje e `now() + dias_prazo days` e `prazo_fatal IS NOT NULL`.

**C4 — Oportunidades paradas:**
Busca oportunidades com `estagio != "ganho"` e `estagio != "perdido"` cujo `updated_at < now() - dias_oportunidade days`.

### Arquivo

`backend/app/api/alertas/router.py` — novo módulo com router próprio, registrado em `main.py` com prefixo `/api`.

Funções puras de agregação testáveis sem Supabase (padrão do projeto):
- `_calcular_severidade_processo(dias: int) -> str`
- `_calcular_severidade_lead(dias: int) -> str`
- `_calcular_severidade_prazo(dias: int) -> str`
- `_calcular_severidade_oportunidade(dias: int) -> str`

---

## Frontend

### Novos arquivos

| Arquivo | Ação |
|---|---|
| `frontend/app/(app)/alertas/page.tsx` | Nova página de alertas |
| `frontend/types/alertas.ts` | Tipos `Alerta`, `TipoAlerta`, `SeveridadeAlerta`, `AlertasConfig` |
| `frontend/components/alertas/AlertaCard.tsx` | Card individual de alerta |
| `frontend/components/alertas/AlertasSection.tsx` | Seção colapsável com lista de cards |
| `frontend/components/alertas/ConfigPanel.tsx` | Painel de configuração dos thresholds |

### Modificações

| Arquivo | Mudança |
|---|---|
| `frontend/components/layout/AppShell.tsx` | Adicionar item `{ href: "/alertas", label: "Alertas", icon: Bell }` ao `NAV_ITEMS` |

### Tipos (`frontend/types/alertas.ts`)

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
```

### Página `/alertas`

- Header com título "Alertas", subtítulo "Situações que precisam de atenção", ícone `Bell`
- Botão "Configurar limites" que expande/recolhe o `ConfigPanel`
- Contagem total de alertas no header ("X alertas ativos")
- Seção `AlertasSection` para cada tipo, mostrando apenas as que têm itens
- Skeleton de loading durante fetch
- Mensagem "Nenhum alerta no momento" quando lista vazia

### ConfigPanel

- 4 inputs `type="number"` com `min="1"` para cada threshold
- Labels descritivos: "Processos sem andamento (dias)", etc.
- Botão "Aplicar" que dispara novo fetch e salva em `localStorage`
- Botão "Restaurar padrões" que reseta para `DEFAULT_CONFIG`
- Valores iniciais carregados do `localStorage` ou `DEFAULT_CONFIG`

### AlertasSection

- Título da seção com ícone e contagem (ex: "Processos sem andamento (3)")
- Lista de `AlertaCard`
- Colapsável (estado local)

### AlertaCard

- Badge de severidade colorido (vermelho/âmbar/índigo via `SEVERIDADE_COLORS`)
- Título e descrição
- Link "Ver →" que navega para a entidade

### Badge no menu lateral

`AppShell.tsx`: o item de Alertas exibe um badge numérico vermelho com o total de alertas. O fetch para o badge usa os thresholds padrão (sem config personalizada) para não bloquear a navegação. O badge é carregado com `useEffect` na montagem do componente.

---

## Fora do escopo

- Notificações push ou WhatsApp ao advogado quando um alerta surge
- Configurações de alertas persistidas no banco (usa `localStorage`)
- Histórico de alertas resolvidos
- Alertas por email
