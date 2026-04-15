"""
Stub do provider Jusbrasil.
Ative configurando JUSBRASIL_API_KEY no .env quando o advogado fornecer a chave.
"""
from __future__ import annotations

from app.core.config import get_settings
from app.core.logging import get_logger
from app.rpa.providers.base import MonitoramentoProvider, Movimentacao

logger = get_logger("rpa.jusbrasil")


class JusbrasilProvider(MonitoramentoProvider):
    """Provider Jusbrasil — requer JUSBRASIL_API_KEY configurado."""

    async def check_processo(self, numero_cnj: str) -> list[Movimentacao]:
        settings = get_settings()
        if not settings.jusbrasil_api_key:
            raise NotImplementedError(
                "Jusbrasil não configurado. "
                "Defina JUSBRASIL_API_KEY no .env para ativar este provider."
            )
        # TODO: implementar quando a chave for fornecida
        raise NotImplementedError("Implementação Jusbrasil pendente.")
