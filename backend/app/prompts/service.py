from __future__ import annotations
import time
from datetime import datetime
from sqlalchemy.orm import Session as DBSession
from ..db.models import Prompt, PromptVersion, PromptActivation

# in-process 캐시 (단일 backend 노드 가정)
_CACHE: dict[str, tuple[float, PromptVersion]] = {}
_TTL_SECONDS = 60.0


def get_active_prompt(db: DBSession, key: str) -> PromptVersion:
    """활성 PromptVersion을 반환. 60초 TTL 캐시. 활성 없으면 RuntimeError."""
    now = time.time()
    cached = _CACHE.get(key)
    if cached and (now - cached[0]) < _TTL_SECONDS:
        return cached[1]
    prompt = db.query(Prompt).filter_by(key=key).first()
    if not prompt:
        raise RuntimeError(f"Prompt key '{key}' not found")
    active = db.query(PromptVersion).filter_by(prompt_id=prompt.id, is_active=True).first()
    if not active:
        raise RuntimeError(f"No active version for prompt '{key}'")
    _CACHE[key] = (now, active)
    return active


def invalidate_cache(key: str) -> None:
    _CACHE.pop(key, None)


def activate_version(db: DBSession, prompt_id: int, version_number: int, activated_by: int) -> PromptVersion:
    """트랜잭션: 기존 활성 deactivate + 새 버전 activate + PromptActivation 기록 + 캐시 무효화."""
    # 새 버전 조회
    new_active = db.query(PromptVersion).filter_by(prompt_id=prompt_id, version_number=version_number).first()
    if not new_active:
        raise ValueError(f"version {version_number} not found")
    if new_active.is_active:
        return new_active

    # 기존 활성 deactivate — partial unique index(ix_prompt_active) 위반 방지를 위해
    # 새 버전을 활성화하기 전에 반드시 DB에 먼저 반영(flush)해야 한다.
    prev = db.query(PromptVersion).filter_by(prompt_id=prompt_id, is_active=True).first()
    now = datetime.utcnow()
    if prev:
        prev.is_active = False
        prev_act = (
            db.query(PromptActivation)
            .filter_by(prompt_version_id=prev.id, deactivated_at=None)
            .order_by(PromptActivation.activated_at.desc())
            .first()
        )
        if prev_act:
            prev_act.deactivated_at = now
        db.flush()  # is_active=False가 먼저 DB에 반영되어야 다음 활성화에서 unique 충돌이 안 남

    # 새 버전 activate
    new_active.is_active = True
    db.add(PromptActivation(
        prompt_version_id=new_active.id,
        activated_by=activated_by,
        activated_at=now,
    ))
    db.commit()
    db.refresh(new_active)

    # 캐시 무효화 (단일 노드 가정)
    prompt = db.query(Prompt).filter_by(id=prompt_id).first()
    if prompt:
        invalidate_cache(prompt.key)
    return new_active
