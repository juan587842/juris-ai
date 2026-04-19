# Spec: Jurimetria / Analytics — Expansão de Métricas

**Data:** 2026-04-19
**Módulo:** Analytics (`/analytics`)
**Abordagem:** Expandir endpoint existente + nova seção no frontend

---

## Objetivo

Preencher os cards vazios da página `/analytics` com dados reais de processos finalizados e adicionar uma nova seção de métricas de atendimento via chat.

---

## Escopo

### O que muda

**Backend** — `backend/app/api/analytics/router.py`
- Adicionar 2 campos ao objeto de resposta existente: `taxa_exito` e `tempo_medio_dias`
- Adicionar bloco `atendimento` com 3 métricas calculadas

**Frontend** — `frontend/app/(app)/analytics/page.tsx`
- Preencher os cards "Taxa de êxito" e "Tempo médio" com valores reais
- Adicionar seção **"ATENDIMENTO / CHAT"** com 3 cards

### O que NÃO muda

- Schema do banco (sem migrations)
- Outros endpoints
- Outros componentes da página

---

## Backend — Novos campos no response

### Taxa de êxito (`taxa_exito`)

```
processos WHERE status = 'finalizado' AND resultado IN ('ganho', 'parcialmente_ganho')
────────────────────────────────────────────────────────────────────────────────────
processos WHERE status = 'finalizado'
```

- Retorna `null` se não houver processos finalizados (evita divisão por zero)
- Tipo: `float | None` (0.0 a 1.0, ex: 0.75 = 75%)

### Tempo médio (`tempo_medio_dias`)

- Média de `(updated_at - created_at)` em dias para processos com `status = 'finalizado'`
- Retorna `null` se não houver processos finalizados
- Tipo: `float | None`

### Atendimento (`atendimento`)

| Campo | Cálculo | Tipo |
|---|---|---|
| `volume_conversas` | `COUNT(*)` em `conversations` no período | `int` |
| `pct_transbordo` | conversas com `ai_enabled = false` ÷ total | `float \| None` |
| `tempo_medio_resposta_segundos` | média de (1ª msg bot - 1ª msg lead) por conversa | `float \| None` |

Para `tempo_medio_resposta_segundos`: considerar apenas conversas onde existe pelo menos uma mensagem de lead seguida de uma mensagem de bot. Conversas sem resposta bot são ignoradas.

---

## Frontend — Mudanças na página

### Cards existentes corrigidos

**Taxa de êxito:** exibir `"X%"` quando `taxa_exito != null`, ou `"Sem processos finalizados"` quando `null`.

**Tempo médio:** exibir `"X dias"` quando `tempo_medio_dias != null`, ou `"Sem processos finalizados"` quando `null`.

### Nova seção: ATENDIMENTO / CHAT

Posição: abaixo de "JURÍDICO / PROCESSOS", seguindo o mesmo padrão visual.

3 cards horizontais:

| Card | Valor exibido | Fallback |
|---|---|---|
| Volume de conversas | `N conversas` | `"0 conversas"` |
| Transbordo para humano | `X%` | `"—"` |
| Tempo médio de resposta | `X segundos` ou `X min` | `"—"` |

---

## Testes

- Teste unitário para a função de cálculo de `taxa_exito` — caso com dados, caso sem finalizados
- Teste unitário para `tempo_medio_resposta_segundos` — caso normal, caso sem mensagem bot
- TypeScript sem erros no frontend (`tsc --noEmit`)

---

## Fora do escopo

- Análise preditiva / ML
- Rentabilidade por honorários
- Breakdown por área jurídica ou tribunal (mantém o que já existe)
