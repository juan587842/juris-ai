"""Endpoints de inboxes (canais de atendimento)."""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase

router = APIRouter(prefix="/inboxes", tags=["inboxes"])
logger = get_logger("inboxes.router")


class InboxCreate(BaseModel):
    nome: str
    canal: str = "whatsapp"
    evolution_instance: str | None = None


class InboxUpdate(BaseModel):
    nome: str | None = None
    evolution_instance: str | None = None
    ativo: bool | None = None


@router.get("")
async def list_inboxes(_user: AuthUser) -> dict:
    supabase = await get_supabase()
    try:
        res = await supabase.table("inboxes").select("*").order("created_at").execute()
    except Exception as exc:
        logger.error("Erro ao listar inboxes: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc
    return {"inboxes": res.data or []}


@router.post("")
async def create_inbox(_user: AuthUser, body: InboxCreate) -> dict:
    supabase = await get_supabase()
    payload = body.model_dump()
    try:
        res = await supabase.table("inboxes").insert(payload).execute()
    except Exception as exc:
        logger.error("Erro ao criar inbox: %s", exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc
    return res.data[0] if res.data else {}


@router.put("/{inbox_id}")
async def update_inbox(_user: AuthUser, inbox_id: str, body: InboxUpdate) -> dict:
    supabase = await get_supabase()
    update = {k: v for k, v in body.model_dump().items() if v is not None}
    if not update:
        raise HTTPException(status_code=400, detail="Nenhum campo para atualizar")
    try:
        res = (
            await supabase.table("inboxes")
            .update(update)
            .eq("id", inbox_id)
            .execute()
        )
    except Exception as exc:
        logger.error("Erro ao atualizar inbox %s: %s", inbox_id, exc)
        raise HTTPException(status_code=503, detail="Serviço temporariamente indisponível") from exc
    return res.data[0] if res.data else {}
