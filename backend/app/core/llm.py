"""Cliente LLM centralizado — usa OpenRouter por padrão."""
from functools import lru_cache

from openai import AsyncOpenAI

from app.core.config import get_settings


@lru_cache(maxsize=1)
def get_llm_client() -> AsyncOpenAI:
    s = get_settings()
    return AsyncOpenAI(
        api_key=s.openrouter_api_key or s.openai_api_key,
        base_url=s.llm_base_url,
        default_headers={
            "HTTP-Referer": "https://juris-ai.app",
            "X-Title": "Juris AI",
        },
    )


def get_model() -> str:
    return get_settings().llm_model
