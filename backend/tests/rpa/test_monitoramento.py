"""Testes da orquestração de monitoramento."""
import pytest
from datetime import date, timedelta

from app.rpa.providers.base import Movimentacao


def test_filtrar_movimentacoes_novas():
    """Movements older than ultima_verificacao should be filtered out."""
    from app.rpa.monitoramento import _filtrar_novas

    ultima = date(2024, 4, 10)
    movs = [
        Movimentacao(data=date(2024, 4, 15), descricao="Nova"),
        Movimentacao(data=date(2024, 4, 9), descricao="Antiga"),
        Movimentacao(data=date(2024, 4, 10), descricao="Mesma data — ignorar"),
    ]
    novas = _filtrar_novas(movs, ultima)
    assert len(novas) == 1
    assert novas[0].descricao == "Nova"


def test_filtrar_sem_ultima_verificacao_retorna_ultimos_30_dias():
    """If ultima_verificacao is None, return only last 30 days."""
    from app.rpa.monitoramento import _filtrar_novas

    hoje = date.today()
    movs = [
        Movimentacao(data=hoje, descricao="Hoje"),
        Movimentacao(data=hoje - timedelta(days=29), descricao="29 dias atrás"),
        Movimentacao(data=hoje - timedelta(days=31), descricao="31 dias atrás — ignorar"),
    ]
    novas = _filtrar_novas(movs, None)
    assert len(novas) == 2
    assert all(m.descricao != "31 dias atrás — ignorar" for m in novas)


def test_get_provider_retorna_datajud_sem_key():
    """Without jusbrasil_api_key, DataJudProvider is returned."""
    from unittest.mock import patch, MagicMock
    from app.rpa.monitoramento import _get_provider
    from app.rpa.providers.datajud import DataJudProvider

    mock_settings = MagicMock()
    mock_settings.jusbrasil_api_key = None

    with patch("app.rpa.monitoramento.get_settings", return_value=mock_settings):
        provider = _get_provider()

    assert isinstance(provider, DataJudProvider)


def test_get_provider_retorna_jusbrasil_com_key():
    """With jusbrasil_api_key configured, JusbrasilProvider is returned."""
    from unittest.mock import patch, MagicMock
    from app.rpa.monitoramento import _get_provider
    from app.rpa.providers.jusbrasil import JusbrasilProvider

    mock_settings = MagicMock()
    mock_settings.jusbrasil_api_key = "some-key"

    with patch("app.rpa.monitoramento.get_settings", return_value=mock_settings):
        provider = _get_provider()

    assert isinstance(provider, JusbrasilProvider)
