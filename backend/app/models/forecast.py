from datetime import datetime
from uuid import uuid4

from sqlalchemy import DateTime, Float, ForeignKey, JSON, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.models.base import Base


class Forecast(Base):
    __tablename__ = "forecasts"

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid4()))
    neighborhood_id: Mapped[str | None] = mapped_column(ForeignKey("neighborhoods.id"), index=True)
    module: Mapped[str] = mapped_column(String(80), index=True, nullable=False)
    target_date: Mapped[datetime] = mapped_column(DateTime, index=True, nullable=False)
    horizon_days: Mapped[int] = mapped_column(default=7, nullable=False)
    risk_score: Mapped[float] = mapped_column(Float, nullable=False)
    predicted_value: Mapped[float | None] = mapped_column(Float)
    confidence: Mapped[float | None] = mapped_column(Float)
    model_version: Mapped[str] = mapped_column(String(80), nullable=False)
    explanation: Mapped[dict] = mapped_column(JSON, default=dict, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow, nullable=False)

    neighborhood = relationship("Neighborhood", back_populates="forecasts")
