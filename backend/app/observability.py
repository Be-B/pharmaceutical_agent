"""Langfuse 트레이싱 연동.

키(LANGFUSE_PUBLIC_KEY/SECRET_KEY)가 설정돼 있을 때만 LangChain CallbackHandler를 반환한다.
미설정·미설치 시 None → 호출부는 트레이싱 없이 그대로 동작(완전 옵셔널).
"""
from __future__ import annotations

import logging

from .config import settings

logger = logging.getLogger(__name__)

_warned = False


def langfuse_enabled() -> bool:
    return bool(settings.LANGFUSE_PUBLIC_KEY and settings.LANGFUSE_SECRET_KEY)


def get_langfuse_handler(
    *,
    session_id: str | None = None,
    user_id: str | None = None,
    trace_name: str | None = None,
):
    """요청별 Langfuse CallbackHandler. 키 미설정/미설치면 None.

    session_id·user_id를 넘기면 Langfuse UI에서 세션·사용자 단위로 트레이스가 묶인다.
    """
    global _warned
    if not langfuse_enabled():
        return None
    try:
        from langfuse.callback import CallbackHandler
    except ImportError:
        if not _warned:
            logger.warning("langfuse 미설치 — 트레이싱 비활성 (pip install langfuse)")
            _warned = True
        return None
    return CallbackHandler(
        public_key=settings.LANGFUSE_PUBLIC_KEY,
        secret_key=settings.LANGFUSE_SECRET_KEY,
        host=settings.LANGFUSE_BASE_URL,
        session_id=session_id,
        user_id=user_id,
        trace_name=trace_name,
    )
