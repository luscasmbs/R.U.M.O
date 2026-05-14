from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.api.deps import require_roles
from app.db.session import get_db
from app.models.user import User, UserRole
from app.services.ml.epidemiology import EpidemiologyModelService

router = APIRouter()


class TrainRequest(BaseModel):
    module: str = "epidemiology"


@router.post("/train")
def train(payload: TrainRequest, _: User = Depends(require_roles(UserRole.admin, UserRole.analyst)), db: Session = Depends(get_db)):
    if payload.module != "epidemiology":
        return {"status": "not_supported_yet", "module": payload.module, "reason": "MVP inicial treina apenas epidemiologia com dados reais."}
    return EpidemiologyModelService(db).train()
