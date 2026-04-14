"""Schemas Pydantic para o módulo de chat."""
from datetime import datetime
from enum import Enum
from typing import Any
from uuid import UUID

from pydantic import BaseModel, Field


# ─── Enums (espelham os tipos do Postgres) ────────────────────────────────────

class SenderType(str, Enum):
    lead = "lead"
    ai = "ai"
    agent = "agent"
    system = "system"


class ConversationStatus(str, Enum):
    aberta = "aberta"
    em_atendimento = "em_atendimento"
    resolvida = "resolvida"
    pendente = "pendente"


class ConversationEventTipo(str, Enum):
    criada = "criada"
    atribuida = "atribuida"
    ai_pausada = "ai_pausada"
    ai_retomada = "ai_retomada"
    resolvida = "resolvida"
    reaberta = "reaberta"


# ─── Payload do webhook Evolution ────────────────────────────────────────────

class EvolutionMessageKey(BaseModel):
    remoteJid: str
    fromMe: bool = False
    id: str


class EvolutionMessageData(BaseModel):
    key: EvolutionMessageKey
    pushName: str | None = None
    message: dict[str, Any] = {}
    messageType: str = ""
    messageTimestamp: int = 0
    instanceName: str = ""


class EvolutionWebhookPayload(BaseModel):
    event: str
    instance: str
    data: EvolutionMessageData


# ─── Respostas da API ─────────────────────────────────────────────────────────

class MessageOut(BaseModel):
    id: UUID
    conversation_id: UUID
    sender_type: SenderType
    sender_id: UUID | None
    content: str | None
    media_url: str | None
    media_type: str | None
    created_at: datetime


class ConversationOut(BaseModel):
    id: UUID
    inbox_id: UUID
    lead_id: UUID
    status: ConversationStatus
    assigned_user_id: UUID | None
    ai_enabled: bool
    last_message_at: datetime | None
    created_at: datetime


# ─── Requests da API ──────────────────────────────────────────────────────────

class SendMessageRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4096)


class AssignRequest(BaseModel):
    user_id: UUID


class NoteRequest(BaseModel):
    content: str = Field(..., min_length=1, max_length=4096)
