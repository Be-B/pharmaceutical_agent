from sqlalchemy.orm import Session as DBSession
from ..db.models import Session, Message


def create_session(db: DBSession, user_id: int, title: str | None = None) -> Session:
    s = Session(user_id=user_id, title=title or "새 대화")
    db.add(s)
    db.commit()
    db.refresh(s)
    return s


def list_sessions(db: DBSession, user_id: int) -> list[Session]:
    return db.query(Session).filter_by(user_id=user_id).order_by(Session.updated_at.desc()).all()


def get_session_for_user(db: DBSession, session_id: str, user_id: int) -> Session | None:
    return db.query(Session).filter_by(id=session_id, user_id=user_id).first()


def list_messages(db: DBSession, session_id: str) -> list[Message]:
    return db.query(Message).filter_by(session_id=session_id).order_by(Message.created_at).all()


def save_user_message(db: DBSession, session_id: str, content: str) -> Message:
    m = Message(session_id=session_id, role="user", content=content)
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


def save_assistant_message(
    db: DBSession,
    session_id: str,
    content: str,
    tool_calls=None,
    prompt_version_id: int | None = None,
) -> Message:
    m = Message(
        session_id=session_id,
        role="assistant",
        content=content,
        tool_calls=tool_calls,
        prompt_version_id=prompt_version_id,
    )
    db.add(m)
    db.commit()
    db.refresh(m)
    return m


