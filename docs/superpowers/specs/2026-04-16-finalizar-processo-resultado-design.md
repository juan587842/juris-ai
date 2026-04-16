# Spec — Finalizar Processo com Resultado

**Data:** 2026-04-16
**Status:** Aprovado

---

## Objetivo

Permitir que o advogado registre o desfecho de um processo judicial ao finalizá-lo. O campo `resultado` alimenta as métricas de taxa de êxito e tempo médio de resolução no módulo Analytics.

---

## Contexto

O campo `resultado` foi adicionado ao banco na migration `20260416120000_analytics_resultado_processos.sql`, mas não há UI para preenchê-lo. O módulo Analytics exibe "Sem processos finalizados" porque nenhum processo tem `resultado != NULL`.

A página de detalhe do processo já tem botões "Editar processo" (`EditarProcessoModal`) e "Arquivar" (`ConfirmDialog`). O novo botão "Finalizar" segue o mesmo padrão.

---

## Backend

### Alteração em `ProcessoUpdate`

Adicionar campo `resultado` opcional ao modelo Pydantic:

```python
# backend/app/models/processos.py
class ProcessoUpdate(BaseModel):
    cliente_id: UUID | None = None
    advogado_id: UUID | None = None
    tribunal: str | None = Field(default=None, max_length=200)
    vara: str | None = Field(default=None, max_length=200)
    area_juridica: AreaJuridica | None = None
    status: ProcessoStatus | None = None
    resultado: Literal["procedente", "improcedente", "acordo", "desistencia"] | None = None
```

O endpoint `PATCH /api/processos/{id}` já persiste todos os campos de `ProcessoUpdate` — nenhuma outra mudança no backend é necessária.

### Alteração em `ProcessoOut`

Adicionar campo `resultado` ao modelo de resposta para que o frontend receba o valor após salvar:

```python
class ProcessoOut(BaseModel):
    ...
    resultado: Literal["procedente", "improcedente", "acordo", "desistencia"] | None = None
    ...
```

---

## Frontend

### 1. `frontend/types/processos.ts`

Adicionar tipo `ResultadoProcesso` e campo na interface `Processo`:

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

// Na interface Processo, adicionar:
resultado: ResultadoProcesso | null;
```

### 2. `frontend/components/processos/FinalizarProcessoModal.tsx` (novo)

Modal com select de resultado obrigatório. Ao salvar, faz PATCH com `{ status: "finalizado", resultado }`.

**Props:**
```typescript
interface Props {
  open: boolean;
  onClose: () => void;
  processo: Processo;
  onUpdated: (p: Processo) => void;
}
```

**Comportamento:**
- Select com 4 opções (RESULTADO_LABELS)
- Botão "Finalizar processo" desabilitado enquanto nenhuma opção selecionada
- Exibe erro inline se a requisição falhar
- Ao sucesso: chama `onUpdated(updated)` e `onClose()`

**Payload enviado:**
```typescript
api.patch<Processo>(`/api/processos/${processo.id}`, {
  status: "finalizado",
  resultado: resultado,
})
```

### 3. `frontend/components/processos/ProcessoDetail.tsx`

**Botão "Finalizar":** aparece no header quando `localProcesso.status !== "finalizado" && localProcesso.status !== "arquivado"`. Posicionado entre "Editar" e "Arquivar".

Ícone sugerido: `CheckCircle` (lucide-react).

**Exibição do resultado:** quando `localProcesso.resultado !== null`, exibir badge no header ao lado do badge de status. Cores:
- `procedente` / `acordo` → verde (`#22c55e`)
- `improcedente` / `desistencia` → amarelo (`#f59e0b`)

Labels via `RESULTADO_LABELS`.

---

## Fluxo do usuário

1. Advogado entra na página `/processos/:id`
2. Clica em "Finalizar processo"
3. Modal abre com select "Resultado" (vazio por padrão)
4. Seleciona o resultado e clica em "Finalizar processo"
5. Processo atualizado: status = "finalizado", resultado preenchido
6. Modal fecha, header atualiza com badge do resultado
7. Botão "Finalizar" some (status já é finalizado)
8. Analytics passa a contar este processo em taxa de êxito e tempo médio

---

## Fora do escopo

- Edição do resultado após finalização (o botão "Finalizar" some quando status é finalizado)
- Notificação automática ao cliente ao finalizar
- Log de auditoria da finalização
