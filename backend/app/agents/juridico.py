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

    try:
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

    except Exception:
        logger.exception("Erro ao consultar processos", lead_id=lead_id)
        return None
