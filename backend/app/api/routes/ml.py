from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.models.audit_log import AuditLog
from app.services.ml.epidemiology import EpidemiologyModelService

router = APIRouter()


class TrainRequest(BaseModel):
    module: str = "epidemiology"
    disease: str | None = None


@router.post("/train")
def train(payload: TrainRequest, _: User = Depends(require_roles(UserRole.admin, UserRole.analyst)), db: Session = Depends(get_db)):
    if payload.module != "epidemiology":
        return {"status": "not_supported_yet", "module": payload.module, "reason": "MVP inicial treina apenas epidemiologia com dados reais."}
    result = EpidemiologyModelService(db).train(payload.disease)
    db.add(AuditLog(user_id=_.id, action="model.train", entity="forecast", payload=result))
    db.commit()
    return result
