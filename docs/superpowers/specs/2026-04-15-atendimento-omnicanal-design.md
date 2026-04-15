# Spec — Fase 9: Atendimento Omnicanal (Realtime + Tira-dúvidas Jurídico)

**Data:** 2026-04-15  
**Status:** Aprovado  
**Escopo:** Backend (agente jurídico + roteador de intenção) + Frontend (Supabase Realtime no inbox)

---

## 1. Objetivo

Completar o módulo de atendimento omnicanal com duas melhorias críticas:

1. **Tempo real no inbox** — novas mensagens e mudanças de status aparecem instantaneamente para o advogado, sem refresh manual, via Supabase Realtime.
2. **Tira-dúvidas jurídico** — quando um cliente existente pergunta sobre seu processo via WhatsApp, a IA busca os andamentos no banco e responde em linguagem simples, sem juridiquês.

---

## 2. Banco de Dados

Nenhuma alteração de schema necessária. Todas as tabelas já existem:
- `leads` — contém `telefone` e `id`
- `processos` — contém `cliente_id` (referencia `leads.id`)
- `andamentos` — contém `processo_id`, `data_andamento`, `texto_original`, `texto_traduzido`
- `intimacoes` — contém `processo_id`, `data_publicacao`, `texto`
- `conversations`, `messages` — já configuradas para Realtime no Supabase

---

## 3. Backend

### 3.1 Roteador de intenção

Novo arquivo: `backend/app/agents/router.py`

Função pública:
```python
async def rotear_mensagem(
    conversation_id: str,
    lead_id: str,
    lead_phone: str,
    historico: list[dict],
    nova_mensagem: str,
) -> str | None
```

**Lógica de roteamento:**

1. Verifica se o lead tem processos vinculados no banco (`processos WHERE cliente_id = lead_id`)
2. Verifica se a mensagem contém intenção jurídica — matching case-insensitive e sem acentos (normalizar com `unicodedata.normalize` + `.lower()`) contra a lista: `"processo"`, `"andamento"`, `"audiencia"`, `"prazo"`, `"decisao"`, `"quando"`, `"juiz"`, `"sentenca"`, `"recurso"`, `"resultado"`, `"julgamento"`, `"despacho"`
3. Se **ambos** forem verdadeiros → chama `juridico.consultar_processos()`
4. Caso contrário → chama `triagem.processar_mensagem()` (fluxo existente inalterado)

O `_processar_com_ia()` em `evolution.py` passa a chamar `rotear_mensagem()` em vez de `processar_mensagem()` diretamente.

### 3.2 Agente jurídico

Novo arquivo: `backend/app/agents/juridico.py`

Função pública:
```python
async def consultar_processos(
    lead_id: str,
    historico: list[dict],
    nova_mensagem: str,
) -> str | None
```

**Fluxo interno:**

1. Busca `processos WHERE cliente_id = lead_id` (máx. 5 processos mais recentes)
2. Para cada processo, busca `andamentos` dos últimos 30 dias (máx. 3 por processo) e `intimacoes` em aberto
3. Monta contexto estruturado com: número CNJ, tribunal, vara, status, andamentos recentes
4. Chama o LLM com prompt de `prompts/juridico.md`:
   - Instrução: responder em linguagem simples, sem juridiquês, como se explicasse para um familiar leigo
   - Contexto dos processos + pergunta do cliente
5. Retorna a resposta em texto simples (ou `None` se não houver processos)

**Fallback:** Se o lead não tiver processos vinculados, retorna `None` e o roteador cai no agente de triagem.

### 3.3 Prompt jurídico

Novo arquivo: `backend/app/agents/prompts/juridico.md`

Conteúdo:
- Persona: assistente jurídico do escritório, empático e direto
- Instrução principal: traduzir andamentos para linguagem simples
- Restrição: não dar opinião legal, não prometer resultados, sempre sugerir conversa com o advogado para dúvidas complexas
- Formato: resposta curta (máx. 3 parágrafos), adequada para WhatsApp

### 3.4 Testes

Novos arquivos de teste:

**`backend/tests/agents/test_router.py`** — testa o roteador:
- `test_rotear_para_juridico_quando_cliente_tem_processos_e_keyword`
- `test_rotear_para_triagem_quando_sem_processos`
- `test_rotear_para_triagem_quando_sem_keyword`
- `test_keyword_matching_case_insensitive` — "PROCESSO" e "processo" batem
- `test_keyword_matching_sem_acento` — "audiencia" bate "audiência"

**`backend/tests/agents/test_juridico.py`** — testa o agente jurídico:
- `test_consultar_processos_retorna_resposta` — monta contexto e retorna string
- `test_consultar_processos_sem_processos_retorna_none` — fallback funciona
- `test_consultar_processos_limita_andamentos_recentes` — máx. 3 andamentos por processo

---

## 4. Frontend

### 4.1 MessageThread.tsx — Realtime

Modificar `frontend/components/chat/MessageThread.tsx`:

- Adicionar `useEffect` que cria subscription Supabase Realtime na tabela `messages` com filtro `conversation_id=eq.{id}`
- Evento `INSERT` → append da nova mensagem no estado local `messages`
- Scroll automático para o fim quando nova mensagem chega
- Cancelar subscription no cleanup do `useEffect`

```typescript
// Padrão da subscription
const channel = supabase
  .channel(`messages:${conversationId}`)
  .on('postgres_changes', {
    event: 'INSERT',
    schema: 'public',
    table: 'messages',
    filter: `conversation_id=eq.${conversationId}`,
  }, (payload) => {
    setMessages((prev) => [...prev, payload.new as Message]);
  })
  .subscribe();
```

### 4.2 ConversationList.tsx — Realtime + Badge

Modificar `frontend/components/chat/ConversationList.tsx`:

**Realtime:**
- Subscription em `conversations` para eventos `INSERT` e `UPDATE`
- `INSERT` → adicionar conversa no topo da lista
- `UPDATE` → atualizar status da conversa na lista (ex: `em_atendimento`, `resolvida`)

**Badge de não-lida:**
- Estado local: `Map<conversationId, number>` para contagem de mensagens não lidas
- Subscription adicional em `messages INSERT` (sem filtro de conversation_id) → se a `conversation_id` da nova mensagem não for a conversa selecionada atualmente, incrementa o contador
- Quando o usuário seleciona a conversa → zera o contador para aquela conversa
- Badge dourado (`bg-primary`) com número exibido ao lado do nome do contato

---

## 5. Tratamento de Erros

| Situação | Comportamento |
|----------|--------------|
| Lead sem processos vinculados | `consultar_processos()` retorna `None`; roteador chama triagem |
| LLM falha no agente jurídico | Loga erro, retorna `None`; roteador não envia mensagem (falha silenciosa para o cliente) |
| Supabase Realtime desconecta | Supabase client reconecta automaticamente; nenhuma ação manual necessária |
| Mensagem duplicada via Realtime | Verificar `id` antes de append (deduplicação por `message.id`) |

---

## 6. Fora de Escopo (Fase 9)

- Notificação sonora/push no browser para novas mensagens
- Indicador "digitando..." (typing indicator)
- Leitura de PDFs pelo agente jurídico (já coberto pela Fase 8)
- Busca/filtro de conversas por texto
- Landing pages integradas ao CRM
