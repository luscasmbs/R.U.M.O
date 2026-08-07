from functools import lru_cache
from pathlib import Path

from pydantic import AnyHttpUrl, Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    app_env: str = "local"
    database_url: str = "postgresql+psycopg://rumo:rumo@db:5432/rumo"
    redis_url: str = "redis://redis:6379/0"
    secret_key: str = Field(default="change-me-in-production", min_length=16)
    access_token_expire_minutes: int = 720
    cors_origins: list[str] = ["http://localhost:5173", "http://127.0.0.1:5173"]

    recife_ckan_base_url: AnyHttpUrl = "https://dados.recife.pe.gov.br/api/3/action"
    recife_arboviruses_dataset: str = "casos-de-dengue-zika-e-chikungunya"
    datasus_base_url: AnyHttpUrl = "https://apidadosabertos.saude.gov.br"
    inmet_api_base_url: AnyHttpUrl = "https://apitempo.inmet.gov.br"
    open_meteo_base_url: AnyHttpUrl = "https://api.open-meteo.com/v1"
    apac_base_url: AnyHttpUrl = "https://www.apac.pe.gov.br"
    ibge_geo_url: str = "https://geoftp.ibge.gov.br/organizacao_do_territorio/malhas_territoriais/malhas_de_setores_censitarios__divisoes_intramunicipais/censo_2022/malha_de_bairros/PE/PE_bairros_2022.zip"
    recife_municipality_code: str = "2611606"
    recife_latitude: float = -8.0476
    recife_longitude: float = -34.8770
    recife_timezone: str = "America/Sao_Paulo"
    data_history_years: int = 5
    model_min_history_days: int = 365
    forecast_horizons: list[int] = [1, 7, 28]

    model_dir: Path = Path("storage/models")


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
