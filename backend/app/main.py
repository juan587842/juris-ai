from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from uvicorn.middleware.proxy_headers import ProxyHeadersMiddleware

from app.api.alertas.router import router as alertas_router
from app.api.analytics.router import router as analytics_router
from app.api.chat.router import router as chat_router
from app.api.crm.router import router as crm_router
from app.api.dashboard.router import router as dashboard_router
from app.api.processos.router import router as processos_router
from app.api.public.leads import router as public_leads_router
from app.api.webhooks.evolution import router as evolution_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger
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


settings = get_settings()

app = FastAPI(
    title="Juris AI",
    description="CRM e Legal Operations para escritórios de advocacia",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/docs" if not settings.is_production else None,
    redoc_url="/redoc" if not settings.is_production else None,
)

# Respeita X-Forwarded-Proto/For quando atrás de proxy reverso (nginx, Caddy, EasyPanel)
app.add_middleware(ProxyHeadersMiddleware, trusted_hosts="*")

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(analytics_router, prefix="/api")
app.include_router(evolution_router, prefix="/api")
app.include_router(chat_router, prefix="/api")
app.include_router(crm_router, prefix="/api")
app.include_router(processos_router, prefix="/api")
app.include_router(dashboard_router, prefix="/api")
app.include_router(public_leads_router, prefix="/api")
app.include_router(alertas_router, prefix="/api")


@app.get("/health", tags=["sistema"])
async def health_check() -> dict:
    return {"status": "ok", "service": "juris-ai"}
