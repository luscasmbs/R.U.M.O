from fastapi import APIRouter, Depends
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.data_source import DataSource
from app.models.user import User

router = APIRouter()


@router.get("")
def list_data_sources(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    sources = db.scalars(select(DataSource).order_by(DataSource.name)).all()
    return [
        {
            "id": s.id,
            "name": s.name,
            "kind": s.kind,
            "base_url": s.base_url,
            "status": s.status,
            "refresh_frequency": s.refresh_frequency,
            "last_success_at": s.last_success_at,
            "last_error": s.last_error,
            "metadata": s.metadata_json,
        }
        for s in sources
    ]
