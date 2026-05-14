import json

from fastapi import APIRouter, Depends
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_current_user
from app.db.session import get_db
from app.models.neighborhood import Neighborhood
from app.models.user import User

router = APIRouter()


@router.get("/geojson")
def neighborhoods_geojson(_: User = Depends(get_current_user), db: Session = Depends(get_db)):
    rows = db.execute(
        select(
            Neighborhood.id,
            Neighborhood.name,
            Neighborhood.code,
            Neighborhood.area_km2,
            func.ST_AsGeoJSON(Neighborhood.geom).label("geometry"),
        ).where(Neighborhood.geom.isnot(None))
    ).all()
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": row.id,
                "properties": {"id": row.id, "name": row.name, "code": row.code, "area_km2": row.area_km2},
                "geometry": json.loads(row.geometry),
            }
            for row in rows
        ],
    }
