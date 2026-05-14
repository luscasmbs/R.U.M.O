from datetime import datetime
from uuid import uuid4

from geoalchemy2 import Geometry
from sqlalchemy import DateTime, Float, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Neighborhood(Base):
    __tablename__ = "neighborhoods"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    code: Mapped[str | None] = mapped_column(String(80), index=True)
    name: Mapped[str] = mapped_column(String(180), index=True, nullable=False)
    municipality_code: Mapped[str | None] = mapped_column(String(20), index=True)
    area_km2: Mapped[float | None] = mapped_column(Float)
    centroid_lat: Mapped[float | None] = mapped_column(Float)
    centroid_lon: Mapped[float | None] = mapped_column(Float)
    geom = mapped_column(Geometry(geometry_type="MULTIPOLYGON", srid=4326, spatial_index=True))
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    incidents = relationship("Incident", back_populates="neighborhood")
    forecasts = relationship("Forecast", back_populates="neighborhood")
