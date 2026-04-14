"""Endpoints do painel de chat interno."""
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.evolution import get_evolution_client
from app.integrations.supabase import get_supabase
from app.models.chat import (
    AssignRequest,
    ConversationEventTipo,
    NoteRequest,
    SendMessageRequest,
)

router = APIRouter(prefix="/conversations", tags=["chat"])
logger = get_logger("chat.router")


async def _get_conversation_or_404(conversation_id: UUID) -> dict:
    supabase = await get_supabase()
    result = (
        await supabase.table("conversations")
        .select("*, leads(telefone)")
        .eq("id", str(conversation_id))
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Conversa não encontrada")
    return result.data


# ─── Listar conversas ─────────────────────────────────────────────────────────

@router.get("/")
async def list_conversations(
    current_user: AuthUser,
    status: str | None = None,
    limit: int = 50,
    offset: int = 0,
):
    supabase = await get_supabase()
    query = (
        supabase.table("conversations")
        .select(
            "id, status, ai_enabled, last_message_at, created_at, "
            "assigned_user_id, leads(id, nome, telefone)"
        )
        .order("last_message_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if status:
        query = query.eq("status", status)

    result = await query.execute()
    return result.data


# ─── Listar mensagens de uma conversa ────────────────────────────────────────

@router.get("/{conversation_id}/messages")
async def list_messages(conversation_id: UUID, current_user: AuthUser):
    await _get_conversation_or_404(conversation_id)
    supabase = await get_supabase()
    result = (
        await supabase.table("messages")
        .select("*")
        .eq("conversation_id", str(conversation_id))
        .order("created_at")
        .execute()
    )
    return result.data


# ─── Enviar mensagem (humano → WhatsApp) ─────────────────────────────────────

@router.post("/{conversation_id}/messages", status_code=status.HTTP_201_CREATED)
async def send_message(
    conversation_id: UUID,
    body: SendMessageRequest,
    current_user: AuthUser,
):
    conv = await _get_conversation_or_404(conversation_id)
    phone: str = conv["leads"]["telefone"].lstrip("+")

    # Enviar via Evolution
    evolution = get_evolution_client()
    try:
        await evolution.send_text(phone, body.content)
    except Exception as exc:
        logger.error("Falha ao enviar mensagem Evolution", error=str(exc))
        raise HTTPException(status_code=502, detail="Falha ao enviar mensagem WhatsApp")

    # Persistir no banco
    supabase = await get_supabase()
    result = await supabase.table("messages").insert({
        "conversation_id": str(conversation_id),
        "sender_type": "agent",
        "sender_id": current_user.id,
        "content": body.content,
    }).execute()

    return result.data[0]


# ─── Assumir / atribuir conversa ─────────────────────────────────────────────

@router.post("/{conversation_id}/assign", status_code=status.HTTP_200_OK)
async def assign_conversation(
    conversation_id: UUID,
    body: AssignRequest,
    current_user: AuthUser,
):
    await _get_conversation_or_404(conversation_id)
    supabase = await get_supabase()

    await supabase.table("conversations").update({
        "assigned_user_id": str(body.user_id),
        "status": "em_atendimento",
    }).eq("id", str(conversation_id)).execute()

    await supabase.table("conversation_events").insert({
        "conversation_id": str(conversation_id),
        "tipo": ConversationEventTipo.atribuida,
        "actor_id": current_user.id,
        "metadata": {"assigned_to": str(body.user_id)},
    }).execute()

    return {"status": "ok"}


# ─── Pausar IA ────────────────────────────────────────────────────────────────

@router.post("/{conversation_id}/pause-ai", status_code=status.HTTP_200_OK)
async def pause_ai(conversation_id: UUID, current_user: AuthUser):
    conv = await _get_conversation_or_404(conversation_id)
    supabase = await get_supabase()

    await supabase.table("conversations").update({
        "ai_enabled": False,
        "assigned_user_id": current_user.id,
        "status": "em_atendimento",
    }).eq("id", str(conversation_id)).execute()

    await supabase.table("conversation_events").insert({
        "conversation_id": str(conversation_id),
        "tipo": ConversationEventTipo.ai_pausada,
        "actor_id": current_user.id,
        "metadata": {"previous_ai_enabled": conv.get("ai_enabled", True)},
    }).execute()

    logger.info("IA pausada", conversation_id=str(conversation_id), user=current_user.id)
    return {"status": "ok", "ai_enabled": False}


# ─── Retomar IA ───────────────────────────────────────────────────────────────

@router.post("/{conversation_id}/resume-ai", status_code=status.HTTP_200_OK)
async def resume_ai(conversation_id: UUID, current_user: AuthUser):
    await _get_conversation_or_404(conversation_id)
    supabase = await get_supabase()

    await supabase.table("conversations").update({
        "ai_enabled": True,
    }).eq("id", str(conversation_id)).execute()

    await supabase.table("conversation_events").insert({
        "conversation_id": str(conversation_id),
        "tipo": ConversationEventTipo.ai_retomada,
        "actor_id": current_user.id,
    }).execute()

    return {"status": "ok", "ai_enabled": True}


# ─── Resolver conversa ────────────────────────────────────────────────────────

@router.post("/{conversation_id}/resolve", status_code=status.HTTP_200_OK)
async def resolve_conversation(conversation_id: UUID, current_user: AuthUser):
    await _get_conversation_or_404(conversation_id)
    supabase = await get_supabase()

    await supabase.table("conversations").update({
        "status": "resolvida",
        "ai_enabled": False,
    }).eq("id", str(conversation_id)).execute()

    await supabase.table("conversation_events").insert({
        "conversation_id": str(conversation_id),
        "tipo": ConversationEventTipo.resolvida,
        "actor_id": current_user.id,
    }).execute()

    return {"status": "ok"}


# ─── Notas internas ───────────────────────────────────────────────────────────

@router.post("/{conversation_id}/notes", status_code=status.HTTP_201_CREATED)
async def add_note(
    conversation_id: UUID,
    body: NoteRequest,
    current_user: AuthUser,
):
    await _get_conversation_or_404(conversation_id)
    supabase = await get_supabase()

    result = await supabase.table("internal_notes").insert({
        "conversation_id": str(conversation_id),
        "user_id": current_user.id,
        "content": body.content,
    }).execute()

    return result.data[0]


@router.get("/{conversation_id}/notes")
async def list_notes(conversation_id: UUID, current_user: AuthUser):
    await _get_conversation_or_404(conversation_id)
    supabase = await get_supabase()

    result = (
        await supabase.table("internal_notes")
        .select("*")
        .eq("conversation_id", str(conversation_id))
        .order("created_at")
        .execute()
    )
    return result.data
