# Fase 8: Legal Ops / RPA — Monitoramento de Processos

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implementar monitoramento automático de processos judiciais via DataJud/CNJ (gratuito), com alertas WhatsApp para advogado e cliente, extração de PDF e tradução IA do juridiquês.

**Architecture:** APScheduler embutido no FastAPI verifica de hora em hora todos os processos com `monitorar=true`, consultando a API pública DataJud do CNJ. Movimentações novas são salvas como `andamentos` com `origem='rpa'`, notificadas via Evolution API e traduzidas pela IA para o cliente quando configurado.

**Tech Stack:** Python (APScheduler 3.x, httpx, pdfplumber, BeautifulSoup4, pytz), FastAPI, Supabase, Evolution API, OpenAI. Frontend: Next.js, TypeScript, Tailwind CSS.

---

## Arquivos a criar/modificar

**Backend — novos:**
- `backend/app/rpa/providers/base.py` — interface abstrata do provider
- `backend/app/rpa/providers/datajud.py` — provider gratuito (API pública CNJ)
- `backend/app/rpa/providers/jusbrasil.py` — stub para API Jusbrasil (futura)
- `backend/app/rpa/providers/__init__.py`
- `backend/app/rpa/pdf_extractor.py` — download + extração de texto via pdfplumber
- `backend/app/rpa/notificador.py` — WhatsApp + tradução IA
- `backend/app/rpa/monitoramento.py` — orquestração do ciclo de verificação
- `backend/app/rpa/scheduler.py` — APScheduler com timezone SP
- `backend/tests/rpa/test_datajud.py`
- `backend/tests/rpa/test_pdf_extractor.py`
- `backend/tests/rpa/test_notificador.py`
- `backend/tests/rpa/test_monitoramento.py`
- `backend/tests/rpa/__init__.py`

**Backend — modificar:**
- `backend/pyproject.toml` — adicionar apscheduler, pytz
- `backend/app/rpa/__init__.py` — exportar get_provider
- `backend/app/models/processos.py` — novos campos em ProcessoOut, AndamentoOut, MonitoramentoConfig
- `backend/app/api/processos/router.py` — 2 novos endpoints
- `backend/app/main.py` — iniciar/parar scheduler no lifespan

**Frontend — novos:**
- `frontend/components/processos/MonitoramentoTab.tsx`

**Frontend — modificar:**
- `frontend/types/processos.ts` — novos campos
- `frontend/components/processos/ProcessoDetail.tsx` — terceira aba

---

## Task 1: Dependências e migration do banco

**Files:**
- Modify: `backend/pyproject.toml`
- Migration via MCP Supabase

- [ ] **Step 1: Adicionar APScheduler ao pyproject.toml**

Em `backend/pyproject.toml`, adicionar na lista `dependencies`:
```toml
    "apscheduler>=3.10.0",
    "pytz>=2025.1",
```

- [ ] **Step 2: Instalar dependências**

```bash
cd backend && uv pip install apscheduler pytz
```

Expected: pacotes instalados sem erro.

- [ ] **Step 3: Aplicar migration via MCP Supabase**

Usar a ferramenta `mcp__supabase__apply_migration` com nome `fase8_legal_ops_rpa` e SQL:

```sql
-- Fase 8: Legal Ops / RPA — campos de monitoramento

-- processos: configuração de monitoramento
ALTER TABLE processos
  ADD COLUMN IF NOT EXISTS monitorar           BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS notificar_cliente   BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS ultima_verificacao_at TIMESTAMPTZ;

-- andamentos: campos adicionados pelo robô
ALTER TABLE andamentos
  ADD COLUMN IF NOT EXISTS pdf_url                TEXT,
  ADD COLUMN IF NOT EXISTS pdf_texto              TEXT,
  ADD COLUMN IF NOT EXISTS notificado_advogado_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS notificado_cliente_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS origem                 TEXT NOT NULL DEFAULT 'manual';

-- intimacoes: rastrear envio de WhatsApp
ALTER TABLE intimacoes
  ADD COLUMN IF NOT EXISTS notificado_advogado_at TIMESTAMPTZ;

-- Nova tabela: histórico de verificações do robô
CREATE TABLE IF NOT EXISTS monitoramento_logs (
  id                        UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  processo_id               UUID NOT NULL REFERENCES processos(id) ON DELETE CASCADE,
  provider                  TEXT NOT NULL,
  status                    TEXT NOT NULL CHECK (status IN ('ok','erro','sem_novidade')),
  movimentacoes_encontradas INT  NOT NULL DEFAULT 0,
  erro_msg                  TEXT,
  created_at                TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- RLS em monitoramento_logs
ALTER TABLE monitoramento_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "monitoramento_logs_authenticated"
  ON monitoramento_logs
  FOR ALL
  TO authenticated
  USING (true)
  WITH CHECK (true);

-- Índice para busca por processo
CREATE INDEX IF NOT EXISTS idx_monitoramento_logs_processo
  ON monitoramento_logs(processo_id, created_at DESC);

-- Índice para buscar processos monitorados
CREATE INDEX IF NOT EXISTS idx_processos_monitorar
  ON processos(monitorar) WHERE monitorar = true;
```

- [ ] **Step 4: Verificar migration aplicada**

Usar `mcp__supabase__list_migrations` e confirmar que `fase8_legal_ops_rpa` aparece na lista.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/pyproject.toml
git commit -m "feat(fase-8): adicionar apscheduler + migration de monitoramento"
```

---

## Task 2: Modelos Pydantic

**Files:**
- Modify: `backend/app/models/processos.py`

- [ ] **Step 1: Atualizar `ProcessoOut` com novos campos**

No arquivo `backend/app/models/processos.py`, atualizar a classe `ProcessoOut`:

```python
class ProcessoOut(BaseModel):
    id: UUID
    numero_cnj: str
    cliente_id: UUID | None
    advogado_id: UUID | None
    tribunal: str | None
    vara: str | None
    area_juridica: AreaJuridica | None
    status: str
    monitorar: bool
    notificar_cliente: bool
    ultima_verificacao_at: datetime | None
    created_at: datetime
    updated_at: datetime
```

- [ ] **Step 2: Atualizar `AndamentoOut` com novos campos**

```python
class AndamentoOut(BaseModel):
    id: UUID
    processo_id: UUID
    data_andamento: date
    texto_original: str
    texto_traduzido: str | None
    notificado_cliente: bool
    pdf_url: str | None
    pdf_texto: str | None
    notificado_advogado_at: datetime | None
    notificado_cliente_at: datetime | None
    origem: str
    created_at: datetime
```

- [ ] **Step 3: Adicionar novos schemas de monitoramento**

Ao final do arquivo, adicionar:

```python
class MonitoramentoConfig(BaseModel):
    monitorar: bool | None = None
    notificar_cliente: bool | None = None


class MonitoramentoLogOut(BaseModel):
    id: UUID
    processo_id: UUID
    provider: str
    status: str
    movimentacoes_encontradas: int
    erro_msg: str | None
    created_at: datetime
```

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/models/processos.py
git commit -m "feat(fase-8): atualizar modelos Pydantic com campos de monitoramento"
```

---

## Task 3: Provider base e DataJud

**Files:**
- Create: `backend/app/rpa/providers/__init__.py`
- Create: `backend/app/rpa/providers/base.py`
- Create: `backend/app/rpa/providers/datajud.py`
- Create: `backend/app/rpa/providers/jusbrasil.py`
- Create: `backend/tests/rpa/__init__.py`
- Create: `backend/tests/rpa/test_datajud.py`

- [ ] **Step 1: Criar interface abstrata**

Criar `backend/app/rpa/providers/base.py`:

```python
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

        Args:
            numero_cnj: Número no formato NNNNNNN-DD.AAAA.J.TT.OOOO

        Returns:
            Lista de movimentações encontradas (pode ser vazia).

        Raises:
            Exception: Em caso de falha de comunicação com a fonte.
        """
```

- [ ] **Step 2: Criar `providers/__init__.py`**

Criar `backend/app/rpa/providers/__init__.py`:

```python
from app.rpa.providers.base import MonitoramentoProvider, Movimentacao
from app.rpa.providers.datajud import DataJudProvider
from app.rpa.providers.jusbrasil import JusbrasilProvider

__all__ = ["MonitoramentoProvider", "Movimentacao", "DataJudProvider", "JusbrasilProvider"]
```

- [ ] **Step 3: Criar DataJudProvider**

Criar `backend/app/rpa/providers/datajud.py`:

```python
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
            return datetime.strptime(valor[:len(fmt.replace("%", "XX"))], fmt).date()
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
                or mov.get("complementosTabelados", [{}])[0].get("nome", "")
                or "Movimentação sem descrição"
            )
            data_str = mov.get("dataHora") or mov.get("data")
            data = _parse_date(data_str) or date.today()
            result.append(Movimentacao(data=data, descricao=descricao))

        logger.info("DataJud retornou movimentações", cnj=numero_cnj, total=len(result))
        return result
```

- [ ] **Step 4: Criar stub do Jusbrasil**

Criar `backend/app/rpa/providers/jusbrasil.py`:

```python
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
```

- [ ] **Step 5: Escrever testes**

Criar `backend/tests/rpa/__init__.py` (vazio).

Criar `backend/tests/rpa/test_datajud.py`:

```python
"""Testes do DataJudProvider."""
import pytest
from unittest.mock import AsyncMock, patch, MagicMock
from datetime import date

from app.rpa.providers.datajud import DataJudProvider, _parse_tribunal, _parse_date


def test_parse_tribunal_tjsp():
    # TJSP: J=8, TT=25
    assert _parse_tribunal("0001234-56.2024.8.25.0100") == "tjsp"


def test_parse_tribunal_trt2():
    assert _parse_tribunal("0001234-56.2024.5.02.0001") == "trt2"


def test_parse_tribunal_stj():
    assert _parse_tribunal("0001234-56.2024.3.00.0000") == "stj"


def test_parse_tribunal_invalido():
    assert _parse_tribunal("numero-invalido") is None


def test_parse_date_iso():
    assert _parse_date("2024-04-15T10:30:00") == date(2024, 4, 15)


def test_parse_date_br():
    assert _parse_date("15/04/2024") == date(2024, 4, 15)


def test_parse_date_none():
    assert _parse_date(None) is None


@pytest.mark.asyncio
async def test_check_processo_retorna_movimentacoes():
    mock_response = MagicMock()
    mock_response.json.return_value = {
        "hits": {
            "hits": [{
                "_source": {
                    "numeroProcesso": "0001234-56.2024.8.25.0100",
                    "movimentos": [
                        {"nome": "Juntada de petição", "dataHora": "2024-04-15T10:00:00"},
                        {"nome": "Conclusão para despacho", "dataHora": "2024-04-10T09:00:00"},
                    ]
                }
            }]
        }
    }
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        provider = DataJudProvider()
        movs = await provider.check_processo("0001234-56.2024.8.25.0100")

    assert len(movs) == 2
    assert movs[0].descricao == "Juntada de petição"
    assert movs[0].data == date(2024, 4, 15)


@pytest.mark.asyncio
async def test_check_processo_sem_hits_retorna_vazio():
    mock_response = MagicMock()
    mock_response.json.return_value = {"hits": {"hits": []}}
    mock_response.raise_for_status = MagicMock()

    with patch("httpx.AsyncClient") as mock_client_cls:
        mock_client = AsyncMock()
        mock_client.__aenter__ = AsyncMock(return_value=mock_client)
        mock_client.__aexit__ = AsyncMock(return_value=False)
        mock_client.post = AsyncMock(return_value=mock_response)
        mock_client_cls.return_value = mock_client

        provider = DataJudProvider()
        movs = await provider.check_processo("0001234-56.2024.8.25.0100")

    assert movs == []
```

- [ ] **Step 6: Rodar testes**

```bash
cd backend && python -m pytest tests/rpa/test_datajud.py -v
```

Expected: todos os testes passam.

- [ ] **Step 7: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/rpa/providers/ backend/tests/rpa/
git commit -m "feat(fase-8): providers DataJud e Jusbrasil stub com testes"
```

---

## Task 4: PDF Extractor

**Files:**
- Create: `backend/app/rpa/pdf_extractor.py`
- Create: `backend/tests/rpa/test_pdf_extractor.py`

- [ ] **Step 1: Escrever teste que falha**

Criar `backend/tests/rpa/test_pdf_extractor.py`:

```python
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
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
cd backend && python -m pytest tests/rpa/test_pdf_extractor.py -v
```

Expected: FAIL com `ModuleNotFoundError` ou `ImportError`.

- [ ] **Step 3: Implementar extrator**

Criar `backend/app/rpa/pdf_extractor.py`:

```python
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

    Args:
        url: URL do PDF. Retorna None se None ou string vazia.

    Returns:
        Texto extraído concatenado, ou None em caso de falha.
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
```

- [ ] **Step 4: Rodar testes e confirmar que passam**

```bash
cd backend && python -m pytest tests/rpa/test_pdf_extractor.py -v
```

Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/rpa/pdf_extractor.py backend/tests/rpa/test_pdf_extractor.py
git commit -m "feat(fase-8): extrator de texto de PDFs via pdfplumber"
```

---

## Task 5: Notificador WhatsApp + IA

**Files:**
- Create: `backend/app/rpa/notificador.py`
- Create: `backend/tests/rpa/test_notificador.py`

- [ ] **Step 1: Escrever testes**

Criar `backend/tests/rpa/test_notificador.py`:

```python
"""Testes do notificador de movimentações."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
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
    assert "juridiquês" in prompt.lower() or "simples" in prompt.lower()
```

- [ ] **Step 2: Rodar e confirmar falha**

```bash
cd backend && python -m pytest tests/rpa/test_notificador.py -v
```

Expected: FAIL.

- [ ] **Step 3: Implementar notificador**

Criar `backend/app/rpa/notificador.py`:

```python
"""Notificações de movimentações via WhatsApp (Evolution API) com tradução IA."""
from __future__ import annotations

from datetime import date

from app.core.config import get_settings
from app.core.llm import get_llm_client, get_model
from app.core.logging import get_logger
from app.integrations.evolution import get_evolution_client

logger = get_logger("rpa.notificador")


def montar_msg_advogado(
    numero_cnj: str,
    descricao: str,
    data: date,
    processo_id: str,
    base_url: str,
) -> str:
    """Monta mensagem WhatsApp para o advogado."""
    return (
        f"⚖️ *Nova movimentação detectada*\n\n"
        f"*Processo:* `{numero_cnj}`\n"
        f"*Data:* {data.strftime('%d/%m/%Y')}\n"
        f"*Movimentação:* {descricao}\n\n"
        f"🔗 {base_url}/processos/{processo_id}"
    )


def montar_msg_cliente_prompt(texto_juridico: str) -> str:
    """Monta prompt para a IA traduzir o texto jurídico para linguagem simples."""
    return (
        f"Você é um assistente jurídico. Traduza a seguinte movimentação processual "
        f"para linguagem simples e acessível para um leigo, sem juridiquês. "
        f"Use no máximo 3 frases curtas. Comece com 'Seu processo teve uma atualização:'.\n\n"
        f"Movimentação: {texto_juridico}"
    )


async def traduzir_para_cliente(texto_juridico: str) -> str:
    """Usa a IA para traduzir o texto jurídico em linguagem simples."""
    llm = get_llm_client()
    model = get_model()
    prompt = montar_msg_cliente_prompt(texto_juridico)

    response = await llm.chat.completions.create(
        model=model,
        messages=[{"role": "user", "content": prompt}],
        max_tokens=200,
    )
    return response.choices[0].message.content or texto_juridico


async def notificar_advogado(
    telefone_advogado: str,
    numero_cnj: str,
    descricao: str,
    data: date,
    processo_id: str,
) -> bool:
    """
    Envia WhatsApp ao advogado com a movimentação.

    Returns:
        True se enviado com sucesso, False caso contrário.
    """
    settings = get_settings()
    base_url = settings.app_base_url or "https://app.juriscai.com.br"

    msg = montar_msg_advogado(
        numero_cnj=numero_cnj,
        descricao=descricao,
        data=data,
        processo_id=processo_id,
        base_url=base_url,
    )

    try:
        evolution = get_evolution_client()
        phone = telefone_advogado.lstrip("+")
        await evolution.send_text(phone, msg)
        logger.info("WhatsApp advogado enviado", processo_id=processo_id)
        return True
    except Exception as exc:
        logger.error("Falha ao enviar WhatsApp advogado", error=str(exc), processo_id=processo_id)
        return False


async def notificar_cliente(
    telefone_cliente: str,
    descricao: str,
    processo_id: str,
) -> bool:
    """
    Envia WhatsApp ao cliente com versão traduzida pela IA.

    Returns:
        True se enviado com sucesso, False caso contrário.
    """
    try:
        msg = await traduzir_para_cliente(descricao)
        evolution = get_evolution_client()
        phone = telefone_cliente.lstrip("+")
        await evolution.send_text(phone, msg)
        logger.info("WhatsApp cliente enviado", processo_id=processo_id)
        return True
    except Exception as exc:
        logger.error("Falha ao enviar WhatsApp cliente", error=str(exc), processo_id=processo_id)
        return False
```

- [ ] **Step 4: Rodar testes**

```bash
cd backend && python -m pytest tests/rpa/test_notificador.py -v
```

Expected: todos PASS.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/rpa/notificador.py backend/tests/rpa/test_notificador.py
git commit -m "feat(fase-8): notificador WhatsApp com tradução IA do juridiquês"
```

---

## Task 6: Orquestração do ciclo de monitoramento

**Files:**
- Create: `backend/app/rpa/monitoramento.py`
- Modify: `backend/app/rpa/__init__.py`
- Create: `backend/tests/rpa/test_monitoramento.py`

- [ ] **Step 1: Verificar `core/config.py` e adicionar campos necessários**

Abrir `backend/app/core/config.py` e verificar se existem os campos `jusbrasil_api_key` e `app_base_url`. Se não existirem, adicioná-los à classe de settings:

```python
jusbrasil_api_key: str | None = None
app_base_url: str = "https://app.juriscai.com.br"
rpa_check_interval_hours: int = 1
```

- [ ] **Step 2: Escrever teste de orquestração**

Criar `backend/tests/rpa/test_monitoramento.py`:

```python
"""Testes da orquestração de monitoramento."""
import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from datetime import date, datetime, timezone

from app.rpa.providers.base import Movimentacao


@pytest.mark.asyncio
async def test_filtrar_movimentacoes_novas():
    """Movimentações mais antigas que ultima_verificacao devem ser ignoradas."""
    from app.rpa.monitoramento import _filtrar_novas

    ultima = date(2024, 4, 10)
    movs = [
        Movimentacao(data=date(2024, 4, 15), descricao="Nova"),
        Movimentacao(data=date(2024, 4, 9), descricao="Antiga"),
        Movimentacao(data=date(2024, 4, 10), descricao="Mesma data — ignorar"),
    ]
    novas = _filtrar_novas(movs, ultima)
    assert len(novas) == 1
    assert novas[0].descricao == "Nova"


@pytest.mark.asyncio
async def test_filtrar_sem_ultima_verificacao_retorna_ultimos_30_dias():
    """Se ultima_verificacao for None, retorna apenas movs dos últimos 30 dias."""
    from app.rpa.monitoramento import _filtrar_novas
    from datetime import timedelta

    hoje = date.today()
    movs = [
        Movimentacao(data=hoje, descricao="Hoje"),
        Movimentacao(data=hoje - timedelta(days=29), descricao="29 dias atrás"),
        Movimentacao(data=hoje - timedelta(days=31), descricao="31 dias atrás — ignorar"),
    ]
    novas = _filtrar_novas(movs, None)
    assert len(novas) == 2
    assert all(m.descricao != "31 dias atrás — ignorar" for m in novas)
```

- [ ] **Step 3: Rodar e confirmar falha**

```bash
cd backend && python -m pytest tests/rpa/test_monitoramento.py -v
```

Expected: FAIL com ImportError.

- [ ] **Step 4: Implementar monitoramento.py**

Criar `backend/app/rpa/monitoramento.py`:

```python
"""Orquestração do ciclo de monitoramento processual."""
from __future__ import annotations

import pytz
from datetime import date, datetime, timedelta

from app.core.config import get_settings
from app.core.logging import get_logger
from app.integrations.supabase import get_supabase
from app.rpa.pdf_extractor import extrair_texto_pdf
from app.rpa.providers.base import Movimentacao, MonitoramentoProvider
from app.rpa.providers.datajud import DataJudProvider
from app.rpa.providers.jusbrasil import JusbrasilProvider

logger = get_logger("rpa.monitoramento")

_SP_TZ = pytz.timezone("America/Sao_Paulo")


def _get_provider() -> MonitoramentoProvider:
    """Retorna JusbrasilProvider se a chave estiver configurada, DataJud caso contrário."""
    settings = get_settings()
    if settings.jusbrasil_api_key:
        return JusbrasilProvider()
    return DataJudProvider()


def _filtrar_novas(
    movimentacoes: list[Movimentacao],
    ultima_verificacao: date | None,
) -> list[Movimentacao]:
    """
    Filtra movimentações mais recentes que ultima_verificacao.
    Se ultima_verificacao for None, retorna apenas os últimos 30 dias.
    """
    if ultima_verificacao is None:
        corte = date.today() - timedelta(days=30)
    else:
        corte = ultima_verificacao

    return [m for m in movimentacoes if m.data > corte]


async def verificar_processo(processo: dict) -> None:
    """
    Verifica um processo por novas movimentações e processa cada uma.
    Grava resultado em monitoramento_logs.
    """
    supabase = await get_supabase()
    processo_id = processo["id"]
    numero_cnj = processo["numero_cnj"]
    notificar_cliente = processo.get("notificar_cliente", False)

    ultima_at = processo.get("ultima_verificacao_at")
    ultima_date: date | None = None
    if ultima_at:
        try:
            ultima_date = datetime.fromisoformat(ultima_at.replace("Z", "+00:00")).date()
        except Exception:
            ultima_date = None

    provider = _get_provider()
    provider_name = type(provider).__name__.lower().replace("provider", "")

    try:
        todas = await provider.check_processo(numero_cnj)
        novas = _filtrar_novas(todas, ultima_date)

        if not novas:
            await supabase.table("monitoramento_logs").insert({
                "processo_id": processo_id,
                "provider": provider_name,
                "status": "sem_novidade",
                "movimentacoes_encontradas": 0,
            }).execute()
            await _atualizar_ultima_verificacao(supabase, processo_id)
            return

        # Buscar telefone do advogado responsável
        telefone_advogado = await _buscar_telefone_advogado(supabase, processo)
        telefone_cliente = await _buscar_telefone_cliente(supabase, processo) if notificar_cliente else None

        for mov in novas:
            await _processar_movimentacao(
                supabase=supabase,
                processo_id=processo_id,
                numero_cnj=numero_cnj,
                mov=mov,
                telefone_advogado=telefone_advogado,
                notificar_cliente=notificar_cliente,
                telefone_cliente=telefone_cliente,
            )

        await supabase.table("monitoramento_logs").insert({
            "processo_id": processo_id,
            "provider": provider_name,
            "status": "ok",
            "movimentacoes_encontradas": len(novas),
        }).execute()
        await _atualizar_ultima_verificacao(supabase, processo_id)
        logger.info("Processo verificado", cnj=numero_cnj, novas=len(novas))

    except Exception as exc:
        logger.error("Erro ao verificar processo", cnj=numero_cnj, error=str(exc))
        await supabase.table("monitoramento_logs").insert({
            "processo_id": processo_id,
            "provider": provider_name,
            "status": "erro",
            "movimentacoes_encontradas": 0,
            "erro_msg": str(exc)[:500],
        }).execute()


async def _processar_movimentacao(
    supabase,
    processo_id: str,
    numero_cnj: str,
    mov: Movimentacao,
    telefone_advogado: str | None,
    notificar_cliente: bool,
    telefone_cliente: str | None,
) -> None:
    """Salva andamento, extrai PDF e notifica via WhatsApp."""
    from app.rpa.notificador import notificar_advogado, notificar_cliente as notif_cliente

    # Extrair PDF se houver
    pdf_texto = await extrair_texto_pdf(mov.pdf_url) if mov.pdf_url else None

    # Inserir andamento
    andamento_payload = {
        "processo_id": processo_id,
        "data_andamento": str(mov.data),
        "texto_original": mov.descricao,
        "origem": "rpa",
    }
    if mov.pdf_url:
        andamento_payload["pdf_url"] = mov.pdf_url
    if pdf_texto:
        andamento_payload["pdf_texto"] = pdf_texto

    andamento_result = await supabase.table("andamentos").insert(andamento_payload).execute()
    andamento_id = andamento_result.data[0]["id"] if andamento_result.data else None

    # Notificar advogado
    now_sp = datetime.now(_SP_TZ).isoformat()
    if telefone_advogado:
        settings = get_settings()
        ok = await notificar_advogado(
            telefone_advogado=telefone_advogado,
            numero_cnj=numero_cnj,
            descricao=mov.descricao,
            data=mov.data,
            processo_id=processo_id,
        )
        if ok and andamento_id:
            await supabase.table("andamentos").update(
                {"notificado_advogado_at": now_sp}
            ).eq("id", andamento_id).execute()

    # Notificar cliente
    if notificar_cliente and telefone_cliente:
        ok = await notif_cliente(
            telefone_cliente=telefone_cliente,
            descricao=mov.descricao,
            processo_id=processo_id,
        )
        if ok and andamento_id:
            await supabase.table("andamentos").update(
                {"notificado_cliente_at": now_sp}
            ).eq("id", andamento_id).execute()


async def _atualizar_ultima_verificacao(supabase, processo_id: str) -> None:
    now_sp = datetime.now(_SP_TZ).isoformat()
    await supabase.table("processos").update(
        {"ultima_verificacao_at": now_sp}
    ).eq("id", processo_id).execute()


async def _buscar_telefone_advogado(supabase, processo: dict) -> str | None:
    """Busca o telefone do advogado responsável pelo processo."""
    advogado_id = processo.get("advogado_id")
    if not advogado_id:
        return None
    result = await supabase.table("leads").select("telefone").eq("id", advogado_id).single().execute()
    return result.data.get("telefone") if result.data else None


async def _buscar_telefone_cliente(supabase, processo: dict) -> str | None:
    """Busca o telefone do cliente do processo."""
    cliente_id = processo.get("cliente_id")
    if not cliente_id:
        return None
    result = await supabase.table("leads").select("telefone").eq("id", cliente_id).single().execute()
    return result.data.get("telefone") if result.data else None


async def executar_ciclo_monitoramento() -> None:
    """
    Ponto de entrada do scheduler.
    Busca todos os processos monitorados e verifica cada um.
    """
    logger.info("Iniciando ciclo de monitoramento")
    supabase = await get_supabase()

    result = await supabase.table("processos").select(
        "id, numero_cnj, advogado_id, cliente_id, notificar_cliente, ultima_verificacao_at"
    ).eq("monitorar", True).neq("status", "arquivado").execute()

    processos = result.data or []
    logger.info("Processos monitorados", total=len(processos))

    for processo in processos:
        await verificar_processo(processo)

    logger.info("Ciclo de monitoramento concluído", total=len(processos))
```

- [ ] **Step 5: Atualizar `rpa/__init__.py`**

Substituir o conteúdo de `backend/app/rpa/__init__.py` por:

```python
"""Módulo de Legal Ops / RPA — monitoramento processual."""
from app.rpa.monitoramento import executar_ciclo_monitoramento

__all__ = ["executar_ciclo_monitoramento"]
```

- [ ] **Step 6: Rodar testes**

```bash
cd backend && python -m pytest tests/rpa/test_monitoramento.py -v
```

Expected: todos PASS.

- [ ] **Step 7: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/rpa/ backend/tests/rpa/test_monitoramento.py
git commit -m "feat(fase-8): orquestração do ciclo de monitoramento processual"
```

---

## Task 7: Scheduler APScheduler + integração main.py

**Files:**
- Create: `backend/app/rpa/scheduler.py`
- Modify: `backend/app/main.py`

- [ ] **Step 1: Criar scheduler**

Criar `backend/app/rpa/scheduler.py`:

```python
"""APScheduler configurado com timezone America/Sao_Paulo."""
from __future__ import annotations

import asyncio

import pytz
from apscheduler.schedulers.asyncio import AsyncIOScheduler

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("rpa.scheduler")

_SP_TZ = pytz.timezone("America/Sao_Paulo")
_scheduler: AsyncIOScheduler | None = None


async def _job_monitoramento() -> None:
    """Job executado pelo scheduler."""
    from app.rpa.monitoramento import executar_ciclo_monitoramento
    await executar_ciclo_monitoramento()


def get_scheduler() -> AsyncIOScheduler:
    global _scheduler
    if _scheduler is None:
        settings = get_settings()
        _scheduler = AsyncIOScheduler(timezone=_SP_TZ)
        _scheduler.add_job(
            func=lambda: asyncio.ensure_future(_job_monitoramento()),
            trigger="interval",
            hours=settings.rpa_check_interval_hours,
            id="monitoramento_processual",
            replace_existing=True,
        )
    return _scheduler


def start_scheduler() -> None:
    scheduler = get_scheduler()
    if not scheduler.running:
        scheduler.start()
        logger.info("Scheduler iniciado", interval_hours=get_settings().rpa_check_interval_hours)


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler and _scheduler.running:
        _scheduler.shutdown(wait=False)
        logger.info("Scheduler encerrado")
```

- [ ] **Step 2: Integrar scheduler ao lifespan em main.py**

Em `backend/app/main.py`, adicionar o import e chamar start/stop no lifespan:

```python
from app.rpa.scheduler import start_scheduler, stop_scheduler

@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    logger = get_logger("juris-ai")
    logger.info("Juris AI iniciando", env=settings.app_env)
    start_scheduler()
    yield
    stop_scheduler()
    logger.info("Juris AI encerrando")
```

- [ ] **Step 3: Verificar que o servidor inicia sem erros**

```bash
cd backend && python -m uvicorn app.main:app --port 8000 --reload
```

Expected: servidor sobe, log mostra "Scheduler iniciado".  
Pressionar Ctrl+C para parar.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/rpa/scheduler.py backend/app/main.py
git commit -m "feat(fase-8): APScheduler integrado ao lifespan do FastAPI"
```

---

## Task 8: Endpoints da API de processos

**Files:**
- Modify: `backend/app/api/processos/router.py`

- [ ] **Step 1: Adicionar 2 endpoints ao router**

Em `backend/app/api/processos/router.py`, adicionar os seguintes imports e endpoints ao final do arquivo. Primeiro adicionar ao bloco de imports:

```python
from app.models.processos import (
    AndamentoCreate,
    AndamentoOut,
    IntimacaoCreate,
    IntimacaoOut,
    MonitoramentoConfig,
    ProcessoCreate,
    ProcessoDetail,
    ProcessoOut,
    ProcessoUpdate,
)
```

Então adicionar os dois novos endpoints ao final do arquivo:

```python
# ─── Monitoramento ────────────────────────────────────────────────────────────

@router.put("/{processo_id}/monitoramento", response_model=ProcessoOut)
async def update_monitoramento(
    processo_id: UUID, body: MonitoramentoConfig, current_user: AuthUser
):
    """Liga/desliga monitoramento automático e notificação do cliente."""
    await _get_processo_or_404(processo_id)
    supabase = await get_supabase()

    payload = body.model_dump(exclude_none=True)
    if not payload:
        raise HTTPException(status_code=400, detail="Nenhum campo informado")

    result = (
        await supabase.table("processos")
        .update(payload)
        .eq("id", str(processo_id))
        .execute()
    )
    logger.info(
        "Monitoramento atualizado",
        processo_id=str(processo_id),
        config=payload,
        user=current_user.id,
    )
    return result.data[0]


@router.post("/{processo_id}/verificar", status_code=status.HTTP_200_OK)
async def verificar_processo_manual(processo_id: UUID, current_user: AuthUser):
    """Dispara verificação manual imediata de um processo."""
    processo = await _get_processo_or_404(processo_id)
    supabase = await get_supabase()

    # Buscar dados completos para o monitoramento
    result = await supabase.table("processos").select(
        "id, numero_cnj, advogado_id, cliente_id, notificar_cliente, ultima_verificacao_at"
    ).eq("id", str(processo_id)).single().execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="Processo não encontrado")

    from app.rpa.monitoramento import verificar_processo
    import asyncio
    asyncio.create_task(verificar_processo(result.data))

    logger.info("Verificação manual disparada", processo_id=str(processo_id), user=current_user.id)
    return {"status": "ok", "message": "Verificação iniciada em background"}
```

- [ ] **Step 2: Verificar que a aplicação sobe sem erros**

```bash
cd backend && python -m uvicorn app.main:app --port 8000
```

Expected: sem erros de import. Acessar `http://localhost:8000/docs` e confirmar os 2 novos endpoints em `/api/processos`.

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add backend/app/api/processos/router.py
git commit -m "feat(fase-8): endpoints PUT /monitoramento e POST /verificar"
```

---

## Task 9: Frontend — tipos TypeScript

**Files:**
- Modify: `frontend/types/processos.ts`

- [ ] **Step 1: Adicionar novos campos ao tipo `Processo`**

Em `frontend/types/processos.ts`, atualizar a interface `Processo`:

```typescript
export interface Processo {
  id: string;
  numero_cnj: string;
  cliente_id: string | null;
  advogado_id: string | null;
  tribunal: string | null;
  vara: string | null;
  area_juridica: AreaJuridica | null;
  status: ProcessoStatus;
  monitorar: boolean;
  notificar_cliente: boolean;
  ultima_verificacao_at: string | null;
  created_at: string;
  updated_at: string;
}
```

- [ ] **Step 2: Adicionar novos campos ao tipo `Andamento`**

```typescript
export interface Andamento {
  id: string;
  processo_id: string;
  data_andamento: string;
  texto_original: string;
  texto_traduzido: string | null;
  notificado_cliente: boolean;
  pdf_url: string | null;
  pdf_texto: string | null;
  notificado_advogado_at: string | null;
  notificado_cliente_at: string | null;
  origem: string;
  created_at: string;
}
```

- [ ] **Step 3: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add frontend/types/processos.ts
git commit -m "feat(fase-8): atualizar tipos TypeScript com campos de monitoramento"
```

---

## Task 10: Frontend — componente MonitoramentoTab

**Files:**
- Create: `frontend/components/processos/MonitoramentoTab.tsx`

- [ ] **Step 1: Criar componente**

Criar `frontend/components/processos/MonitoramentoTab.tsx`:

```tsx
"use client";

import { useState } from "react";
import { Bot, RefreshCw, FileText, MessageSquare } from "lucide-react";
import { cn } from "@/lib/utils";
import { api } from "@/lib/api";
import type { Processo, Andamento } from "@/types/processos";

interface Props {
  processo: Processo;
  andamentosRpa: Andamento[];
  onProcessoUpdated: (p: Processo) => void;
}

export function MonitoramentoTab({ processo, andamentosRpa, onProcessoUpdated }: Props) {
  const [verificando, setVerificando] = useState(false);
  const [togglingMonitorar, setTogglingMonitorar] = useState(false);
  const [togglingCliente, setTogglingCliente] = useState(false);

  async function handleToggleMonitorar() {
    setTogglingMonitorar(true);
    try {
      const updated = await api.put<Processo>(
        `/api/processos/${processo.id}/monitoramento`,
        { monitorar: !processo.monitorar }
      );
      onProcessoUpdated(updated);
    } finally {
      setTogglingMonitorar(false);
    }
  }

  async function handleToggleCliente() {
    setTogglingCliente(true);
    try {
      const updated = await api.put<Processo>(
        `/api/processos/${processo.id}/monitoramento`,
        { notificar_cliente: !processo.notificar_cliente }
      );
      onProcessoUpdated(updated);
    } finally {
      setTogglingCliente(false);
    }
  }

  async function handleVerificarAgora() {
    setVerificando(true);
    try {
      await api.post(`/api/processos/${processo.id}/verificar`, {});
    } finally {
      setVerificando(false);
    }
  }

  const ultimaVerificacao = processo.ultima_verificacao_at
    ? new Date(processo.ultima_verificacao_at).toLocaleString("pt-BR", {
        timeZone: "America/Sao_Paulo",
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;

  return (
    <div className="space-y-6">
      {/* Configuração */}
      <div>
        <p className="label-caps mb-3">Configuração</p>
        <div className="rounded-xl border border-border bg-surface/50 divide-y divide-border">
          <ToggleRow
            label="Monitorar automaticamente"
            description="Verifica novas movimentações a cada hora via DataJud/CNJ"
            checked={processo.monitorar}
            disabled={togglingMonitorar}
            onChange={handleToggleMonitorar}
          />
          <ToggleRow
            label="Notificar cliente via WhatsApp"
            description="Envia resumo em linguagem simples ao cliente quando houver novidade"
            checked={processo.notificar_cliente}
            disabled={togglingCliente || !processo.monitorar}
            onChange={handleToggleCliente}
          />
        </div>
      </div>

      {/* Status + ação manual */}
      <div className="flex items-stretch gap-3">
        <div className="flex-1 rounded-xl border border-border bg-surface/50 px-4 py-3">
          <p className="label-caps mb-1">Última verificação</p>
          <p className="text-sm font-medium">
            {ultimaVerificacao ?? "Nunca verificado"}
          </p>
        </div>
        <div className="flex items-center">
          <button
            onClick={handleVerificarAgora}
            disabled={verificando || !processo.monitorar}
            className="flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground hover:bg-primary-hover hover:shadow-glow-gold transition-colors disabled:opacity-50"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", verificando && "animate-spin")} />
            {verificando ? "Verificando..." : "Verificar agora"}
          </button>
        </div>
      </div>

      {/* Movimentações detectadas pelo robô */}
      <div>
        <p className="label-caps mb-3">
          Movimentações detectadas pelo robô ({andamentosRpa.length})
        </p>
        {andamentosRpa.length === 0 ? (
          <div className="rounded-xl border border-border bg-surface/50 px-4 py-8 text-center">
            <Bot className="mx-auto h-8 w-8 text-muted-foreground mb-2 opacity-40" />
            <p className="text-sm text-muted-foreground">
              {processo.monitorar
                ? "Nenhuma movimentação detectada ainda. O robô verifica a cada hora."
                : "Ative o monitoramento para que o robô comece a verificar este processo."}
            </p>
          </div>
        ) : (
          <div className="rounded-xl border border-border bg-surface/50 divide-y divide-border">
            {andamentosRpa.map((a) => (
              <MovimentacaoItem key={a.id} andamento={a} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  description,
  checked,
  disabled,
  onChange,
}: {
  label: string;
  description: string;
  checked: boolean;
  disabled: boolean;
  onChange: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4 px-4 py-3">
      <div>
        <p className="text-sm font-medium">{label}</p>
        <p className="text-xs text-muted-foreground mt-0.5">{description}</p>
      </div>
      <button
        onClick={onChange}
        disabled={disabled}
        className={cn(
          "relative inline-flex h-5 w-9 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 focus-visible:outline-none disabled:opacity-40",
          checked ? "bg-green-500" : "bg-muted"
        )}
        role="switch"
        aria-checked={checked}
      >
        <span
          className={cn(
            "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow transition duration-200",
            checked ? "translate-x-4" : "translate-x-0"
          )}
        />
      </button>
    </div>
  );
}

function MovimentacaoItem({ andamento }: { andamento: Andamento }) {
  const data = new Date(andamento.data_andamento + "T12:00:00").toLocaleDateString("pt-BR");

  return (
    <div className="flex gap-3 px-4 py-3">
      <div className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-violet-400" />
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <p className="text-sm font-medium leading-snug">{andamento.texto_original}</p>
          <span className="flex-shrink-0 text-xs text-muted-foreground">{data}</span>
        </div>
        <div className="mt-1.5 flex flex-wrap gap-1.5">
          {andamento.pdf_url && (
            <Badge icon={<FileText className="h-3 w-3" />} label="PDF extraído" color="gold" />
          )}
          {andamento.notificado_advogado_at && (
            <Badge icon={<MessageSquare className="h-3 w-3" />} label="Advogado notificado" color="green" />
          )}
          {andamento.notificado_cliente_at && (
            <Badge icon={<Bot className="h-3 w-3" />} label="Cliente notificado" color="violet" />
          )}
        </div>
      </div>
    </div>
  );
}

function Badge({
  icon,
  label,
  color,
}: {
  icon: React.ReactNode;
  label: string;
  color: "gold" | "green" | "violet";
}) {
  const colors = {
    gold: "bg-primary/10 text-primary",
    green: "bg-green-500/10 text-green-400",
    violet: "bg-violet-500/10 text-violet-400",
  };
  return (
    <span className={cn("inline-flex items-center gap-1 rounded px-1.5 py-0.5 text-xs font-medium", colors[color])}>
      {icon}
      {label}
    </span>
  );
}
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add frontend/components/processos/MonitoramentoTab.tsx
git commit -m "feat(fase-8): componente MonitoramentoTab com toggles e timeline"
```

---

## Task 11: Frontend — atualizar ProcessoDetail

**Files:**
- Modify: `frontend/components/processos/ProcessoDetail.tsx`

- [ ] **Step 1: Adicionar aba Monitoramento ao ProcessoDetail**

No arquivo `frontend/components/processos/ProcessoDetail.tsx`:

**1.** Alterar o tipo `Tab`:
```typescript
type Tab = "andamentos" | "intimacoes" | "monitoramento";
```

**2.** Adicionar import do componente:
```typescript
import { MonitoramentoTab } from "./MonitoramentoTab";
```

**3.** No bloco de tabs, substituir o map por:
```tsx
{/* Tabs */}
<div className="border-b flex text-sm">
  {(["andamentos", "intimacoes", "monitoramento"] as Tab[]).map((t) => (
    <button
      key={t}
      onClick={() => setTab(t)}
      className={cn(
        "px-4 py-2 font-medium capitalize transition-colors",
        tab === t
          ? "border-b-2 border-primary text-primary"
          : "text-muted-foreground hover:text-foreground"
      )}
    >
      {t === "andamentos"
        ? `Andamentos (${localAndamentos.length})`
        : t === "intimacoes"
        ? `Intimações (${intimacoes.length})`
        : "🤖 Monitoramento"}
    </button>
  ))}
</div>
```

**4.** No conteúdo das abas, adicionar o caso `monitoramento`:
```tsx
{tab === "andamentos" ? (
  /* ... código existente ... */
) : tab === "intimacoes" ? (
  /* ... código existente ... */
) : (
  <MonitoramentoTab
    processo={localProcesso}
    andamentosRpa={localAndamentos.filter((a) => a.origem === "rpa")}
    onProcessoUpdated={(updated) => setLocalProcesso(updated)}
  />
)}
```

- [ ] **Step 2: Verificar TypeScript sem erros**

```bash
cd frontend && npx tsc --noEmit
```

Expected: sem erros de tipo.

- [ ] **Step 3: Commit final**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI"
git add frontend/components/processos/ProcessoDetail.tsx
git commit -m "feat(fase-8): adicionar aba Monitoramento ao ProcessoDetail"
```

---

## Task 12: Push e verificação final

- [ ] **Step 1: Rodar todos os testes do backend**

```bash
cd backend && python -m pytest tests/ -v
```

Expected: todos passam (health + rpa tests).

- [ ] **Step 2: Build do frontend sem erros**

```bash
cd frontend && npm run build
```

Expected: build completo sem erros de TypeScript ou ESLint.

- [ ] **Step 3: Push para o repositório**

```bash
cd "C:\Users\Juan Paulo\Desktop\Juris AI" && git push origin main
```

Expected: push bem-sucedido.
