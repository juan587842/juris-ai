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
    normalizado = _normalizar(mensagem)
    # Remove pontuação substituindo por espaço para não fundir palavras
    sem_pontuacao = "".join(c if c.isalnum() or c.isspace() else " " for c in normalizado)
    palavras = sem_pontuacao.split()
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
