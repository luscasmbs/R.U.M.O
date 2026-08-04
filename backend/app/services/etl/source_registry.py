from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import settings
from app.models.data_source import DataSource


def get_or_create_source(db: Session, *, name: str, kind: str, base_url: str, refresh_frequency: str | None = None) -> DataSource:
    source = db.scalar(select(DataSource).where(DataSource.name == name))
    if source:
        return source
    source = DataSource(name=name, kind=kind, base_url=base_url, refresh_frequency=refresh_frequency, metadata_json={})
    db.add(source)
    db.commit()
    db.refresh(source)
    return source


def ensure_default_sources(db: Session) -> list[DataSource]:
    """Keep the public-data catalog visible before the first ingestion."""
    definitions = [
        ("Recife Dados Abertos - Arboviroses", "ckan", str(settings.recife_ckan_base_url), "trimestral", "active", "Arboviroses", "CKAN API"),
        ("DATASUS - Notificações epidemiológicas", "health_data", str(settings.datasus_base_url), "mensal", "ready", "Notificações epidemiológicas", "TabNet / arquivos oficiais"),
        ("INMET", "weather_api", str(settings.inmet_api_base_url), "diária", "ready", "Chuva, temperatura e umidade", "API pública"),
        ("APAC", "weather_monitoring", str(settings.apac_base_url), "diária", "monitoring", "Monitoramento hídrico e boletins", "links oficiais"),
        ("IBGE Malha de Bairros 2022", "geospatial", settings.ibge_geo_url, "sob demanda", "ready", "Malha territorial e demografia", "arquivo geoespacial oficial"),
    ]
    sources = []
    for name, kind, base_url, frequency, status, coverage, transport in definitions:
        source = get_or_create_source(db, name=name, kind=kind, base_url=base_url, refresh_frequency=frequency)
        source.status = source.status if source.status == "error" else status
        source.metadata_json = {"coverage": coverage, "transport": transport, **(source.metadata_json or {})}
        db.add(source)
        sources.append(source)
    db.commit()
    return sources


def mark_source_success(db: Session, source: DataSource, metadata: dict | None = None):
    source.status = "active"
    source.last_error = None
    source.last_success_at = datetime.utcnow()
    if metadata:
        source.metadata_json = {**(source.metadata_json or {}), **metadata}
    db.add(source)
    db.commit()


def mark_source_error(db: Session, source: DataSource, error: str):
    source.status = "error"
    source.last_error = error[:2000]
    db.add(source)
    db.commit()
