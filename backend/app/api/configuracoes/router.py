"""Endpoints de configurações — perfil e escritório."""
from datetime import datetime, timezone

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase

router = APIRouter(prefix="/configuracoes", tags=["configuracoes"])
logger = get_logger("configuracoes.router")


# ── Perfil ────────────────────────────────────────────────────────────────────

class NotifPreferences(BaseModel):
    dias_processo: int = 7
    dias_lead: int = 3
    dias_prazo: int = 5
    dias_oportunidade: int = 14
    canal: str = "whatsapp"


class PerfilUpdate(BaseModel):
    full_name: str | None = None
    oab_number: str | None = None
    avatar_url: str | None = None
    notif_preferences: NotifPreferences | None = None


@router.get("/perfil")
async def get_perfil(user: AuthUser) -> dict:
    supabase = await get_supabase()
    try:
        res = (
            await supabase.table("profiles")
            .select("id, full_name, oab_number, avatar_url, role, notif_preferences")
            .eq("id", user.id)
            .single()
            .execute()
        )
    except Exception as exc:
        logger.error("Erro ao buscar perfil: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc

    if not res.data:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")

    data = dict(res.data)
    data["email"] = user.email
    return data


@router.put("/perfil")
async def update_perfil(user: AuthUser, body: PerfilUpdate) -> dict:
    supabase = await get_supabase()
    update: dict = {}
    if body.full_name is not None:
        update["full_name"] = body.full_name
    if body.oab_number is not None:
        update["oab_number"] = body.oab_number
    if body.avatar_url is not None:
        update["avatar_url"] = body.avatar_url
    if body.notif_preferences is not None:
        update["notif_preferences"] = body.notif_preferences.model_dump()

    if not update:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")

    update["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        res = (
            await supabase.table("profiles")
            .update(update)
            .eq("id", user.id)
            .execute()
        )
    except Exception as exc:
        logger.error("Erro ao atualizar perfil: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc

    if not res.data:
        raise HTTPException(status_code=404, detail="Perfil não encontrado")
    return res.data[0]


# ── Escritório ────────────────────────────────────────────────────────────────

class EscritorioUpdate(BaseModel):
    nome: str
    oab: str | None = None
    logo_url: str | None = None
    endereco: str | None = None
    telefone: str | None = None
    site: str | None = None
    assinatura: str | None = None
    rodape: str | None = None


async def _require_admin(user_id: str) -> None:
    supabase = await get_supabase()
    try:
        res = (
            await supabase.table("profiles")
            .select("role")
            .eq("id", user_id)
            .single()
            .execute()
        )
    except Exception as exc:
        logger.error("Erro ao verificar permissão de admin: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc
    if not res.data or res.data.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Apenas administradores podem editar dados do escritório")


@router.get("/escritorio")
async def get_escritorio(_user: AuthUser) -> dict:
    supabase = await get_supabase()
    try:
        res = await supabase.table("escritorio").select("*").limit(1).execute()
    except Exception as exc:
        logger.error("Erro ao buscar escritório: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc
    return res.data[0] if res.data else {}


@router.put("/escritorio")
async def update_escritorio(user: AuthUser, body: EscritorioUpdate) -> dict:
    await _require_admin(user.id)
    supabase = await get_supabase()

    payload = body.model_dump()
    payload["updated_at"] = datetime.now(timezone.utc).isoformat()

    try:
        existing = await supabase.table("escritorio").select("id").limit(1).execute()
        if existing.data:
            row_id = existing.data[0]["id"]
            res = (
                await supabase.table("escritorio")
                .update(payload)
                .eq("id", row_id)
                .execute()
            )
        else:
            payload["created_at"] = payload["updated_at"]
            res = await supabase.table("escritorio").insert(payload).execute()
    except Exception as exc:
        logger.error("Erro ao atualizar escritório: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc

    return res.data[0] if res.data else {}
