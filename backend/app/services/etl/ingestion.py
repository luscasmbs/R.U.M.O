from __future__ import annotations

from datetime import datetime
from io import StringIO
import re

import geopandas as gpd
import httpx
import pandas as pd
from geoalchemy2.shape import from_shape
from shapely.geometry import MultiPolygon, Polygon
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.incident import Incident
from app.models.neighborhood import Neighborhood
from app.services.connectors.apac import ApacConnector
from app.services.connectors.datasus import DatasusConnector
from app.services.connectors.ibge_geo import IbgeGeoConnector
from app.services.connectors.inmet import InmetConnector
from app.services.connectors.open_meteo import OpenMeteoConnector
from app.services.connectors.recife_ckan import RecifeCkanConnector
from app.services.etl.source_registry import get_or_create_source, mark_source_error, mark_source_success


def normalize_text(value: str | None) -> str:
    if not value:
        return ""
    value = str(value).strip().lower()
    value = re.sub(r"\s+", " ", value)
    return value


def first_existing(columns: list[str], candidates: list[str]) -> str | None:
    lookup = {normalize_text(c): c for c in columns}
    for candidate in candidates:
        normalized = normalize_text(candidate)
        if normalized in lookup:
            return lookup[normalized]
    for col in columns:
        normalized = normalize_text(col)
        if any(token in normalized for token in candidates):
            return col
    return None


def parse_date(value) -> datetime | None:
    if pd.isna(value):
        return None
    parsed = pd.to_datetime(value, errors="coerce", dayfirst=True)
    if pd.isna(parsed):
        return None
    return parsed.to_pydatetime()


def nullable_float(value) -> float | None:
    parsed = pd.to_numeric(value, errors="coerce")
    if pd.isna(parsed):
        return None
    return float(parsed)


class IngestionService:
    def __init__(self, db: Session):
        self.db = db

    async def ingest_recife_ckan(self) -> dict:
        source = get_or_create_source(
            self.db,
            name="Recife Dados Abertos - Arboviroses",
            kind="ckan",
            base_url=str(settings.recife_ckan_base_url),
            refresh_frequency="trimestral",
        )
        try:
            connector = RecifeCkanConnector()
            resources = await connector.arbovirus_csv_resources()
            inserted = 0
            async with httpx.AsyncClient(timeout=120, follow_redirects=True) as client:
                for resource in resources:
                    history_years = {str(year) for year in range(datetime.utcnow().year - settings.data_history_years, datetime.utcnow().year + 1)}
                    if not any(year in (resource["name"] or "") for year in history_years):
                        continue
                    response = await client.get(resource["url"])
                    response.raise_for_status()
                    frame = pd.read_csv(StringIO(response.text), sep=None, engine="python", dtype=str)
                    inserted += self._persist_arbovirus_frame(frame, source.id, resource)
            mark_source_success(self.db, source, {"resources": len(resources), "inserted": inserted})
            return {"source": source.name, "resources": len(resources), "inserted": inserted}
        except Exception as exc:
            mark_source_error(self.db, source, str(exc))
            raise

    def _persist_arbovirus_frame(self, frame: pd.DataFrame, source_id: str, resource: dict) -> int:
        columns = list(frame.columns)
        neighborhood_col = first_existing(columns, ["bairro", "nm_bairro", "nome_bairro"])
        date_col = first_existing(columns, ["data", "dt_notificacao", "data_notificacao", "notificacao", "dt_sin_pri"])
        lat_col = first_existing(columns, ["latitude", "lat"])
        lon_col = first_existing(columns, ["longitude", "lon", "lng"])
        disease = "dengue"
        lower_name = normalize_text(resource.get("name"))
        if "zika" in lower_name or "zica" in lower_name:
            disease = "zika"
        if "chikungunya" in lower_name:
            disease = "chikungunya"

        neighborhoods = {
            normalize_text(n.name): n.id
            for n in self.db.scalars(select(Neighborhood)).all()
        }
        inserted = 0
        for index, row in frame.iterrows():
            occurred_at = parse_date(row.get(date_col)) if date_col else None
            external_id = f"{resource.get('id')}:{index}"
            if self.db.scalar(select(Incident.id).where(Incident.external_id == external_id)):
                continue
            neighborhood_id = None
            if neighborhood_col:
                neighborhood_id = neighborhoods.get(normalize_text(row.get(neighborhood_col)))
            incident = Incident(
                source_id=source_id,
                neighborhood_id=neighborhood_id,
                category="epidemiology",
                disease=disease,
                occurred_at=occurred_at,
                latitude=nullable_float(row.get(lat_col)) if lat_col else None,
                longitude=nullable_float(row.get(lon_col)) if lon_col else None,
                external_id=external_id,
                properties={"resource": resource.get("name"), "raw": row.dropna().to_dict()},
            )
            self.db.add(incident)
            inserted += 1
            if inserted % 1000 == 0:
                self.db.commit()
        self.db.commit()
        return inserted

    async def ingest_ibge_geo(self) -> dict:
        source = get_or_create_source(
            self.db,
            name="IBGE Malha de Bairros 2022",
            kind="geospatial",
            base_url=settings.ibge_geo_url,
            refresh_frequency="sob demanda",
        )
        try:
            gdf = await IbgeGeoConnector().download_recife_neighborhoods()
            upserted = self._persist_neighborhoods(gdf)
            mark_source_success(self.db, source, {"upserted": upserted})
            return {"source": source.name, "upserted": upserted}
        except Exception as exc:
            mark_source_error(self.db, source, str(exc))
            raise

    def _persist_neighborhoods(self, gdf: gpd.GeoDataFrame) -> int:
        upserted = 0
        for _, row in gdf.iterrows():
            name = row.get("NM_BAIRRO") or row.get("nome") or row.get("name")
            code = str(row.get("CD_BAIRRO") or row.get("id") or name)
            if not name:
                continue
            geom = row.geometry
            if isinstance(geom, Polygon):
                geom = MultiPolygon([geom])
            centroid = geom.centroid
            neighborhood = self.db.scalar(select(Neighborhood).where(Neighborhood.code == code))
            if not neighborhood:
                neighborhood = Neighborhood(code=code, name=str(name))
            neighborhood.name = str(name)
            neighborhood.municipality_code = str(row.get("CD_MUN") or settings.recife_municipality_code)
            neighborhood.area_km2 = nullable_float(row.get("AREA_KM2"))
            neighborhood.centroid_lat = float(centroid.y)
            neighborhood.centroid_lon = float(centroid.x)
            neighborhood.geom = from_shape(geom, srid=4326)
            self.db.add(neighborhood)
            upserted += 1
        self.db.commit()
        return upserted

    async def register_inmet(self) -> dict:
        source = get_or_create_source(self.db, name="INMET", kind="weather_api", base_url=str(settings.inmet_api_base_url), refresh_frequency="diária")
        stations = await InmetConnector().stations()
        mark_source_success(self.db, source, {"stations_seen": len(stations)})
        return {"source": source.name, "stations_seen": len(stations)}

    async def register_apac(self) -> dict:
        source = get_or_create_source(self.db, name="APAC", kind="weather_monitoring", base_url=str(settings.apac_base_url), refresh_frequency="diária")
        links = await ApacConnector().monitoring_links()
        mark_source_success(self.db, source, {"monitoring_links": links[:20]})
        return {"source": source.name, "links": len(links)}

    async def register_open_meteo(self) -> dict:
        source = get_or_create_source(
            self.db,
            name="Open-Meteo - Previsão do Recife",
            kind="weather_forecast",
            base_url=str(settings.open_meteo_base_url),
            refresh_frequency="a cada 15 minutos",
        )
        try:
            forecast = await OpenMeteoConnector().forecast()
            metadata = {
                "updated_at": forecast["updated_at"],
                "forecast_days": len(forecast["daily"]),
                "next_24h": forecast["next_24h"],
            }
            mark_source_success(self.db, source, metadata)
            return {"source": source.name, **metadata}
        except Exception as exc:
            mark_source_error(self.db, source, str(exc))
            raise

    async def register_datasus(self) -> dict:
        source = get_or_create_source(
            self.db,
            name="DATASUS - Notificações epidemiológicas",
            kind="health_data",
            base_url=str(settings.datasus_base_url),
            refresh_frequency="mensal",
        )
        metadata = await DatasusConnector().metadata()
        mark_source_success(self.db, source, metadata)
        return {"source": source.name, "mode": metadata["mode"], "records": len(metadata["records"]), "ready": True}
