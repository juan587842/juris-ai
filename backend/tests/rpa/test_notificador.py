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


@pytest.mark.asyncio
async def test_notificar_advogado_retorna_true_quando_sucesso():
    from unittest.mock import AsyncMock, patch, MagicMock
    from app.rpa.notificador import notificar_advogado
    from datetime import date

    mock_evolution = MagicMock()
    mock_evolution.send_text = AsyncMock(return_value=None)

    with patch("app.rpa.notificador.get_evolution_client", return_value=mock_evolution):
        result = await notificar_advogado(
            telefone_advogado="+5511999999999",
            numero_cnj="0001234-56.2024.8.25.0100",
            descricao="Juntada de petição",
            data=date(2024, 4, 15),
            processo_id="abc-123",
        )

    assert result is True
    mock_evolution.send_text.assert_called_once()


@pytest.mark.asyncio
async def test_notificar_advogado_retorna_false_quando_falha():
    from unittest.mock import AsyncMock, patch, MagicMock
    from app.rpa.notificador import notificar_advogado
    from datetime import date

    mock_evolution = MagicMock()
    mock_evolution.send_text = AsyncMock(side_effect=Exception("Falha de conexão"))

    with patch("app.rpa.notificador.get_evolution_client", return_value=mock_evolution):
        result = await notificar_advogado(
            telefone_advogado="+5511999999999",
            numero_cnj="0001234-56.2024.8.25.0100",
            descricao="Juntada de petição",
            data=date(2024, 4, 15),
            processo_id="abc-123",
        )

    assert result is False


@pytest.mark.asyncio
async def test_notificar_cliente_retorna_true_quando_sucesso():
    from unittest.mock import AsyncMock, patch, MagicMock
    from app.rpa.notificador import notificar_cliente

    mock_evolution = MagicMock()
    mock_evolution.send_text = AsyncMock(return_value=None)

    with patch("app.rpa.notificador.get_evolution_client", return_value=mock_evolution), \
         patch("app.rpa.notificador.traduzir_para_cliente", AsyncMock(return_value="Seu processo teve uma atualização: juntada de petição.")):
        result = await notificar_cliente(
            telefone_cliente="+5511888888888",
            descricao="Juntada de petição",
            processo_id="abc-123",
        )

    assert result is True
