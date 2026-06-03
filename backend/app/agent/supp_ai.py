from __future__ import annotations

import logging
import re
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


def reconstruct_sentence(spans: list[dict]) -> str:
    """spans[].text를 이어붙여 원문 문장을 복원하고 구두점 주변 공백을 정리."""
    text = " ".join(s.get("text", "") for s in spans if s.get("text"))
    text = re.sub(r"\s+([,.;:%)\]])", r"\1", text)  # 구두점/닫는괄호 앞 공백 제거
    text = re.sub(r"([(\[])\s+", r"\1", text)        # 여는 괄호 뒤 공백 제거
    text = re.sub(r"\s{2,}", " ", text).strip()      # 중복 공백 축약
    return text


_TYPE_RANK = {"clinical": 0, "human": 1, "animal": 2, "other": 3}


def _study_type(paper: dict) -> str:
    if paper.get("clinical_study"):
        return "clinical"
    if paper.get("human_study"):
        return "human"
    if paper.get("animal_study"):
        return "animal"
    return "other"


def summarize_evidence(evidence: list[dict], max_items: int) -> list[dict]:
    """근거 논문을 요약: 철회 제외, 논문당 대표 문장 1개, 사람/임상 우선·최신연도순, 상위 N."""
    items: list[dict] = []
    for ev in evidence:
        paper = ev.get("paper", {})
        if paper.get("retraction"):
            continue
        sentences = ev.get("sentences", [])
        sentence = (
            reconstruct_sentence(sentences[0].get("spans", [])) if sentences else ""
        )
        items.append(
            {
                "sentence": sentence,
                "pmid": paper.get("pmid"),
                "doi": paper.get("doi"),
                "year": paper.get("year"),
                "venue": paper.get("venue"),
                "study_type": _study_type(paper),
            }
        )
    items.sort(key=lambda x: (_TYPE_RANK.get(x["study_type"], 3), -(x["year"] or 0)))
    return items[:max_items]
