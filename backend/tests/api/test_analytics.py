# backend/tests/api/test_analytics.py
"""Testes para as funções de agregação do router de analytics."""
import pytest

from app.api.analytics.router import (
    _calcular_carteira_ativa,
    _calcular_distribuicao_tribunal,
    _calcular_funil,
    _calcular_origem_leads,
    _calcular_receita_por_area,
    _calcular_taxa_exito,
    _calcular_tempo_medio,
)


def test_calcular_funil_taxa_conversao():
    leads = [
        {"status": "novo"},
        {"status": "qualificado"},
        {"status": "convertido"},
        {"status": "convertido"},
    ]
    resultado = _calcular_funil(leads)
    assert resultado["novo"] == 1
    assert resultado["qualificado"] == 1
    assert resultado["convertido"] == 2
    assert resultado["taxa_conversao_pct"] == 50.0


def test_calcular_funil_vazio():
    resultado = _calcular_funil([])
    assert resultado["taxa_conversao_pct"] == 0.0
    assert resultado["convertido"] == 0
    assert resultado["novo"] == 0


def test_calcular_receita_por_area_soma_e_ordena():
    ops = [
        {"area_juridica": "trabalhista", "valor_estimado": 10000.0},
        {"area_juridica": "trabalhista", "valor_estimado": 5000.0},
        {"area_juridica": "civil", "valor_estimado": 8000.0},
    ]
    resultado = _calcular_receita_por_area(ops)
    trabalhista = next(r for r in resultado if r["area"] == "trabalhista")
    assert trabalhista["total"] == 15000.0
    assert resultado[0]["area"] == "trabalhista"  # maior valor primeiro


def test_calcular_receita_ignora_valor_none():
    ops = [{"area_juridica": "civil", "valor_estimado": None}]
    resultado = _calcular_receita_por_area(ops)
    assert resultado[0]["total"] == 0.0


def test_calcular_taxa_exito_ignora_sem_resultado():
    processos = [
        {"area_juridica": "trabalhista", "resultado": "procedente"},
        {"area_juridica": "trabalhista", "resultado": "improcedente"},
        {"area_juridica": "trabalhista", "resultado": None},
    ]
    resultado = _calcular_taxa_exito(processos)
    assert len(resultado) == 1
    assert resultado[0]["total"] == 2  # None foi ignorado
    assert resultado[0]["exito_pct"] == 50.0


def test_calcular_taxa_exito_acordo_conta_como_exito():
    processos = [
        {"area_juridica": "civil", "resultado": "acordo"},
        {"area_juridica": "civil", "resultado": "desistencia"},
    ]
    resultado = _calcular_taxa_exito(processos)
    assert resultado[0]["exito_pct"] == 50.0


def test_calcular_taxa_exito_vazio():
    resultado = _calcular_taxa_exito([])
    assert resultado == []


def test_calcular_distribuicao_tribunal_ordena():
    processos = [
        {"tribunal": "TJSP"},
        {"tribunal": "TJSP"},
        {"tribunal": "TRT-2"},
    ]
    resultado = _calcular_distribuicao_tribunal(processos)
    assert resultado[0]["tribunal"] == "TJSP"
    assert resultado[0]["count"] == 2
    assert resultado[1]["tribunal"] == "TRT-2"


def test_calcular_distribuicao_tribunal_none_vira_nao_informado():
    processos = [{"tribunal": None}]
    resultado = _calcular_distribuicao_tribunal(processos)
    assert resultado[0]["tribunal"] == "Não informado"


def test_calcular_origem_leads_percentual():
    leads = [
        {"origem": "whatsapp"},
        {"origem": "whatsapp"},
        {"origem": "indicacao"},
    ]
    resultado = _calcular_origem_leads(leads)
    whatsapp = next(r for r in resultado if r["origem"] == "whatsapp")
    assert whatsapp["count"] == 2
    assert whatsapp["pct"] == pytest.approx(66.7, abs=0.1)


def test_calcular_origem_leads_vazio():
    resultado = _calcular_origem_leads([])
    assert resultado == []


def test_calcular_carteira_ativa():
    processos = [
        {"status": "ativo"},
        {"status": "ativo"},
        {"status": "suspenso"},
        {"status": "finalizado"},
    ]
    resultado = _calcular_carteira_ativa(processos)
    assert resultado["ativo"] == 2
    assert resultado["suspenso"] == 1
    assert resultado["finalizado"] == 1
    assert resultado["total"] == 4


def test_calcular_carteira_ativa_vazia():
    resultado = _calcular_carteira_ativa([])
    assert resultado["ativo"] == 0
    assert resultado["total"] == 0
