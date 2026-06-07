from __future__ import annotations
import logging
from typing import Optional
import cohere
from cohere.core.api_error import ApiError
from langchain_core.tools import tool
from langchain_core.documents import Document
from .retriever import search_with_score
from .supp_ai import (
    SuppAIError,
    search_agent as _supp_search_agent,
    get_interaction as _supp_get_interaction,
    list_interactions as _supp_list_interactions,
)
from ..config import settings

logger = logging.getLogger(__name__)

def _format_results(docs: list[Document]) -> list[dict]:
    return [
        {
            "name": d.metadata.get("name"),
            "source": d.metadata.get("source"),
            "item_code": d.metadata.get("item_code"),
            "company": d.metadata.get("company"),
            "image_url": d.metadata.get("image_url"),
            "snippet": d.page_content[:500],
        }
        for d in docs
    ]


async def _rerank(query: str, docs: list[Document], top_n: int) -> list[Document]:
    if not settings.COHERE_API_KEY or not docs:
        return docs[:top_n]
    co = cohere.AsyncClientV2(api_key=settings.COHERE_API_KEY)
    try:
        resp = await co.v2.rerank(
            model=settings.COHERE_RERANK_MODEL,
            query=query,
            documents=[d.page_content for d in docs],
            top_n=top_n,
        )
        result = [docs[r.index] for r in resp.results]
        logger.info("rerank ok: %d→%d via %s", len(docs), len(result), settings.COHERE_RERANK_MODEL)
        return result
    except ApiError as e:
        logger.warning("cohere_fallback: %s", e)
        return docs[:top_n]
    except Exception as e:
        # 1회 retry
        try:
            resp = await co.v2.rerank(
                model=settings.COHERE_RERANK_MODEL,
                query=query,
                documents=[d.page_content for d in docs],
                top_n=top_n,
            )
            return [docs[r.index] for r in resp.results]
        except Exception as e2:
            logger.warning("cohere_fallback (retry failed): %s", e2)
            return docs[:top_n]
        else:
            logger.info("rerank ok (after retry): %d→%d via %s", len(docs), len(resp.results), settings.COHERE_RERANK_MODEL)


async def _search(query: str, source: Optional[str], top_n: int = 5) -> list[dict]:
    pairs = search_with_score(query, source=source, k=20)
    docs = [d for d, _ in pairs]
    final = await _rerank(query, docs, top_n)
    return _format_results(final)


@tool
async def search_drugs(query: str) -> list[dict]:
    """의약품(전문/일반의약품) 정보를 검색합니다. 효능, 사용법, 부작용, 주의사항, 상호작용을 알고 싶을 때 사용."""
    logger.info("TOOL CALL: search_drugs(query=%r)", query)
    out = await _search(query, source="drug")
    logger.info("TOOL DONE: search_drugs → %d hits", len(out))
    return out


@tool
async def search_health_foods(query: str) -> list[dict]:
    """건강기능식품(영양제, 비타민, 프로바이오틱스 등) 정보를 검색합니다. 주된 기능성과 섭취 방법을 알고 싶을 때 사용."""
    logger.info("TOOL CALL: search_health_foods(query=%r)", query)
    out = await _search(query, source="hff")
    logger.info("TOOL DONE: search_health_foods → %d hits", len(out))
    return out


@tool
async def search_all(query: str) -> list[dict]:
    """의약품과 건강기능식품을 동시에 검색합니다. 어느 카테고리에 속하는지 불분명하거나, '약 대신 먹을 수 있는 건기식' 같이 둘을 비교할 때 사용."""
    logger.info("TOOL CALL: search_all(query=%r)", query)
    out = await _search(query, source=None)
    logger.info("TOOL DONE: search_all → %d hits", len(out))
    return out


@tool
async def supp_search_agent(query: str) -> list[dict]:
    """supp.ai에서 보충제/의약품 개체를 검색해 CUI를 얻습니다. query는 반드시 영문 성분명/약물명이어야 합니다(예: "Warfarin", "Ginkgo"). 한글명은 먼저 영문으로 변환하세요. 반환된 cui를 supp_get_interaction / supp_list_interactions의 인자로 사용합니다."""
    logger.info("TOOL CALL: supp_search_agent(query=%r)", query)
    try:
        out = await _supp_search_agent(query)
    except SuppAIError as e:
        return [{"error": f"supp.ai 조회 실패: {e}"}]
    return out[:5]


@tool
async def supp_get_interaction(cui_a: str, cui_b: str) -> dict:
    """두 개체(보충제↔의약품)의 CUI 사이 상호작용 논문 근거를 반환합니다. cui 순서는 무관합니다. 먼저 supp_search_agent로 두 cui를 얻으세요. 알려진 상호작용이 없으면 {"found": false}를 반환합니다."""
    logger.info("TOOL CALL: supp_get_interaction(%r, %r)", cui_a, cui_b)
    try:
        out = await _supp_get_interaction(cui_a, cui_b)
    except SuppAIError as e:
        return {"found": False, "error": f"supp.ai 조회 실패: {e}"}
    if out is None:
        return {"found": False}
    return {"found": True, **out}


@tool
async def supp_list_interactions(cui: str) -> dict:
    """한 개체(cui)와 상호작용하는 모든 상대를 나열합니다. "이 약과 같이 먹으면 안 되는 영양제" 같은 질문에 사용하세요. 먼저 supp_search_agent로 cui를 얻으세요."""
    logger.info("TOOL CALL: supp_list_interactions(%r)", cui)
    try:
        out = await _supp_list_interactions(cui)
    except SuppAIError as e:
        return {"error": f"supp.ai 조회 실패: {e}"}
    return out


ALL_TOOLS = [
    search_drugs,
    search_health_foods,
    search_all,
    supp_search_agent,
    supp_get_interaction,
    supp_list_interactions,
]
