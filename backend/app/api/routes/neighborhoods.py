import json

from fastapi import APIRouter, Depends, Query
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from app.api.deps import get_optional_current_user
from app.db.session import get_db
from app.models.neighborhood import Neighborhood
from app.models.user import User

router = APIRouter()


@router.get("/geojson")
def neighborhoods_geojson(
    municipality_code: str = Query("2611606", min_length=1, max_length=20),
    _: User | None = Depends(get_optional_current_user),
    db: Session = Depends(get_db),
):
    rows = db.execute(
        select(
            Neighborhood.id,
            Neighborhood.name,
            Neighborhood.code,
            Neighborhood.area_km2,
            Neighborhood.centroid_lat,
            Neighborhood.centroid_lon,
            func.ST_AsGeoJSON(Neighborhood.geom).label("geometry"),
        ).where(
            Neighborhood.geom.isnot(None),
            Neighborhood.municipality_code == municipality_code,
        )
    ).all()
    return {
        "type": "FeatureCollection",
        "features": [
            {
                "type": "Feature",
                "id": row.id,
                "properties": {
                    "id": row.id,
                    "name": row.name,
                    "code": row.code,
                    "area_km2": row.area_km2,
                    "centroid_lat": row.centroid_lat,
                    "centroid_lon": row.centroid_lon,
                },
                "geometry": json.loads(row.geometry),
            }
            for row in rows
        ],
    }
