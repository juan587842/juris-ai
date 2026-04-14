"""Endpoint público de captura de leads (landing pages, formulários web)."""
import re

from fastapi import APIRouter, HTTPException, status

from app.core.logging import get_logger
from app.integrations.supabase import get_supabase
from app.models.crm import PublicLeadCreate

router = APIRouter(prefix="/public", tags=["public"])
logger = get_logger("public.leads")

_PHONE_RE = re.compile(r"\D+")


def _normalize_phone(raw: str) -> str:
    digits = _PHONE_RE.sub("", raw)
    if len(digits) < 10:
        raise HTTPException(status_code=400, detail="Telefone inválido")
    if not digits.startswith("55") and len(digits) <= 11:
        digits = "55" + digits
    return f"+{digits}"


@router.post("/leads", status_code=status.HTTP_201_CREATED)
async def capture_public_lead(body: PublicLeadCreate):
    supabase = await get_supabase()
    telefone = _normalize_phone(body.telefone)

    payload = {
        "nome": body.nome,
        "telefone": telefone,
        "email": str(body.email) if body.email else None,
        "origem": body.origem,
        "area_interesse": body.area_interesse.value if body.area_interesse else None,
        "notas": body.mensagem,
    }
    payload = {k: v for k, v in payload.items() if v is not None}

    result = await supabase.table("leads").upsert(
        payload, on_conflict="telefone", ignore_duplicates=False
    ).execute()

    if not result.data:
        logger.error("Falha ao capturar lead público", phone=telefone)
        raise HTTPException(status_code=500, detail="Falha ao registrar lead")

    lead = result.data[0]
    logger.info("Lead público capturado", lead_id=lead["id"], origem=body.origem)

    return {
        "id": lead["id"],
        "status": "ok",
        "mensagem": "Recebemos seu contato. Em breve entraremos em contato.",
    }
