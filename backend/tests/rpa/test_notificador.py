"""Testes do notificador de movimentações."""
import pytest
from datetime import date

from app.rpa.notificador import montar_msg_advogado, montar_msg_cliente_prompt


def test_montar_msg_advogado():
    msg = montar_msg_advogado(
        numero_cnj="0001234-56.2024.8.25.0100",
        descricao="Juntada de petição",
        data=date(2024, 4, 15),
        processo_id="abc-123",
        base_url="https://app.juriscai.com.br",
    )
    assert "0001234-56.2024.8.25.0100" in msg
    assert "Juntada de petição" in msg
    assert "15/04/2024" in msg
    assert "abc-123" in msg


def test_montar_msg_cliente_prompt():
    prompt = montar_msg_cliente_prompt("Concluso para despacho ao MM. Juiz da causa.")
    assert "Concluso para despacho" in prompt
    assert len(prompt) > 50
