from time import monotonic

import httpx
from fastapi import APIRouter, HTTPException

from app.services.connectors.open_meteo import OpenMeteoConnector

router = APIRouter()

_CACHE_TTL_SECONDS = 15 * 60
_cache: dict = {"expires_at": 0.0, "forecast": None}


@router.get("/forecast")
async def weather_forecast():
    if _cache["forecast"] and monotonic() < _cache["expires_at"]:
        return _cache["forecast"]
    try:
        forecast = await OpenMeteoConnector().forecast()
    except httpx.HTTPError as exc:
        raise HTTPException(status_code=503, detail="Previsão climática indisponível no momento.") from exc
    _cache.update(forecast=forecast, expires_at=monotonic() + _CACHE_TTL_SECONDS)
    return forecast
