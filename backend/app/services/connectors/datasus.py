from __future__ import annotations

import asyncio
from datetime import datetime

import httpx

from app.core.config import settings


DISEASE_ENDPOINTS = {
    "dengue": "dengue",
    "chikungunya": "chikungunya",
    "zika": "zikavirus",
}
SAMPLE_LIMIT = 1000


def summarize_notifications(records: list[dict], disease: str) -> dict:
    dates = sorted(
        str(record["dt_notific"])
        for record in records
        if record.get("dt_notific") and str(record["dt_notific"]) != "nan"
    )
    recife_code = settings.recife_municipality_code[:6]
    resident_records = sum(1 for record in records if str(record.get("id_mn_resi")) == recife_code)
    return {
        "disease": disease,
        "records_sampled": len(records),
        "sample_limit_reached": len(records) >= SAMPLE_LIMIT,
        "latest_notification_date": dates[-1] if dates else None,
        "recife_resident_records_sampled": resident_records,
        "status": "available",
    }


class DatasusConnector:
    """Recent municipal signal from the official Open Data SUS API.

    The endpoint filters by the notifying municipality and does not expose a
    reliable neighborhood field. These records must not be distributed among
    Recife neighborhoods or treated as territorial model inputs.
    """

    def __init__(self, base_url: str | None = None):
        self.base_url = str(base_url or settings.datasus_base_url).rstrip("/")

    async def _disease_summary(self, client: httpx.AsyncClient, disease: str, endpoint: str, year: int) -> dict:
        try:
            response = await client.get(
                f"{self.base_url}/arboviroses/{endpoint}",
                params={
                    "nu_ano": year,
                    "id_municip": settings.recife_municipality_code[:6],
                    "limit": SAMPLE_LIMIT,
                    "offset": 0,
                },
            )
            response.raise_for_status()
            return summarize_notifications(response.json().get(endpoint, []), disease)
        except (httpx.HTTPError, ValueError, TypeError) as exc:
            return {
                "disease": disease,
                "records_sampled": 0,
                "sample_limit_reached": False,
                "latest_notification_date": None,
                "recife_resident_records_sampled": 0,
                "status": "unavailable",
                "error": str(exc)[:300],
            }

    async def recent_signal(self, year: int | None = None) -> dict:
        reference_year = year or datetime.now().year
        async with httpx.AsyncClient(timeout=60, follow_redirects=True) as client:
            summaries = await asyncio.gather(
                *(
                    self._disease_summary(client, disease, endpoint, reference_year)
                    for disease, endpoint in DISEASE_ENDPOINTS.items()
                )
            )
        available_dates = [
            item["latest_notification_date"]
            for item in summaries
            if item["latest_notification_date"]
        ]
        return {
            "source": "Open Data SUS",
            "reference_year": reference_year,
            "municipality_filter": "Recife/PE (município notificante)",
            "latest_notification_date": max(available_dates, default=None),
            "diseases": summaries,
            "scope_note": (
                "Sinal municipal recente. A fonte não oferece bairro confiável; "
                "estes dados não são distribuídos nos scores territoriais."
            ),
        }

    async def metadata(self) -> dict:
        signal = await self.recent_signal()
        return {
            "source": "datasus",
            "dataset": "arbovirus_notifications",
            "base_url": self.base_url,
            "mode": "current-municipal-signal",
            **signal,
        }
