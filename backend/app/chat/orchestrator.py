from __future__ import annotations
from typing import AsyncIterator
from sqlalchemy.orm import Session as DBSession
from langchain_core.messages import HumanMessage, AIMessage, AIMessageChunk
from ..db.models import Message, Prompt, PromptVersion, Session, User
from ..agent.builder import build_agent
from .sse import ChatEvent
from .persistence import save_user_message, save_assistant_message, list_messages
from .title import (
    DEFAULT_TITLE,
    count_turns,
    generate_session_title,
    should_regenerate_title,
)


def _build_profile_block(user: User) -> str:
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


def _load_active_prompt(db: DBSession, key: str = "system.chat") -> PromptVersion:
    try:
        from ..prompts.service import get_active_prompt
        return get_active_prompt(db, key)
    except (ImportError, AttributeError):
        prompt = db.query(Prompt).filter_by(key=key).first()
        if not prompt:
            raise RuntimeError(f"Prompt key '{key}' not found")
        active = db.query(PromptVersion).filter_by(prompt_id=prompt.id, is_active=True).first()
        if not active:
            raise RuntimeError(f"No active version for prompt '{key}'")
        return active


def _to_lc_messages(messages: list[Message]) -> list:
    out = []
    for m in messages:
        if m.role == "user":
            out.append(HumanMessage(content=m.content))
        elif m.role == "assistant":
            out.append(AIMessage(content=m.content))
    return out


async def run(db: DBSession, user_id: int, session_id: str, query: str) -> AsyncIterator[ChatEvent]:
    # 1. 사용자 메시지 저장 + 이전 메시지 로드
    save_user_message(db, session_id, query)
    history = list_messages(db, session_id)
    lc_messages = _to_lc_messages(history)

    # 2. 활성 프롬프트 + 사용자 프로필 주입 + agent
    active = _load_active_prompt(db)
    user = db.query(User).filter_by(id=user_id).first()
    profile_block = _build_profile_block(user) if user else ""
    if profile_block:
        import copy
        active_with_profile = copy.copy(active)
        active_with_profile.content = profile_block + "\n\n---\n\n" + active.content
        agent = build_agent(active_with_profile)
    else:
        agent = build_agent(active)

    # 3. astream — AIMessageChunk만 token으로, tool 이벤트는 별도
    final_text_parts: list[str] = []
    tool_calls_log: list[dict] = []
    try:
        async for ns, mode, payload in agent.astream(
            {"messages": lc_messages},
            stream_mode=["messages", "tools"],
            subgraphs=True,
        ):
            if mode == "messages":
                chunk = payload[0] if isinstance(payload, tuple) else payload
                if not isinstance(chunk, AIMessageChunk):
                    continue
                text = getattr(chunk, "content", "")
                if isinstance(text, str) and text:
                    final_text_parts.append(text)
                    yield ChatEvent(type="token", payload={"text": text})
            elif mode == "tools":
                tool_event = payload.get("event")
                if tool_event in ("tool-started", "tool-finished"):
                    yield ChatEvent(type="tool", payload={
                        "phase": tool_event,
                        "tool_call_id": payload.get("tool_call_id"),
                        "tool_name": payload.get("tool_name"),
                        "input": payload.get("input"),
                    })
                    if tool_event == "tool-started":
                        tool_calls_log.append({
                            "tool_call_id": payload.get("tool_call_id"),
                            "tool_name": payload.get("tool_name"),
                            "input": payload.get("input"),
                        })
    except Exception as e:
        yield ChatEvent(type="error", payload={"message": str(e)})
        return

    # 4. assistant 메시지 저장 (LLM 답변 그대로)
    final = "".join(final_text_parts).strip()
    msg = save_assistant_message(
        db, session_id, final,
        tool_calls=tool_calls_log or None,
        prompt_version_id=active.id,
    )

    # 5. 자동 세션 제목 — 첫 응답 + 5턴마다 재요약. 실패해도 done은 발사.
    session = db.query(Session).filter_by(id=session_id).first()
    new_title: str | None = None
    if session:
        all_messages = list_messages(db, session_id)  # 방금 저장한 assistant 포함
        turn = count_turns(all_messages)
        if should_regenerate_title(turn, session.title):
            try:
                generated = await generate_session_title(all_messages)
                if generated and generated != session.title:
                    session.title = generated
                    db.commit()
                    new_title = generated
            except Exception:
                new_title = None

    yield ChatEvent(type="done", payload={
        "message_id": msg.id,
        "prompt_version_id": active.id,
        "session_title": new_title,
    })
