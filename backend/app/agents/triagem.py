"""
Agente de Triagem — Juris AI
Fluxo: saudacao → consentimento_lgpd → coleta → classificacao → {proposta | escalacao}
"""
from __future__ import annotations

import json
from pathlib import Path
from typing import Annotated, Any, TypedDict

from langgraph.graph import END, START, StateGraph
from langgraph.graph.message import add_messages
from openai.types.chat import ChatCompletionMessageParam

from app.core.llm import get_llm_client, get_model
from app.core.logging import get_logger
from app.integrations.evolution import get_evolution_client
from app.integrations.supabase import get_supabase

logger = get_logger("agents.triagem")

# ─── Prompt base ──────────────────────────────────────────────────────────────
_PROMPT_PATH = Path(__file__).parent / "prompts" / "triagem.md"
_SYSTEM_PROMPT = _PROMPT_PATH.read_text(encoding="utf-8")

# ─── Estado do grafo ──────────────────────────────────────────────────────────

class TriagemState(TypedDict):
    conversation_id: str
    lead_id: str
    lead_phone: str
    messages: Annotated[list[ChatCompletionMessageParam], add_messages]
    consentimento_dado: bool
    escalado: bool
    resposta_ia: str | None


# ─── Tools (funções chamadas pela IA) ─────────────────────────────────────────

TOOLS: list[dict[str, Any]] = [
    {
        "type": "function",
        "function": {
            "name": "solicitar_consentimento_lgpd",
            "description": "Registra que o consentimento LGPD foi solicitado e obtido do lead.",
            "parameters": {
                "type": "object",
                "properties": {
                    "consentiu": {
                        "type": "boolean",
                        "description": "True se o lead concordou, False se recusou."
                    }
                },
                "required": ["consentiu"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "registrar_lead",
            "description": "Atualiza os dados do lead com as informações coletadas.",
            "parameters": {
                "type": "object",
                "properties": {
                    "nome": {"type": "string", "description": "Nome completo do lead."},
                    "area_juridica": {
                        "type": "string",
                        "enum": ["trabalhista", "civil", "criminal", "familia",
                                 "empresarial", "tributario", "previdenciario", "imobiliario", "outro"],
                        "description": "Área jurídica do caso."
                    },
                    "resumo": {"type": "string", "description": "Resumo breve da situação (1-2 frases)."}
                },
                "required": ["area_juridica"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "criar_oportunidade",
            "description": "Cria uma oportunidade no CRM para o lead qualificado.",
            "parameters": {
                "type": "object",
                "properties": {
                    "titulo": {"type": "string", "description": "Título da oportunidade (ex: 'Rescisão indireta - João Silva')."},
                    "area_juridica": {
                        "type": "string",
                        "enum": ["trabalhista", "civil", "criminal", "familia",
                                 "empresarial", "tributario", "previdenciario", "imobiliario", "outro"]
                    }
                },
                "required": ["titulo", "area_juridica"]
            }
        }
    },
    {
        "type": "function",
        "function": {
            "name": "escalar_para_humano",
            "description": "Pausa a IA e sinaliza que um advogado deve assumir a conversa.",
            "parameters": {
                "type": "object",
                "properties": {
                    "motivo": {
                        "type": "string",
                        "description": "Motivo da escalação (urgência, pedido do cliente, caso complexo, etc.)"
                    }
                },
                "required": ["motivo"]
            }
        }
    }
]


# ─── Handlers das tools ───────────────────────────────────────────────────────

async def _handle_tool_call(
    tool_name: str,
    tool_args: dict,
    state: TriagemState,
) -> tuple[TriagemState, str]:
    """Executa a tool e retorna o estado atualizado + resultado em string."""
    supabase = await get_supabase()
    result = ""

    if tool_name == "solicitar_consentimento_lgpd":
        consentiu: bool = tool_args.get("consentiu", False)
        await supabase.table("consentimentos_lgpd").upsert(
            {
                "lead_id": state["lead_id"],
                "base_legal": "consentimento",
                "opt_in_at": "now()" if consentiu else None,
                "opt_out_at": "now()" if not consentiu else None,
                "evidencia": "Consentimento solicitado via WhatsApp pelo agente de triagem",
            },
            on_conflict="lead_id",
        ).execute()
        state["consentimento_dado"] = consentiu
        result = "ok" if consentiu else "recusado"
        logger.info("Consentimento LGPD", lead_id=state["lead_id"], consentiu=consentiu)

    elif tool_name == "registrar_lead":
        update: dict[str, Any] = {}
        if tool_args.get("nome"):
            update["nome"] = tool_args["nome"]
        if tool_args.get("area_juridica"):
            update["area_interesse"] = tool_args["area_juridica"]
        if tool_args.get("resumo"):
            update["notas"] = tool_args["resumo"]
        if update:
            await supabase.table("leads").update(update).eq("id", state["lead_id"]).execute()
        result = "lead atualizado"

    elif tool_name == "criar_oportunidade":
        await supabase.table("oportunidades").insert({
            "lead_id": state["lead_id"],
            "titulo": tool_args["titulo"],
            "area_juridica": tool_args["area_juridica"],
            "estagio": "qualificado",
        }).execute()
        result = "oportunidade criada"
        logger.info("Oportunidade criada", lead_id=state["lead_id"], titulo=tool_args["titulo"])

    elif tool_name == "escalar_para_humano":
        motivo = tool_args.get("motivo", "")
        await supabase.table("conversations").update({
            "ai_enabled": False,
            "status": "em_atendimento",
        }).eq("id", state["conversation_id"]).execute()

        await supabase.table("conversation_events").insert({
            "conversation_id": state["conversation_id"],
            "tipo": "ai_pausada",
            "metadata": {"motivo": motivo, "origem": "agente_triagem"},
        }).execute()

        state["escalado"] = True
        result = f"escalado: {motivo}"
        logger.info("Conversa escalada", conversation_id=state["conversation_id"], motivo=motivo)

    # Registrar no audit_log
    await supabase.table("audit_log").insert({
        "actor": "ai",
        "acao": f"tool_call:{tool_name}",
        "entidade": "conversations",
        "entidade_id": state["conversation_id"],
        "payload": {"args": tool_args, "result": result},
    }).execute()

    return state, result


# ─── Nó principal do LangGraph ────────────────────────────────────────────────

async def _agente_node(state: TriagemState) -> TriagemState:
    """Chama o LLM, executa tool calls e registra a resposta."""
    llm = get_llm_client()
    model = get_model()

    messages: list[ChatCompletionMessageParam] = [
        {"role": "system", "content": _SYSTEM_PROMPT},
        *state["messages"],
    ]

    # Loop de tool calling
    max_iterations = 5
    for _ in range(max_iterations):
        response = await llm.chat.completions.create(
            model=model,
            messages=messages,
            tools=TOOLS,
            tool_choice="auto",
        )

        choice = response.choices[0]
        assistant_msg = choice.message

        # Adicionar resposta do assistente ao histórico
        messages.append({"role": "assistant", "content": assistant_msg.content, "tool_calls": assistant_msg.tool_calls})  # type: ignore

        # Se não há tool calls, terminamos
        if not assistant_msg.tool_calls:
            state["resposta_ia"] = assistant_msg.content or ""
            break

        # Processar cada tool call
        for tc in assistant_msg.tool_calls:
            tool_name = tc.function.name
            tool_args = json.loads(tc.function.arguments)

            state, tool_result = await _handle_tool_call(tool_name, tool_args, state)

            messages.append({
                "role": "tool",
                "tool_call_id": tc.id,
                "content": tool_result,
            })

        # Se foi escalado, forçar resposta final
        if state["escalado"]:
            break

    # Garantir que haja uma resposta
    if not state.get("resposta_ia"):
        state["resposta_ia"] = ""

    # Salvar resposta da IA no audit_log
    if state["resposta_ia"]:
        supabase = await get_supabase()
        await supabase.table("audit_log").insert({
            "actor": "ai",
            "acao": "mensagem_enviada",
            "entidade": "conversations",
            "entidade_id": state["conversation_id"],
            "payload": {
                "model": model,
                "resposta": state["resposta_ia"][:500],  # truncar para o log
                "num_messages": len(state["messages"]),
            },
        }).execute()

    return state


# ─── Construção do grafo ──────────────────────────────────────────────────────

def _build_graph() -> Any:
    graph = StateGraph(TriagemState)
    graph.add_node("agente", _agente_node)
    graph.add_edge(START, "agente")
    graph.add_edge("agente", END)
    return graph.compile()


_graph = _build_graph()


# ─── Função pública ───────────────────────────────────────────────────────────

async def processar_mensagem(
    conversation_id: str,
    lead_id: str,
    lead_phone: str,
    historico: list[dict],
    nova_mensagem: str,
) -> str | None:
    """
    Processa uma mensagem recebida e retorna a resposta da IA (ou None se escalado).
    """
    # Converter histórico para formato OpenAI
    messages: list[ChatCompletionMessageParam] = []
    for msg in historico[-20:]:  # últimas 20 mensagens para contexto
        sender = msg.get("sender_type", "lead")
        content = msg.get("content") or ""
        if not content:
            continue
        role: str = "user" if sender == "lead" else "assistant"
        messages.append({"role": role, "content": content})  # type: ignore

    # Adicionar nova mensagem
    messages.append({"role": "user", "content": nova_mensagem})

    # Verificar consentimento existente
    supabase = await get_supabase()
    consent_result = await supabase.table("consentimentos_lgpd").select("opt_in_at").eq("lead_id", lead_id).execute()
    consentimento_dado = bool(consent_result.data and consent_result.data[0].get("opt_in_at"))

    initial_state: TriagemState = {
        "conversation_id": conversation_id,
        "lead_id": lead_id,
        "lead_phone": lead_phone,
        "messages": messages,
        "consentimento_dado": consentimento_dado,
        "escalado": False,
        "resposta_ia": None,
    }

    result = await _graph.ainvoke(initial_state)

    if result["escalado"]:
        return result.get("resposta_ia")  # pode ser None ou uma mensagem de despedida

    return result.get("resposta_ia")
