"""Endpoints do módulo de Processos Judiciais."""
from uuid import UUID

from fastapi import APIRouter, HTTPException, status

from app.core.auth import AuthUser
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase
from app.models.processos import (
    AndamentoCreate,
    AndamentoOut,
    IntimacaoCreate,
    IntimacaoOut,
    MonitoramentoConfig,
    ProcessoCreate,
    ProcessoDetail,
    ProcessoOut,
    ProcessoUpdate,
)

router = APIRouter(prefix="/processos", tags=["processos"])
logger = get_logger("processos.router")


async def _get_processo_or_404(processo_id: UUID) -> dict:
    supabase = await get_supabase()
    result = (
        await supabase.table("processos")
        .select("*")
        .eq("id", str(processo_id))
        .neq("status", "arquivado")
        .single()
        .execute()
    )
    if not result.data:
        raise HTTPException(status_code=404, detail="Processo não encontrado")
    return result.data


# ─── Listar processos ─────────────────────────────────────────────────────────

@router.get("", response_model=list[ProcessoOut])
async def list_processos(
    current_user: AuthUser,
    status: str | None = None,
    area_juridica: str | None = None,
    advogado_id: UUID | None = None,
    limit: int = 50,
    offset: int = 0,
):
    supabase = await get_supabase()
    query = (
        supabase.table("processos")
        .select("*")
        .neq("status", "arquivado")
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )
    if status:
        query = query.eq("status", status)
    if area_juridica:
        query = query.eq("area_juridica", area_juridica)
    if advogado_id:
        query = query.eq("advogado_id", str(advogado_id))

    result = await query.execute()
    return result.data


# ─── Detalhe do processo ──────────────────────────────────────────────────────

@router.get("/{processo_id}", response_model=ProcessoDetail)
async def get_processo(processo_id: UUID, current_user: AuthUser):
    processo = await _get_processo_or_404(processo_id)
    supabase = await get_supabase()

    andamentos_result = (
        await supabase.table("andamentos")
        .select("*")
        .eq("processo_id", str(processo_id))
        .order("data_andamento", desc=True)
        .execute()
    )
    intimacoes_result = (
        await supabase.table("intimacoes")
        .select("*")
        .eq("processo_id", str(processo_id))
        .order("data_publicacao", desc=True)
        .execute()
    )

    return ProcessoDetail(
        processo=ProcessoOut(**processo),
        andamentos=[AndamentoOut(**a) for a in (andamentos_result.data or [])],
        intimacoes=[IntimacaoOut(**i) for i in (intimacoes_result.data or [])],
    )


# ─── Criar processo ───────────────────────────────────────────────────────────

@router.post("", response_model=ProcessoOut, status_code=status.HTTP_201_CREATED)
async def create_processo(body: ProcessoCreate, current_user: AuthUser):
    supabase = await get_supabase()

    # Verificar CNJ duplicado
    existing = (
        await supabase.table("processos")
        .select("id")
        .eq("numero_cnj", body.numero_cnj)
        .limit(1)
        .execute()
    )
    if existing.data:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Processo com este número CNJ já cadastrado",
        )

    payload = body.model_dump(exclude_none=True)
    for field in ("cliente_id", "advogado_id"):
        if field in payload:
            payload[field] = str(payload[field])

    result = await supabase.table("processos").insert(payload).execute()
    logger.info("Processo criado", cnj=body.numero_cnj, user=current_user.id)
    return result.data[0]


# ─── Atualizar processo ───────────────────────────────────────────────────────

@router.patch("/{processo_id}", response_model=ProcessoOut)
async def update_processo(
    processo_id: UUID, body: ProcessoUpdate, current_user: AuthUser
):
    await _get_processo_or_404(processo_id)
    supabase = await get_supabase()

    payload = body.model_dump(exclude_none=True)
    for field in ("cliente_id", "advogado_id"):
        if field in payload:
            payload[field] = str(payload[field])
    if "status" in payload:
        payload["status"] = payload["status"].value if hasattr(payload["status"], "value") else payload["status"]

    result = (
        await supabase.table("processos")
        .update(payload)
        .eq("id", str(processo_id))
        .execute()
    )
    return result.data[0]


# ─── Arquivar processo (soft delete) ──────────────────────────────────────────

@router.delete("/{processo_id}", status_code=status.HTTP_200_OK)
async def archive_processo(processo_id: UUID, current_user: AuthUser):
    await _get_processo_or_404(processo_id)
    supabase = await get_supabase()

    await supabase.table("processos").update({"status": "arquivado"}).eq(
        "id", str(processo_id)
    ).execute()
    logger.info("Processo arquivado", processo_id=str(processo_id), user=current_user.id)
    return {"status": "ok"}


# ─── Andamentos ───────────────────────────────────────────────────────────────

@router.post(
    "/{processo_id}/andamentos",
    response_model=AndamentoOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_andamento(
    processo_id: UUID, body: AndamentoCreate, current_user: AuthUser
):
    await _get_processo_or_404(processo_id)
    supabase = await get_supabase()

    payload = body.model_dump(exclude_none=True)
    payload["processo_id"] = str(processo_id)
    payload["data_andamento"] = str(payload["data_andamento"])

    result = await supabase.table("andamentos").insert(payload).execute()
    return result.data[0]


# ─── Monitoramento ────────────────────────────────────────────────────────────

@router.put("/{processo_id}/monitoramento", response_model=ProcessoOut)
async def update_monitoramento(
    processo_id: UUID, body: MonitoramentoConfig, current_user: AuthUser
):
    await _get_processo_or_404(processo_id)
    supabase = await get_supabase()

    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="Informe ao menos um campo para atualizar",
        )

    result = (
        await supabase.table("processos")
        .update(payload)
        .eq("id", str(processo_id))
        .execute()
    )
    logger.info(
        "Monitoramento atualizado",
        processo_id=str(processo_id),
        payload=payload,
        user=current_user.id,
    )
    return result.data[0]


@router.post("/{processo_id}/verificar", status_code=status.HTTP_200_OK)
async def verificar_agora(processo_id: UUID, current_user: AuthUser):
    from app.rpa.monitoramento import verificar_processo

    processo = await _get_processo_or_404(processo_id)
    await verificar_processo(processo)
    logger.info("Verificação manual disparada", processo_id=str(processo_id), user=current_user.id)
    return {"status": "ok", "processo_id": str(processo_id)}


# ─── Intimações ───────────────────────────────────────────────────────────────

@router.post(
    "/{processo_id}/intimacoes",
    response_model=IntimacaoOut,
    status_code=status.HTTP_201_CREATED,
)
async def add_intimacao(
    processo_id: UUID, body: IntimacaoCreate, current_user: AuthUser
):
    await _get_processo_or_404(processo_id)
    supabase = await get_supabase()

    payload = body.model_dump(exclude_none=True)
    payload["processo_id"] = str(processo_id)
    payload["data_publicacao"] = str(payload["data_publicacao"])
    if "prazo_fatal" in payload:
        payload["prazo_fatal"] = str(payload["prazo_fatal"])
    if "fonte" in payload:
        payload["fonte"] = payload["fonte"].value if hasattr(payload["fonte"], "value") else payload["fonte"]

    result = await supabase.table("intimacoes").insert(payload).execute()
    return result.data[0]
