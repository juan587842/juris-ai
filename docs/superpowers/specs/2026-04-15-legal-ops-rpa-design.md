# Spec — Fase 8: Legal Ops / RPA (Monitoramento de Processos)

**Data:** 2026-04-15  
**Status:** Aprovado  
**Escopo:** Backend (RPA + scheduler) + Frontend (aba Monitoramento) + Banco de dados

---

## 1. Objetivo

Implementar monitoramento automático de processos judiciais com:
- Scraping do DJEN (gratuito) como provider padrão
- Stub da API Jusbrasil pronto para ativação futura via chave de API
- Alertas via WhatsApp (Evolution API) para o advogado e, opcionalmente, para o cliente
- Extração de texto de PDFs de decisões usando pdfplumber
- Tradução do "juridiquês" para linguagem simples pela IA antes de notificar o cliente

---

## 2. Banco de Dados

### 2.1 Alterações em tabelas existentes

**`processos`** — adicionar colunas:
```sql
monitorar               BOOLEAN NOT NULL DEFAULT false
notificar_cliente       BOOLEAN NOT NULL DEFAULT false
ultima_verificacao_at   TIMESTAMPTZ  -- fuso: America/Sao_Paulo em toda a aplicação
```

**`andamentos`** — adicionar colunas:
```sql
pdf_url                 TEXT         -- URL do PDF da decisão (quando houver)
pdf_texto               TEXT         -- texto extraído pelo pdfplumber
notificado_advogado_at  TIMESTAMPTZ  -- quando o WhatsApp foi enviado ao advogado
notificado_cliente_at   TIMESTAMPTZ  -- quando o WhatsApp foi enviado ao cliente
origem                  TEXT NOT NULL DEFAULT 'manual'  -- 'manual' | 'rpa'
```

**`intimacoes`** — adicionar coluna:
```sql
notificado_advogado_at  TIMESTAMPTZ
```

### 2.2 Nova tabela: `monitoramento_logs`

Histórico de cada ciclo de verificação do robô. Serve para diagnóstico sem incomodar o advogado.

```sql
CREATE TABLE monitoramento_logs (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id     UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  provider        TEXT NOT NULL,           -- 'djen' | 'jusbrasil'
  status          TEXT NOT NULL,           -- 'ok' | 'erro' | 'sem_novidade'
  movimentacoes_encontradas INT DEFAULT 0,
  erro_msg        TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

RLS: habilitado, acesso apenas para `authenticated`.

### 2.3 Fuso horário

Todos os `TIMESTAMPTZ` são gravados em UTC no PostgreSQL (padrão), mas toda lógica Python usa `pytz.timezone('America/Sao_Paulo')` para cálculos e exibição. O APScheduler também é configurado com `timezone='America/Sao_Paulo'`. Isso garante que VPS na Europa e banco no Brasil não gerem conflito.

---

## 3. Backend

### 3.1 Estrutura de arquivos em `backend/app/rpa/`

```
rpa/
  __init__.py
  providers/
    __init__.py
    base.py          ← classe abstrata MonitoramentoProvider
    djen.py          ← implementação gratuita: requests + BeautifulSoup no DJEN
    jusbrasil.py     ← stub: levanta NotImplementedError com instrução de configurar JUSBRASIL_API_KEY
  scheduler.py       ← APScheduler com timezone America/Sao_Paulo, job a cada hora
  monitoramento.py   ← orquestração principal
  pdf_extractor.py   ← pdfplumber: download + extração de texto
  notificador.py     ← WhatsApp (Evolution API) + tradução IA
```

### 3.2 Interface do provider (`providers/base.py`)

```python
from abc import ABC, abstractmethod
from dataclasses import dataclass
from datetime import date

@dataclass
class Movimentacao:
    data: date
    descricao: str
    pdf_url: str | None = None

class MonitoramentoProvider(ABC):
    @abstractmethod
    async def check_processo(self, numero_cnj: str) -> list[Movimentacao]:
        """Retorna movimentações novas. Lança exceção em caso de falha."""
```

### 3.3 Fluxo do scheduler (a cada hora)

1. Busca todos os processos com `monitorar = true` no Supabase
2. Para cada processo, chama `DJENProvider.check_processo(numero_cnj)`
3. Filtra movimentações com `data > ultima_verificacao_at` (usando `America/Sao_Paulo`). Se `ultima_verificacao_at` for `NULL` (primeiro check), busca apenas os últimos 30 dias para evitar flood de notificações
4. Para cada movimentação nova:
   a. Se houver `pdf_url`: baixa e extrai texto com `pdf_extractor`
   b. Insere em `andamentos` com `origem = 'rpa'`
   c. Chama `notificador.notificar_advogado(...)` — sempre
   d. Se `notificar_cliente = true`: chama `notificador.notificar_cliente(...)` com tradução IA
5. Atualiza `ultima_verificacao_at` do processo
6. Grava entrada em `monitoramento_logs` com status `ok`, `sem_novidade` ou `erro`

### 3.4 Notificador (`notificador.py`)

- **Advogado:** mensagem WhatsApp com texto original da movimentação + link para o processo no sistema
- **Cliente:** passa o texto original para o LLM (mesmo `get_llm_client()` já existente) com prompt pedindo tradução em linguagem simples, sem termos jurídicos. Envia resultado via WhatsApp.
- Falha no WhatsApp: loga o erro, marca `notificado_*_at = NULL` (não bloqueia o fluxo)

### 3.5 Novos endpoints em `processos/router.py`

| Método | Rota | Descrição |
|--------|------|-----------|
| `PUT` | `/api/processos/{id}/monitoramento` | Body: `{ monitorar?: bool, notificar_cliente?: bool }`. Retorna `ProcessoOut` atualizado |
| `POST` | `/api/processos/{id}/verificar` | Dispara verificação manual imediata |

### 3.6 Inicialização do scheduler

Em `backend/app/main.py`, via `lifespan`:
```python
scheduler.start()   # on startup
scheduler.shutdown()  # on shutdown
```

### 3.7 Configuração (`core/config.py`)

Novas variáveis de ambiente:
- `JUSBRASIL_API_KEY` — opcional; se presente, usa JusbrasilProvider em vez de DJENProvider
- `RPA_CHECK_INTERVAL_HOURS` — padrão `1`

---

## 4. Frontend

### 4.1 Componente `ProcessoDetail.tsx`

Adicionar terceira aba `"monitoramento"` ao tipo `Tab` existente (`"andamentos" | "intimacoes" | "monitoramento"`).

### 4.2 Conteúdo da aba Monitoramento

Novo componente `components/processos/MonitoramentoTab.tsx`:

**Seção 1 — Configuração** (card com dois toggles):
- "Monitorar automaticamente" → `PUT /api/processos/{id}/monitoramento` com `{ monitorar: bool }`
- "Notificar cliente via WhatsApp" → mesma rota com `{ notificar_cliente: bool }`

**Seção 2 — Status**:
- Chip "Última verificação: DD/MM/YYYY às HH:mm"
- Chip "Status: ✓ Sem novidades | ⚠ Erro | — Nunca verificado"
- Botão "Verificar agora" → `POST /api/processos/{id}/verificar`

**Seção 3 — Movimentações detectadas pelo robô**:
- Lista filtrada de `andamentos` com `origem = 'rpa'`, ordem cronológica decrescente
- Cada item mostra: data, descrição, badges (PDF extraído / IA traduziu / WhatsApp enviado)
- Reutiliza o mesmo padrão visual de `AndamentoTimeline`

### 4.3 Tipos (`types/processos.ts`)

Adicionar:
```typescript
monitorar: boolean
notificar_cliente: boolean
ultima_verificacao_at: string | null
```
ao tipo `ProcessoOut`.

---

## 5. Tratamento de Erros

| Situação | Comportamento |
|----------|--------------|
| DJEN fora do ar | Grava `monitoramento_logs` com `status='erro'`, não notifica o advogado |
| PDF ilegível / corrompido | Salva andamento sem `pdf_texto`, segue notificação normalmente |
| WhatsApp falha | Loga erro, `notificado_*_at` fica NULL, não retenta automaticamente |
| Processo sem `numero_cnj` válido | Pula e loga warning |

---

## 6. Fora de Escopo (Fase 8)

- Interface de configuração do Jusbrasil API key (feito manualmente via variável de ambiente)
- Retry automático de notificações WhatsApp falhas
- Monitoramento de andamentos via portais estaduais (e-SAJ, PJe) diretamente
- Relatórios/BI de movimentações
