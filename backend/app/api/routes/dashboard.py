import json

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.alert import Alert
from app.models.data_source import DataSource
from app.models.forecast import Forecast
from app.models.incident import Incident
from app.models.neighborhood import Neighborhood
from app.models.user import User

router = APIRouter()


@router.get("")
def dashboard(module: str = "epidemiology", window_days: int = 7, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    latest_forecast = (
        select(Forecast.neighborhood_id, func.max(Forecast.created_at).label("created_at"))
        .where(Forecast.module == module, Forecast.horizon_days == window_days)
        .group_by(Forecast.neighborhood_id)
        .subquery()
    )
    forecast_rows = db.execute(
        select(Forecast, Neighborhood.name)
        .join(latest_forecast, (Forecast.neighborhood_id == latest_forecast.c.neighborhood_id) & (Forecast.created_at == latest_forecast.c.created_at))
        .join(Neighborhood, Neighborhood.id == Forecast.neighborhood_id, isouter=True)
        .order_by(Forecast.risk_score.desc())
    ).all()
    risk_by_neighborhood = {f.neighborhood_id: f for f, _ in forecast_rows}
    incident_counts = dict(
        db.execute(
            select(Incident.neighborhood_id, func.count(Incident.id))
            .where(Incident.category == module if module != "epidemiology" else Incident.category == "epidemiology")
            .group_by(Incident.neighborhood_id)
        ).all()
    )
    neighborhoods = db.execute(
        select(
            Neighborhood.id,
            Neighborhood.name,
            Neighborhood.code,
            Neighborhood.area_km2,
            func.ST_AsGeoJSON(Neighborhood.geom).label("geometry"),
        ).where(Neighborhood.geom.isnot(None))
    ).all()
    features = []
    for row in neighborhoods:
        forecast = risk_by_neighborhood.get(row.id)
        features.append(
            {
                "type": "Feature",
                "id": row.id,
                "properties": {
                    "id": row.id,
                    "name": row.name,
                    "code": row.code,
                    "area_km2": row.area_km2,
                    "risk_score": round(forecast.risk_score, 2) if forecast else 0,
                    "incident_count": int(incident_counts.get(row.id, 0)),
                },
                "geometry": json.loads(row.geometry),
            }
        )
    alerts = db.execute(
        select(Alert, Neighborhood.name)
        .join(Neighborhood, Neighborhood.id == Alert.neighborhood_id, isouter=True)
        .where(Alert.status == "active", Alert.module == module)
        .order_by(Alert.created_at.desc())
        .limit(20)
    ).all()
    return {
        "metrics": {
            "neighborhoods": db.scalar(select(func.count(Neighborhood.id))) or 0,
            "active_alerts": db.scalar(select(func.count(Alert.id)).where(Alert.status == "active")) or 0,
            "forecasts": db.scalar(select(func.count(Forecast.id))) or 0,
            "data_sources": db.scalar(select(func.count(DataSource.id))) or 0,
        },
        "geojson": {"type": "FeatureCollection", "features": features},
        "top_neighborhoods": [
            {"label": name or "Bairro", "risk_score": round(forecast.risk_score, 2), "predicted_value": forecast.predicted_value}
            for forecast, name in forecast_rows[:12]
        ],
        "alerts": [
            {
                "id": alert.id,
                "title": alert.title,
                "description": alert.description,
                "severity": alert.severity,
                "neighborhood_name": name,
                "created_at": alert.created_at,
            }
            for alert, name in alerts
        ],
    }
