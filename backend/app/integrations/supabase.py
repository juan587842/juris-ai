"""Cliente Supabase com service_key — uso exclusivo do backend/workers."""
from functools import lru_cache

from supabase import AsyncClient, acreate_client

from app.core.config import get_settings


@lru_cache(maxsize=1)
def _get_settings():
    return get_settings()


_client: AsyncClient | None = None


async def get_supabase() -> AsyncClient:
    global _client
    if _client is None:
        s = _get_settings()
        _client = await acreate_client(s.supabase_url, s.supabase_service_key)
    return _client
