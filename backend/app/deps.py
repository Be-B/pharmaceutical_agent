from fastapi import Depends, HTTPException, Request
from sqlalchemy.orm import Session as DBSession

from .db.base import get_db
from .db.models import User, UserRole
from .auth.service import decode_token


def get_current_user(request: Request, db: DBSession = Depends(get_db)) -> User:
    token = request.cookies.get("session")
    if not token:
        raise HTTPException(401, "인증이 필요합니다")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(401, "유효하지 않은 토큰")
    user = db.query(User).filter_by(id=int(payload["sub"])).first()
    if not user:
        raise HTTPException(401, "사용자를 찾을 수 없습니다")
    return user


def require_admin(user: User = Depends(get_current_user)) -> User:
    if user.role != UserRole.admin:
        raise HTTPException(403, "관리자 권한이 필요합니다")
    return user
