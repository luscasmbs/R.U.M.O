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
    email: EmailStr
    role: UserRole
    is_active: bool

    model_config = {"from_attributes": True}
