from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.services.etl.ingestion import IngestionService

router = APIRouter()


class IngestionRequest(BaseModel):
    sources: list[str]


@router.post("/run")
async def run_ingestion(payload: IngestionRequest, _: User = Depends(require_roles(UserRole.admin, UserRole.analyst)), db: Session = Depends(get_db)):
    service = IngestionService(db)
    results = {}
    for source in payload.sources:
        if source == "recife_ckan":
            results[source] = await service.ingest_recife_ckan()
        elif source == "ibge_geo":
            results[source] = await service.ingest_ibge_geo()
        elif source == "inmet":
            results[source] = await service.register_inmet()
        elif source == "apac":
            results[source] = await service.register_apac()
        else:
            results[source] = {"skipped": True, "reason": "Fonte desconhecida."}
    return {"results": results}
