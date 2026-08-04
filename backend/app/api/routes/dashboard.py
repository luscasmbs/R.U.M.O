import json
from datetime import date, datetime, time, timedelta

from fastapi import APIRouter, Depends, HTTPException, Query
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


def _date_filters(start_date: date | None, end_date: date | None) -> list:
    if start_date and end_date and start_date > end_date:
        raise HTTPException(status_code=400, detail="O início do período deve ser anterior ao fim.")
    filters = []
    if start_date:
        filters.append(Incident.occurred_at >= datetime.combine(start_date, time.min))
    if end_date:
        filters.append(Incident.occurred_at < datetime.combine(end_date + timedelta(days=1), time.min))
    return filters


@router.get("")
def dashboard(
    module: str = Query("epidemiology", pattern="^[a-z_]+$"),
    window_days: int = Query(7, ge=1, le=90),
    municipality_code: str = Query("2611606", min_length=1, max_length=20),
    start_date: date | None = None,
    end_date: date | None = None,
    period_days: int = Query(90, ge=1, le=1825),
    category: str | None = Query(None, pattern="^[a-z_]+$"),
    _: User = Depends(get_current_user),
    db: Session = Depends(get_db),
):
    if not start_date and not end_date:
        end_date = date.today()
        start_date = end_date - timedelta(days=period_days - 1)
    base_incident_filters = _date_filters(start_date, end_date)
    selected_category = category or "all"
    incident_filters = [*base_incident_filters, Incident.category == module]
    if selected_category not in {"all", module}:
        if module == "epidemiology":
            incident_filters.append(Incident.disease == selected_category)
        else:
            incident_filters.append(Incident.properties["subcategory"].as_string() == selected_category)

    latest_forecast = (
        select(Forecast.neighborhood_id, func.max(Forecast.created_at).label("created_at"))
        .where(Forecast.module == module, Forecast.horizon_days == window_days)
        .group_by(Forecast.neighborhood_id)
        .subquery()
    )
    forecast_rows = db.execute(
        select(
            Forecast,
            Neighborhood.name,
            Neighborhood.centroid_lat,
            Neighborhood.centroid_lon,
        )
        .join(
            latest_forecast,
            (Forecast.neighborhood_id == latest_forecast.c.neighborhood_id)
            & (Forecast.created_at == latest_forecast.c.created_at),
        )
        .join(Neighborhood, Neighborhood.id == Forecast.neighborhood_id, isouter=True)
        .where(Neighborhood.municipality_code == municipality_code)
        .order_by(Forecast.risk_score.desc())
    ).all()
    risk_by_neighborhood = {forecast.neighborhood_id: forecast for forecast, *_ in forecast_rows}

    incident_counts = dict(
        db.execute(
            select(Incident.neighborhood_id, func.count(Incident.id))
            .join(Neighborhood, Neighborhood.id == Incident.neighborhood_id, isouter=True)
            .where(*incident_filters, Neighborhood.municipality_code == municipality_code)
            .group_by(Incident.neighborhood_id)
        ).all()
    )
    neighborhoods = db.execute(
        select(
            Neighborhood.id,
            Neighborhood.name,
            Neighborhood.code,
            Neighborhood.area_km2,
            Neighborhood.centroid_lat,
            Neighborhood.centroid_lon,
            func.ST_AsGeoJSON(Neighborhood.geom).label("geometry"),
        ).where(Neighborhood.geom.isnot(None), Neighborhood.municipality_code == municipality_code)
    ).all()
    overall_incident_counts = dict(
        db.execute(
            select(Incident.neighborhood_id, func.count(Incident.id))
            .join(Neighborhood, Neighborhood.id == Incident.neighborhood_id, isouter=True)
            .where(*base_incident_filters, Incident.category == module, Neighborhood.municipality_code == municipality_code)
            .group_by(Incident.neighborhood_id)
        ).all()
    )
    def adjusted_score(neighborhood_id, score):
        if selected_category == "all":
            return round(score, 2)
        total = max(int(overall_incident_counts.get(neighborhood_id, 0)), 1)
        selected = int(incident_counts.get(neighborhood_id, 0))
        return round(min(100, score * (0.5 + 0.5 * selected / total)), 2)
    features = []
    for row in neighborhoods:
        forecast = risk_by_neighborhood.get(row.id)
        geometry = json.loads(row.geometry) if row.geometry else None
        if not geometry:
            continue
        features.append(
            {
                "type": "Feature",
                "id": row.id,
                "properties": {
                    "id": row.id,
                    "name": row.name,
                    "code": row.code,
                    "area_km2": row.area_km2,
                    "centroid_lat": row.centroid_lat,
                    "centroid_lon": row.centroid_lon,
                    "risk_score": adjusted_score(row.id, forecast.risk_score if forecast else 0),
                    "probability": round(adjusted_score(row.id, forecast.risk_score if forecast else 0) / 100, 4),
                    "confidence": forecast.confidence if forecast else None,
                    "incident_count": int(incident_counts.get(row.id, 0)),
                },
                "geometry": geometry,
            }
        )

    time_series_rows = db.execute(
        select(
            func.date_trunc("week", Incident.occurred_at).label("period"),
            func.count(Incident.id).label("incidents"),
        )
        .join(Neighborhood, Neighborhood.id == Incident.neighborhood_id, isouter=True)
        .where(*incident_filters, Neighborhood.municipality_code == municipality_code)
        .group_by("period")
        .order_by("period")
    ).all()
    time_series = [
        {"period": period.date().isoformat() if hasattr(period, "date") else str(period), "incidents": int(count)}
        for period, count in time_series_rows
    ]

    category_rows = db.execute(
        select(func.coalesce(Incident.disease, Incident.category), func.count(Incident.id))
        .join(Neighborhood, Neighborhood.id == Incident.neighborhood_id, isouter=True)
        .where(*base_incident_filters, Incident.category == module, Neighborhood.municipality_code == municipality_code)
        .group_by(func.coalesce(Incident.disease, Incident.category))
        .order_by(func.count(Incident.id).desc())
    ).all()
    alerts = db.execute(
        select(Alert, Neighborhood.name)
        .join(Neighborhood, Neighborhood.id == Alert.neighborhood_id, isouter=True)
        .where(Alert.status == "active", Alert.module == module, Neighborhood.municipality_code == municipality_code)
        .order_by(Alert.created_at.desc())
        .limit(20)
    ).all()

    risk_scores = [float(forecast.risk_score) for forecast, *_ in forecast_rows]
    latest_forecast_obj = forecast_rows[0][0] if forecast_rows else None
    validation_metrics = (latest_forecast_obj.explanation or {}).get("validation_metrics", {}) if latest_forecast_obj else {}
    active_alerts = db.scalar(
        select(func.count(Alert.id))
        .join(Neighborhood, Neighborhood.id == Alert.neighborhood_id, isouter=True)
        .where(Alert.status == "active", Alert.module == module, Neighborhood.municipality_code == municipality_code)
    ) or 0
    incident_total = sum(int(value) for value in incident_counts.values())
    return {
        "contract_version": "2026-01",
        "mode": "live",
        "generated_at": datetime.utcnow(),
        "filters": {
            "module": module,
            "category": selected_category,
            "window_days": window_days,
            "municipality_code": municipality_code,
            "start_date": start_date,
            "end_date": end_date,
            "period_days": period_days,
        },
        "metrics": {
            "neighborhoods": db.scalar(select(func.count(Neighborhood.id)).where(Neighborhood.municipality_code == municipality_code)) or 0,
            "active_alerts": active_alerts,
            "forecasts": db.scalar(select(func.count(Forecast.id)).where(Forecast.module == module)) or 0,
            "data_sources": db.scalar(select(func.count(DataSource.id))) or 0,
            "incidents": incident_total,
            "high_risk": sum(1 for score in risk_scores if score >= 65),
            "average_risk": round(sum(risk_scores) / len(risk_scores), 1) if risk_scores else 0,
            "trend": _trend(time_series),
        },
        "geojson": {"type": "FeatureCollection", "features": features},
        "top_neighborhoods": [
            {
                "id": forecast.neighborhood_id,
                "label": name or "Bairro",
                "risk_score": adjusted_score(forecast.neighborhood_id, forecast.risk_score),
                "probability": round(adjusted_score(forecast.neighborhood_id, forecast.risk_score) / 100, 4),
                "predicted_value": forecast.predicted_value,
                "confidence": forecast.confidence,
                "incident_count": int(incident_counts.get(forecast.neighborhood_id, 0)),
                "model_version": forecast.model_version,
                "explanation": forecast.explanation or {},
            }
            for forecast, name, *_ in forecast_rows[:12]
        ],
        "time_series": time_series,
        "category_breakdown": [{"label": label or "Sem categoria", "value": int(value)} for label, value in category_rows],
        "model": {
            "version": latest_forecast_obj.model_version if latest_forecast_obj else None,
            "validation_metrics": validation_metrics,
            "explainability": "feature_importance + variáveis observadas por bairro",
        },
        "alerts": [
            {
                "id": alert.id,
                "title": alert.title,
                "description": alert.description,
                "severity": alert.severity,
                "neighborhood_name": name,
                "created_at": alert.created_at,
                "recommended_actions": alert.recommended_actions or {},
                "forecast_id": alert.forecast_id,
            }
            for alert, name in alerts
        ],
    }


def _trend(time_series: list[dict]) -> float:
    if len(time_series) < 2 or time_series[-2]["incidents"] == 0:
        return 0.0
    previous = time_series[-2]["incidents"]
    current = time_series[-1]["incidents"]
    return round((current - previous) / previous * 100, 1)
