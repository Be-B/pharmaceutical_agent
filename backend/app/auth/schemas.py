from pydantic import BaseModel, Field


class RegisterRequest(BaseModel):
    email: str
    password: str = Field(min_length=8)
    pii_consent: bool
    # 선택 입력 (가입 시 함께 받을 수 있고, 나중에 프로필 모달에서 수정 가능)
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    symptoms_note: str | None = None
    current_medications: str | None = None
    allergies: str | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


class UserPublic(BaseModel):
    id: int
    email: str
    role: str
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    symptoms_note: str | None = None
    current_medications: str | None = None
    allergies: str | None = None


class UserProfileUpdate(BaseModel):
    name: str | None = None
    age: int | None = None
    gender: str | None = None
    symptoms_note: str | None = None
    current_medications: str | None = None
    allergies: str | None = None
