from __future__ import annotations

from datetime import datetime
from typing import Any

import httpx

from app.core.config import settings


WEATHER_LABELS = {
    0: "Céu limpo",
    1: "Predominantemente limpo",
    2: "Parcialmente nublado",
    3: "Nublado",
    45: "Nevoeiro",
    48: "Nevoeiro com geada",
    51: "Garoa leve",
    53: "Garoa moderada",
    55: "Garoa intensa",
    61: "Chuva leve",
    63: "Chuva moderada",
    65: "Chuva forte",
    80: "Pancadas leves",
    81: "Pancadas moderadas",
    82: "Pancadas fortes",
    95: "Trovoadas",
    96: "Trovoadas com granizo",
    99: "Trovoadas fortes com granizo",
}


def _number(value: Any, default: float = 0.0) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return default


def _value_at(values: list, index: int):
    return values[index] if index < len(values) else None


def normalize_weather_forecast(payload: dict) -> dict:
    current = payload.get("current") or {}
    hourly = payload.get("hourly") or {}
    daily = payload.get("daily") or {}
    current_time = str(current.get("time") or "")

    hourly_times = hourly.get("time") or []
    start_index = 0
    if current_time and hourly_times:
        start_index = next(
            (index for index, value in enumerate(hourly_times) if str(value) >= current_time),
            0,
        )
    end_index = min(start_index + 24, len(hourly_times))
    precipitation_24h = sum(
        _number(value) for value in (hourly.get("precipitation") or [])[start_index:end_index]
    )
    probability_24h = max(
        [_number(value) for value in (hourly.get("precipitation_probability") or [])[start_index:end_index]],
        default=0.0,
    )

    daily_rows = []
    dates = daily.get("time") or []
    precipitation = daily.get("precipitation_sum") or []
    probabilities = daily.get("precipitation_probability_max") or []
    temperatures_min = daily.get("temperature_2m_min") or []
    temperatures_max = daily.get("temperature_2m_max") or []
    for index, day in enumerate(dates):
        daily_rows.append(
            {
                "date": day,
                "precipitation_mm": _number(_value_at(precipitation, index)),
                "precipitation_probability_pct": _number(_value_at(probabilities, index)),
                "temperature_min_c": _number(_value_at(temperatures_min, index)),
                "temperature_max_c": _number(_value_at(temperatures_max, index)),
            }
        )

    weather_code = int(_number(current.get("weather_code")))
    return {
        "source": "Open-Meteo",
        "location": "Recife/PE",
        "timezone": payload.get("timezone") or settings.recife_timezone,
        "updated_at": current_time or datetime.now().isoformat(timespec="minutes"),
        "current": {
            "temperature_c": _number(current.get("temperature_2m")),
            "relative_humidity_pct": _number(current.get("relative_humidity_2m")),
            "precipitation_mm": _number(current.get("precipitation")),
            "wind_speed_kmh": _number(current.get("wind_speed_10m")),
            "weather_code": weather_code,
            "condition": WEATHER_LABELS.get(weather_code, "Condição variável"),
        },
        "next_24h": {
            "precipitation_mm": round(precipitation_24h, 1),
            "precipitation_probability_pct": round(probability_24h),
        },
        "daily": daily_rows,
        "usage_note": "Contexto meteorológico. Não representa, isoladamente, risco epidemiológico.",
    }


class OpenMeteoConnector:
    def __init__(self, base_url: str | None = None):
        self.base_url = str(base_url or settings.open_meteo_base_url).rstrip("/")

    async def forecast(self) -> dict:
        params = {
            "latitude": settings.recife_latitude,
            "longitude": settings.recife_longitude,
            "timezone": settings.recife_timezone,
            "forecast_days": 14,
            "current": "temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m",
            "hourly": "precipitation_probability,precipitation",
            "daily": "precipitation_sum,precipitation_probability_max,temperature_2m_max,temperature_2m_min",
        }
        async with httpx.AsyncClient(timeout=30) as client:
            response = await client.get(f"{self.base_url}/forecast", params=params)
            response.raise_for_status()
            return normalize_weather_forecast(response.json())
