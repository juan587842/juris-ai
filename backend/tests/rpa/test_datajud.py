"""Testes do DataJudProvider."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date

from app.rpa.providers.datajud import DataJudProvider, _parse_tribunal, _parse_date


def test_parse_tribunal_tjsp():
    assert _parse_tribunal("0001234-56.2024.8.25.0100") == "tjsp"


def test_parse_tribunal_trt2():
    assert _parse_tribunal("0001234-56.2024.5.02.0001") == "trt2"


def test_parse_tribunal_stj():
    assert _parse_tribunal("0001234-56.2024.3.00.0000") == "stj"


def test_parse_tribunal_invalido():
    assert _parse_tribunal("numero-invalido") is None


def test_parse_date_iso():
    assert _parse_date("2024-04-15T10:30:00") == date(2024, 4, 15)


def test_parse_date_br():
    assert _parse_date("15/04/2024") == date(2024, 4, 15)


def test_parse_date_none():
    assert _parse_date(None) is None


@pytest.mark.asyncio
async def test_check_processo_retorna_movimentacoes():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "hits": {
            "hits": [{
                "_source": {
                    "numeroProcesso": "0001234-56.2024.8.25.0100",
                    "movimentos": [
                        {"nome": "Juntada de petição", "dataHora": "2024-04-15T10:00:00"},
                        {"nome": "Conclusão para despacho", "dataHora": "2024-04-10T09:00:00"},
                    ]
                }
            }]
        }
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        provider = DataJudProvider()
        movs = await provider.check_processo("0001234-56.2024.8.25.0100")

    assert len(movs) == 2
    assert movs[0].descricao == "Juntada de petição"
    assert movs[0].data == date(2024, 4, 15)


@pytest.mark.asyncio
async def test_check_processo_sem_hits_retorna_vazio():
    mock_response = MagicMock()
    mock_response.json.return_value = {"hits": {"hits": []}}
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        provider = DataJudProvider()
        movs = await provider.check_processo("0001234-56.2024.8.25.0100")

    assert movs == []
