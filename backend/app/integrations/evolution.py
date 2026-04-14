"""Cliente HTTP async para a Evolution API."""
from typing import Any

import httpx

from app.core.config import get_settings
from app.core.logging import get_logger

logger = get_logger("evolution")


class EvolutionClient:
    def __init__(self) -> None:
        s = get_settings()
        self._base_url = s.evolution_api_url.rstrip("/")
        self._instance = s.evolution_instance
        self._headers = {
            "apikey": s.evolution_api_key,
            "Content-Type": "application/json",
        }

    # ─── Mensagens ────────────────────────────────────────────────────────────

    async def send_text(self, phone: str, text: str) -> dict[str, Any]:
        """Envia mensagem de texto para um número (E.164 sem '+')."""
        payload = {
            "number": phone,
            "text": text,
            "options": {"delay": 500, "presence": "composing"},
        }
        return await self._post(f"/message/sendText/{self._instance}", payload)

    async def send_media(
        self,
        phone: str,
        media_url: str,
        caption: str = "",
        media_type: str = "document",
    ) -> dict[str, Any]:
        payload = {
            "number": phone,
            "mediatype": media_type,
            "media": media_url,
            "caption": caption,
        }
        return await self._post(f"/message/sendMedia/{self._instance}", payload)

    async def mark_as_read(self, remote_jid: str, message_id: str) -> dict[str, Any]:
        payload = {
            "readMessages": [{"remoteJid": remote_jid, "id": message_id}]
        }
        return await self._post(f"/message/markMessageAsRead/{self._instance}", payload)

    # ─── Instância ────────────────────────────────────────────────────────────

    async def get_instance_info(self) -> dict[str, Any]:
        return await self._get(f"/instance/fetchInstances")

    async def check_connection(self) -> bool:
        try:
            data = await self._get(f"/instance/connectionState/{self._instance}")
            return data.get("instance", {}).get("state") == "open"
        except Exception:
            return False

    # ─── HTTP helpers ─────────────────────────────────────────────────────────

    async def _post(self, path: str, payload: dict) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=15) as client:
            resp = await client.post(
                f"{self._base_url}{path}",
                json=payload,
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()

    async def _get(self, path: str) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=10) as client:
            resp = await client.get(
                f"{self._base_url}{path}",
                headers=self._headers,
            )
            resp.raise_for_status()
            return resp.json()


def get_evolution_client() -> EvolutionClient:
    return EvolutionClient()
