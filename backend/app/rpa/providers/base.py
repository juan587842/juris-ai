"""Interface abstrata para providers de monitoramento processual."""
from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import date


@dataclass
class Movimentacao:
    data: date
    descricao: str
    pdf_url: str | None = None
    tipo: str = "andamento"


class MonitoramentoProvider(ABC):
    """Contrato que todo provider deve implementar."""

    @abstractmethod
    async def check_processo(self, numero_cnj: str) -> list[Movimentacao]:
        """
        Consulta movimentações de um processo.
        Returns empty list if no movements found.
        Raises Exception on communication failure.
        """
