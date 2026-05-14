from __future__ import annotations

from pathlib import Path
from tempfile import TemporaryDirectory
from zipfile import ZipFile

import geopandas as gpd
import httpx

from app.core.config import settings


class IbgeGeoConnector:
    def __init__(self, geo_url: str | None = None):
        self.geo_url = geo_url or settings.ibge_geo_url

    async def download_recife_neighborhoods(self) -> gpd.GeoDataFrame:
        with TemporaryDirectory() as tmp:
            tmp_path = Path(tmp)
            archive = tmp_path / "ibge_bairros.zip"
            async with httpx.AsyncClient(timeout=180, follow_redirects=True) as client:
                response = await client.get(self.geo_url)
                response.raise_for_status()
                archive.write_bytes(response.content)
            with ZipFile(archive) as zf:
                zf.extractall(tmp_path)
            candidates = list(tmp_path.rglob("*.gpkg")) + list(tmp_path.rglob("*.shp")) + list(tmp_path.rglob("*.geojson"))
            if not candidates:
                raise FileNotFoundError("O pacote do IBGE não contém GPKG, SHP ou GeoJSON.")
            gdf = gpd.read_file(candidates[0]).to_crs(4326)
            if "CD_MUN" in gdf.columns:
                gdf = gdf[gdf["CD_MUN"].astype(str) == settings.recife_municipality_code]
            if gdf.empty:
                raise ValueError("A malha baixada do IBGE não contém bairros do Recife.")
            return gdf
