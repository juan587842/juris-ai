"""Testes unitários dos modelos Pydantic de processos."""
import pytest
from uuid import uuid4
from datetime import datetime

from app.models.processos import ProcessoUpdate, ProcessoOut


# ─── ProcessoUpdate ───────────────────────────────────────────────────────────

def test_processo_update_aceita_resultado_valido():
    """Campo resultado deve ser aceito com valores do Literal."""
    for valor in ("procedente", "improcedente", "acordo", "desistencia"):
        m = ProcessoUpdate(resultado=valor)
        assert m.resultado == valor


def test_processo_update_resultado_none_por_padrao():
    """Campo resultado deve ser None quando omitido."""
    m = ProcessoUpdate()
    assert m.resultado is None


def test_processo_update_resultado_invalido_raises():
    """Valor fora do Literal deve levantar ValidationError."""
    from pydantic import ValidationError
    with pytest.raises(ValidationError):
        ProcessoUpdate(resultado="ganho")


# ─── ProcessoOut ─────────────────────────────────────────────────────────────

def _base_processo_out_data(**kwargs):
    now = datetime.now().isoformat()
    return {
        "id": str(uuid4()),
        "numero_cnj": "1234567-89.2024.8.26.0001",
        "cliente_id": None,
        "advogado_id": None,
        "tribunal": None,
        "vara": None,
        "area_juridica": None,
        "status": "ativo",
        "monitorar": False,
        "notificar_cliente": False,
        "ultima_verificacao_at": None,
        "created_at": now,
        "updated_at": now,
        **kwargs,
    }


def test_processo_out_serializa_resultado_preenchido():
    """ProcessoOut deve expor o campo resultado quando preenchido."""
    data = _base_processo_out_data(resultado="procedente")
    p = ProcessoOut(**data)
    assert p.resultado == "procedente"


def test_processo_out_resultado_none_por_padrao():
    """ProcessoOut deve aceitar resultado ausente (None) sem erro."""
    data = _base_processo_out_data()
    p = ProcessoOut(**data)
    assert p.resultado is None
