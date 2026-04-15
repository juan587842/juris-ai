"""Endpoint de métricas para o Dashboard."""
from datetime import date, timedelta

from fastapi import APIRouter

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase

router = APIRouter(prefix="/dashboard", tags=["dashboard"])
logger = get_logger("dashboard.router")


@router.get("/stats")
async def get_stats(_user: AuthUser) -> dict:
    """Retorna KPIs consolidados para o dashboard do escritório."""
    supabase = await get_supabase()

    # ─── Processos por status ─────────────────────────────────────────────────
    proc_statuses = ["ativo", "suspenso", "finalizado"]
    proc_counts: dict[str, int] = {}
    for s in proc_statuses:
        r = (
            await supabase.table("processos")
            .select("id", count="exact")
            .eq("status", s)
            .execute()
        )
        proc_counts[s] = r.count or 0

    processos = {
        "total": sum(proc_counts.values()),
        **proc_counts,
    }

    # ─── Leads por status ─────────────────────────────────────────────────────
    lead_statuses = ["novo", "contato_feito", "qualificado", "convertido", "desqualificado"]
    lead_counts: dict[str, int] = {}
    for s in lead_statuses:
        r = (
            await supabase.table("leads")
            .select("id", count="exact")
            .eq("status", s)
            .execute()
        )
        lead_counts[s] = r.count or 0

    leads = {
        "total": sum(lead_counts.values()),
        **lead_counts,
    }

    # ─── Intimações urgentes (prazo ≤ hoje + 5 dias) ─────────────────────────
    prazo_limite = (date.today() + timedelta(days=5)).isoformat()
    intimacoes_raw = (
        await supabase.table("intimacoes")
        .select("id, processo_id, prazo_fatal, fonte, processos(id, numero_cnj, status)")
        .lte("prazo_fatal", prazo_limite)
        .not_.is_("prazo_fatal", "null")
        .order("prazo_fatal", desc=False)
        .limit(20)
        .execute()
    )

    intimacoes_urgentes = []
    for item in (intimacoes_raw.data or []):
        processo = item.get("processos") or {}
        # Excluir processos arquivados
        if processo.get("status") == "arquivado":
            continue
        intimacoes_urgentes.append({
            "id": item["id"],
            "processo_id": item["processo_id"],
            "processo_cnj": processo.get("numero_cnj", "—"),
            "prazo_fatal": item["prazo_fatal"],
            "fonte": item["fonte"],
        })

    # ─── Andamentos recentes ──────────────────────────────────────────────────
    andamentos_raw = (
        await supabase.table("andamentos")
        .select("id, processo_id, data_andamento, texto_original, created_at, processos(id, numero_cnj)")
        .order("created_at", desc=True)
        .limit(7)
        .execute()
    )

    andamentos_recentes = []
    for item in (andamentos_raw.data or []):
        processo = item.get("processos") or {}
        andamentos_recentes.append({
            "id": item["id"],
            "processo_id": item["processo_id"],
            "processo_cnj": processo.get("numero_cnj", "—"),
            "data_andamento": item["data_andamento"],
            "texto_original": item["texto_original"],
            "created_at": item["created_at"],
        })

    # ─── Leads recentes ───────────────────────────────────────────────────────
    leads_raw = (
        await supabase.table("leads")
        .select("id, nome, telefone, status, created_at")
        .order("created_at", desc=True)
        .limit(5)
        .execute()
    )

    leads_recentes = leads_raw.data or []

    return {
        "processos": processos,
        "leads": leads,
        "intimacoes_urgentes": intimacoes_urgentes,
        "andamentos_recentes": andamentos_recentes,
        "leads_recentes": leads_recentes,
    }
