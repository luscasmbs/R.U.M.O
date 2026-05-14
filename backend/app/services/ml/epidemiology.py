from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sklearn.ensemble import RandomForestRegressor
from sklearn.inspection import permutation_importance

from app.core.config import settings
from app.models.alert import Alert
from app.models.forecast import Forecast
from app.models.incident import Incident
from app.models.neighborhood import Neighborhood


class EpidemiologyModelService:
    def __init__(self, db: Session):
        self.db = db
        settings.model_dir.mkdir(parents=True, exist_ok=True)

    def build_dataset(self) -> pd.DataFrame:
        rows = self.db.execute(
            select(
                Incident.neighborhood_id,
                func.date_trunc("week", Incident.occurred_at).label("week"),
                func.count(Incident.id).label("cases"),
            )
            .where(Incident.category == "epidemiology", Incident.occurred_at.isnot(None), Incident.neighborhood_id.isnot(None))
            .group_by(Incident.neighborhood_id, "week")
            .order_by("week")
        ).all()
        frame = pd.DataFrame(rows, columns=["neighborhood_id", "week", "cases"])
        if frame.empty:
            return frame
        frame["week"] = pd.to_datetime(frame["week"])
        frame = frame.sort_values(["neighborhood_id", "week"])
        frame["cases_lag_1"] = frame.groupby("neighborhood_id")["cases"].shift(1).fillna(0)
        frame["cases_lag_2"] = frame.groupby("neighborhood_id")["cases"].shift(2).fillna(0)
        frame["rolling_4w"] = frame.groupby("neighborhood_id")["cases"].rolling(4, min_periods=1).mean().reset_index(level=0, drop=True)
        frame["month"] = frame["week"].dt.month
        frame["weekofyear"] = frame["week"].dt.isocalendar().week.astype(int)
        frame["target"] = frame.groupby("neighborhood_id")["cases"].shift(-1)
        return frame.dropna(subset=["target"])

    def train(self) -> dict:
        dataset = self.build_dataset()
        if len(dataset) < 30:
            return self._baseline_forecast(dataset)
        features = ["cases_lag_1", "cases_lag_2", "rolling_4w", "month", "weekofyear"]
        model = RandomForestRegressor(n_estimators=120, random_state=42, min_samples_leaf=2)
        model.fit(dataset[features], dataset["target"])
        version = f"epidemiology-rf-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        model_path = Path(settings.model_dir) / f"{version}.joblib"
        joblib.dump({"model": model, "features": features}, model_path)
        importances = dict(zip(features, model.feature_importances_.round(4).tolist()))
        forecasts = self._persist_predictions(dataset, model, features, version, importances)
        return {"model_version": version, "rows": len(dataset), "forecasts": forecasts, "feature_importance": importances}

    def _baseline_forecast(self, dataset: pd.DataFrame) -> dict:
        version = f"epidemiology-baseline-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        neighborhoods = self.db.scalars(select(Neighborhood)).all()
        target_date = datetime.utcnow() + timedelta(days=7)
        inserted = 0
        for n in neighborhoods:
            recent = 0.0
            if not dataset.empty:
                subset = dataset[dataset["neighborhood_id"] == n.id]
                if not subset.empty:
                    recent = float(subset.tail(4)["cases"].mean())
            risk_score = min(100.0, recent * 12.5)
            forecast = Forecast(
                neighborhood_id=n.id,
                module="epidemiology",
                target_date=target_date,
                horizon_days=7,
                risk_score=risk_score,
                predicted_value=recent,
                confidence=0.35 if recent else 0.15,
                model_version=version,
                explanation={"fallback": "Dados insuficientes para treinar modelo supervisionado; usada média móvel real."},
            )
            self.db.add(forecast)
            inserted += 1
        self.db.commit()
        return {"model_version": version, "rows": len(dataset), "forecasts": inserted, "fallback": True}

    def _persist_predictions(self, dataset: pd.DataFrame, model, features: list[str], version: str, importances: dict) -> int:
        latest = dataset.sort_values("week").groupby("neighborhood_id").tail(1)
        predictions = np.maximum(0, model.predict(latest[features]))
        max_pred = max(float(predictions.max()), 1.0)
        target_date = datetime.utcnow() + timedelta(days=7)
        inserted = 0
        for (_, row), pred in zip(latest.iterrows(), predictions):
            risk_score = min(100.0, float(pred) / max_pred * 100.0)
            forecast = Forecast(
                neighborhood_id=row["neighborhood_id"],
                module="epidemiology",
                target_date=target_date,
                horizon_days=7,
                risk_score=risk_score,
                predicted_value=float(pred),
                confidence=0.72,
                model_version=version,
                explanation={"feature_importance": importances, "features": {f: float(row[f]) for f in features}},
            )
            self.db.add(forecast)
            inserted += 1
            if risk_score >= 65:
                self.db.add(
                    Alert(
                        neighborhood_id=row["neighborhood_id"],
                        forecast=forecast,
                        module="epidemiology",
                        title="Risco epidemiológico elevado",
                        description="Modelo identificou tendência de aumento de arboviroses para a próxima semana.",
                        severity="critical" if risk_score >= 80 else "high",
                        recommended_actions={
                            "immediate": ["Priorizar visitas de campo", "Reforçar comunicação preventiva", "Checar focos informados"]
                        },
                    )
                )
        self.db.commit()
        return inserted
