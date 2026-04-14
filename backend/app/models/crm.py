"""Schemas Pydantic para o módulo CRM."""
from datetime import date, datetime
from decimal import Decimal
from enum import Enum
from uuid import UUID

from pydantic import BaseModel, EmailStr, Field


# ─── Enums (espelham os tipos do Postgres) ────────────────────────────────────

class LeadStatus(str, Enum):
    novo = "novo"
    contato_feito = "contato_feito"
    qualificado = "qualificado"
    desqualificado = "desqualificado"
    convertido = "convertido"


class AreaJuridica(str, Enum):
    trabalhista = "trabalhista"
    civil = "civil"
    criminal = "criminal"
    familia = "familia"
    empresarial = "empresarial"
    tributario = "tributario"
    previdenciario = "previdenciario"
    imobiliario = "imobiliario"
    outro = "outro"


class OportunidadeEstagio(str, Enum):
    novo_lead = "novo_lead"
    qualificado = "qualificado"
    proposta_enviada = "proposta_enviada"
    negociacao = "negociacao"
    ganho = "ganho"
    perdido = "perdido"


# ─── Respostas ────────────────────────────────────────────────────────────────

class LeadOut(BaseModel):
    id: UUID
    nome: str | None
    telefone: str
    email: str | None
    origem: str | None
    status: LeadStatus
    area_interesse: AreaJuridica | None
    notas: str | None
    assigned_to: UUID | None
    created_at: datetime
    updated_at: datetime


class OportunidadeOut(BaseModel):
    id: UUID
    lead_id: UUID
    titulo: str
    estagio: OportunidadeEstagio
    valor_estimado: Decimal | None
    area_juridica: AreaJuridica | None
    assigned_to: UUID | None
    data_fechamento: date | None
    notas: str | None
    created_at: datetime
    updated_at: datetime


# ─── Requests ─────────────────────────────────────────────────────────────────

class LeadCreate(BaseModel):
    nome: str | None = Field(default=None, max_length=200)
    telefone: str = Field(..., min_length=8, max_length=20)
    email: EmailStr | None = None
    origem: str = Field(default="manual", max_length=50)
    area_interesse: AreaJuridica | None = None
    notas: str | None = Field(default=None, max_length=4000)


class LeadUpdate(BaseModel):
    nome: str | None = Field(default=None, max_length=200)
    email: EmailStr | None = None
    status: LeadStatus | None = None
    area_interesse: AreaJuridica | None = None
    notas: str | None = Field(default=None, max_length=4000)
    assigned_to: UUID | None = None


class PublicLeadCreate(BaseModel):
    """Captura via landing page (sem auth)."""
    nome: str = Field(..., min_length=2, max_length=200)
    telefone: str = Field(..., min_length=8, max_length=20)
    email: EmailStr | None = None
    area_interesse: AreaJuridica | None = None
    mensagem: str | None = Field(default=None, max_length=2000)
    origem: str = Field(default="landing_page", max_length=50)


class OportunidadeCreate(BaseModel):
    lead_id: UUID
    titulo: str = Field(..., min_length=2, max_length=200)
    estagio: OportunidadeEstagio = OportunidadeEstagio.novo_lead
    valor_estimado: Decimal | None = None
    area_juridica: AreaJuridica | None = None
    data_fechamento: date | None = None
    notas: str | None = Field(default=None, max_length=4000)


class OportunidadeUpdate(BaseModel):
    titulo: str | None = Field(default=None, max_length=200)
    estagio: OportunidadeEstagio | None = None
    valor_estimado: Decimal | None = None
    area_juridica: AreaJuridica | None = None
    assigned_to: UUID | None = None
    data_fechamento: date | None = None
    notas: str | None = Field(default=None, max_length=4000)
