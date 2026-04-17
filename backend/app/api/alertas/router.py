"""Endpoint de alertas inteligentes."""
from datetime import date, datetime, timedelta, timezone
from typing import Literal

from fastapi import APIRouter, HTTPException, Query

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase

router = APIRouter(prefix="/alertas", tags=["alertas"])
logger = get_logger("alertas.router")

SeveridadeType = Literal["alta", "media", "baixa"]
_SEVERIDADE_ORDER: dict[str, int] = {"alta": 0, "media": 1, "baixa": 2}


# ─── Funções puras de severidade (testáveis sem Supabase) ─────────────────────

def _severidade_processo(dias: int) -> SeveridadeType:
    """Alta se >60 dias, média se 30–60, baixa se <30."""
    if dias > 60:
        return "alta"
    if dias >= 30:
        return "media"
    return "baixa"


def _severidade_lead(dias: int) -> SeveridadeType:
    """Alta se >14 dias, média se 7–14, baixa se <7."""
    if dias > 14:
        return "alta"
    if dias >= 7:
        return "media"
    return "baixa"


def _severidade_prazo(dias_ate_vencimento: int) -> SeveridadeType:
    """Alta se ≤2 dias, média se 3–5, baixa se >5."""
    if dias_ate_vencimento <= 2:
        return "alta"
    if dias_ate_vencimento <= 5:
        return "media"
    return "baixa"


def _severidade_oportunidade(dias: int) -> SeveridadeType:
    """Alta se >30 dias, média se 15–30, baixa se <15."""
    if dias > 30:
        return "alta"
    if dias >= 15:
        return "media"
    return "baixa"


# ─── Endpoint ─────────────────────────────────────────────────────────────────

@router.get("")
async def get_alertas(
    _user: AuthUser,
    dias_processo: int = Query(default=30, ge=1),
    dias_lead: int = Query(default=7, ge=1),
    dias_prazo: int = Query(default=5, ge=1),
    dias_oportunidade: int = Query(default=15, ge=1),
) -> dict:
    """Retorna alertas operacionais agrupados por tipo e ordenados por severidade."""
    now = datetime.now(timezone.utc)
    cutoff_processo = (now - timedelta(days=dias_processo)).isoformat()
    cutoff_lead = (now - timedelta(days=dias_lead)).isoformat()
    cutoff_oportunidade = (now - timedelta(days=dias_oportunidade)).isoformat()
    hoje = date.today()
    prazo_limite = (hoje + timedelta(days=dias_prazo)).isoformat()
    hoje_str = hoje.isoformat()

    try:
        supabase = await get_supabase()

        # C1: processos sem andamento — duas etapas
        recent_and_res = (
            await supabase.table("andamentos")
            .select("processo_id")
            .gte("created_at", cutoff_processo)
            .execute()
        )
        recent_ids = {row["processo_id"] for row in recent_and_res.data or []}

        proc_res = (
            await supabase.table("processos")
            .select("id, numero_cnj, updated_at")
            .eq("status", "ativo")
            .execute()
        )
        processos_inativos = [p for p in (proc_res.data or []) if p["id"] not in recent_ids]

        # C2: leads sem contato
        leads_res = (
            await supabase.table("leads")
            .select("id, nome, telefone, updated_at")
            .lt("updated_at", cutoff_lead)
            .not_.in_("status", ["convertido", "desqualificado"])
            .execute()
        )
        leads_inativos = leads_res.data or []

        # C3: prazos fatais próximos (join com processos para obter numero_cnj)
        prazos_res = (
            await supabase.table("intimacoes")
            .select("id, processo_id, prazo_fatal, processos(numero_cnj)")
            .gte("prazo_fatal", hoje_str)
            .lte("prazo_fatal", prazo_limite)
            .execute()
        )
        prazos = prazos_res.data or []

        # C4: oportunidades paradas
        ops_res = (
            await supabase.table("oportunidades")
            .select("id, titulo, updated_at, lead_id")
            .lt("updated_at", cutoff_oportunidade)
            .not_.in_("estagio", ["ganho", "perdido"])
            .execute()
        )
        ops_paradas = ops_res.data or []

    except Exception as exc:
        logger.error("Erro ao buscar alertas: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc

    alertas: list[dict] = []

    for p in processos_inativos:
        try:
            updated = datetime.fromisoformat(str(p["updated_at"]).replace("Z", "+00:00"))
            dias = max((now - updated).days, 0)
        except (ValueError, TypeError, KeyError):
            dias = dias_processo
        alertas.append({
            "tipo": "processo_sem_andamento",
            "id": p["id"],
            "titulo": p["numero_cnj"],
            "descricao": f"Sem andamentos há {dias} dias",
            "link": f"/processos/{p['id']}",
            "severidade": _severidade_processo(dias),
            "dias": dias,
        })

    for lead in leads_inativos:
        try:
            updated = datetime.fromisoformat(str(lead["updated_at"]).replace("Z", "+00:00"))
            dias = max((now - updated).days, 0)
        except (ValueError, TypeError, KeyError):
            dias = dias_lead
        nome = lead.get("nome") or lead.get("telefone") or "Lead"
        alertas.append({
            "tipo": "lead_sem_contato",
            "id": lead["id"],
            "titulo": nome,
            "descricao": f"Sem atualização há {dias} dias",
            "link": f"/crm/{lead['id']}",
            "severidade": _severidade_lead(dias),
            "dias": dias,
        })

    for intimacao in prazos:
        try:
            prazo = date.fromisoformat(str(intimacao["prazo_fatal"]))
            dias_restantes = max((prazo - hoje).days, 0)
        except (ValueError, TypeError, KeyError):
            dias_restantes = 0
        processo_data = intimacao.get("processos") or {}
        cnj = processo_data.get("numero_cnj") or "Processo"
        alertas.append({
            "tipo": "prazo_fatal",
            "id": intimacao["id"],
            "titulo": cnj,
            "descricao": f"Prazo fatal em {dias_restantes} dia{'s' if dias_restantes != 1 else ''}",
            "link": f"/processos/{intimacao['processo_id']}",
            "severidade": _severidade_prazo(dias_restantes),
            "dias": dias_restantes,
        })

    for op in ops_paradas:
        try:
            updated = datetime.fromisoformat(str(op["updated_at"]).replace("Z", "+00:00"))
            dias = max((now - updated).days, 0)
        except (ValueError, TypeError, KeyError):
            dias = dias_oportunidade
        alertas.append({
            "tipo": "oportunidade_parada",
            "id": op["id"],
            "titulo": op.get("titulo") or "Oportunidade",
            "descricao": f"Sem movimentação há {dias} dias",
            "link": f"/crm/{op['lead_id']}" if op.get("lead_id") else f"/oportunidades/{op['id']}",
            "severidade": _severidade_oportunidade(dias),
            "dias": dias,
        })

    alertas.sort(key=lambda a: _SEVERIDADE_ORDER[a["severidade"]])

    return {"alertas": alertas, "total": len(alertas)}
