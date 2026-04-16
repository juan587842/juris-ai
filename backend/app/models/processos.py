"""Schemas Pydantic para o módulo de Processos Judiciais."""
import re
from datetime import date, datetime
from enum import Enum
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, Field, field_validator

from app.models.crm import AreaJuridica

# Regex CNJ: NNNNNNN-DD.AAAA.J.TT.OOOO
_CNJ_RE = re.compile(r"^\d{7}-\d{2}\.\d{4}\.\d\.\d{2}\.\d{4}$")


# ─── Enums ────────────────────────────────────────────────────────────────────

class ProcessoStatus(str, Enum):
    ativo = "ativo"
    suspenso = "suspenso"
    finalizado = "finalizado"
    arquivado = "arquivado"


class FonteIntimacao(str, Enum):
    DJEN = "DJEN"
    DJE = "DJE"
    domicilio_judicial = "domicilio_judicial"


class MonitoramentoStatus(str, Enum):
    ok = "ok"
    erro = "erro"
    sem_novidade = "sem_novidade"


# ─── Respostas ────────────────────────────────────────────────────────────────

class AndamentoOut(BaseModel):
    id: UUID
    processo_id: UUID
    data_andamento: date
    texto_original: str
    texto_traduzido: str | None
    notificado_cliente: bool
    pdf_url: str | None
    pdf_texto: str | None
    notificado_advogado_at: datetime | None
    notificado_cliente_at: datetime | None
    origem: Literal["manual", "rpa"]
    created_at: datetime


class IntimacaoOut(BaseModel):
    id: UUID
    processo_id: UUID
    fonte: FonteIntimacao
    data_publicacao: date
    prazo_fatal: date | None
    texto: str | None
    notificado_em: datetime | None
    created_at: datetime


class ProcessoOut(BaseModel):
    id: UUID
    numero_cnj: str
    cliente_id: UUID | None
    advogado_id: UUID | None
    tribunal: str | None
    vara: str | None
    area_juridica: AreaJuridica | None
    status: str
    resultado: Literal["procedente", "improcedente", "acordo", "desistencia"] | None = None
    monitorar: bool
    notificar_cliente: bool
    ultima_verificacao_at: datetime | None
    created_at: datetime
    updated_at: datetime


class ProcessoDetail(BaseModel):
    processo: ProcessoOut
    andamentos: list[AndamentoOut]
    intimacoes: list[IntimacaoOut]


# ─── Requests ─────────────────────────────────────────────────────────────────

class ProcessoCreate(BaseModel):
    numero_cnj: str = Field(..., min_length=25, max_length=25)
    cliente_id: UUID | None = None
    advogado_id: UUID | None = None
    tribunal: str | None = Field(default=None, max_length=200)
    vara: str | None = Field(default=None, max_length=200)
    area_juridica: AreaJuridica | None = None

    @field_validator("numero_cnj")
    @classmethod
    def validar_cnj(cls, v: str) -> str:
        if not _CNJ_RE.match(v):
            raise ValueError(
                "Número CNJ inválido. Formato esperado: NNNNNNN-DD.AAAA.J.TT.OOOO"
            )
        return v


class ProcessoUpdate(BaseModel):
    cliente_id: UUID | None = None
    advogado_id: UUID | None = None
    tribunal: str | None = Field(default=None, max_length=200)
    vara: str | None = Field(default=None, max_length=200)
    area_juridica: AreaJuridica | None = None
    status: ProcessoStatus | None = None
    resultado: Literal["procedente", "improcedente", "acordo", "desistencia"] | None = None


class AndamentoCreate(BaseModel):
    data_andamento: date
    texto_original: str = Field(..., min_length=1, max_length=10000)
    texto_traduzido: str | None = Field(default=None, max_length=10000)


class IntimacaoCreate(BaseModel):
    fonte: FonteIntimacao
    data_publicacao: date
    prazo_fatal: date | None = None
    texto: str | None = Field(default=None, max_length=10000)


class MonitoramentoConfig(BaseModel):
    monitorar: bool | None = None
    notificar_cliente: bool | None = None


class MonitoramentoLogOut(BaseModel):
    id: UUID
    processo_id: UUID
    provider: str
    status: MonitoramentoStatus
    movimentacoes_encontradas: int
    erro_msg: str | None
    created_at: datetime
