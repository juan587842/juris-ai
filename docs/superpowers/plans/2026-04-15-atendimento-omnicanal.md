# Fase 9: Atendimento Omnicanal — Agente Jurídico + Badge de Não-Lidas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Adicionar um agente jurídico que responde dúvidas de clientes sobre seus processos em linguagem simples, roteado por intenção a partir do webhook da Evolution API, e badge de mensagens não lidas no inbox.

**Architecture:** Novo `router.py` intercepta a chamada ao agente de triagem no webhook: se a mensagem tem intenção jurídica e o lead tem processos cadastrados, delega ao `juridico.py` (que busca andamentos e responde via LLM); caso contrário, mantém o fluxo de triagem inalterado. O frontend já tem Realtime; apenas o badge de não-lidas precisa ser adicionado à `ConversationList`.

**Tech Stack:** Python (unicodedata, pytz, OpenAI), FastAPI, Supabase, Next.js/TypeScript.

---

## Arquivos a criar/modificar

**Backend — novos:**
- `backend/app/agents/prompts/juridico.md` — prompt do agente jurídico
- `backend/app/agents/juridico.py` — agente que consulta processos e responde em linguagem simples
- `backend/app/agents/router.py` — roteador de intenção
- `backend/tests/agents/__init__.py`
- `backend/tests/agents/test_juridico.py`
- `backend/tests/agents/test_router.py`

**Backend — modificar:**
- `backend/app/api/webhooks/evolution.py` — trocar chamada direta ao triagem por `rotear_mensagem`

**Frontend — modificar:**
- `frontend/components/chat/ConversationList.tsx` — adicionar badge de não-lidas

---

## Task 1: Prompt do agente jurídico

**Files:**
- Create: `backend/app/agents/prompts/juridico.md`

- [ ] **Step 1: Criar o arquivo de prompt**

Criar `backend/app/agents/prompts/juridico.md`:

```markdown
# Assistente Jurídico — Juris AI

Você é o assistente digital do escritório. Sua função é responder dúvidas do cliente sobre o andamento dos processos dele em linguagem simples e acolhedora, sem usar termos jurídicos técnicos.

## Regras obrigatórias

1. **Use linguagem simples**: explique como se fosse para um familiar leigo, nunca use juridiquês.
2. **Seja breve**: máximo 3 parágrafos curtos — o cliente está lendo no WhatsApp.
3. **Não dê opiniões legais**: não prometa resultados, não avalie chances de êxito.
4. **Oriente ao advogado**: para dúvidas complexas, sugira conversar diretamente com o advogado.
5. **Seja empático**: reconheça que processos geram ansiedade e valide o sentimento do cliente.

## Exemplos de tradução

- "Concluso para despacho" → "O processo chegou ao juiz, que vai analisar e tomar uma decisão em breve."
- "Juntada de petição" → "O advogado apresentou um documento importante no processo."
- "Audiência de instrução e julgamento" → "Haverá uma audiência onde o juiz vai ouvir as partes e pode dar uma decisão."

## Tom

Profissional, empático e direto. Nunca alarmista. Se não souber a resposta com base nos dados disponíveis, diga isso honestamente e oriente o cliente a entrar em contato com o advogado responsável.
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/agents/prompts/juridico.md
git commit -m "feat(fase-9): prompt do agente jurídico"
```

---

## Task 2: Agente jurídico (`juridico.py`)

**Files:**
- Create: `backend/app/agents/juridico.py`
- Create: `backend/tests/agents/__init__.py`
- Create: `backend/tests/agents/test_juridico.py`

- [ ] **Step 1: Criar `backend/tests/agents/__init__.py`**

Criar o arquivo vazio:

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
New-Item -Path "backend/tests/agents/__init__.py" -ItemType File -Force
```

Ou criar usando qualquer editor — o arquivo deve estar vazio.

- [ ] **Step 2: Escrever os testes (TDD — antes da implementação)**

Criar `backend/tests/agents/test_juridico.py`:

```python
"""Testes do agente jurídico."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_consultar_processos_retorna_resposta():
    """Quando o lead tem processos, retorna string com resposta da IA."""
    from app.agents.juridico import consultar_processos

    mock_supabase = MagicMock()

    # Simula resultado de processos
    proc_chain = MagicMock()
    proc_chain.execute = AsyncMock(return_value=MagicMock(data=[
        {"id": "proc-1", "numero_cnj": "0001234-56.2024.8.25.0100",
         "tribunal": "TJSP", "vara": "1ª Vara Cível", "status": "ativo"}
    ]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.neq.return_value.order.return_value.limit.return_value = proc_chain

    # Simula resultado de andamentos
    and_chain = MagicMock()
    and_chain.execute = AsyncMock(return_value=MagicMock(data=[
        {"data_andamento": "2026-04-10",
         "texto_original": "Concluso para despacho",
         "texto_traduzido": "O processo chegou ao juiz."}
    ]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.gte.return_value.order.return_value.limit.return_value = and_chain

    mock_llm = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=MagicMock(content="Seu processo está com o juiz."))]
    mock_llm.chat.completions.create = AsyncMock(return_value=mock_resp)

    with (
        patch("app.agents.juridico.get_supabase", AsyncMock(return_value=mock_supabase)),
        patch("app.agents.juridico.get_llm_client", return_value=mock_llm),
        patch("app.agents.juridico.get_model", return_value="gpt-4o-mini"),
    ):
        result = await consultar_processos(
            lead_id="lead-1",
            historico=[],
            nova_mensagem="Qual o status do meu processo?",
        )

    assert result == "Seu processo está com o juiz."


@pytest.mark.asyncio
async def test_consultar_processos_sem_processos_retorna_none():
    """Quando o lead não tem processos, retorna None sem chamar o LLM."""
    from app.agents.juridico import consultar_processos

    mock_supabase = MagicMock()
    chain = MagicMock()
    chain.execute = AsyncMock(return_value=MagicMock(data=[]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.neq.return_value.order.return_value.limit.return_value = chain

    with patch("app.agents.juridico.get_supabase", AsyncMock(return_value=mock_supabase)):
        result = await consultar_processos(
            lead_id="lead-sem-processos",
            historico=[],
            nova_mensagem="Qual o status do meu processo?",
        )

    assert result is None


@pytest.mark.asyncio
async def test_consultar_processos_prefere_texto_traduzido():
    """Usa texto_traduzido quando disponível, texto_original como fallback."""
    from app.agents.juridico import consultar_processos

    mock_supabase = MagicMock()

    proc_chain = MagicMock()
    proc_chain.execute = AsyncMock(return_value=MagicMock(data=[
        {"id": "proc-1", "numero_cnj": "0001234-56.2024.8.25.0100",
         "tribunal": "TJSP", "vara": "1ª Vara", "status": "ativo"}
    ]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.neq.return_value.order.return_value.limit.return_value = proc_chain

    and_chain = MagicMock()
    and_chain.execute = AsyncMock(return_value=MagicMock(data=[
        {"data_andamento": "2026-04-10",
         "texto_original": "Concluso para despacho",
         "texto_traduzido": "TEXTO_TRADUZIDO_AQUI"}
    ]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.gte.return_value.order.return_value.limit.return_value = and_chain

    captured: list[list] = []

    async def fake_create(**kwargs):
        captured.append(kwargs["messages"])
        resp = MagicMock()
        resp.choices = [MagicMock(message=MagicMock(content="resposta"))]
        return resp

    mock_llm = MagicMock()
    mock_llm.chat.completions.create = fake_create

    with (
        patch("app.agents.juridico.get_supabase", AsyncMock(return_value=mock_supabase)),
        patch("app.agents.juridico.get_llm_client", return_value=mock_llm),
        patch("app.agents.juridico.get_model", return_value="gpt-4o-mini"),
    ):
        await consultar_processos(
            lead_id="lead-1",
            historico=[],
            nova_mensagem="como tá meu processo?",
        )

    user_msg = next(m for m in captured[0] if m["role"] == "user")
    assert "TEXTO_TRADUZIDO_AQUI" in user_msg["content"]
    assert "Concluso para despacho" not in user_msg["content"]
```

- [ ] **Step 3: Rodar os testes — esperado: FAIL**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\backend"
.venv/Scripts/python.exe -m pytest tests/agents/test_juridico.py -v 2>&1 | tail -10
```

Expected: `ModuleNotFoundError: No module named 'app.agents.juridico'`

- [ ] **Step 4: Criar `juridico.py`**

Criar `backend/app/agents/juridico.py`:

```python
"""Agente jurídico — responde dúvidas do cliente sobre seus processos em linguagem simples."""
from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

import pytz

from app.core.llm import get_llm_client, get_model
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase

logger = get_logger("agents.juridico")

_SP_TZ = pytz.timezone("America/Sao_Paulo")
_PROMPT_PATH = Path(__file__).parent / "prompts" / "juridico.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8")

_MAX_PROCESSOS = 5
_MAX_ANDAMENTOS = 3


async def consultar_processos(
    lead_id: str,
    historico: list[dict],
    nova_mensagem: str,
) -> str | None:
    """
    Busca os processos do cliente pelo lead_id, monta contexto dos andamentos
    recentes e responde em linguagem simples via LLM.

    Retorna None se o lead não tiver processos vinculados.
    """
    supabase = await get_supabase()

    processos_result = (
        await supabase
        .table("processos")
        .select("id, numero_cnj, tribunal, vara, status")
        .eq("cliente_id", lead_id)
        .neq("status", "arquivado")
        .order("created_at", desc=True)
        .limit(_MAX_PROCESSOS)
        .execute()
    )

    if not processos_result.data:
        return None

    cutoff = (datetime.now(_SP_TZ) - timedelta(days=30)).date().isoformat()
    contexto_partes: list[str] = []

    for proc in processos_result.data:
        andamentos_result = (
            await supabase
            .table("andamentos")
            .select("data_andamento, texto_original, texto_traduzido")
            .eq("processo_id", proc["id"])
            .gte("data_andamento", cutoff)
            .order("data_andamento", desc=True)
            .limit(_MAX_ANDAMENTOS)
            .execute()
        )

        andamentos = andamentos_result.data or []
        linha = (
            f"Processo {proc['numero_cnj']}"
            f" ({proc.get('tribunal') or 'Tribunal não informado'})"
            f" — Status: {proc['status']}"
        )

        if andamentos:
            movs = "\n".join(
                f"  - {a['data_andamento']}: {a.get('texto_traduzido') or a['texto_original']}"
                for a in andamentos
            )
            linha += f"\nMovimentações recentes:\n{movs}"
        else:
            linha += "\nSem movimentações nos últimos 30 dias."

        contexto_partes.append(linha)

    contexto = "\n\n".join(contexto_partes)

    messages: list[dict] = [{"role": "system", "content": _SYSTEM_PROMPT}]

    for msg in historico[-10:]:
        content = msg.get("content") or ""
        if not content:
            continue
        role = "user" if msg.get("sender_type") == "lead" else "assistant"
        messages.append({"role": role, "content": content})

    messages.append({
        "role": "user",
        "content": f"{nova_mensagem}\n\n[Dados dos seus processos no escritório:]\n{contexto}",
    })

    llm = get_llm_client()
    model = get_model()

    response = await llm.chat.completions.create(model=model, messages=messages)
    return response.choices[0].message.content or ""
```

- [ ] **Step 5: Rodar os testes — esperado: PASS**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\backend"
.venv/Scripts/python.exe -m pytest tests/agents/test_juridico.py -v 2>&1 | tail -10
```

Expected: `3 passed`

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/agents/juridico.py backend/tests/agents/__init__.py backend/tests/agents/test_juridico.py
git commit -m "feat(fase-9): agente jurídico para tira-dúvidas de processos"
```

---

## Task 3: Roteador de intenção (`router.py`)

**Files:**
- Create: `backend/app/agents/router.py`
- Create: `backend/tests/agents/test_router.py`

- [ ] **Step 1: Escrever os testes**

Criar `backend/tests/agents/test_router.py`:

```python
"""Testes do roteador de intenção."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ─── Detecção de keywords ──────────────────────────────────────────────────────

def test_tem_intencao_juridica_com_keyword():
    from app.agents.router import _tem_intencao_juridica
    assert _tem_intencao_juridica("como está meu processo?") is True


def test_tem_intencao_juridica_case_insensitive():
    from app.agents.router import _tem_intencao_juridica
    assert _tem_intencao_juridica("PROCESSO 123") is True


def test_tem_intencao_juridica_sem_acento():
    from app.agents.router import _tem_intencao_juridica
    # "audiência" sem acento → "audiencia" está na lista
    assert _tem_intencao_juridica("qual a proxima audiencia?") is True


def test_tem_intencao_juridica_false_para_mensagem_generica():
    from app.agents.router import _tem_intencao_juridica
    assert _tem_intencao_juridica("boa tarde, quero contratar um advogado") is False


# ─── Roteamento ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rotear_para_juridico_quando_tem_processos_e_keyword():
    """Deve chamar consultar_processos quando há intenção jurídica e processos."""
    from app.agents.router import rotear_mensagem

    mock_supabase = MagicMock()
    chain = MagicMock()
    chain.execute = AsyncMock(return_value=MagicMock(data=[{"id": "proc-1"}]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.neq.return_value.limit.return_value = chain

    with (
        patch("app.agents.router.get_supabase", AsyncMock(return_value=mock_supabase)),
        patch("app.agents.juridico.consultar_processos",
              AsyncMock(return_value="resposta jurídica")),
        patch("app.agents.triagem.processar_mensagem",
              AsyncMock(return_value="resposta triagem")),
    ):
        result = await rotear_mensagem(
            conversation_id="conv-1",
            lead_id="lead-1",
            lead_phone="+5511999999999",
            historico=[],
            nova_mensagem="quando é a próxima audiência?",
        )

    assert result == "resposta jurídica"


@pytest.mark.asyncio
async def test_rotear_para_triagem_quando_sem_processos():
    """Deve chamar processar_mensagem quando o lead não tem processos."""
    from app.agents.router import rotear_mensagem

    mock_supabase = MagicMock()
    chain = MagicMock()
    chain.execute = AsyncMock(return_value=MagicMock(data=[]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.neq.return_value.limit.return_value = chain

    with (
        patch("app.agents.router.get_supabase", AsyncMock(return_value=mock_supabase)),
        patch("app.agents.triagem.processar_mensagem",
              AsyncMock(return_value="resposta triagem")),
    ):
        result = await rotear_mensagem(
            conversation_id="conv-1",
            lead_id="lead-sem-processos",
            lead_phone="+5511999999999",
            historico=[],
            nova_mensagem="quero saber sobre meu processo",
        )

    assert result == "resposta triagem"


@pytest.mark.asyncio
async def test_rotear_para_triagem_quando_sem_keyword():
    """Deve chamar processar_mensagem quando não há intenção jurídica (sem consultar BD)."""
    from app.agents.router import rotear_mensagem

    with patch("app.agents.triagem.processar_mensagem",
               AsyncMock(return_value="resposta triagem")):
        result = await rotear_mensagem(
            conversation_id="conv-1",
            lead_id="lead-1",
            lead_phone="+5511999999999",
            historico=[],
            nova_mensagem="boa tarde, quero contratar um advogado",
        )

    assert result == "resposta triagem"
```

- [ ] **Step 2: Rodar os testes — esperado: FAIL**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\backend"
.venv/Scripts/python.exe -m pytest tests/agents/test_router.py -v 2>&1 | tail -10
```

Expected: `ModuleNotFoundError: No module named 'app.agents.router'`

- [ ] **Step 3: Criar `router.py`**

Criar `backend/app/agents/router.py`:

```python
"""Roteador de intenção — decide entre agente jurídico e agente de triagem."""
from __future__ import annotations

import unicodedata

from app.core.logging import get_logger
from app.integrations.supabase import get_supabase

logger = get_logger("agents.router")

_KEYWORDS_JURIDICO = {
    "processo", "andamento", "audiencia", "prazo", "decisao",
    "quando", "juiz", "sentenca", "recurso", "resultado",
    "julgamento", "despacho", "intimacao", "citacao",
}


def _normalizar(texto: str) -> str:
    """Remove acentos e converte para lowercase."""
    normalizado = unicodedata.normalize("NFD", texto)
    sem_acento = "".join(c for c in normalizado if unicodedata.category(c) != "Mn")
    return sem_acento.lower()


def _tem_intencao_juridica(mensagem: str) -> bool:
    """Verifica se a mensagem contém intenção de consulta processual."""
    palavras = _normalizar(mensagem).split()
    return any(p in _KEYWORDS_JURIDICO for p in palavras)


async def _tem_processos(lead_id: str) -> bool:
    """Verifica se o lead tem processos vinculados no banco."""
    supabase = await get_supabase()
    result = (
        await supabase
        .table("processos")
        .select("id")
        .eq("cliente_id", lead_id)
        .neq("status", "arquivado")
        .limit(1)
        .execute()
    )
    return bool(result.data)


async def rotear_mensagem(
    conversation_id: str,
    lead_id: str,
    lead_phone: str,
    historico: list[dict],
    nova_mensagem: str,
) -> str | None:
    """
    Decide qual agente responde:
    - juridico: lead tem processos E mensagem tem intenção jurídica
    - triagem: qualquer outro caso (inclusive fallback se juridico retornar None)
    """
    from app.agents.juridico import consultar_processos
    from app.agents.triagem import processar_mensagem

    if _tem_intencao_juridica(nova_mensagem) and await _tem_processos(lead_id):
        logger.info("Roteando para agente jurídico", lead_id=lead_id)
        resposta = await consultar_processos(
            lead_id=lead_id,
            historico=historico,
            nova_mensagem=nova_mensagem,
        )
        if resposta is not None:
            return resposta
        logger.warning(
            "Agente jurídico retornou None, fallback para triagem",
            lead_id=lead_id,
        )

    return await processar_mensagem(
        conversation_id=conversation_id,
        lead_id=lead_id,
        lead_phone=lead_phone,
        historico=historico,
        nova_mensagem=nova_mensagem,
    )
```

- [ ] **Step 4: Rodar os testes — esperado: PASS**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\backend"
.venv/Scripts/python.exe -m pytest tests/agents/test_router.py -v 2>&1 | tail -10
```

Expected: `7 passed`

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/agents/router.py backend/tests/agents/test_router.py
git commit -m "feat(fase-9): roteador de intenção juridico vs triagem"
```

---

## Task 4: Integrar roteador no webhook

**Files:**
- Modify: `backend/app/api/webhooks/evolution.py`

O arquivo atual tem, dentro de `_processar_com_ia`:

```python
    from app.agents.triagem import processar_mensagem
    ...
    resposta = await processar_mensagem(
        conversation_id=conversation_id,
        lead_id=lead_id,
        lead_phone=lead_phone,
        historico=historico_anterior,
        nova_mensagem=nova_mensagem,
    )
```

- [ ] **Step 1: Substituir import e chamada**

Localizar no arquivo `backend/app/api/webhooks/evolution.py` a função `_processar_com_ia` e:

1. Remover:
```python
        from app.agents.triagem import processar_mensagem
```

2. Adicionar no lugar:
```python
        from app.agents.router import rotear_mensagem
```

3. Substituir:
```python
        resposta = await processar_mensagem(
            conversation_id=conversation_id,
            lead_id=lead_id,
            lead_phone=lead_phone,
            historico=historico_anterior,
            nova_mensagem=nova_mensagem,
        )
```

por:
```python
        resposta = await rotear_mensagem(
            conversation_id=conversation_id,
            lead_id=lead_id,
            lead_phone=lead_phone,
            historico=historico_anterior,
            nova_mensagem=nova_mensagem,
        )
```

- [ ] **Step 2: Rodar todos os testes do backend**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\backend"
.venv/Scripts/python.exe -m pytest tests/ -v 2>&1 | tail -20
```

Expected: todos passam (21 rpa + 3 juridico + 7 router + 1 health = 32 testes).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/api/webhooks/evolution.py
git commit -m "feat(fase-9): integrar roteador no webhook da Evolution API"
```

---

## Task 5: Badge de não-lidas na ConversationList

**Files:**
- Modify: `frontend/components/chat/ConversationList.tsx`

O componente atual já tem Realtime para conversas, mas não tem badge de não-lidas.

- [ ] **Step 1: Substituir o conteúdo de `ConversationList.tsx`**

Substituir o conteúdo completo de `frontend/components/chat/ConversationList.tsx` por:

```tsx
"use client";

import { useEffect, useRef, useState } from "react";
import { createBrowserClient } from "@/lib/supabase/client";
import type { Conversation } from "@/types/chat";
import { cn } from "@/lib/utils";
import { Bot, User } from "lucide-react";

interface Props {
  selectedId: string | null;
  onSelect: (conv: Conversation) => void;
}

function formatTime(dateStr: string | null) {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  const now = new Date();
  const isToday = d.toDateString() === now.toDateString();
  return isToday
    ? d.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })
    : d.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

const STATUS_COLORS: Record<string, string> = {
  aberta: "bg-blue-500",
  em_atendimento: "bg-yellow-500",
  resolvida: "bg-green-500",
  pendente: "bg-gray-400",
};

export function ConversationList({ selectedId, onSelect }: Props) {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [unreadCounts, setUnreadCounts] = useState<Map<string, number>>(new Map());
  const selectedIdRef = useRef(selectedId);
  const supabase = createBrowserClient();

  // Sincroniza ref com prop e zera badge ao selecionar conversa
  useEffect(() => {
    selectedIdRef.current = selectedId;
    if (selectedId) {
      setUnreadCounts((prev) => {
        const next = new Map(prev);
        next.delete(selectedId);
        return next;
      });
    }
  }, [selectedId]);

  useEffect(() => {
    async function load() {
      const { data } = await supabase
        .from("conversations")
        .select("*, leads(id, nome, telefone)")
        .neq("status", "resolvida")
        .order("last_message_at", { ascending: false })
        .limit(60);
      if (data) setConversations(data as Conversation[]);
    }
    load();

    // Atualiza lista quando conversas mudam
    const convChannel = supabase
      .channel("conversations-realtime")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "conversations" },
        () => load()
      )
      .subscribe();

    // Conta mensagens não lidas para conversas não selecionadas
    const msgChannel = supabase
      .channel("messages-unread")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "messages" },
        (payload) => {
          const msg = payload.new as { conversation_id: string; sender_type: string };
          if (msg.sender_type !== "lead") return;
          if (msg.conversation_id === selectedIdRef.current) return;
          setUnreadCounts((prev) => {
            const next = new Map(prev);
            next.set(msg.conversation_id, (next.get(msg.conversation_id) ?? 0) + 1);
            return next;
          });
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(convChannel);
      supabase.removeChannel(msgChannel);
    };
  }, []);

  if (conversations.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm p-4 text-center">
        Nenhuma conversa ativa.
        <br />
        Aguardando mensagens via WhatsApp.
      </div>
    );
  }

  return (
    <div className="flex-1 overflow-y-auto">
      {conversations.map((conv) => {
        const name = conv.leads?.nome || conv.leads?.telefone || "Sem nome";
        const unread = unreadCounts.get(conv.id) ?? 0;
        return (
          <button
            key={conv.id}
            onClick={() => onSelect(conv)}
            className={cn(
              "w-full text-left px-4 py-3 border-b hover:bg-muted/50 transition-colors",
              selectedId === conv.id && "bg-muted"
            )}
          >
            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className={cn(
                    "h-2 w-2 rounded-full flex-shrink-0",
                    STATUS_COLORS[conv.status] ?? "bg-gray-400"
                  )}
                />
                <span className="font-medium text-sm truncate">{name}</span>
              </div>
              <div className="flex items-center gap-1.5 flex-shrink-0">
                {unread > 0 && (
                  <span className="rounded-full bg-primary px-1.5 py-0.5 text-xs font-bold text-primary-foreground leading-none">
                    {unread}
                  </span>
                )}
                <span className="text-xs text-muted-foreground">
                  {formatTime(conv.last_message_at)}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-1 mt-0.5 pl-4">
              {conv.ai_enabled ? (
                <Bot className="h-3 w-3 text-violet-500 flex-shrink-0" />
              ) : (
                <User className="h-3 w-3 text-blue-500 flex-shrink-0" />
              )}
              <span className="text-xs text-muted-foreground truncate">
                {conv.ai_enabled ? "IA ativa" : "Atendimento humano"}
              </span>
            </div>
          </button>
        );
      })}
    </div>
  );
}
```

- [ ] **Step 2: Verificar TypeScript sem erros**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\frontend"
npx tsc --noEmit 2>&1 | tail -10
```

Expected: sem saída (nenhum erro).

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add frontend/components/chat/ConversationList.tsx
git commit -m "feat(fase-9): badge de não-lidas na ConversationList"
```

---

## Task 6: Push final

- [ ] **Step 1: Rodar todos os testes do backend**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI\backend"
.venv/Scripts/python.exe -m pytest tests/ -v 2>&1 | tail -15
```

Expected: todos passam.

- [ ] **Step 2: Push**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git push
```
