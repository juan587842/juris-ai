"""APScheduler configurado com timezone America/Sao_Paulo."""
from __future__ import annotations

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
            func=_job_monitoramento,
            trigger="interval",
            hours=settings.rpa_check_interval_hours,
            id="monitoramento_processual",
            replace_existing=True,
            misfire_grace_time=60,
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
