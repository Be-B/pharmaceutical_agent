"""세션 제목 자동 생성 — 첫 응답 + 5턴마다 재요약."""
from __future__ import annotations
import asyncio

from langchain_core.messages import HumanMessage, SystemMessage
from langchain_openai import ChatOpenAI

from ..config import settings
from ..db.models import Message


DEFAULT_TITLE = "새 대화"
TITLE_REGEN_INTERVAL = 5  # 5턴마다 재요약 (turn = assistant 응답 1회)
_TITLE_TIMEOUT_SEC = 8.0
_MAX_TITLE_LEN = 30
_HISTORY_HEAD = 2   # 재요약 시 앞쪽에서 가져올 메시지 수
_HISTORY_TAIL = 6   # 재요약 시 뒤쪽에서 가져올 메시지 수
_PER_MSG_TRUNC = 400  # 메시지 1개당 LLM 입력 길이 상한

_SYSTEM_PROMPT = (
    "다음은 사용자와 의약품 정보 챗봇의 대화입니다. "
    "전체 대화의 핵심 주제를 5~15자 이내의 짧은 한국어 명사구 제목으로 요약해주세요.\n"
    "규칙:\n"
    "- 제목 한 줄만 출력 (마침표·따옴표·괄호·이모지 금지)\n"
    "- '대화', '질문' 같은 군더더기 단어는 빼고 핵심 주제만\n"
    "- 대화에 여러 주제가 섞였으면 가장 자주 다룬 주제를 선택\n"
    "- 예) '타이레놀 복용 간격', '비타민D 결핍 증상', '고혈압 약 부작용'"
)


def _fallback_title(messages: list[Message]) -> str:
    """LLM 실패 시 첫 user 메시지 앞 20자."""
    first_user = next((m for m in messages if m.role == "user"), None)
    if not first_user:
        return DEFAULT_TITLE
    snippet = (first_user.content or "").strip().splitlines()[0][:20].strip()
    return snippet or DEFAULT_TITLE


def _clean_title(raw: str) -> str | None:
    title = (raw or "").strip()
    title = title.strip('"\'`「」『』()[]【】{}').rstrip(".。!?").strip()
    title = title.splitlines()[0].strip() if title else ""
    if not title:
        return None
    if len(title) > _MAX_TITLE_LEN:
        title = title[:_MAX_TITLE_LEN].rstrip()
    return title


def _sample_history(messages: list[Message]) -> list[Message]:
    """긴 대화를 LLM 입력용으로 압축: 첫 N개 + 마지막 M개."""
    total = _HISTORY_HEAD + _HISTORY_TAIL
    if len(messages) <= total:
        return messages
    return messages[:_HISTORY_HEAD] + messages[-_HISTORY_TAIL:]


def _format_messages(messages: list[Message]) -> str:
    lines = []
    for m in messages:
        speaker = "사용자" if m.role == "user" else "챗봇"
        content = (m.content or "").strip()[:_PER_MSG_TRUNC]
        lines.append(f"[{speaker}]\n{content}")
    return "\n\n".join(lines)


def count_turns(messages: list[Message]) -> int:
    """대화 턴 수 = assistant 응답 횟수."""
    return sum(1 for m in messages if m.role == "assistant")


def should_regenerate_title(turn: int, current_title: str) -> bool:
    """첫 응답(turn==1)이거나 5턴마다 재요약."""
    if turn == 1 and current_title == DEFAULT_TITLE:
        return True
    if turn >= TITLE_REGEN_INTERVAL and turn % TITLE_REGEN_INTERVAL == 0:
        return True
    return False


async def generate_session_title(messages: list[Message]) -> str:
    """대화 history 기반 제목 생성. 항상 비어있지 않은 문자열 반환."""
    if not messages:
        return DEFAULT_TITLE
    sample = _sample_history(messages)
    body = _format_messages(sample)
    if not body.strip():
        return _fallback_title(messages)
    try:
        llm = ChatOpenAI(
            model=settings.DEFAULT_LLM_MODEL,
            temperature=0.3,
            api_key=settings.OPENAI_API_KEY,
            max_tokens=30,
        )
        resp = await asyncio.wait_for(
            llm.ainvoke([
                SystemMessage(content=_SYSTEM_PROMPT),
                HumanMessage(content=body),
            ]),
            timeout=_TITLE_TIMEOUT_SEC,
        )
        cleaned = _clean_title(getattr(resp, "content", "") or "")
        if cleaned:
            return cleaned
    except (asyncio.TimeoutError, Exception):
        pass
    return _fallback_title(messages)
