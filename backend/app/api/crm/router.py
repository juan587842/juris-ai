"""Endpoints do módulo CRM (leads e oportunidades)."""
from uuid import UUID

from fastapi import APIRouter, HTTPException, Query, status

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase
from app.models.crm import (
    LeadCreate,
    LeadStatus,
    LeadUpdate,
    OportunidadeCreate,
    OportunidadeEstagio,
    OportunidadeUpdate,
)

router = APIRouter(prefix="/crm", tags=["crm"])
logger = get_logger("crm.router")


# ─── Leads ────────────────────────────────────────────────────────────────────

@router.get("/leads")
async def list_leads(
    current_user: AuthUser,
    status_filter: LeadStatus | None = Query(default=None, alias="status"),
    origem: str | None = None,
    assigned_to: UUID | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
):
    supabase = await get_supabase()
    query = (
        supabase.table("leads")
        .select("*")
        .order("updated_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if status_filter:
        query = query.eq("status", status_filter.value)
    if origem:
        query = query.eq("origem", origem)
    if assigned_to:
        query = query.eq("assigned_to", str(assigned_to))

    result = await query.execute()
    return result.data


@router.get("/leads/{lead_id}")
async def get_lead(lead_id: UUID, current_user: AuthUser):
    supabase = await get_supabase()
    lead_result = (
        await supabase.table("leads")
        .select("*")
        .eq("id", str(lead_id))
        .single()
        .execute()
    )
    if not lead_result.data:
        raise HTTPException(status_code=404, detail="Lead não encontrado")

    conv_result = (
        await supabase.table("conversations")
        .select("id, status, ai_enabled, last_message_at, created_at")
        .eq("lead_id", str(lead_id))
        .order("created_at", desc=True)
        .execute()
    )

    op_result = (
        await supabase.table("oportunidades")
        .select("*")
        .eq("lead_id", str(lead_id))
        .order("created_at", desc=True)
        .execute()
    )

    return {
        "lead": lead_result.data,
        "conversations": conv_result.data or [],
        "oportunidades": op_result.data or [],
    }


@router.post("/leads", status_code=status.HTTP_201_CREATED)
async def create_lead(body: LeadCreate, current_user: AuthUser):
    supabase = await get_supabase()
    payload = body.model_dump(exclude_none=True)
    if "email" in payload:
        payload["email"] = str(payload["email"])

    result = await supabase.table("leads").upsert(
        payload, on_conflict="telefone", ignore_duplicates=False
    ).execute()

    if not result.data:
        raise HTTPException(status_code=500, detail="Falha ao criar lead")
    return result.data[0]


@router.patch("/leads/{lead_id}")
async def update_lead(lead_id: UUID, body: LeadUpdate, current_user: AuthUser):
    supabase = await get_supabase()
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    if "email" in payload:
        payload["email"] = str(payload["email"])
    if "assigned_to" in payload:
        payload["assigned_to"] = str(payload["assigned_to"])
    if "status" in payload and hasattr(payload["status"], "value"):
        payload["status"] = payload["status"].value
    if "area_interesse" in payload and hasattr(payload["area_interesse"], "value"):
        payload["area_interesse"] = payload["area_interesse"].value

    result = (
        await supabase.table("leads")
        .update(payload)
        .eq("id", str(lead_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Lead não encontrado")
    return result.data[0]


@router.delete("/leads/{lead_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_lead(lead_id: UUID, current_user: AuthUser):
    """Soft delete via anonimização (LGPD)."""
    supabase = await get_supabase()
    await supabase.table("leads").update({
        "nome": "[REMOVIDO]",
        "email": None,
        "notas": None,
        "status": LeadStatus.desqualificado.value,
    }).eq("id", str(lead_id)).execute()
    return None


# ─── Oportunidades ────────────────────────────────────────────────────────────

@router.get("/oportunidades")
async def list_oportunidades(
    current_user: AuthUser,
    estagio: OportunidadeEstagio | None = None,
    lead_id: UUID | None = None,
    limit: int = Query(default=100, le=500),
    offset: int = 0,
):
    supabase = await get_supabase()
    query = (
        supabase.table("oportunidades")
        .select("*, leads(id, nome, telefone)")
        .order("updated_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if estagio:
        query = query.eq("estagio", estagio.value)
    if lead_id:
        query = query.eq("lead_id", str(lead_id))

    result = await query.execute()
    return result.data


@router.post("/oportunidades", status_code=status.HTTP_201_CREATED)
async def create_oportunidade(body: OportunidadeCreate, current_user: AuthUser):
    supabase = await get_supabase()
    payload = body.model_dump(exclude_none=True)
    payload["lead_id"] = str(payload["lead_id"])
    if hasattr(payload["estagio"], "value"):
        payload["estagio"] = payload["estagio"].value
    if "area_juridica" in payload and hasattr(payload["area_juridica"], "value"):
        payload["area_juridica"] = payload["area_juridica"].value
    if "valor_estimado" in payload:
        payload["valor_estimado"] = float(payload["valor_estimado"])
    if "data_fechamento" in payload:
        payload["data_fechamento"] = payload["data_fechamento"].isoformat()

    result = await supabase.table("oportunidades").insert(payload).execute()
    if not result.data:
        raise HTTPException(status_code=500, detail="Falha ao criar oportunidade")
    return result.data[0]


@router.patch("/oportunidades/{oportunidade_id}")
async def update_oportunidade(
    oportunidade_id: UUID, body: OportunidadeUpdate, current_user: AuthUser,
):
    supabase = await get_supabase()
    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    for key in ("estagio", "area_juridica"):
        if key in payload and hasattr(payload[key], "value"):
            payload[key] = payload[key].value
    if "valor_estimado" in payload:
        payload["valor_estimado"] = float(payload["valor_estimado"])
    if "data_fechamento" in payload:
        payload["data_fechamento"] = payload["data_fechamento"].isoformat()
    if "assigned_to" in payload:
        payload["assigned_to"] = str(payload["assigned_to"])

    result = (
        await supabase.table("oportunidades")
        .update(payload)
        .eq("id", str(oportunidade_id))
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Oportunidade não encontrada")
    return result.data[0]


@router.delete("/oportunidades/{oportunidade_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_oportunidade(oportunidade_id: UUID, current_user: AuthUser):
    supabase = await get_supabase()
    await supabase.table("oportunidades").delete().eq("id", str(oportunidade_id)).execute()
    return None
