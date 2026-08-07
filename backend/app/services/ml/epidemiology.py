from __future__ import annotations

from datetime import datetime, timedelta
from pathlib import Path

import joblib
import numpy as np
import pandas as pd
from sqlalchemy import func, select
from sqlalchemy.orm import Session
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import (
    f1_score,
    mean_absolute_error,
    precision_score,
    recall_score,
    roc_auc_score,
    root_mean_squared_error,
)

from app.core.config import settings
from app.models.alert import Alert
from app.models.forecast import Forecast
from app.models.incident import Incident
from app.models.neighborhood import Neighborhood
from app.services.ml.features import FEATURES, add_horizon_target, prepare_daily_features


def _tree_probability(model: RandomForestRegressor, values: pd.DataFrame, threshold: float) -> np.ndarray:
    matrix = values.to_numpy()
    tree_predictions = np.vstack([tree.predict(matrix) for tree in model.estimators_])
    return (tree_predictions >= threshold).mean(axis=0)


class EpidemiologyModelService:
    def __init__(self, db: Session):
        self.db = db
        settings.model_dir.mkdir(parents=True, exist_ok=True)

    def build_dataset(self, disease: str | None = None) -> tuple[pd.DataFrame, dict]:
        conditions = [
            Incident.category == "epidemiology",
            Incident.occurred_at.isnot(None),
            Incident.neighborhood_id.isnot(None),
        ]
        if disease:
            conditions.append(Incident.disease == disease)

        earliest, latest = self.db.execute(
            select(func.min(Incident.occurred_at), func.max(Incident.occurred_at)).where(*conditions)
        ).one()
        if not earliest or not latest:
            return pd.DataFrame(), self._empty_history()

        data_end = pd.Timestamp(latest).normalize()
        configured_start = data_end - pd.DateOffset(years=settings.data_history_years)
        data_start = max(pd.Timestamp(earliest).normalize(), configured_start)
        query_start = data_start - pd.Timedelta(days=90)
        rows = self.db.execute(
            select(
                Incident.neighborhood_id,
                func.date_trunc("day", Incident.occurred_at).label("day"),
                func.count(Incident.id).label("cases"),
            )
            .where(
                *conditions,
                Incident.occurred_at >= query_start.to_pydatetime(),
                Incident.occurred_at < (data_end + pd.Timedelta(days=1)).to_pydatetime(),
            )
            .group_by(Incident.neighborhood_id, "day")
            .order_by("day")
        ).all()
        counts = pd.DataFrame(rows, columns=["neighborhood_id", "day", "cases"])
        frame = prepare_daily_features(counts, data_start, data_end)
        coverage_days = max(0, int((data_end - data_start).days) + 1)
        history = {
            "data_start": data_start.date().isoformat(),
            "data_end": data_end.date().isoformat(),
            "coverage_days": coverage_days,
            "configured_years": settings.data_history_years,
            "minimum_required_days": settings.model_min_history_days,
            "neighborhoods": int(frame["neighborhood_id"].nunique()) if not frame.empty else 0,
            "daily_rows": len(frame),
            "source_records": int(counts["cases"].sum()) if not counts.empty else 0,
        }
        return frame, history

    def train(self, disease: str | None = None) -> dict:
        dataset, history = self.build_dataset(disease)
        target = disease or "all"
        version = f"epidemiology-{target}-rf-{datetime.utcnow().strftime('%Y%m%d%H%M%S')}"
        quality_gate = self._quality_gate(dataset, history)
        if not quality_gate["passed"]:
            return self._baseline_forecasts(dataset, history, version, target, quality_gate)

        models: dict[int, dict] = {}
        forecasts_by_horizon: dict[str, int] = {}
        validation_by_horizon: dict[str, dict] = {}
        total_rows = 0
        total_forecasts = 0
        for horizon_days in settings.forecast_horizons:
            targeted = add_horizon_target(dataset, horizon_days)
            training = targeted.dropna(subset=["target"])
            if training.empty:
                forecasts_by_horizon[str(horizon_days)] = 0
                continue

            model = self._new_model(random_state=42 + horizon_days)
            model.fit(training[FEATURES], training["target"])
            threshold = float(training["target"].quantile(0.75))
            threshold = max(threshold, 1.0)
            validation_metrics = self._validation_metrics(training, threshold, horizon_days)
            importances = dict(zip(FEATURES, model.feature_importances_.round(4).tolist()))
            inserted = self._persist_predictions(
                dataset,
                model,
                version,
                importances,
                validation_metrics,
                history,
                target,
                horizon_days,
                threshold,
            )
            models[horizon_days] = {
                "model": model,
                "features": FEATURES,
                "threshold": threshold,
                "validation_metrics": validation_metrics,
            }
            forecasts_by_horizon[str(horizon_days)] = inserted
            validation_by_horizon[str(horizon_days)] = validation_metrics
            total_rows += len(training)
            total_forecasts += inserted

        model_path = Path(settings.model_dir) / f"{version}.joblib"
        joblib.dump({"models": models, "history": history, "target_disease": target}, model_path)
        return {
            "model_version": version,
            "rows": total_rows,
            "forecasts": total_forecasts,
            "forecasts_by_horizon": forecasts_by_horizon,
            "validation_by_horizon": validation_by_horizon,
            "history": history,
            "quality_gate": quality_gate,
            "target_disease": target,
        }

    def _new_model(self, random_state: int) -> RandomForestRegressor:
        return RandomForestRegressor(
            n_estimators=140,
            random_state=random_state,
            min_samples_leaf=3,
            max_depth=18,
            n_jobs=-1,
        )

    def _quality_gate(self, dataset: pd.DataFrame, history: dict) -> dict:
        reasons = []
        if dataset.empty:
            reasons.append("Nenhuma série epidemiológica territorial foi encontrada.")
        if history["coverage_days"] < settings.model_min_history_days:
            reasons.append(
                f"O histórico cobre {history['coverage_days']} dias; "
                f"o mínimo exigido é {settings.model_min_history_days} dias."
            )
        if history["neighborhoods"] < 2:
            reasons.append("São necessários dados de pelo menos dois bairros para priorização territorial.")
        return {"passed": not reasons, "reasons": reasons}

    def _baseline_forecasts(self, dataset: pd.DataFrame, history: dict, version: str, target: str, quality_gate: dict) -> dict:
        neighborhoods = self.db.scalars(select(Neighborhood)).all()
        latest = dataset.sort_values("day").groupby("neighborhood_id").tail(1) if not dataset.empty else pd.DataFrame()
        latest_by_id = latest.set_index("neighborhood_id") if not latest.empty else pd.DataFrame()
        forecasts_by_horizon = {}
        inserted = 0
        reference_date = self._reference_date(history)
        for horizon_days in settings.forecast_horizons:
            self._resolve_active_alerts(horizon_days, target)
            horizon_inserted = 0
            for neighborhood in neighborhoods:
                recent_daily_rate = 0.0
                if not latest_by_id.empty and neighborhood.id in latest_by_id.index:
                    recent_daily_rate = float(latest_by_id.loc[neighborhood.id, "rolling_28d"]) / 28
                predicted_value = recent_daily_rate * horizon_days
                risk_score = min(100.0, predicted_value * 12.5)
                self.db.add(
                    Forecast(
                        neighborhood_id=neighborhood.id,
                        module="epidemiology",
                        target_date=reference_date + timedelta(days=horizon_days),
                        horizon_days=horizon_days,
                        risk_score=risk_score,
                        predicted_value=predicted_value,
                        confidence=0.2 if predicted_value else 0.1,
                        model_version=version.replace("-rf-", "-baseline-"),
                        explanation={
                            "method": "moving_average_baseline",
                            "fallback": "Treino supervisionado bloqueado pelo critério mínimo de qualidade.",
                            "factors": {"rolling_28d_daily_rate": round(recent_daily_rate, 4)},
                            "probability": None,
                            "probability_definition": None,
                            "validation_metrics": self._empty_metrics(),
                            "target_disease": target,
                            "horizon_days": horizon_days,
                            "training_history": history,
                            "quality_gate": quality_gate,
                        },
                    )
                )
                inserted += 1
                horizon_inserted += 1
            forecasts_by_horizon[str(horizon_days)] = horizon_inserted
        self.db.commit()
        return {
            "model_version": version.replace("-rf-", "-baseline-"),
            "rows": len(dataset),
            "forecasts": inserted,
            "forecasts_by_horizon": forecasts_by_horizon,
            "fallback": True,
            "validation_by_horizon": {str(h): self._empty_metrics() for h in settings.forecast_horizons},
            "history": history,
            "quality_gate": quality_gate,
            "target_disease": target,
        }

    def _validation_metrics(self, dataset: pd.DataFrame, threshold: float, horizon_days: int) -> dict:
        dates = np.sort(dataset["day"].unique())
        if len(dates) < 10:
            return self._empty_metrics()
        split_date = dates[max(int(len(dates) * 0.8), 1)]
        train = dataset[dataset["day"] < split_date]
        test = dataset[dataset["day"] >= split_date]
        if train.empty or test.empty:
            return self._empty_metrics()

        validator = self._new_model(random_state=7 + horizon_days)
        validator.fit(train[FEATURES], train["target"])
        predictions = np.maximum(0, validator.predict(test[FEATURES]))
        probabilities = _tree_probability(validator, test[FEATURES], threshold)
        actual = (test["target"].to_numpy() >= threshold).astype(int)
        predicted = (probabilities >= 0.5).astype(int)
        auc = None
        if len(np.unique(actual)) > 1:
            auc = round(float(roc_auc_score(actual, probabilities)), 4)
        return {
            "auc": auc,
            "precision": round(float(precision_score(actual, predicted, zero_division=0)), 4),
            "recall": round(float(recall_score(actual, predicted, zero_division=0)), 4),
            "f1": round(float(f1_score(actual, predicted, zero_division=0)), 4),
            "mae": round(float(mean_absolute_error(test["target"], predictions)), 4),
            "rmse": round(float(root_mean_squared_error(test["target"], predictions)), 4),
            "validation_start": pd.Timestamp(split_date).date().isoformat(),
            "validation_end": pd.Timestamp(test["day"].max()).date().isoformat(),
            "test_rows": len(test),
            "alert_threshold_cases": round(threshold, 4),
        }

    def _persist_predictions(
        self,
        dataset: pd.DataFrame,
        model: RandomForestRegressor,
        version: str,
        importances: dict,
        validation_metrics: dict,
        history: dict,
        target: str,
        horizon_days: int,
        threshold: float,
    ) -> int:
        self._resolve_active_alerts(horizon_days, target)
        latest = dataset.sort_values("day").groupby("neighborhood_id").tail(1)
        predictions = np.maximum(0, model.predict(latest[FEATURES]))
        probabilities = _tree_probability(model, latest[FEATURES], threshold)
        max_prediction = max(float(predictions.max()), 1.0)
        reference_date = self._reference_date(history)
        freshness_days = max(0, (datetime.utcnow().date() - reference_date.date()).days)
        confidence = self._confidence(validation_metrics, history, freshness_days)
        inserted = 0
        for (_, row), prediction, probability in zip(latest.iterrows(), predictions, probabilities):
            relative_burden = min(1.0, float(prediction) / max_prediction)
            risk_score = min(100.0, (float(probability) * 0.7 + relative_burden * 0.3) * 100)
            forecast = Forecast(
                neighborhood_id=row["neighborhood_id"],
                module="epidemiology",
                target_date=reference_date + timedelta(days=horizon_days),
                horizon_days=horizon_days,
                risk_score=risk_score,
                predicted_value=float(prediction),
                confidence=confidence,
                model_version=version,
                explanation={
                    "method": "random_forest_daily_panel",
                    "feature_importance": importances,
                    "features": {feature: round(float(row[feature]), 6) for feature in FEATURES},
                    "probability": round(float(probability), 6),
                    "probability_definition": "Chance estimada de superar o percentil 75 do volume histórico para o horizonte.",
                    "priority_score_definition": "70% de probabilidade de excedência e 30% de carga prevista relativa entre bairros.",
                    "predicted_value_unit": "casos no horizonte",
                    "validation_metrics": validation_metrics,
                    "target_disease": target,
                    "horizon_days": horizon_days,
                    "training_history": history,
                    "forecast_reference_date": reference_date.date().isoformat(),
                    "data_freshness_days": freshness_days,
                    "alert_threshold_cases": round(threshold, 4),
                },
            )
            self.db.add(forecast)
            inserted += 1
            if risk_score >= 65 and freshness_days <= max(7, horizon_days):
                self.db.add(self._build_alert(forecast, risk_score, horizon_days, target))
        self.db.commit()
        return inserted

    def _resolve_active_alerts(self, horizon_days: int, target: str) -> None:
        active_alerts = self.db.scalars(
            select(Alert)
            .join(Forecast, Forecast.id == Alert.forecast_id)
            .where(
                Alert.status == "active",
                Alert.module == "epidemiology",
                Forecast.horizon_days == horizon_days,
                Forecast.explanation["target_disease"].as_string() == target,
            )
        ).all()
        resolved_at = datetime.utcnow()
        for alert in active_alerts:
            alert.status = "resolved"
            alert.resolved_at = resolved_at

    def _build_alert(self, forecast: Forecast, risk_score: float, horizon_days: int, target: str) -> Alert:
        label = "24 horas" if horizon_days == 1 else f"{horizon_days} dias"
        disease_label = "eventos epidemiológicos" if target == "all" else target
        return Alert(
            neighborhood_id=forecast.neighborhood_id,
            forecast=forecast,
            module="epidemiology",
            title=f"Risco epidemiológico elevado em {label}",
            description=f"O modelo identificou risco elevado para {disease_label}, considerando o histórico diário e a sazonalidade.",
            severity="critical" if risk_score >= 80 else "high",
            recommended_actions={
                "immediate": [
                    "Validar o sinal com a vigilância epidemiológica",
                    "Priorizar verificação de campo no território",
                    "Revisar atualidade e completude das notificações",
                ]
            },
        )

    def _confidence(self, metrics: dict, history: dict, freshness_days: int) -> float:
        auc = metrics.get("auc") if metrics.get("auc") is not None else 0.5
        f1 = metrics.get("f1") if metrics.get("f1") is not None else 0.0
        coverage = min(1.0, history["coverage_days"] / max(settings.data_history_years * 365, 1))
        freshness_factor = max(0.2, 1 - freshness_days / 180)
        return round(float(np.clip((0.35 + 0.25 * auc + 0.2 * f1 + 0.2 * coverage) * freshness_factor, 0.1, 0.95)), 4)

    def _reference_date(self, history: dict) -> datetime:
        if history.get("data_end"):
            return datetime.fromisoformat(history["data_end"])
        return datetime.utcnow()

    def _empty_history(self) -> dict:
        return {
            "data_start": None,
            "data_end": None,
            "coverage_days": 0,
            "configured_years": settings.data_history_years,
            "minimum_required_days": settings.model_min_history_days,
            "neighborhoods": 0,
            "daily_rows": 0,
            "source_records": 0,
        }

    def _empty_metrics(self) -> dict:
        return {
            "auc": None,
            "precision": None,
            "recall": None,
            "f1": None,
            "mae": None,
            "rmse": None,
            "validation_start": None,
            "validation_end": None,
            "test_rows": 0,
            "alert_threshold_cases": None,
        }
