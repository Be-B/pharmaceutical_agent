from datetime import datetime

from fastapi import APIRouter, Depends, HTTPException, Response, status
from sqlalchemy.orm import Session as DBSession

from ..common.errors import UNAUTHORIZED, BAD_REQUEST, CONFLICT
from ..db.base import get_db
from ..db.models import User, UserRole
from ..deps import get_current_user
from .schemas import RegisterRequest, LoginRequest, UserPublic, UserProfileUpdate
from .service import (
    hash_password,
    verify_password,
    create_access_token,
    set_session_cookie,
    clear_session_cookie,
)

router = APIRouter()


def _user_to_public(u: User) -> UserPublic:
    return UserPublic(
        id=u.id, email=u.email, role=u.role.value,
        name=u.name, age=u.age, gender=u.gender,
        symptoms_note=u.symptoms_note,
        current_medications=u.current_medications,
        allergies=u.allergies,
    )


@router.post(
    "/register",
    response_model=UserPublic,
    status_code=status.HTTP_201_CREATED,
    summary="회원가입",
    description=(
        "신규 사용자를 생성합니다. 성공 시 자동으로 로그인되어 `session` 쿠키가 설정됩니다.\n\n"
        "- `pii_consent`는 반드시 `true`여야 합니다.\n"
        "- 프로필 필드(name, age, gender 등)는 가입 시 선택 입력하거나 이후 `PATCH /auth/me`로 수정할 수 있습니다."
    ),
    responses={**BAD_REQUEST, **CONFLICT},
)
def register(body: RegisterRequest, response: Response, db: DBSession = Depends(get_db)):
    if not body.pii_consent:
        raise HTTPException(400, "PII 동의가 필요합니다")
    if "@" not in body.email:
        raise HTTPException(400, "올바른 이메일 형식이 아닙니다")
    if db.query(User).filter_by(email=body.email).first():
        raise HTTPException(409, "이미 가입된 이메일입니다")
    user = User(
        email=body.email,
        password_hash=hash_password(body.password),
        role=UserRole.user,
        pii_consent_at=datetime.utcnow(),
        name=body.name,
        age=body.age,
        gender=body.gender,
        symptoms_note=body.symptoms_note,
        current_medications=body.current_medications,
        allergies=body.allergies,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    token = create_access_token(user.id, user.role.value)
    set_session_cookie(response, token)
    return _user_to_public(user)


@router.post(
    "/login",
    response_model=UserPublic,
    summary="로그인",
    description="이메일/비밀번호로 로그인합니다. 성공 시 `session` 쿠키가 설정됩니다.",
    responses={**UNAUTHORIZED},
)
def login(body: LoginRequest, response: Response, db: DBSession = Depends(get_db)):
    user = db.query(User).filter_by(email=body.email).first()
    if not user or not verify_password(body.password, user.password_hash):
        raise HTTPException(401, "이메일 또는 비밀번호가 잘못되었습니다")
    token = create_access_token(user.id, user.role.value)
    set_session_cookie(response, token)
    return _user_to_public(user)


@router.post(
    "/logout",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="로그아웃",
    description="현재 세션 쿠키를 만료시킵니다. 본문/응답 본문 없음.",
)
def logout(response: Response):
    clear_session_cookie(response)
    return None


@router.get(
    "/me",
    response_model=UserPublic,
    summary="내 프로필 조회",
    description="현재 로그인된 사용자의 프로필 전체를 반환합니다.",
    responses={**UNAUTHORIZED},
)
def me(user: User = Depends(get_current_user)):
    return _user_to_public(user)


@router.patch(
    "/me",
    response_model=UserPublic,
    summary="내 프로필 수정",
    description=(
        "현재 로그인된 사용자의 프로필 필드를 부분 업데이트합니다.\n"
        "보낸 필드만 변경되고, 생략하거나 `null`인 필드는 기존 값을 유지합니다."
    ),
    responses={**UNAUTHORIZED},
)
def update_me(
    body: UserProfileUpdate,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    for field in ("name", "age", "gender", "symptoms_note", "current_medications", "allergies"):
        v = getattr(body, field)
        if v is not None:
            setattr(user, field, v)
    db.commit()
    db.refresh(user)
    return _user_to_public(user)
