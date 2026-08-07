from time import monotonic

from fastapi import APIRouter, HTTPException

from app.services.connectors.datasus import DatasusConnector

router = APIRouter()

_CACHE_TTL_SECONDS = 6 * 60 * 60
_cache: dict = {"expires_at": 0.0, "signal": None}


@router.get("/recent-signal")
async def recent_epidemiology_signal():
    if _cache["signal"] and monotonic() < _cache["expires_at"]:
        return _cache["signal"]
    signal = await DatasusConnector().recent_signal()
    if not any(item["status"] == "available" for item in signal["diseases"]):
        raise HTTPException(status_code=503, detail="Sinal epidemiológico recente indisponível no momento.")
    _cache.update(signal=signal, expires_at=monotonic() + _CACHE_TTL_SECONDS)
    return signal
