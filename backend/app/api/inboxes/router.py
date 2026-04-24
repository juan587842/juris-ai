"""Endpoints de inboxes (canais de atendimento)."""
from typing import Literal

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase
from app.integrations.evolution import get_evolution_client

router = APIRouter(prefix="/inboxes", tags=["inboxes"])
logger = get_logger("inboxes.router")


class InboxCreate(BaseModel):
    nome: str
    canal: Literal["whatsapp", "webchat", "email"] = "whatsapp"
    evolution_instance: str | None = None


class InboxUpdate(BaseModel):
    nome: str | None = None
    evolution_instance: str | None = None
    ativo: bool | None = None


class EvolutionCreateBody(BaseModel):
    instance_name: str


async def _get_inbox(inbox_id: str) -> dict:
    supabase = await get_supabase()
    res = (
        await supabase.table("inboxes")
        .select("*")
        .eq("id", inbox_id)
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Inbox não encontrado")
    return res.data


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
    if not res.data:
        raise HTTPException(status_code=404, detail="Inbox não encontrado")
    return res.data[0]


# ── Evolution API ─────────────────────────────────────────────────────────────

@router.post("/{inbox_id}/evolution/create")
async def evolution_create(
    _user: AuthUser, inbox_id: str, body: EvolutionCreateBody
) -> dict:
    await _get_inbox(inbox_id)
    evo = get_evolution_client()
    try:
        result = await evo.create_instance(body.instance_name)
    except Exception as exc:
        logger.error("Erro ao criar instância Evolution %s: %s", body.instance_name, exc)
        raise HTTPException(status_code=502, detail="Erro ao comunicar com Evolution API") from exc

    supabase = await get_supabase()
    await (
        supabase.table("inboxes")
        .update({"evolution_instance": body.instance_name})
        .eq("id", inbox_id)
        .execute()
    )

    qrcode = result.get("qrcode", {}).get("base64") or ""
    return {"state": "connecting", "qrcode": qrcode}


@router.get("/{inbox_id}/evolution/status")
async def evolution_status(_user: AuthUser, inbox_id: str) -> dict:
    inbox = await _get_inbox(inbox_id)
    instance = inbox.get("evolution_instance")
    if not instance:
        raise HTTPException(status_code=400, detail="Inbox não tem instância Evolution configurada")
    evo = get_evolution_client()
    state = await evo.get_connection_state(instance)
    return {"state": state}


@router.get("/{inbox_id}/evolution/qrcode")
async def evolution_qrcode(_user: AuthUser, inbox_id: str) -> dict:
    inbox = await _get_inbox(inbox_id)
    instance = inbox.get("evolution_instance")
    if not instance:
        raise HTTPException(status_code=400, detail="Inbox não tem instância Evolution configurada")
    evo = get_evolution_client()
    try:
        qr = await evo.get_qr_code(instance)
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc
    except Exception as exc:
        logger.error("Erro ao obter QR code para %s: %s", instance, exc)
        raise HTTPException(status_code=502, detail="Erro ao comunicar com Evolution API") from exc
    return {"qrcode": qr}


@router.delete("/{inbox_id}/evolution/delete")
async def evolution_delete(_user: AuthUser, inbox_id: str) -> dict:
    inbox = await _get_inbox(inbox_id)
    instance = inbox.get("evolution_instance")
    if not instance:
        raise HTTPException(status_code=400, detail="Inbox não tem instância Evolution configurada")
    evo = get_evolution_client()
    try:
        await evo.delete_instance(instance)
    except Exception as exc:
        logger.error("Erro ao deletar instância Evolution %s: %s", instance, exc)
        raise HTTPException(status_code=502, detail="Erro ao comunicar com Evolution API") from exc

    supabase = await get_supabase()
    await (
        supabase.table("inboxes")
        .update({"evolution_instance": None})
        .eq("id", inbox_id)
        .execute()
    )
    return {"ok": True}
