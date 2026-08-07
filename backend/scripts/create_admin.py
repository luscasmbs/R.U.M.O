import os

from sqlalchemy import select

from app.core.config import settings
from app.core.security import get_password_hash
from app.db.session import SessionLocal
from app.models.user import User, UserRole
from app.services.etl.source_registry import ensure_default_sources


def admin_credentials() -> tuple[str, str, str]:
    is_local = settings.app_env == "local"
    name = os.getenv("ADMIN_NAME", "Administrador R.U.M.O")
    email = os.getenv("ADMIN_EMAIL", "admin@rumo.local" if is_local else "")
    password = os.getenv("ADMIN_PASSWORD", "admin123" if is_local else "")
    if not email or not password:
        raise RuntimeError("Defina ADMIN_EMAIL e ADMIN_PASSWORD antes de iniciar em produção.")
    if not is_local and len(password) < 12:
        raise RuntimeError("ADMIN_PASSWORD deve ter pelo menos 12 caracteres em produção.")
    return name, email, password


def main():
    db = SessionLocal()
    try:
        name, email, password = admin_credentials()
        existing = db.scalar(select(User).where(User.email == email))
        if existing:
            print("Admin já existe.")
        else:
            user = User(
                name=name,
                email=email,
                hashed_password=get_password_hash(password),
                role=UserRole.admin,
            )
            db.add(user)
            db.commit()
            print(f"Admin criado: {email}")
        ensure_default_sources(db)
    finally:
        db.close()


if __name__ == "__main__":
    main()
