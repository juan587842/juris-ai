"""Orquestração do ciclo de monitoramento processual."""
from __future__ import annotations

import pytz
from datetime import date, datetime, timedelta

from app.core.config import get_settings
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase
from app.rpa.pdf_extractor import extrair_texto_pdf
from app.rpa.providers.base import Movimentacao, MonitoramentoProvider
from app.rpa.providers.datajud import DataJudProvider
from app.rpa.providers.jusbrasil import JusbrasilProvider

logger = get_logger("rpa.monitoramento")

_SP_TZ = pytz.timezone("America/Sao_Paulo")


def _get_provider() -> MonitoramentoProvider:
    """Returns JusbrasilProvider if key is configured, DataJudProvider otherwise."""
    settings = get_settings()
    if settings.jusbrasil_api_key:
        return JusbrasilProvider()
    return DataJudProvider()


def _filtrar_novas(
    movimentacoes: list[Movimentacao],
    ultima_verificacao: date | None,
) -> list[Movimentacao]:
    """
    Filters movements newer than ultima_verificacao.
    If ultima_verificacao is None, returns only last 30 days.
    """
    if ultima_verificacao is None:
        corte = date.today() - timedelta(days=30)
    else:
        corte = ultima_verificacao

    return [m for m in movimentacoes if m.data > corte]


async def verificar_processo(processo: dict) -> None:
    """
    Checks a process for new movements and processes each one.
    Records result in monitoramento_logs.
    """
    supabase = await get_supabase()
    processo_id = processo["id"]
    numero_cnj = processo["numero_cnj"]
    notificar_cliente = processo.get("notificar_cliente", False)

    ultima_at = processo.get("ultima_verificacao_at")
    ultima_date: date | None = None
    if ultima_at:
        try:
            ultima_date = datetime.fromisoformat(ultima_at.replace("Z", "+00:00")).date()
        except Exception:
            ultima_date = None

    provider = _get_provider()
    provider_name = type(provider).__name__.lower().replace("provider", "")

    try:
        todas = await provider.check_processo(numero_cnj)
        novas = _filtrar_novas(todas, ultima_date)

        if not novas:
            await supabase.table("monitoramento_logs").insert({
                "processo_id": processo_id,
                "provider": provider_name,
                "status": "sem_novidade",
                "movimentacoes_encontradas": 0,
            }).execute()
            await _atualizar_ultima_verificacao(supabase, processo_id)
            return

        # Buscar telefones
        telefone_advogado = await _buscar_telefone_advogado(supabase, processo)
        telefone_cliente = await _buscar_telefone_cliente(supabase, processo) if notificar_cliente else None

        for mov in novas:
            await _processar_movimentacao(
                supabase=supabase,
                processo_id=processo_id,
                numero_cnj=numero_cnj,
                mov=mov,
                telefone_advogado=telefone_advogado,
                notificar_cliente=notificar_cliente,
                telefone_cliente=telefone_cliente,
            )

        await supabase.table("monitoramento_logs").insert({
            "processo_id": processo_id,
            "provider": provider_name,
            "status": "ok",
            "movimentacoes_encontradas": len(novas),
        }).execute()
        await _atualizar_ultima_verificacao(supabase, processo_id)
        logger.info("Processo verificado", cnj=numero_cnj, novas=len(novas))

    except Exception as exc:
        logger.error("Erro ao verificar processo", cnj=numero_cnj, error=str(exc))
        await supabase.table("monitoramento_logs").insert({
            "processo_id": processo_id,
            "provider": provider_name,
            "status": "erro",
            "movimentacoes_encontradas": 0,
            "erro_msg": str(exc)[:500],
        }).execute()


async def _processar_movimentacao(
    supabase,
    processo_id: str,
    numero_cnj: str,
    mov: Movimentacao,
    telefone_advogado: str | None,
    notificar_cliente: bool,
    telefone_cliente: str | None,
) -> None:
    """Saves andamento, extracts PDF and notifies via WhatsApp."""
    from app.rpa.notificador import notificar_advogado, notificar_cliente as notif_cliente

    pdf_texto = await extrair_texto_pdf(mov.pdf_url) if mov.pdf_url else None

    andamento_payload: dict = {
        "processo_id": processo_id,
        "data_andamento": str(mov.data),
        "texto_original": mov.descricao,
        "origem": "rpa",
    }
    if mov.pdf_url:
        andamento_payload["pdf_url"] = mov.pdf_url
    if pdf_texto:
        andamento_payload["pdf_texto"] = pdf_texto

    andamento_result = await supabase.table("andamentos").insert(andamento_payload).execute()
    andamento_id = andamento_result.data[0]["id"] if andamento_result.data else None

    now_sp = datetime.now(_SP_TZ).isoformat()

    if telefone_advogado:
        ok = await notificar_advogado(
            telefone_advogado=telefone_advogado,
            numero_cnj=numero_cnj,
            descricao=mov.descricao,
            data=mov.data,
            processo_id=processo_id,
        )
        if ok and andamento_id:
            await supabase.table("andamentos").update(
                {"notificado_advogado_at": now_sp}
            ).eq("id", andamento_id).execute()

    if notificar_cliente and telefone_cliente:
        ok = await notif_cliente(
            telefone_cliente=telefone_cliente,
            descricao=mov.descricao,
            processo_id=processo_id,
        )
        if ok and andamento_id:
            await supabase.table("andamentos").update(
                {"notificado_cliente_at": now_sp}
            ).eq("id", andamento_id).execute()


async def _atualizar_ultima_verificacao(supabase, processo_id: str) -> None:
    now_sp = datetime.now(_SP_TZ).isoformat()
    await supabase.table("processos").update(
        {"ultima_verificacao_at": now_sp}
    ).eq("id", processo_id).execute()


async def _buscar_telefone_advogado(supabase, processo: dict) -> str | None:
    advogado_id = processo.get("advogado_id")
    if not advogado_id:
        return None
    result = await supabase.table("leads").select("telefone").eq("id", advogado_id).limit(1).execute()
    return result.data[0].get("telefone") if result.data else None


async def _buscar_telefone_cliente(supabase, processo: dict) -> str | None:
    cliente_id = processo.get("cliente_id")
    if not cliente_id:
        return None
    result = await supabase.table("leads").select("telefone").eq("id", cliente_id).limit(1).execute()
    return result.data[0].get("telefone") if result.data else None


async def executar_ciclo_monitoramento() -> None:
    """
    Scheduler entry point.
    Fetches all monitored processes and checks each one.
    """
    logger.info("Iniciando ciclo de monitoramento")
    supabase = await get_supabase()

    result = await supabase.table("processos").select(
        "id, numero_cnj, advogado_id, cliente_id, notificar_cliente, ultima_verificacao_at"
    ).eq("monitorar", True).neq("status", "arquivado").execute()

    processos = result.data or []
    logger.info("Processos monitorados", total=len(processos))

    for processo in processos:
        await verificar_processo(processo)

    logger.info("Ciclo de monitoramento concluído", total=len(processos))
