"""Notificações de movimentações via WhatsApp (Evolution API) com tradução IA."""
from __future__ import annotations

from datetime import date

from app.core.config import get_settings
from app.core.llm import get_llm_client, get_model
from app.core.logging import get_logger
from app.integrations.evolution import get_evolution_client

logger = get_logger("rpa.notificador")


def montar_msg_advogado(
    numero_cnj: str,
    descricao: str,
    data: date,
    processo_id: str,
    base_url: str,
) -> str:
    """Monta mensagem WhatsApp para o advogado."""
    return (
        f"⚖️ *Nova movimentação detectada*\n\n"
        f"*Processo:* `{numero_cnj}`\n"
        f"*Data:* {data.strftime('%d/%m/%Y')}\n"
        f"*Movimentação:* {descricao}\n\n"
        f"🔗 {base_url}/processos/{processo_id}"
    )


def montar_msg_cliente_prompt(texto_juridico: str) -> str:
    """Monta prompt para a IA traduzir o texto jurídico para linguagem simples."""
    return (
        f"Você é um assistente jurídico. Traduza a seguinte movimentação processual "
        f"para linguagem simples e acessível para um leigo, sem juridiquês. "
        f"Use no máximo 3 frases curtas. Comece com 'Seu processo teve uma atualização:'.\n\n"
        f"Movimentação: {texto_juridico}"
    )


async def traduzir_para_cliente(texto_juridico: str) -> str:
    """Usa a IA para traduzir o texto jurídico em linguagem simples."""
    llm = get_llm_client()
    model = get_model()
    prompt = montar_msg_cliente_prompt(texto_juridico)

    response = await llm.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
    )
    return response.choices[0].message.content or texto_juridico


async def notificar_advogado(
    telefone_advogado: str,
    numero_cnj: str,
    descricao: str,
    data: date,
    processo_id: str,
) -> bool:
    """
    Envia WhatsApp ao advogado com a movimentação.
    Returns True if sent successfully, False otherwise.
    """
    settings = get_settings()
    base_url = settings.app_base_url

    msg = montar_msg_advogado(
        numero_cnj=numero_cnj,
        descricao=descricao,
        data=data,
        processo_id=processo_id,
        base_url=base_url,
    )

    try:
        evolution = get_evolution_client()
        phone = telefone_advogado.lstrip("+")
        await evolution.send_text(phone, msg)
        logger.info("WhatsApp advogado enviado", processo_id=processo_id)
        return True
    except Exception as exc:
        logger.error("Falha ao enviar WhatsApp advogado", error=str(exc), processo_id=processo_id)
        return False


async def notificar_cliente(
    telefone_cliente: str,
    descricao: str,
    processo_id: str,
) -> bool:
    """
    Envia WhatsApp ao cliente com versão traduzida pela IA.
    Returns True if sent successfully, False otherwise.
    """
    try:
        msg = await traduzir_para_cliente(descricao)
        evolution = get_evolution_client()
        phone = telefone_cliente.lstrip("+")
        await evolution.send_text(phone, msg)
        logger.info("WhatsApp cliente enviado", processo_id=processo_id)
        return True
    except Exception as exc:
        logger.error("Falha ao enviar WhatsApp cliente", error=str(exc), processo_id=processo_id)
        return False
