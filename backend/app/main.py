from collections import defaultdict, deque
from time import monotonic

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy.exc import SQLAlchemyError
import structlog

from app.api.routes import alerts, auth, dashboard, data_sources, forecasts, health, ingestion, ml, neighborhoods, users, weather
from app.core.config import settings

logger = structlog.get_logger()
rate_buckets: dict[str, deque[float]] = defaultdict(deque)


def create_app() -> FastAPI:
    app = FastAPI(title="R.U.M.O API", version="1.0.0")

    app.add_middleware(
        CORSMiddleware,
        allow_origins=settings.cors_origins,
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.middleware("http")
    async def request_logging_and_rate_limit(request: Request, call_next):
        client_ip = request.client.host if request.client else "unknown"
        now = monotonic()
        bucket = rate_buckets[client_ip]
        while bucket and now - bucket[0] > 60:
            bucket.popleft()
        if len(bucket) >= 180:
            return JSONResponse(status_code=429, content={"detail": "Muitas requisições. Tente novamente em instantes."})
        bucket.append(now)
        logger.info("request_started", method=request.method, path=request.url.path, client_ip=client_ip)
        response = await call_next(request)
        logger.info("request_finished", method=request.method, path=request.url.path, status_code=response.status_code)
        return response

    @app.exception_handler(SQLAlchemyError)
    async def database_exception_handler(request: Request, exc: SQLAlchemyError):
        logger.exception("database_error", path=str(request.url), error=str(exc))
        return JSONResponse(status_code=500, content={"detail": "Erro de banco de dados."})

    @app.exception_handler(Exception)
    async def unhandled_exception_handler(request: Request, exc: Exception):
        logger.exception("unhandled_error", path=str(request.url), error=str(exc))
        return JSONResponse(status_code=500, content={"detail": "Erro interno inesperado."})

    app.include_router(health.router, prefix="/api/v1", tags=["health"])
    app.include_router(auth.router, prefix="/api/v1/auth", tags=["auth"])
    app.include_router(users.router, prefix="/api/v1/users", tags=["users"])
    app.include_router(data_sources.router, prefix="/api/v1/data-sources", tags=["data-sources"])
    app.include_router(neighborhoods.router, prefix="/api/v1/neighborhoods", tags=["neighborhoods"])
    app.include_router(alerts.router, prefix="/api/v1/alerts", tags=["alerts"])
    app.include_router(dashboard.router, prefix="/api/v1/dashboard", tags=["dashboard"])
    app.include_router(forecasts.router, prefix="/api/v1/forecasts", tags=["forecasts"])
    app.include_router(weather.router, prefix="/api/v1/weather", tags=["weather"])
    app.include_router(ingestion.router, prefix="/api/v1/ingestion", tags=["ingestion"])
    app.include_router(ml.router, prefix="/api/v1/ml", tags=["ml"])
    return app


app = create_app()
