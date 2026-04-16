"""Webhook da Evolution API — recebe mensagens do WhatsApp."""
import asyncio
import hashlib
import hmac
import re

from fastapi import APIRouter, Header, HTTPException, Request, status

from app.core.config import get_settings
from app.core.logging import get_logger
from app.integrations.evolution import get_evolution_client
from app.integrations.supabase import get_supabase
from app.models.chat import EvolutionWebhookPayload

router = APIRouter(prefix="/webhooks", tags=["webhooks"])
logger = get_logger("webhook.evolution")

_PHONE_RE = re.compile(r"(\d+)@")


def _extract_phone(remote_jid: str) -> str:
    """Extrai número E.164 do remoteJid (ex: '5511999999999@s.whatsapp.net')."""
    match = _PHONE_RE.match(remote_jid)
    if match:
        number = match.group(1)
        if not number.startswith("+"):
            number = f"+{number}"
        return number
    return remote_jid


def _extract_text(message_data: dict) -> str | None:
    """Extrai texto da estrutura de mensagem da Evolution."""
    msg = message_data
    return (
        msg.get("conversation")
        or msg.get("extendedTextMessage", {}).get("text")
        or msg.get("imageMessage", {}).get("caption")
        or msg.get("videoMessage", {}).get("caption")
        or None
    )


def _verify_signature(body: bytes, signature: str | None) -> bool:
    secret = get_settings().evolution_webhook_secret
    if not secret:
        return True  # sem secret configurado, aceita tudo (dev)
    if not signature:
        return False
    expected = hmac.new(secret.encode(), body, hashlib.sha256).hexdigest()
    return hmac.compare_digest(expected, signature)


@router.post("/evolution", status_code=status.HTTP_200_OK)
async def evolution_webhook(
    request: Request,
    x_hub_signature: str | None = Header(default=None, alias="x-hub-signature-256"),
):
    body = await request.body()

    if not _verify_signature(body, x_hub_signature):
        raise HTTPException(status_code=401, detail="Assinatura inválida")

    try:
        payload = EvolutionWebhookPayload.model_validate_json(body)
    except Exception as exc:
        logger.warning("Payload inválido", error=str(exc))
        return {"status": "ignored"}

    # Processar apenas mensagens recebidas (não enviadas pelo bot)
    if payload.event != "messages.upsert":
        return {"status": "ignored"}

    data = payload.data
    if data.key.fromMe:
        return {"status": "ignored"}

    phone = _extract_phone(data.key.remoteJid)
    text = _extract_text(data.message)
    contact_name = data.pushName

    supabase = await get_supabase()

    # ── Upsert do lead ────────────────────────────────────────────────────────
    lead_result = (
        await supabase.table("leads")
        .upsert(
            {"telefone": phone, "nome": contact_name, "origem": "whatsapp"},
            on_conflict="telefone",
            ignore_duplicates=False,
        )
        .execute()
    )
    lead = lead_result.data[0] if lead_result.data else None
    if not lead:
        logger.error("Falha ao upsert lead", phone=phone)
        return {"status": "error"}

    lead_id = lead["id"]

    # ── Buscar inbox WhatsApp (ou criar se não existir) ───────────────────────
    inbox_result = (
        await supabase.table("inboxes")
        .select("id")
        .eq("canal", "whatsapp")
        .eq("evolution_instance", payload.instance)
        .limit(1)
        .execute()
    )

    if inbox_result.data:
        inbox_id = inbox_result.data[0]["id"]
    else:
        new_inbox = (
            await supabase.table("inboxes")
            .insert({
                "nome": f"WhatsApp ({payload.instance})",
                "canal": "whatsapp",
                "evolution_instance": payload.instance,
            })
            .execute()
        )
        inbox_id = new_inbox.data[0]["id"]

    # ── Upsert conversation (reusa se não resolvida) ──────────────────────────
    conv_result = (
        await supabase.table("conversations")
        .select("id, status, ai_enabled")
        .eq("lead_id", lead_id)
        .eq("inbox_id", inbox_id)
        .neq("status", "resolvida")
        .order("created_at", desc=True)
        .limit(1)
        .execute()
    )

    if conv_result.data:
        conversation_id = conv_result.data[0]["id"]
    else:
        new_conv = (
            await supabase.table("conversations")
            .insert({
                "inbox_id": inbox_id,
                "lead_id": lead_id,
                "status": "aberta",
                "ai_enabled": True,
            })
            .execute()
        )
        conversation_id = new_conv.data[0]["id"]

        # Registrar evento de criação
        await supabase.table("conversation_events").insert({
            "conversation_id": conversation_id,
            "tipo": "criada",
            "metadata": {"origem": "whatsapp_webhook"},
        }).execute()

    # ── Inserir mensagem do lead ──────────────────────────────────────────────
    await supabase.table("messages").insert({
        "conversation_id": conversation_id,
        "sender_type": "lead",
        "content": text,
        "media_type": data.messageType if data.messageType != "conversation" else None,
    }).execute()

    logger.info(
        "Mensagem recebida",
        lead_id=lead_id,
        conversation_id=conversation_id,
        msg_type=data.messageType,
    )

    # ── Acionar agente de triagem se IA ativa e há texto ─────────────────────
    conv_data = conv_result.data[0] if conv_result.data else {"ai_enabled": True}
    ai_enabled = conv_data.get("ai_enabled", True)

    if ai_enabled and text:
        asyncio.create_task(
            _processar_com_ia(
                conversation_id=conversation_id,
                lead_id=lead_id,
                lead_phone=phone,
            )
        )

    return {"status": "ok", "conversation_id": conversation_id}


async def _processar_com_ia(
    conversation_id: str,
    lead_id: str,
    lead_phone: str,
) -> None:
    """Busca histórico, roda o agente e envia a resposta via WhatsApp."""
    from app.agents.router import rotear_mensagem

    try:
        supabase = await get_supabase()

        # Buscar histórico da conversa
        hist_result = await supabase.table("messages").select(
            "sender_type, content"
        ).eq("conversation_id", conversation_id).order("created_at").execute()

        historico = hist_result.data or []
        if not historico:
            return

        # Última mensagem do lead
        nova_mensagem = next(
            (m["content"] for m in reversed(historico) if m["sender_type"] == "lead" and m["content"]),
            None,
        )
        if not nova_mensagem:
            return

        # Histórico sem a última mensagem (já será adicionada pelo agente)
        historico_anterior = [m for m in historico[:-1]]

        resposta = await rotear_mensagem(
            conversation_id=conversation_id,
            lead_id=lead_id,
            lead_phone=lead_phone,
            historico=historico_anterior,
            nova_mensagem=nova_mensagem,
        )

        if not resposta:
            return

        # Persistir resposta da IA
        await supabase.table("messages").insert({
            "conversation_id": conversation_id,
            "sender_type": "ai",
            "content": resposta,
        }).execute()

        # Enviar via WhatsApp
        phone_digits = lead_phone.lstrip("+")
        evolution = get_evolution_client()
        await evolution.send_text(phone_digits, resposta)

        logger.info("Resposta IA enviada", conversation_id=conversation_id)

    except Exception as exc:
        logger.error("Erro no agente de triagem", error=str(exc), conversation_id=conversation_id)
