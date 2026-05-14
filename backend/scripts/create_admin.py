from sqlalchemy import select

from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.user import User, UserRole


def main():
    db = SessionLocal()
    try:
        email = "admin@rumo.local"
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            print("Admin já existe.")
            return
        user = User(
            name="Administrador R.U.M.O",
            email=email,
            hashed_password=get_password_hash("admin123"),
            role=UserRole.admin,
        )
        db.add(user)
        db.commit()
        print("Admin criado: admin@rumo.local / admin123")
    finally:
        db.close()


if __name__ == "__main__":
    main()
