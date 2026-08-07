from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.forecast import Forecast
from app.models.neighborhood import Neighborhood
from app.models.user import User

router = APIRouter()


@router.get("")
def list_forecasts(
    module: str = Query("epidemiology", pattern="^[a-z_]+$"),
    municipality_code: str = Query("2611606", min_length=1, max_length=20),
    horizon_days: int = Query(7, ge=1, le=90),
    limit: int = Query(60, ge=1, le=200),
    disease: str = Query("all", pattern="^[a-z_]+$"),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    forecast_filters = [
        Forecast.module == module,
        Forecast.horizon_days == horizon_days,
        Forecast.explanation["target_disease"].as_string() == disease,
        Neighborhood.municipality_code == municipality_code,
    ]
    latest_forecast = (
        select(Forecast.neighborhood_id, func.max(Forecast.created_at).label("created_at"))
        .join(Neighborhood, Neighborhood.id == Forecast.neighborhood_id)
        .where(*forecast_filters)
        .group_by(Forecast.neighborhood_id)
        .subquery()
    )
    rows = db.execute(
        select(Forecast, Neighborhood.name)
        .join(
            latest_forecast,
            (Forecast.neighborhood_id == latest_forecast.c.neighborhood_id)
            & (Forecast.created_at == latest_forecast.c.created_at),
        )
        .join(Neighborhood, Neighborhood.id == Forecast.neighborhood_id)
        .where(*forecast_filters)
        .order_by(Forecast.risk_score.desc())
        .limit(limit)
    ).all()
    return {
        "contract_version": "2026-01",
        "mode": "live",
        "items": [
            {
                "id": forecast.id,
                "neighborhood_id": forecast.neighborhood_id,
                "neighborhood_name": name or "Recife",
                "module": forecast.module,
                "target_date": forecast.target_date,
                "created_at": forecast.created_at,
                "horizon_days": forecast.horizon_days,
                "risk_score": round(forecast.risk_score, 2),
                "probability": (forecast.explanation or {}).get("probability")
                if (forecast.explanation or {}).get("probability") is not None
                else round(forecast.risk_score / 100, 4),
                "predicted_value": forecast.predicted_value,
                "confidence": forecast.confidence,
                "model_version": forecast.model_version,
                "explanation": forecast.explanation or {},
            }
            for forecast, name in rows
        ],
    }
