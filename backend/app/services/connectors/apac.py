from __future__ import annotations

import httpx
from bs4 import BeautifulSoup

from app.core.config import settings


class ApacConnector:
    """Conector conservador para APAC.

    A APAC publica monitoramento, boletins e links oficiais. Quando não houver
    API JSON pública estável, esta classe coleta metadados e links de boletins
    nas páginas oficiais para ingestão posterior/manual auditável.
    """

    def __init__(self, base_url: str | None = None):
        self.base_url = str(base_url or settings.apac_base_url).rstrip("/")

    async def monitoring_links(self) -> list[dict]:
        async with httpx.AsyncClient(timeout=45, follow_redirects=True) as client:
            response = await client.get(f"{self.base_url}/monitoramento")
            response.raise_for_status()
        soup = BeautifulSoup(response.text, "html.parser")
        links = []
        for anchor in soup.select("a[href]"):
            text = " ".join(anchor.get_text(" ", strip=True).split())
            href = anchor["href"]
            if any(term in text.lower() for term in ["chuva", "cotas", "boletim", "previsão", "monitoramento"]):
                if href.startswith("/"):
                    href = f"{self.base_url}{href}"
                links.append({"title": text or href, "url": href})
        return links
