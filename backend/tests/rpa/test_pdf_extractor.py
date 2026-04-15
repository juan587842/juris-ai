"""Testes do extrator de PDF."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch

from app.rpa.pdf_extractor import extrair_texto_pdf


@pytest.mark.asyncio
async def test_extrai_texto_de_pdf():
    pdf_bytes = b"%PDF conteudo simulado"

    mock_response = MagicMock()
    mock_response.content = pdf_bytes
    mock_response.raise_for_status = MagicMock()

    mock_page = MagicMock()
    mock_page.extract_text.return_value = "Texto extraído da decisão judicial."

    mock_pdf = MagicMock()
    mock_pdf.__enter__ = MagicMock(return_value=mock_pdf)
    mock_pdf.__exit__ = MagicMock(return_value=False)
    mock_pdf.pages = [mock_page]

    with patch("httpx.AsyncClient") as mock_client_cls, \
         patch("pdfplumber.open", return_value=mock_pdf):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        texto = await extrair_texto_pdf("https://exemplo.com/decisao.pdf")

    assert texto == "Texto extraído da decisão judicial."


@pytest.mark.asyncio
async def test_retorna_none_se_url_vazia():
    resultado = await extrair_texto_pdf(None)
    assert resultado is None


@pytest.mark.asyncio
async def test_retorna_none_se_pdf_ilegivel():
    mock_response = MagicMock()
    mock_response.content = b"bytes corrompidos"
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client_cls, \
         patch("pdfplumber.open", side_effect=Exception("PDF corrompido")):
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.get = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        resultado = await extrair_texto_pdf("https://exemplo.com/corrompido.pdf")

    assert resultado is None
