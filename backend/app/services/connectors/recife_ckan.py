from __future__ import annotations

import httpx

from app.core.config import settings


class RecifeCkanConnector:
    def __init__(self, base_url: str | None = None):
        self.base_url = str(base_url or settings.recife_ckan_base_url).rstrip("/")

    async def package_show(self, dataset_id: str | None = None) -> dict:
        dataset = dataset_id or settings.recife_arboviruses_dataset
        async with httpx.AsyncClient(timeout=45) as client:
            response = await client.get(f"{self.base_url}/package_show", params={"id": dataset})
            response.raise_for_status()
            payload = response.json()
        if not payload.get("success"):
            raise ValueError(f"CKAN retornou falha para dataset {dataset}")
        return payload["result"]

    async def arbovirus_csv_resources(self) -> list[dict]:
        package = await self.package_show()
        resources = []
        for resource in package.get("resources", []):
            name = (resource.get("name") or "").lower()
            fmt = (resource.get("format") or "").lower()
            url = resource.get("url")
            if not url or "csv" not in fmt:
                continue
            if any(term in name for term in ["dengue", "zika", "chikungunya"]):
                resources.append(
                    {
                        "id": resource.get("id"),
                        "name": resource.get("name"),
                        "url": url,
                        "format": resource.get("format"),
                        "last_modified": resource.get("last_modified"),
                    }
                )
        return resources
