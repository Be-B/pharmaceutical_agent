from fastapi import APIRouter, Depends, HTTPException, status
from sse_starlette.sse import EventSourceResponse
from sqlalchemy.orm import Session as DBSession

from ..common.errors import UNAUTHORIZED, FORBIDDEN
from ..db.base import get_db
from ..db.models import User
from ..deps import get_current_user
from .schemas import CreateSessionRequest, SessionPublic, MessageBody, MessagePublic
from . import persistence, orchestrator
from .sse import to_sse_dict

router = APIRouter()


SSE_RESPONSE_DOC = {
    200: {
        "description": (
            "Server-Sent Events 스트림. 각 이벤트는 `event:` 줄과 JSON `data:` 줄로 구성됩니다.\n\n"
            "**이벤트 타입:**\n"
            "- `token` — `{\"text\": \"...\"}` 어시스턴트가 생성한 토큰 조각\n"
            "- `tool` — `{\"phase\": \"start|end\", \"tool_name\": \"...\", \"input\": {...}}` 도구 호출 진행 상황\n"
            "- `done` — 스트림 정상 종료. `{\"message_id\": int}`\n"
            "- `error` — `{\"message\": \"...\"}` 에러 발생"
        ),
        "content": {
            "text/event-stream": {
                "example": (
                    "event: token\ndata: {\"text\": \"안녕\"}\n\n"
                    "event: token\ndata: {\"text\": \"하세요\"}\n\n"
                    "event: done\ndata: {\"message_id\": 42}\n\n"
                ),
            },
        },
    },
}


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

    async def event_gen():
        async for ev in orchestrator.run(db, user.id, session_id, body.content):
            yield to_sse_dict(ev)

    return EventSourceResponse(event_gen())
