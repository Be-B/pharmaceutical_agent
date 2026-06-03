from __future__ import annotations

import logging
from typing import Optional

import httpx

from ..config import settings

logger = logging.getLogger(__name__)


class SuppAIError(Exception):
    """supp.ai 호출 실패(타임아웃/네트워크/5xx). 호출자가 graceful degrade."""


# supp.ai는 정적 스냅샷(2021-10-20)이라 TTL 불필요. URL+params 키 단순 캐시.
_CACHE: dict[str, Optional[dict]] = {}
_CACHE_MAX = 512


def clear_cache() -> None:
    _CACHE.clear()


async def _request(path: str, params: Optional[dict] = None) -> Optional[dict]:
    """supp.ai GET. 404 -> None, 그 외 전송 실패 -> SuppAIError. 결과 캐시."""
    key = path + "?" + "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))
    if key in _CACHE:
        return _CACHE[key]

    url = f"{settings.SUPP_AI_BASE_URL}{path}"
    try:
        async with httpx.AsyncClient(timeout=settings.SUPP_AI_TIMEOUT) as client:
            resp = await client.get(url, params=params)
    except httpx.HTTPError as e:
        logger.warning("supp.ai request failed: %s", e)
        raise SuppAIError(str(e)) from e

    if resp.status_code == 404:
        result: Optional[dict] = None
    elif resp.status_code >= 400:
        logger.warning("supp.ai status %s for %s", resp.status_code, url)
        raise SuppAIError(f"HTTP {resp.status_code}")
    else:
        result = resp.json()

    if len(_CACHE) < _CACHE_MAX:
        _CACHE[key] = result
    return result
