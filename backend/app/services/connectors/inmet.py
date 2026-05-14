from __future__ import annotations

from datetime import date

import httpx

from app.core.config import settings


class InmetConnector:
    """Cliente para endpoints públicos do INMET.

    O INMET documenta acesso público a dados meteorológicos, avisos e estações.
    O endpoint `apitempo.inmet.gov.br` é usado por clientes abertos do próprio INMET.
    """

    def __init__(self, base_url: str | None = None):
        self.base_url = str(base_url or settings.inmet_api_base_url).rstrip("/")

    async def stations(self, station_type: str = "T") -> list[dict]:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.get(f"{self.base_url}/estacoes/{station_type}")
            response.raise_for_status()
            return response.json()

    async def station_data(self, station_code: str, day: date) -> list[dict]:
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.get(f"{self.base_url}/estacao/dados/{day.isoformat()}/{station_code}")
            response.raise_for_status()
            return response.json()
