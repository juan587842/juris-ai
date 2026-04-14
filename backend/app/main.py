from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.chat.router import router as chat_router
from app.api.webhooks.evolution import router as evolution_router
from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger


@asynccontextmanager
async def lifespan(app: FastAPI):
    settings = get_settings()
    configure_logging(settings.log_level)
    logger = get_logger("juris-ai")
    logger.info("Juris AI iniciando", env=settings.app_env)
    yield
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

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


app.include_router(evolution_router, prefix="/api")
app.include_router(chat_router, prefix="/api")


@app.get("/health", tags=["sistema"])
async def health_check() -> dict:
    return {"status": "ok", "service": "juris-ai"}
