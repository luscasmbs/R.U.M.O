from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Incident(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    source_id: Mapped[str | None] = mapped_column(ForeignKey("data_sources.id"))
    neighborhood_id: Mapped[str | None] = mapped_column(ForeignKey("neighborhoods.id"), index=True)
    category: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    disease: Mapped[str | None] = mapped_column(String(80), index=True)
    occurred_at: Mapped[datetime | None] = mapped_column(DateTime, index=True)
    latitude: Mapped[float | None] = mapped_column(Float)
    longitude: Mapped[float | None] = mapped_column(Float)
    external_id: Mapped[str | None] = mapped_column(String(255), index=True)
    properties: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    neighborhood = relationship("Neighborhood", back_populates="incidents")
    source = relationship("DataSource")
