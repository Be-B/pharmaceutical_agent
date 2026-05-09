from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session as DBSession
from sqlalchemy import func

from ..common.errors import UNAUTHORIZED, FORBIDDEN, NOT_FOUND, CONFLICT, BAD_REQUEST
from ..db.base import get_db
from ..db.models import User, Prompt, PromptVersion, PromptActivation
from ..deps import get_current_user, require_admin
from .schemas import (
    PromptCreate,
    VersionCreate,
    VersionPublic,
    PromptPublic,
    ActivationPublic,
    ActivateVersionRequest,
)
from . import service

router = APIRouter()


def _to_version_public(v: PromptVersion) -> VersionPublic:
    return VersionPublic(
        id=v.id,
        version_number=v.version_number,
        content=v.content,
        model=v.model,
        temperature=v.temperature,
        is_active=v.is_active,
        created_by=v.created_by,
        created_at=v.created_at,
    )


@router.get(
    "",
    response_model=list[PromptPublic],
    summary="프롬프트 목록",
    description="등록된 모든 프롬프트의 메타데이터를 반환합니다 (versions 필드는 비어있음 — 상세는 `GET /prompts/{key}`).",
    responses={**UNAUTHORIZED},
)
def list_prompts(db: DBSession = Depends(get_db), _: User = Depends(get_current_user)):
    items = db.query(Prompt).order_by(Prompt.created_at).all()
    return [
        PromptPublic(id=p.id, key=p.key, description=p.description, created_at=p.created_at, versions=[])
        for p in items
    ]


@router.get(
    "/{key}",
    response_model=PromptPublic,
    summary="프롬프트 상세",
    description="특정 프롬프트의 모든 버전을 포함한 상세 정보를 반환합니다.",
    responses={**UNAUTHORIZED, **NOT_FOUND},
)
def get_prompt(key: str, db: DBSession = Depends(get_db), _: User = Depends(get_current_user)):
    p = db.query(Prompt).filter_by(key=key).first()
    if not p:
        raise HTTPException(404, "프롬프트를 찾을 수 없습니다")
    versions = (
        db.query(PromptVersion)
        .filter_by(prompt_id=p.id)
        .order_by(PromptVersion.version_number)
        .all()
    )
    return PromptPublic(
        id=p.id,
        key=p.key,
        description=p.description,
        created_at=p.created_at,
        versions=[_to_version_public(v) for v in versions],
    )


@router.post(
    "",
    response_model=PromptPublic,
    status_code=status.HTTP_201_CREATED,
    summary="프롬프트 생성 (admin)",
    description="새 프롬프트 키를 등록합니다. 본문 버전은 `POST /prompts/{key}/versions`로 추가하세요.",
    responses={**UNAUTHORIZED, **FORBIDDEN, **CONFLICT},
)
def create_prompt(body: PromptCreate, db: DBSession = Depends(get_db), admin: User = Depends(require_admin)):
    if db.query(Prompt).filter_by(key=body.key).first():
        raise HTTPException(409, "이미 존재하는 key")
    p = Prompt(key=body.key, description=body.description)
    db.add(p)
    db.commit()
    db.refresh(p)
    return PromptPublic(id=p.id, key=p.key, description=p.description, created_at=p.created_at, versions=[])


@router.post(
    "/{key}/versions",
    response_model=VersionPublic,
    status_code=status.HTTP_201_CREATED,
    summary="프롬프트 버전 생성 (admin)",
    description="새 버전을 추가합니다. `version_number`는 자동으로 다음 번호가 할당되며, 기본 비활성 상태입니다.",
    responses={**UNAUTHORIZED, **FORBIDDEN, **NOT_FOUND},
)
def create_version(key: str, body: VersionCreate, db: DBSession = Depends(get_db), admin: User = Depends(require_admin)):
    p = db.query(Prompt).filter_by(key=key).first()
    if not p:
        raise HTTPException(404, "프롬프트를 찾을 수 없습니다")
    next_num = (
        db.query(func.coalesce(func.max(PromptVersion.version_number), 0))
        .filter(PromptVersion.prompt_id == p.id)
        .scalar() or 0
    ) + 1
    v = PromptVersion(
        prompt_id=p.id,
        version_number=next_num,
        content=body.content,
        model=body.model,
        temperature=body.temperature,
        is_active=False,
        created_by=admin.id,
    )
    db.add(v)
    db.commit()
    db.refresh(v)
    return _to_version_public(v)


@router.put(
    "/{key}/active-version",
    response_model=VersionPublic,
    summary="활성 버전 설정 (admin)",
    description=(
        "프롬프트의 활성 버전을 지정합니다. 기존 활성 버전은 자동으로 비활성화되고 활성화 이력이 기록됩니다.\n\n"
        "PUT 시맨틱: 같은 버전을 반복 호출해도 결과는 동일합니다(idempotent)."
    ),
    responses={**UNAUTHORIZED, **FORBIDDEN, **NOT_FOUND},
)
def set_active_version(
    key: str,
    body: ActivateVersionRequest,
    db: DBSession = Depends(get_db),
    admin: User = Depends(require_admin),
):
    p = db.query(Prompt).filter_by(key=key).first()
    if not p:
        raise HTTPException(404, "프롬프트를 찾을 수 없습니다")
    try:
        v = service.activate_version(db, p.id, body.version_number, activated_by=admin.id)
    except ValueError as e:
        raise HTTPException(404, str(e))
    return _to_version_public(v)


@router.delete(
    "/{key}/versions/{n}",
    status_code=status.HTTP_204_NO_CONTENT,
    summary="프롬프트 버전 삭제 (admin)",
    description="특정 버전을 삭제합니다. 활성 버전은 삭제할 수 없으므로, 먼저 다른 버전을 활성화해야 합니다.",
    responses={**UNAUTHORIZED, **FORBIDDEN, **NOT_FOUND, **BAD_REQUEST},
)
def delete_version(key: str, n: int, db: DBSession = Depends(get_db), admin: User = Depends(require_admin)):
    p = db.query(Prompt).filter_by(key=key).first()
    if not p:
        raise HTTPException(404, "프롬프트를 찾을 수 없습니다")
    v = db.query(PromptVersion).filter_by(prompt_id=p.id, version_number=n).first()
    if not v:
        raise HTTPException(404, "버전을 찾을 수 없습니다")
    if v.is_active:
        raise HTTPException(400, "활성 버전은 삭제할 수 없습니다")
    db.delete(v)
    db.commit()


@router.get(
    "/{key}/activations",
    response_model=list[ActivationPublic],
    summary="활성화 이력 조회 (admin)",
    description="이 프롬프트의 활성/비활성 전환 이력을 최신순으로 반환합니다.",
    responses={**UNAUTHORIZED, **FORBIDDEN, **NOT_FOUND},
)
def list_activations(key: str, db: DBSession = Depends(get_db), admin: User = Depends(require_admin)):
    p = db.query(Prompt).filter_by(key=key).first()
    if not p:
        raise HTTPException(404, "프롬프트를 찾을 수 없습니다")
    rows = (
        db.query(PromptActivation, PromptVersion, User)
        .join(PromptVersion, PromptActivation.prompt_version_id == PromptVersion.id)
        .outerjoin(User, PromptActivation.activated_by == User.id)
        .filter(PromptVersion.prompt_id == p.id)
        .order_by(PromptActivation.activated_at.desc())
        .all()
    )
    return [
        ActivationPublic(
            id=act.id,
            prompt_version_id=act.prompt_version_id,
            version_number=ver.version_number,
            activated_by=act.activated_by,
            activated_by_email=usr.email if usr else None,
            activated_at=act.activated_at,
            deactivated_at=act.deactivated_at,
        )
        for act, ver, usr in rows
    ]
