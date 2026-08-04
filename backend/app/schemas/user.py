from pydantic import BaseModel, EmailStr

from app.models.user import UserRole


class UserCreate(BaseModel):
    name: str
    email: EmailStr
    password: str
    role: UserRole = UserRole.operator


class UserRead(BaseModel):
    id: str
    name: str
    # The seeded development user uses the reserved .local domain.
    # UserCreate keeps EmailStr validation for new accounts.
    email: str
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}
