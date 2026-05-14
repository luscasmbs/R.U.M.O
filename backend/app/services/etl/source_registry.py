from datetime import datetime

from sqlalchemy import select
from sqlalchemy.orm import Session

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
