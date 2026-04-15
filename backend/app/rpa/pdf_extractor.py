"""Extração de texto de PDFs judiciais via pdfplumber."""
from __future__ import annotations

import io

import httpx
import pdfplumber

from app.core.logging import get_logger

logger = get_logger("rpa.pdf_extractor")


async def extrair_texto_pdf(url: str | None) -> str | None:
    """
    Baixa um PDF e extrai seu texto.
    Returns None if url is None/empty or if extraction fails.
    """
    if not url:
        return None

    try:
        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.get(url)
            resp.raise_for_status()
            pdf_bytes = resp.content

        with pdfplumber.open(io.BytesIO(pdf_bytes)) as pdf:
            partes = [
                page.extract_text() or ""
                for page in pdf.pages
            ]
            texto = "\n".join(p for p in partes if p.strip())

        logger.info("PDF extraído", url=url, chars=len(texto))
        return texto or None

    except Exception as exc:
        logger.warning("Falha ao extrair PDF", url=url, error=str(exc))
        return None
