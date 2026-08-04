from __future__ import annotations

from app.core.config import settings


class DatasusConnector:
    """Contract adapter for public DATASUS epidemiological datasets.

    DATASUS exposes different datasets through TabNet, FTP and periodically
    published files. Keeping the source contract here lets the ETL swap the
    transport without changing normalization, storage or model code.
    """

    def __init__(self, base_url: str | None = None):
        self.base_url = str(base_url or settings.datasus_base_url).rstrip("/")

    async def metadata(self) -> dict:
        return {
            "source": "datasus",
            "dataset": "epidemiological_notifications",
            "base_url": self.base_url,
            "mode": "real-ready",
            "records": [],
            "schema": {
                "municipality_code": "string",
                "disease": "string",
                "occurred_at": "date",
                "neighborhood": "string|null",
                "latitude": "float|null",
                "longitude": "float|null",
            },
            "notes": "Configurar o transporte do dataset oficial antes de executar a ingestão produtiva.",
        }
