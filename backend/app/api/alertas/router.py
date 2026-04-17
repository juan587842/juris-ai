"""Endpoint de alertas inteligentes."""
from typing import Literal

from fastapi import APIRouter

# Endpoint GET /alertas adicionado na Task 2 (ver router.py após implementação completa)
router = APIRouter(prefix="/alertas", tags=["alertas"])

SeveridadeType = Literal["alta", "media", "baixa"]


# ─── Funções puras de severidade (testáveis sem Supabase) ─────────────────────

def _severidade_processo(dias: int) -> SeveridadeType:
    """Alta se >60 dias, média se 30–60, baixa se <30."""
    if dias > 60:
        return "alta"
    if dias >= 30:
        return "media"
    return "baixa"


def _severidade_lead(dias: int) -> SeveridadeType:
    """Alta se >14 dias, média se 7–14, baixa se <7."""
    if dias > 14:
        return "alta"
    if dias >= 7:
        return "media"
    return "baixa"


def _severidade_prazo(dias_ate_vencimento: int) -> SeveridadeType:
    """Alta se ≤2 dias, média se 3–5, baixa se >5."""
    if dias_ate_vencimento <= 2:
        return "alta"
    if dias_ate_vencimento <= 5:
        return "media"
    return "baixa"


def _severidade_oportunidade(dias: int) -> SeveridadeType:
    """Alta se >30 dias, média se 15–30, baixa se <15."""
    if dias > 30:
        return "alta"
    if dias >= 15:
        return "media"
    return "baixa"
