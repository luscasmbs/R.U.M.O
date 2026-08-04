from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.services.etl.source_registry import ensure_default_sources


def main():
    db = SessionLocal()
    try:
        email = "admin@rumo.local"
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            print("Admin já existe.")
        else:
            user = User(
                name="Administrador R.U.M.O",
                email=email,
                hashed_password=get_password_hash("admin123"),
                role=UserRole.admin,
            )
            db.add(user)
            db.commit()
            print("Admin criado: admin@rumo.local / admin123")
        ensure_default_sources(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
