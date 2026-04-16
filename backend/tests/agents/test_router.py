"""Testes do roteador de intenção."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


# ─── Detecção de keywords ──────────────────────────────────────────────────────

def test_tem_intencao_juridica_com_keyword():
    from app.agents.router import _tem_intencao_juridica
    assert _tem_intencao_juridica("como está meu processo?") is True


def test_tem_intencao_juridica_case_insensitive():
    from app.agents.router import _tem_intencao_juridica
    assert _tem_intencao_juridica("PROCESSO 123") is True


def test_tem_intencao_juridica_sem_acento():
    from app.agents.router import _tem_intencao_juridica
    # "audiência" sem acento → "audiencia" está na lista
    assert _tem_intencao_juridica("qual a proxima audiencia?") is True


def test_tem_intencao_juridica_false_para_mensagem_generica():
    from app.agents.router import _tem_intencao_juridica
    assert _tem_intencao_juridica("boa tarde, quero contratar um advogado") is False


# ─── Roteamento ───────────────────────────────────────────────────────────────

@pytest.mark.asyncio
async def test_rotear_para_juridico_quando_tem_processos_e_keyword():
    """Deve chamar consultar_processos quando há intenção jurídica e processos."""
    from app.agents.router import rotear_mensagem

    mock_supabase = MagicMock()
    chain = MagicMock()
    chain.execute = AsyncMock(return_value=MagicMock(data=[{"id": "proc-1"}]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.neq.return_value.limit.return_value = chain

    with (
        patch("app.agents.router.get_supabase", AsyncMock(return_value=mock_supabase)),
        patch("app.agents.juridico.consultar_processos",
              AsyncMock(return_value="resposta jurídica")),
        patch("app.agents.triagem.processar_mensagem",
              AsyncMock(return_value="resposta triagem")),
    ):
        result = await rotear_mensagem(
            conversation_id="conv-1",
            lead_id="lead-1",
            lead_phone="+5511999999999",
            historico=[],
            nova_mensagem="quando é a próxima audiência?",
        )

    assert result == "resposta jurídica"


@pytest.mark.asyncio
async def test_rotear_para_triagem_quando_sem_processos():
    """Deve chamar processar_mensagem quando o lead não tem processos."""
    from app.agents.router import rotear_mensagem

    mock_supabase = MagicMock()
    chain = MagicMock()
    chain.execute = AsyncMock(return_value=MagicMock(data=[]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.neq.return_value.limit.return_value = chain

    with (
        patch("app.agents.router.get_supabase", AsyncMock(return_value=mock_supabase)),
        patch("app.agents.triagem.processar_mensagem",
              AsyncMock(return_value="resposta triagem")),
    ):
        result = await rotear_mensagem(
            conversation_id="conv-1",
            lead_id="lead-sem-processos",
            lead_phone="+5511999999999",
            historico=[],
            nova_mensagem="quero saber sobre meu processo",
        )

    assert result == "resposta triagem"


@pytest.mark.asyncio
async def test_rotear_para_triagem_quando_sem_keyword():
    """Deve chamar processar_mensagem quando não há intenção jurídica (sem consultar BD)."""
    from app.agents.router import rotear_mensagem

    with patch("app.agents.triagem.processar_mensagem",
               AsyncMock(return_value="resposta triagem")):
        result = await rotear_mensagem(
            conversation_id="conv-1",
            lead_id="lead-1",
            lead_phone="+5511999999999",
            historico=[],
            nova_mensagem="boa tarde, quero contratar um advogado",
        )

    assert result == "resposta triagem"


@pytest.mark.asyncio
async def test_rotear_para_triagem_quando_juridico_retorna_none():
    """Quando juridico.consultar_processos retorna None, deve fazer fallback para triagem."""
    from app.agents.router import rotear_mensagem

    mock_supabase = MagicMock()
    chain = MagicMock()
    chain.execute = AsyncMock(return_value=MagicMock(data=[{"id": "proc-1"}]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.neq.return_value.limit.return_value = chain

    with (
        patch("app.agents.router.get_supabase", AsyncMock(return_value=mock_supabase)),
        patch("app.agents.juridico.consultar_processos",
              AsyncMock(return_value=None)),
        patch("app.agents.triagem.processar_mensagem",
              AsyncMock(return_value="resposta triagem")),
    ):
        result = await rotear_mensagem(
            conversation_id="conv-1",
            lead_id="lead-1",
            lead_phone="+5511999999999",
            historico=[],
            nova_mensagem="qual o status do meu processo?",
        )

    assert result == "resposta triagem"
