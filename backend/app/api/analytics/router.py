# backend/app/api/analytics/router.py
"""Endpoint de métricas estratégicas (Jurimetria / BI)."""
from datetime import datetime, timedelta, timezone

from fastapi import APIRouter, Query

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase

router = APIRouter(prefix="/analytics", tags=["analytics"])
logger = get_logger("analytics.router")

_PERIODO_DIAS: dict[str, int] = {"30d": 30, "90d": 90, "365d": 365}


def _cutoff(dias: int) -> str:
    """Retorna ISO 8601 de (agora - dias) em UTC."""
    dt = datetime.now(timezone.utc) - timedelta(days=dias)
    return dt.isoformat()


# ─── Funções de agregação puras (testáveis sem Supabase) ─────────────────────


def _calcular_funil(leads: list[dict]) -> dict:
    """Agrupa leads por status e calcula taxa de conversão."""
    contagem: dict[str, int] = {}
    for lead in leads:
        s = lead.get("status") or "novo"
        contagem[s] = contagem.get(s, 0) + 1
    total = len(leads)
    convertido = contagem.get("convertido", 0)
    taxa = round(convertido / total * 100, 1) if total > 0 else 0.0
    return {
        "novo": contagem.get("novo", 0),
        "contato_feito": contagem.get("contato_feito", 0),
        "qualificado": contagem.get("qualificado", 0),
        "convertido": convertido,
        "perdido": contagem.get("desqualificado", 0),
        "taxa_conversao_pct": taxa,
    }


def _calcular_receita_por_area(ops: list[dict]) -> list[dict]:
    """Soma valor_estimado por area_juridica, ordenado do maior para o menor."""
    totais: dict[str, float] = {}
    for op in ops:
        area = op.get("area_juridica") or "outro"
        valor = float(op.get("valor_estimado") or 0)
        totais[area] = totais.get(area, 0.0) + valor
    return [
        {"area": area, "total": round(total, 2)}
        for area, total in sorted(totais.items(), key=lambda x: -x[1])
    ]


def _calcular_taxa_exito(processos: list[dict]) -> list[dict]:
    """% de processos com resultado procedente ou acordo por area_juridica.

    Ignora processos com resultado IS NULL (em andamento).
    """
    contagem: dict[str, dict[str, int]] = {}
    for p in processos:
        if p.get("resultado") is None:
            continue
        area = p.get("area_juridica") or "outro"
        if area not in contagem:
            contagem[area] = {"total": 0, "exito": 0}
        contagem[area]["total"] += 1
        if p["resultado"] in ("procedente", "acordo"):
            contagem[area]["exito"] += 1
    resultado = []
    for area, c in contagem.items():
        pct = round(c["exito"] / c["total"] * 100, 1) if c["total"] > 0 else 0.0
        resultado.append({"area": area, "exito_pct": pct, "total": c["total"]})
    return sorted(resultado, key=lambda x: -x["exito_pct"])


def _calcular_tempo_medio(processos: list[dict]) -> list[dict]:
    """Tempo médio (dias) entre created_at e updated_at para processos finalizados.

    Usa updated_at como proxy de data_encerramento (campo não existe no schema).
    Ignora processos com resultado IS NULL.
    """
    duracao: dict[str, list[float]] = {}
    for p in processos:
        if p.get("resultado") is None:
            continue
        area = p.get("area_juridica") or "outro"
        try:
            created = datetime.fromisoformat(
                str(p["created_at"]).replace("Z", "+00:00")
            )
            updated = datetime.fromisoformat(
                str(p["updated_at"]).replace("Z", "+00:00")
            )
            dias = max((updated - created).days, 0)
        except (KeyError, ValueError, TypeError):
            continue
        duracao.setdefault(area, []).append(dias)
    resultado = []
    for area, dias_list in duracao.items():
        media_dias = round(sum(dias_list) / len(dias_list)) if dias_list else 0
        resultado.append(
            {"area": area, "media_dias": media_dias, "total": len(dias_list)}
        )
    return sorted(resultado, key=lambda x: x["media_dias"])


def _calcular_distribuicao_tribunal(processos: list[dict]) -> list[dict]:
    """Conta processos por tribunal, ordenado do maior para o menor."""
    contagem: dict[str, int] = {}
    for p in processos:
        tribunal = p.get("tribunal") or "Não informado"
        contagem[tribunal] = contagem.get(tribunal, 0) + 1
    return [
        {"tribunal": t, "count": c}
        for t, c in sorted(contagem.items(), key=lambda x: -x[1])
    ]


def _calcular_origem_leads(leads: list[dict]) -> list[dict]:
    """Conta e calcula % por origem no período."""
    contagem: dict[str, int] = {}
    for lead in leads:
        origem = lead.get("origem") or "outro"
        contagem[origem] = contagem.get(origem, 0) + 1
    total = len(leads)
    return [
        {
            "origem": o,
            "count": c,
            "pct": round(c / total * 100, 1) if total > 0 else 0.0,
        }
        for o, c in sorted(contagem.items(), key=lambda x: -x[1])
    ]


def _calcular_carteira_ativa(processos: list[dict]) -> dict:
    """Conta processos por status (sem filtro de período).

    Status possíveis: ativo, suspenso, finalizado, arquivado.
    """
    contagem: dict[str, int] = {}
    for p in processos:
        s = p.get("status") or "ativo"
        contagem[s] = contagem.get(s, 0) + 1
    return {
        "ativo": contagem.get("ativo", 0),
        "suspenso": contagem.get("suspenso", 0),
        "finalizado": contagem.get("finalizado", 0),
        "arquivado": contagem.get("arquivado", 0),
        "total": sum(contagem.values()),
    }


def _calcular_taxa_exito_geral(processos: list[dict]) -> float | None:
    """% global de processos com resultado procedente ou acordo.

    Retorna None se não houver processos com resultado registrado.
    """
    finalizados = [p for p in processos if p.get("resultado") is not None]
    if not finalizados:
        return None
    exito = sum(1 for p in finalizados if p["resultado"] in ("procedente", "acordo"))
    return round(exito / len(finalizados) * 100, 1)


def _calcular_tempo_medio_geral(processos: list[dict]) -> float | None:
    """Média global de dias entre created_at e updated_at dos processos finalizados.

    Retorna None se não houver processos com resultado registrado.
    """
    dias_list: list[float] = []
    for p in processos:
        if p.get("resultado") is None:
            continue
        try:
            created = datetime.fromisoformat(str(p["created_at"]).replace("Z", "+00:00"))
            updated = datetime.fromisoformat(str(p["updated_at"]).replace("Z", "+00:00"))
            dias_list.append(max((updated - created).days, 0))
        except (KeyError, ValueError, TypeError):
            continue
    if not dias_list:
        return None
    return round(sum(dias_list) / len(dias_list))


def _calcular_atendimento(conversations: list[dict], messages: list[dict]) -> dict:
    """Métricas de atendimento: volume, transbordo e tempo médio de 1ª resposta.

    Args:
        conversations: registros da tabela conversations no período.
        messages: todas as mensagens dessas conversas.

    Returns:
        dict com volume_conversas, pct_transbordo, tempo_medio_resposta_segundos.
    """
    total = len(conversations)
    if total == 0:
        return {
            "volume_conversas": 0,
            "pct_transbordo": None,
            "tempo_medio_resposta_segundos": None,
        }

    transbordo = sum(1 for c in conversations if not c.get("ai_enabled", True))
    pct_transbordo = round(transbordo / total * 100, 1)

    # Agrupar mensagens por conversa
    msgs_por_conv: dict[str, list[dict]] = {}
    for msg in messages:
        conv_id = msg.get("conversation_id", "")
        msgs_por_conv.setdefault(conv_id, []).append(msg)

    tempos: list[float] = []
    for msgs in msgs_por_conv.values():
        msgs_ord = sorted(msgs, key=lambda m: m.get("created_at", ""))
        primeiro_lead = next(
            (m for m in msgs_ord if m.get("sender_type") == "lead"), None
        )
        if not primeiro_lead:
            continue
        primeiro_bot = next(
            (
                m for m in msgs_ord
                if m.get("sender_type") == "bot"
                and m.get("created_at", "") > primeiro_lead.get("created_at", "")
            ),
            None,
        )
        if not primeiro_bot:
            continue
        try:
            t_lead = datetime.fromisoformat(
                str(primeiro_lead["created_at"]).replace("Z", "+00:00")
            )
            t_bot = datetime.fromisoformat(
                str(primeiro_bot["created_at"]).replace("Z", "+00:00")
            )
            diff = (t_bot - t_lead).total_seconds()
            if diff >= 0:
                tempos.append(diff)
        except (ValueError, TypeError):
            continue

    tempo_medio = round(sum(tempos) / len(tempos), 1) if tempos else None

    return {
        "volume_conversas": total,
        "pct_transbordo": pct_transbordo,
        "tempo_medio_resposta_segundos": tempo_medio,
    }


# ─── Endpoint ────────────────────────────────────────────────────────────────


@router.get("")
async def get_analytics(
    _user: AuthUser,
    periodo: str = Query(default="30d", pattern="^(30d|90d|365d)$"),
) -> dict:
    """Retorna métricas estratégicas do escritório para o período especificado."""
    from fastapi import HTTPException

    dias = _PERIODO_DIAS[periodo]
    cutoff = _cutoff(dias)

    try:
        supabase = await get_supabase()

        # Leads criados no período (funil + origem)
        leads_res = (
            await supabase.table("leads")
            .select("status, origem, created_at")
            .gte("created_at", cutoff)
            .execute()
        )
        leads = leads_res.data or []

        # Oportunidades criadas no período, excluindo perdidas (receita)
        ops_res = (
            await supabase.table("oportunidades")
            .select("area_juridica, valor_estimado, estagio, created_at")
            .gte("created_at", cutoff)
            .neq("estagio", "perdido")
            .execute()
        )
        ops = ops_res.data or []

        # Todos os processos (taxa de êxito, tempo médio, tribunal e carteira)
        # limit defensivo de 5000 registros
        todos_proc_res = (
            await supabase.table("processos")
            .select("area_juridica, status, tribunal, resultado, created_at, updated_at")
            .limit(5000)
            .execute()
        )
        todos_processos = todos_proc_res.data or []

    except Exception as exc:
        logger.error("Erro ao buscar dados de analytics: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc

    return {
        "funil_conversao": _calcular_funil(leads),
        "receita_por_area": _calcular_receita_por_area(ops),
        "taxa_exito": _calcular_taxa_exito(todos_processos),
        "tempo_medio": _calcular_tempo_medio(todos_processos),
        "distribuicao_tribunal": _calcular_distribuicao_tribunal(todos_processos),
        "origem_leads": _calcular_origem_leads(leads),
        "carteira_ativa": _calcular_carteira_ativa(todos_processos),
    }
