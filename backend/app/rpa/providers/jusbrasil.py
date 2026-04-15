"""
Stub do provider Jusbrasil.
Ative configurando JUSBRASIL_API_KEY no .env quando o advogado fornecer a chave.
"""
from __future__ import annotations

from app.core.logging import get_logger
from app.rpa.providers.base import MonitoramentoProvider, Movimentacao

logger = get_logger("rpa.jusbrasil")


class JusbrasilProvider(MonitoramentoProvider):
    """Provider Jusbrasil — requer JUSBRASIL_API_KEY configurado."""

    async def check_processo(self, numero_cnj: str) -> list[Movimentacao]:
        raise NotImplementedError(
            "Jusbrasil não configurado. "
            "Defina JUSBRASIL_API_KEY no .env para ativar este provider."
        )
