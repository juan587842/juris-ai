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
    _calcular_taxa_exito_geral,
    _calcular_tempo_medio_geral,
    _calcular_atendimento,
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


def test_calcular_tempo_medio_por_area():
    processos = [
        {
            "area_juridica": "trabalhista",
            "resultado": "procedente",
            "created_at": "2024-01-01T00:00:00+00:00",
            "updated_at": "2024-07-01T00:00:00+00:00",  # ~181 dias
        },
        {
            "area_juridica": "civil",
            "resultado": "acordo",
            "created_at": "2024-01-01T00:00:00+00:00",
            "updated_at": "2024-04-01T00:00:00+00:00",  # ~91 dias
        },
    ]
    resultado = _calcular_tempo_medio(processos)
    areas = {r["area"]: r for r in resultado}
    assert "trabalhista" in areas
    assert "civil" in areas
    assert areas["trabalhista"]["media_dias"] > 0
    assert areas["trabalhista"]["total"] == 1
    assert areas["civil"]["media_dias"] > 0


def test_calcular_tempo_medio_ignora_sem_resultado():
    processos = [
        {
            "area_juridica": "civil",
            "resultado": None,
            "created_at": "2024-01-01T00:00:00+00:00",
            "updated_at": "2024-06-01T00:00:00+00:00",
        },
    ]
    resultado = _calcular_tempo_medio(processos)
    assert resultado == []


def test_calcular_tempo_medio_vazio():
    resultado = _calcular_tempo_medio([])
    assert resultado == []


# ─── Novos testes: funções globais ───────────────────────────────────────────


def test_taxa_exito_geral_calcula_percentual():
    processos = [
        {"resultado": "procedente"},
        {"resultado": "acordo"},
        {"resultado": "improcedente"},
        {"resultado": None},  # deve ser ignorado
    ]
    assert _calcular_taxa_exito_geral(processos) == pytest.approx(66.7, abs=0.1)


def test_taxa_exito_geral_retorna_none_sem_finalizados():
    assert _calcular_taxa_exito_geral([]) is None
    assert _calcular_taxa_exito_geral([{"resultado": None}]) is None


def test_tempo_medio_geral_calcula_media():
    processos = [
        {
            "resultado": "procedente",
            "created_at": "2024-01-01T00:00:00+00:00",
            "updated_at": "2024-04-11T00:00:00+00:00",  # 101 dias
        },
        {
            "resultado": "acordo",
            "created_at": "2024-01-01T00:00:00+00:00",
            "updated_at": "2024-02-10T00:00:00+00:00",  # 40 dias
        },
    ]
    resultado = _calcular_tempo_medio_geral(processos)
    assert resultado == pytest.approx(70, abs=2)  # média de 101 e 40


def test_tempo_medio_geral_retorna_none_sem_finalizados():
    assert _calcular_tempo_medio_geral([]) is None
    assert _calcular_tempo_medio_geral([{"resultado": None}]) is None


def test_calcular_atendimento_volume_e_transbordo():
    conversations = [
        {"id": "c1", "ai_enabled": True},
        {"id": "c2", "ai_enabled": False},
        {"id": "c3", "ai_enabled": False},
    ]
    messages = []
    resultado = _calcular_atendimento(conversations, messages)
    assert resultado["volume_conversas"] == 3
    assert resultado["pct_transbordo"] == pytest.approx(66.7, abs=0.1)
    assert resultado["tempo_medio_resposta_segundos"] is None


def test_calcular_atendimento_tempo_resposta():
    conversations = [{"id": "c1", "ai_enabled": True}]
    messages = [
        {
            "conversation_id": "c1",
            "sender_type": "lead",
            "created_at": "2024-04-01T10:00:00+00:00",
        },
        {
            "conversation_id": "c1",
            "sender_type": "bot",
            "created_at": "2024-04-01T10:00:30+00:00",  # 30 segundos depois
        },
    ]
    resultado = _calcular_atendimento(conversations, messages)
    assert resultado["tempo_medio_resposta_segundos"] == pytest.approx(30.0)


def test_calcular_atendimento_ignora_conv_sem_resposta_bot():
    conversations = [{"id": "c1", "ai_enabled": True}]
    messages = [
        {
            "conversation_id": "c1",
            "sender_type": "lead",
            "created_at": "2024-04-01T10:00:00+00:00",
        },
        # sem mensagem bot — deve ser ignorada
    ]
    resultado = _calcular_atendimento(conversations, messages)
    assert resultado["tempo_medio_resposta_segundos"] is None


def test_calcular_atendimento_vazio():
    resultado = _calcular_atendimento([], [])
    assert resultado["volume_conversas"] == 0
    assert resultado["pct_transbordo"] is None
    assert resultado["tempo_medio_resposta_segundos"] is None
