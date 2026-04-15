"""
Provider gratuito: API Pública DataJud do CNJ.
Documentação: https://datajud-wiki.cnj.jus.br/api-publica/acesso
"""
from __future__ import annotations

import re
from datetime import date, datetime

import httpx
import pytz

from app.core.logging import get_logger
from app.rpa.providers.base import MonitoramentoProvider, Movimentacao

logger = get_logger("rpa.datajud")

_SP_TZ = pytz.timezone("America/Sao_Paulo")
_CNJ_RE = re.compile(r"^\d{7}-\d{2}\.\d{4}\.(\d)\.(\d{2})\.\d{4}$")

_DATAJUD_BASE = "https://api-publica.datajud.cnj.jus.br"
_DATAJUD_KEY = "ApiKey cDZHYzlZa0JadVREZDJCendFbzVlQTU2YFBhcGZyM2I="

# Mapeamento J.TT -> índice DataJud
_TRIBUNAL_INDEX: dict[str, str] = {
    "1.00": "stf",   "2.00": "cnt",   "3.00": "stj",
    "4.01": "trf1",  "4.02": "trf2",  "4.03": "trf3",
    "4.04": "trf4",  "4.05": "trf5",  "4.06": "trf6",
    "5.01": "trt1",  "5.02": "trt2",  "5.03": "trt3",
    "5.04": "trt4",  "5.05": "trt5",  "5.06": "trt6",
    "5.07": "trt7",  "5.08": "trt8",  "5.09": "trt9",
    "5.10": "trt10", "5.11": "trt11", "5.12": "trt12",
    "5.13": "trt13", "5.14": "trt14", "5.15": "trt15",
    "5.16": "trt16", "5.17": "trt17", "5.18": "trt18",
    "5.19": "trt19", "5.20": "trt20", "5.21": "trt21",
    "5.22": "trt22", "5.23": "trt23", "5.24": "trt24",
    "6.00": "tse",   "7.00": "stm",
    "8.01": "tjac",  "8.02": "tjal",  "8.03": "tjap",
    "8.04": "tjam",  "8.05": "tjba",  "8.06": "tjce",
    "8.07": "tjdft", "8.08": "tjes",  "8.09": "tjgo",
    "8.10": "tjma",  "8.11": "tjmt",  "8.12": "tjms",
    "8.13": "tjmg",  "8.14": "tjpa",  "8.15": "tjpb",
    "8.16": "tjpr",  "8.17": "tjpe",  "8.18": "tjpi",
    "8.19": "tjrj",  "8.20": "tjrn",  "8.21": "tjrs",
    "8.22": "tjro",  "8.23": "tjrr",  "8.24": "tjsc",
    "8.25": "tjsp",  "8.26": "tjse",  "8.27": "tjto",
}


def _parse_tribunal(numero_cnj: str) -> str | None:
    """Extrai o índice DataJud a partir do número CNJ."""
    m = _CNJ_RE.match(numero_cnj)
    if not m:
        return None
    key = f"{m.group(1)}.{m.group(2)}"
    return _TRIBUNAL_INDEX.get(key)


def _parse_date(valor: str | None) -> date | None:
    """Converte string ISO ou DD/MM/YYYY para date."""
    if not valor:
        return None
    for fmt in ("%Y-%m-%dT%H:%M:%S", "%Y-%m-%d", "%d/%m/%Y"):
        try:
            return datetime.strptime(valor[:19], fmt).date()
        except ValueError:
            continue
    return None


class DataJudProvider(MonitoramentoProvider):
    """Consulta a API pública DataJud/CNJ — sem custo."""

    async def check_processo(self, numero_cnj: str) -> list[Movimentacao]:
        tribunal = _parse_tribunal(numero_cnj)
        if not tribunal:
            logger.warning("Tribunal não mapeado para CNJ", cnj=numero_cnj)
            return []

        url = f"{_DATAJUD_BASE}/api_publica_{tribunal}/_search"
        payload = {
            "query": {"match": {"numeroProcesso": numero_cnj}},
            "_source": ["movimentos", "numeroProcesso"],
            "size": 1,
        }
        headers = {"Authorization": _DATAJUD_KEY, "Content-Type": "application/json"}

        async with httpx.AsyncClient(timeout=30) as client:
            resp = await client.post(url, json=payload, headers=headers)
            resp.raise_for_status()

        hits = resp.json().get("hits", {}).get("hits", [])
        if not hits:
            return []

        source = hits[0].get("_source", {})
        movimentos = source.get("movimentos", [])

        result: list[Movimentacao] = []
        for mov in movimentos:
            descricao = (
                mov.get("nome")
                or (mov.get("complementosTabelados") or [{}])[0].get("nome", "")
                or "Movimentação sem descrição"
            )
            data_str = mov.get("dataHora") or mov.get("data")
            data = _parse_date(data_str) or date.today()
            result.append(Movimentacao(data=data, descricao=descricao))

        logger.info("DataJud retornou movimentações", cnj=numero_cnj, total=len(result))
        return result
