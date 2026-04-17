"""Testes unitários das funções de severidade de alertas."""
from app.api.alertas.router import (
    _severidade_processo,
    _severidade_lead,
    _severidade_prazo,
    _severidade_oportunidade,
)


# ─── _severidade_processo ─────────────────────────────────────────────────────

def test_severidade_processo_alta():
    assert _severidade_processo(61) == "alta"
    assert _severidade_processo(100) == "alta"


def test_severidade_processo_media():
    assert _severidade_processo(30) == "media"
    assert _severidade_processo(60) == "media"


def test_severidade_processo_baixa():
    assert _severidade_processo(1) == "baixa"
    assert _severidade_processo(29) == "baixa"


# ─── _severidade_lead ─────────────────────────────────────────────────────────

def test_severidade_lead_alta():
    assert _severidade_lead(15) == "alta"
    assert _severidade_lead(30) == "alta"


def test_severidade_lead_media():
    assert _severidade_lead(7) == "media"
    assert _severidade_lead(14) == "media"


def test_severidade_lead_baixa():
    assert _severidade_lead(1) == "baixa"
    assert _severidade_lead(6) == "baixa"


# ─── _severidade_prazo ────────────────────────────────────────────────────────

def test_severidade_prazo_alta():
    assert _severidade_prazo(0) == "alta"
    assert _severidade_prazo(2) == "alta"


def test_severidade_prazo_media():
    assert _severidade_prazo(3) == "media"
    assert _severidade_prazo(5) == "media"


def test_severidade_prazo_baixa():
    assert _severidade_prazo(6) == "baixa"
    assert _severidade_prazo(30) == "baixa"


# ─── _severidade_oportunidade ─────────────────────────────────────────────────

def test_severidade_oportunidade_alta():
    assert _severidade_oportunidade(31) == "alta"
    assert _severidade_oportunidade(100) == "alta"


def test_severidade_oportunidade_media():
    assert _severidade_oportunidade(15) == "media"
    assert _severidade_oportunidade(30) == "media"


def test_severidade_oportunidade_baixa():
    assert _severidade_oportunidade(1) == "baixa"
    assert _severidade_oportunidade(14) == "baixa"
