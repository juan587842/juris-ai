"""Testes do agente jurídico."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch


@pytest.mark.asyncio
async def test_consultar_processos_retorna_resposta():
    """Quando o lead tem processos, retorna string com resposta da IA."""
    from app.agents.juridico import consultar_processos

    mock_supabase = MagicMock()

    # Simula resultado de processos
    proc_chain = MagicMock()
    proc_chain.execute = AsyncMock(return_value=MagicMock(data=[
        {"id": "proc-1", "numero_cnj": "0001234-56.2024.8.25.0100",
         "tribunal": "TJSP", "vara": "1ª Vara Cível", "status": "ativo"}
    ]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.neq.return_value.order.return_value.limit.return_value = proc_chain

    # Simula resultado de andamentos
    and_chain = MagicMock()
    and_chain.execute = AsyncMock(return_value=MagicMock(data=[
        {"data_andamento": "2026-04-10",
         "texto_original": "Concluso para despacho",
         "texto_traduzido": "O processo chegou ao juiz."}
    ]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.gte.return_value.order.return_value.limit.return_value = and_chain

    mock_llm = MagicMock()
    mock_resp = MagicMock()
    mock_resp.choices = [MagicMock(message=MagicMock(content="Seu processo está com o juiz."))]
    mock_llm.chat.completions.create = AsyncMock(return_value=mock_resp)

    with (
        patch("app.agents.juridico.get_supabase", AsyncMock(return_value=mock_supabase)),
        patch("app.agents.juridico.get_llm_client", return_value=mock_llm),
        patch("app.agents.juridico.get_model", return_value="gpt-4o-mini"),
    ):
        result = await consultar_processos(
            lead_id="lead-1",
            historico=[],
            nova_mensagem="Qual o status do meu processo?",
        )

    assert result == "Seu processo está com o juiz."


@pytest.mark.asyncio
async def test_consultar_processos_sem_processos_retorna_none():
    """Quando o lead não tem processos, retorna None sem chamar o LLM."""
    from app.agents.juridico import consultar_processos

    mock_supabase = MagicMock()
    chain = MagicMock()
    chain.execute = AsyncMock(return_value=MagicMock(data=[]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.neq.return_value.order.return_value.limit.return_value = chain

    with patch("app.agents.juridico.get_supabase", AsyncMock(return_value=mock_supabase)):
        result = await consultar_processos(
            lead_id="lead-sem-processos",
            historico=[],
            nova_mensagem="Qual o status do meu processo?",
        )

    assert result is None


@pytest.mark.asyncio
async def test_consultar_processos_prefere_texto_traduzido():
    """Usa texto_traduzido quando disponível, texto_original como fallback."""
    from app.agents.juridico import consultar_processos

    mock_supabase = MagicMock()

    proc_chain = MagicMock()
    proc_chain.execute = AsyncMock(return_value=MagicMock(data=[
        {"id": "proc-1", "numero_cnj": "0001234-56.2024.8.25.0100",
         "tribunal": "TJSP", "vara": "1ª Vara", "status": "ativo"}
    ]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.neq.return_value.order.return_value.limit.return_value = proc_chain

    and_chain = MagicMock()
    and_chain.execute = AsyncMock(return_value=MagicMock(data=[
        {"data_andamento": "2026-04-10",
         "texto_original": "Concluso para despacho",
         "texto_traduzido": "TEXTO_TRADUZIDO_AQUI"}
    ]))
    mock_supabase.table.return_value.select.return_value \
        .eq.return_value.gte.return_value.order.return_value.limit.return_value = and_chain

    captured: list[list] = []

    async def fake_create(**kwargs):
        captured.append(kwargs["messages"])
        resp = MagicMock()
        resp.choices = [MagicMock(message=MagicMock(content="resposta"))]
        return resp

    mock_llm = MagicMock()
    mock_llm.chat.completions.create = fake_create

    with (
        patch("app.agents.juridico.get_supabase", AsyncMock(return_value=mock_supabase)),
        patch("app.agents.juridico.get_llm_client", return_value=mock_llm),
        patch("app.agents.juridico.get_model", return_value="gpt-4o-mini"),
    ):
        await consultar_processos(
            lead_id="lead-1",
            historico=[],
            nova_mensagem="como tá meu processo?",
        )

    user_msg = next(m for m in captured[0] if m["role"] == "user")
    assert "TEXTO_TRADUZIDO_AQUI" in user_msg["content"]
    assert "Concluso para despacho" not in user_msg["content"]
