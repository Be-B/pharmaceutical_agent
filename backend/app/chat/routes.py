import json
import logging

from fastapi import APIRouter, Depends, HTTPException, status
from langchain_core.messages import AIMessage, HumanMessage
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session as DBSession

from ..agent.builder import build_agent
from ..common.errors import UNAUTHORIZED, FORBIDDEN
from ..db.base import get_db
from ..db.models import User
from ..deps import get_current_user
from ..observability import get_langfuse_handler
from ..prompts.service import get_active_prompt
from . import persistence
from .schemas import CreateSessionRequest, MessageBody, MessagePublic, SessionPublic
from .title import (
    count_turns,
    generate_session_title,
    should_regenerate_title,
)

router = APIRouter()
logger = logging.getLogger(__name__)


SSE_RESPONSE_DOC = {
    200: {
        "description": (
            "Server-Sent Events 스트림. 각 이벤트는 `event:` 줄과 JSON `data:` 줄로 구성됩니다.\n\n"
            "**이벤트 타입:**\n"
            "- `token` — `{\"text\": \"...\"}` 어시스턴트가 생성한 토큰 조각\n"
            "- `tool` — `{\"phase\": \"tool-started|tool-finished\", \"tool_name\": \"...\", \"input\": {...}}` 도구 호출 진행 상황\n"
            "- `done` — 스트림 정상 종료. `{\"message_id\": int, \"session_title\": str|null}`\n"
            "- `error` — `{\"message\": \"...\"}` 에러 발생"
        ),
        "content": {
            "text/event-stream": {
                "example": (
                    "event: tool\ndata: {\"phase\": \"tool-started\", \"tool_name\": \"search_drugs\", \"input\": {\"query\": \"타이레놀\"}}\n\n"
                    "event: token\ndata: {\"text\": \"타이레놀\"}\n\n"
                    "event: token\ndata: {\"text\": \"500mg은\"}\n\n"
                    "event: done\ndata: {\"message_id\": 42, \"session_title\": \"타이레놀 복용\"}\n\n"
                ),
            },
        },
    },
}


def _profile_block(user: User) -> str:
    """사용자 프로필을 시스템 프롬프트 앞에 합칠 마크다운 블록."""
    parts = []
    if user.name: parts.append(f"이름: {user.name}")
    if user.age is not None: parts.append(f"나이: {user.age}")
    if user.gender: parts.append(f"성별: {user.gender}")
    if user.symptoms_note: parts.append(f"증상/특이사항: {user.symptoms_note}")
    if user.current_medications: parts.append(f"복용 중인 약물: {user.current_medications}")
    if user.allergies: parts.append(f"알레르기: {user.allergies}")
    if not parts:
        return ""
    return (
        "## 사용자 프로필 (참고용)\n"
        + "\n".join(parts)
        + "\n\n사용자 검색 시 이 프로필을 참고하세요. 약물 상호작용/알레르기는 반드시 강조 안내."
    )


@router.post(
    "/sessions",
    response_model=SessionPublic,
    status_code=status.HTTP_201_CREATED,
    summary="대화 세션 생성",
    description="새 대화 세션을 만듭니다. `title`을 생략하면 기본 제목이 부여됩니다.",
    responses={**UNAUTHORIZED},
)
def create_session(
    body: CreateSessionRequest,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = persistence.create_session(db, user.id, body.title)
    return SessionPublic(id=s.id, title=s.title, created_at=s.created_at, updated_at=s.updated_at)


@router.get(
    "/sessions",
    response_model=list[SessionPublic],
    summary="내 대화 세션 목록",
    description="현재 로그인된 사용자가 소유한 대화 세션을 최신 갱신순으로 반환합니다.",
    responses={**UNAUTHORIZED},
)
def list_sessions(
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    return [
        SessionPublic(id=s.id, title=s.title, created_at=s.created_at, updated_at=s.updated_at)
        for s in persistence.list_sessions(db, user.id)
    ]


@router.get(
    "/sessions/{session_id}/messages",
    response_model=list[MessagePublic],
    summary="세션 메시지 조회",
    description="해당 세션에 저장된 메시지를 시간순으로 반환합니다. 본인 소유 세션만 조회 가능합니다.",
    responses={**UNAUTHORIZED, **FORBIDDEN},
)
def list_session_messages(
    session_id: str,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = persistence.get_session_for_user(db, session_id, user.id)
    if not s:
        raise HTTPException(403, "세션을 찾을 수 없거나 접근 권한이 없습니다")
    return [
        MessagePublic(
            id=m.id,
            role=m.role,
            content=m.content,
            tool_calls=m.tool_calls,
            prompt_version_id=m.prompt_version_id,
            created_at=m.created_at,
        )
        for m in persistence.list_messages(db, session_id)
    ]


@router.post(
    "/sessions/{session_id}/messages",
    summary="메시지 전송 (SSE 스트리밍 응답)",
    description=(
        "사용자 메시지를 전송하고, 어시스턴트의 응답을 **Server-Sent Events** 로 스트리밍합니다.\n\n"
        "프론트엔드는 `fetch` + ReadableStream 또는 `EventSource`로 수신하세요. 본 응답은 JSON이 아닙니다."
    ),
    response_class=EventSourceResponse,
    responses={**SSE_RESPONSE_DOC, **UNAUTHORIZED, **FORBIDDEN},
)
async def post_message(
    session_id: str,
    body: MessageBody,
    db: DBSession = Depends(get_db),
    user: User = Depends(get_current_user),
):
    s = persistence.get_session_for_user(db, session_id, user.id)
    if not s:
        raise HTTPException(403, "세션을 찾을 수 없거나 접근 권한이 없습니다")

    # user 메시지를 먼저 저장 — 클라이언트가 도중에 끊겨도 보존됨
    persistence.save_user_message(db, session_id, body.content)

    # 활성 시스템 프롬프트 + 사용자 프로필을 합쳐 ReAct agent 구성
    active = get_active_prompt(db, "system.chat")
    profile = _profile_block(user)
    prompt_text = (profile + "\n\n---\n\n" + active.content) if profile else active.content
    agent = build_agent(prompt_text, model=active.model, temperature=active.temperature)

    history = persistence.list_messages(db, session_id)  # 방금 저장한 user 포함
    lc_messages = [
        HumanMessage(content=m.content) if m.role == "user" else AIMessage(content=m.content)
        for m in history if m.role in ("user", "assistant")
    ]

    # Langfuse 트레이싱(옵셔널) — 세션·사용자 단위로 묶음. 키 미설정 시 None.
    lf_handler = get_langfuse_handler(
        session_id=session_id, user_id=str(user.id), trace_name="chat"
    )
    run_config = {"callbacks": [lf_handler]} if lf_handler else {}

    async def event_gen():
        final_parts: list[str] = []
        tool_calls_log: list[dict] = []
        try:
            async for ev in agent.astream_events(
                {"messages": lc_messages}, version="v2", config=run_config
            ):
                kind = ev["event"]
                data = ev.get("data", {})

                if kind == "on_chat_model_stream":
                    chunk = data.get("chunk")
                    text = getattr(chunk, "content", "") if chunk else ""
                    if isinstance(text, str) and text:
                        final_parts.append(text)
                        yield {
                            "event": "token",
                            "data": json.dumps({"text": text}, ensure_ascii=False),
                        }

                elif kind == "on_tool_start":
                    name = ev.get("name", "")
                    tin = data.get("input", {}) or {}
                    # 기존 SSE 계약 유지: phase = "tool-started" / "tool-finished"
                    tool_calls_log.append({"tool_name": name, "input": tin})
                    logger.info("agent tool_start: %s input=%s", name, tin)
                    yield {
                        "event": "tool",
                        "data": json.dumps(
                            {"phase": "tool-started", "tool_name": name, "input": tin},
                            ensure_ascii=False,
                        ),
                    }

                elif kind == "on_tool_end":
                    name = ev.get("name", "")
                    logger.info("agent tool_end: %s", name)
                    yield {
                        "event": "tool",
                        "data": json.dumps(
                            {"phase": "tool-finished", "tool_name": name},
                            ensure_ascii=False,
                        ),
                    }
        except Exception as e:
            logger.exception("agent stream failed")
            yield {
                "event": "error",
                "data": json.dumps({"message": str(e)}, ensure_ascii=False),
            }
            return
        finally:
            if lf_handler:
                lf_handler.flush()

        # assistant 메시지 저장
        final_text = "".join(final_parts).strip()
        msg = persistence.save_assistant_message(
            db, session_id, final_text,
            tool_calls=tool_calls_log or None,
            prompt_version_id=active.id,
        )

        # 자동 세션 제목: 첫 응답 + 5턴마다
        new_title: str | None = None
        all_msgs = persistence.list_messages(db, session_id)
        turn = count_turns(all_msgs)
        if should_regenerate_title(turn, s.title):
            try:
                generated = await generate_session_title(all_msgs, session_id=session_id)
                if generated and generated != s.title:
                    s.title = generated
                    db.commit()
                    new_title = generated
            except Exception:
                new_title = None

        yield {
            "event": "done",
            "data": json.dumps(
                {
                    "message_id": msg.id,
                    "prompt_version_id": active.id,
                    "session_title": new_title,
                },
                ensure_ascii=False,
            ),
        }

    # 중간 프록시(Next.js dev 서버 등)가 응답을 gzip으로 묶어 buffering하면
    # 토큰이 한방에 도착해 SSE가 망가짐. 압축/변환 금지를 명시.
    return EventSourceResponse(
        event_gen(),
        headers={
            "Cache-Control": "no-cache, no-transform",
            "X-Accel-Buffering": "no",
            "Content-Encoding": "identity",
        },
    )
