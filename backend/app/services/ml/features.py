from __future__ import annotations

import numpy as np
import pandas as pd


FEATURES = [
    "cases_lag_1",
    "cases_lag_7",
    "cases_lag_14",
    "cases_lag_28",
    "rolling_7d",
    "rolling_28d",
    "rolling_90d",
    "trend_7d",
    "dayofyear_sin",
    "dayofyear_cos",
]


def prepare_daily_features(
    counts: pd.DataFrame,
    analysis_start: pd.Timestamp,
    analysis_end: pd.Timestamp,
    warmup_days: int = 90,
) -> pd.DataFrame:
    """Build a gap-free daily panel so zero-case days remain part of the signal."""
    if counts.empty:
        return counts

    frame = counts.copy()
    frame["day"] = pd.to_datetime(frame["day"]).dt.normalize()
    frame["cases"] = pd.to_numeric(frame["cases"], errors="coerce").fillna(0).astype(float)
    neighborhood_ids = sorted(frame["neighborhood_id"].dropna().unique())
    warmup_start = analysis_start - pd.Timedelta(days=warmup_days)
    full_index = pd.MultiIndex.from_product(
        [neighborhood_ids, pd.date_range(warmup_start, analysis_end, freq="D")],
        names=["neighborhood_id", "day"],
    )
    frame = (
        frame.set_index(["neighborhood_id", "day"])["cases"]
        .groupby(level=[0, 1])
        .sum()
        .reindex(full_index, fill_value=0)
        .rename("cases")
        .reset_index()
    )

    grouped = frame.groupby("neighborhood_id", sort=False)["cases"]
    for lag in (1, 7, 14, 28):
        frame[f"cases_lag_{lag}"] = grouped.shift(lag).fillna(0)
    for window in (7, 28, 90):
        frame[f"rolling_{window}d"] = grouped.transform(
            lambda values, size=window: values.rolling(size, min_periods=1).sum()
        )

    previous_7d = grouped.transform(
        lambda values: values.shift(7).rolling(7, min_periods=1).sum()
    )
    frame["trend_7d"] = frame["rolling_7d"] - previous_7d.fillna(0)
    day_of_year = frame["day"].dt.dayofyear.astype(float)
    frame["dayofyear_sin"] = np.sin(2 * np.pi * day_of_year / 365.25)
    frame["dayofyear_cos"] = np.cos(2 * np.pi * day_of_year / 365.25)
    return frame.loc[frame["day"] >= analysis_start].reset_index(drop=True)


def add_horizon_target(frame: pd.DataFrame, horizon_days: int) -> pd.DataFrame:
    """Sum cases strictly after each observation date within each neighborhood."""
    if horizon_days < 1:
        raise ValueError("horizon_days must be at least 1")

    targeted = frame.copy()
    targeted["target"] = targeted.groupby(
        "neighborhood_id", sort=False
    )["cases"].transform(
        lambda values: values.shift(-1)
        .rolling(horizon_days, min_periods=horizon_days)
        .sum()
        .shift(-(horizon_days - 1))
    )
    return targeted
