# Spec — Módulo Jurimetria / BI (Analytics)

**Data:** 2026-04-16
**Status:** Aprovado

---

## Objetivo

Adicionar uma página `/analytics` ao Juris AI com visão estratégica do escritório. A página exibe 7 métricas calculadas pelo backend agrupadas em duas seções: CRM/Negócio e Jurídico/Processos. O usuário pode filtrar por período (30 dias, 90 dias ou 1 ano).

---

## Contexto

O dashboard atual (`/dashboard`) é operacional — mostra KPIs de hoje, alertas e atividade recente. O módulo de Analytics é estratégico — mostra tendências, conversão, receita e desempenho jurídico no período selecionado. As duas páginas coexistem; Analytics recebe um novo item no menu lateral.

---

## Banco de Dados

### Migration: campo `resultado` em `processos`

Adicionar coluna nullable `resultado` à tabela `processos` para registrar o desfecho dos processos finalizados:

```sql
ALTER TABLE processos
ADD COLUMN resultado text CHECK (resultado IN (
  'procedente', 'improcedente', 'acordo', 'desistencia'
));
```

- `NULL` = processo em andamento
- Preenchido manualmente ao arquivar/finalizar o processo
- Necessário para calcular taxa de êxito e tempo médio por área

---

## Backend

### Endpoint

```
GET /api/analytics?periodo=30d
```

**Parâmetro `periodo`:** `30d` (default) | `90d` | `365d`

**Arquivo:** `backend/app/api/analytics/router.py`

**Registro em:** `backend/app/main.py` — `app.include_router(analytics_router, prefix="/api/analytics")`

### Resposta JSON

```json
{
  "funil_conversao": {
    "novo": 7,
    "qualificado": 5,
    "convertido": 2,
    "perdido": 1,
    "taxa_conversao_pct": 28.0
  },
  "receita_por_area": [
    { "area": "Trabalhista", "total": 21500.0 },
    { "area": "Empresarial", "total": 25000.0 }
  ],
  "taxa_exito": [
    { "area": "Trabalhista", "exito_pct": 72.0, "total": 10 }
  ],
  "tempo_medio": [
    { "area": "Trabalhista", "media_dias": 547, "total": 10 }
  ],
  "distribuicao_tribunal": [
    { "tribunal": "TJSP", "count": 2 }
  ],
  "origem_leads": [
    { "origem": "whatsapp", "count": 4, "pct": 57.0 }
  ],
  "carteira_ativa": {
    "ativo": 4,
    "suspenso": 0,
    "finalizado": 0,
    "total": 4
  }
}
```

### Lógica de cada métrica

| Métrica | Fonte | Filtro de período | Query |
|---|---|---|---|
| `funil_conversao` | `leads` | `created_at >= agora - periodo` | COUNT por `status`; taxa = convertido/total |
| `receita_por_area` | `oportunidades` | `created_at >= agora - periodo`, status != 'perdido' | SUM(`valor_estimado`) GROUP BY `area_juridica` |
| `taxa_exito` | `processos` | `data_encerramento >= agora - periodo`, `resultado IS NOT NULL` | COUNT WHERE resultado IN ('procedente','acordo') / COUNT total por `area_juridica` |
| `tempo_medio` | `processos` | `data_encerramento >= agora - periodo`, `resultado IS NOT NULL` | AVG(data_encerramento - data_distribuicao) em dias, GROUP BY `area_juridica` |
| `distribuicao_tribunal` | `processos` | sem filtro de período (carteira total) | COUNT GROUP BY `tribunal` |
| `origem_leads` | `leads` | `created_at >= agora - periodo` | COUNT GROUP BY `origem` |
| `carteira_ativa` | `processos` | sem filtro de período | COUNT GROUP BY `status` |

### Autenticação

Endpoint protegido com `Depends(get_current_user)` — mesmo padrão dos demais routers.

---

## Frontend

### Arquivos a criar

| Arquivo | Responsabilidade |
|---|---|
| `frontend/app/(app)/analytics/page.tsx` | Página principal — estado de período, fetch, layout em duas seções |
| `frontend/components/analytics/FunilConversao.tsx` | Barras horizontais escalonadas por status |
| `frontend/components/analytics/ReceitaPorArea.tsx` | Lista com valor formatado em BRL por área |
| `frontend/components/analytics/TaxaExito.tsx` | Lista com % colorido (verde ≥ 60%, amarelo < 60%) |
| `frontend/components/analytics/TempoMedio.tsx` | Lista com duração em meses por área |
| `frontend/components/analytics/DistribuicaoTribunal.tsx` | Lista com count por tribunal |
| `frontend/components/analytics/OrigemLeads.tsx` | Lista com bullet colorido + % por origem |
| `frontend/components/analytics/CarteiraAtiva.tsx` | Contadores por status com badge colorido |
| `frontend/types/analytics.ts` | Tipos TypeScript espelhando o JSON de resposta |

### Arquivos a modificar

| Arquivo | Mudança |
|---|---|
| `frontend/components/layout/AppShell.tsx` | Adicionar `{ href: "/analytics", label: "Analytics", icon: BarChart2 }` ao array `navItems` |
| `backend/app/main.py` | `app.include_router(analytics_router, prefix="/api/analytics", tags=["analytics"])` |

### Layout da página `/analytics`

```
┌─────────────────────────────────────────────────────────────┐
│ Analytics                    [30 dias] [90 dias] [1 ano]    │
│ Visão estratégica do escritório                              │
├─────────────────────────────────────────────────────────────┤
│ CRM / NEGÓCIO                                                │
│ ┌──────────────────┐  ┌──────────────────┐                  │
│ │ Funil de         │  │ Receita por área │                  │
│ │ conversão        │  │ jurídica         │                  │
│ └──────────────────┘  └──────────────────┘                  │
│ ┌──────────────────┐  ┌──────────────────┐                  │
│ │ Origem dos leads │  │ Carteira ativa   │                  │
│ └──────────────────┘  └──────────────────┘                  │
├─────────────────────────────────────────────────────────────┤
│ JURÍDICO / PROCESSOS                                         │
│ ┌──────────────┐  ┌──────────────┐  ┌──────────────┐        │
│ │ Taxa de      │  │ Tempo médio  │  │ Por tribunal │        │
│ │ êxito        │  │              │  │              │        │
│ └──────────────┘  └──────────────┘  └──────────────┘        │
└─────────────────────────────────────────────────────────────┘
```

### Design system

- Seguir tokens do `globals.css`: `#0a0f1e` (bg), `#c9a96e` (gold), `.glass-card`, `.label-caps`
- Gráficos em CSS puro — sem bibliotecas externas (mesmo padrão do `ProcessosBarChart.tsx`)
- Cards com `background: rgba(255,255,255,.04)`, `border: 1px solid rgba(255,255,255,.06)`, `border-radius: 8px`
- Botões de período: ativo com `background: #c9a96e; color: #0a0f1e`, inativo com `background: rgba(255,255,255,.08)`
- Cor de taxa de êxito: `#22c55e` se ≥ 60%, `#f59e0b` se < 60%

### Estado e fetch

- `periodo` como estado local: `'30d' | '90d' | '365d'`
- `useEffect` re-fetch quando `periodo` muda
- Loading state com skeleton ou spinner
- Sem cache especial — fetch simples com `api.get("/api/analytics?periodo=${periodo}")`

---

## Sem novas dependências

Nenhuma biblioteca de gráficos nova. Todo o visual é CSS puro seguindo o padrão já existente no projeto.

---

## Fora do escopo

- Exportação de relatórios (PDF/Excel)
- Comparativo entre períodos
- Alertas baseados em métricas
- Edição do campo `resultado` inline na página de analytics (será feito via página de processos existente)
