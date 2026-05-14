from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.alert import Alert
from app.models.user import User

router = APIRouter()


@router.get("")
def list_alerts(module: str | None = None, _: User = Depends(get_current_user), db: Session = Depends(get_db)):
    stmt = select(Alert).where(Alert.status == "active").order_by(Alert.created_at.desc())
    if module:
        stmt = stmt.where(Alert.module == module)
    return db.scalars(stmt).all()
