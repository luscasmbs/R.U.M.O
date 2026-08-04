from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import f1_score, precision_score, recall_score, roc_auc_score

from app.core.config import settings
from app.models.alert import Alert
from app.models.forecast import Forecast
from app.models.incident import Incident
from app.models.neighborhood import Neighborhood


class EpidemiologyModelService:
    def __init__(self, db: Session):
        self.db = db
        settings.model_dir.mkdir(parents=True, exist_ok=True)

    def build_dataset(self, disease: str | None = None) -> pd.DataFrame:
        conditions = [Incident.category == "epidemiology", Incident.occurred_at.isnot(None), Incident.neighborhood_id.isnot(None)]
        if disease:
            conditions.append(Incident.disease == disease)
        rows = self.db.execute(
            select(
                Incident.neighborhood_id,
                func.date_trunc("week", Incident.occurred_at).label("week"),
                func.count(Incident.id).label("cases"),
            )
            .where(*conditions)
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

    def train(self, disease: str | None = None) -> dict:
        dataset = self.build_dataset(disease)
        if len(dataset) < 30:
            return self._baseline_forecast(dataset, disease)
        features = ["cases_lag_1", "cases_lag_2", "rolling_4w", "month", "weekofyear"]
        model = RandomForestRegressor(n_estimators=120, random_state=42, min_samples_leaf=2)
        model.fit(dataset[features], dataset["target"])
        validation_metrics = self._validation_metrics(dataset, features)
        target = disease or "all"
        version = f"epidemiology-{target}-rf-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        model_path = Path(settings.model_dir) / f"{version}.joblib"
        joblib.dump({"model": model, "features": features, "validation_metrics": validation_metrics}, model_path)
        importances = dict(zip(features, model.feature_importances_.round(4).tolist()))
        forecasts = self._persist_predictions(dataset, model, features, version, importances, validation_metrics, disease)
        return {
            "model_version": version,
            "rows": len(dataset),
            "forecasts": forecasts,
            "feature_importance": importances,
            "validation_metrics": validation_metrics,
            "target_disease": target,
        }

    def _baseline_forecast(self, dataset: pd.DataFrame, disease: str | None = None) -> dict:
        target = disease or "all"
        version = f"epidemiology-{target}-baseline-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
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
                explanation={
                    "fallback": "Dados insuficientes para treinar modelo supervisionado; usada média móvel real.",
                    "factors": {"rolling_4w": round(recent, 2)},
                    "validation_metrics": {"auc": None, "precision": None, "recall": None, "f1": None},
                    "target_disease": target,
                },
            )
            self.db.add(forecast)
            inserted += 1
        self.db.commit()
        return {
            "model_version": version,
            "rows": len(dataset),
            "forecasts": inserted,
            "fallback": True,
            "validation_metrics": {"auc": None, "precision": None, "recall": None, "f1": None},
            "target_disease": target,
        }

    def _validation_metrics(self, dataset: pd.DataFrame, features: list[str]) -> dict:
        split_at = max(int(len(dataset) * 0.8), 1)
        if split_at >= len(dataset):
            return {"auc": None, "precision": None, "recall": None, "f1": None}
        train = dataset.iloc[:split_at]
        test = dataset.iloc[split_at:]
        validator = RandomForestRegressor(n_estimators=80, random_state=7, min_samples_leaf=2)
        validator.fit(train[features], train["target"])
        predictions = np.maximum(0, validator.predict(test[features]))
        threshold = float(train["target"].median())
        actual = (test["target"].to_numpy() >= threshold).astype(int)
        predicted = (predictions >= threshold).astype(int)
        probabilities = np.clip(predictions / max(float(predictions.max()), 1.0), 0, 1)
        auc = None
        if len(np.unique(actual)) > 1:
            auc = round(float(roc_auc_score(actual, probabilities)), 4)
        return {
            "auc": auc,
            "precision": round(float(precision_score(actual, predicted, zero_division=0)), 4),
            "recall": round(float(recall_score(actual, predicted, zero_division=0)), 4),
            "f1": round(float(f1_score(actual, predicted, zero_division=0)), 4),
        }

    def _persist_predictions(self, dataset: pd.DataFrame, model, features: list[str], version: str, importances: dict, validation_metrics: dict, disease: str | None = None) -> int:
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
                explanation={
                    "feature_importance": importances,
                    "features": {f: float(row[f]) for f in features},
                    "validation_metrics": validation_metrics,
                    "target_disease": disease or "all",
                },
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
