import enum
import uuid
from datetime import datetime
from sqlalchemy import (
    Column, Integer, String, DateTime, ForeignKey, Text,
    Boolean, Float, JSON, UniqueConstraint, Index, Enum, text,
)
from sqlalchemy.orm import relationship
from .base import Base


def _new_uuid() -> str:
    return uuid.uuid4().hex


class UserRole(str, enum.Enum):
    user = "user"
    admin = "admin"


class User(Base):
    __tablename__ = "users"

    id = Column(Integer, primary_key=True)
    email = Column(String, unique=True, nullable=False, index=True)
    password_hash = Column(String, nullable=False)
    role = Column(Enum(UserRole), default=UserRole.user, nullable=False)
    pii_consent_at = Column(DateTime, nullable=True)
    name = Column(String, nullable=True)
    age = Column(Integer, nullable=True)
    gender = Column(String, nullable=True)  # 'male' | 'female' | 'other' | None
    symptoms_note = Column(Text, nullable=True)  # 자유 텍스트
    current_medications = Column(Text, nullable=True)  # 자유 텍스트
    allergies = Column(Text, nullable=True)  # 자유 텍스트
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Session(Base):
    __tablename__ = "sessions"

    id = Column(String, primary_key=True, default=_new_uuid)
    user_id = Column(Integer, ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    title = Column(String, default="새 대화", nullable=False)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)


class Message(Base):
    __tablename__ = "messages"

    id = Column(Integer, primary_key=True)
    session_id = Column(String, ForeignKey("sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String, nullable=False)
    content = Column(Text, nullable=False)
    tool_calls = Column(JSON, nullable=True)
    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class Prompt(Base):
    __tablename__ = "prompts"

    id = Column(Integer, primary_key=True)
    key = Column(String, unique=True, nullable=False, index=True)
    description = Column(String, default="")
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)


class PromptVersion(Base):
    __tablename__ = "prompt_versions"

    id = Column(Integer, primary_key=True)
    prompt_id = Column(Integer, ForeignKey("prompts.id", ondelete="CASCADE"), nullable=False, index=True)
    version_number = Column(Integer, nullable=False)
    content = Column(Text, nullable=False)
    model = Column(String, nullable=True)
    temperature = Column(Float, nullable=True)
    is_active = Column(Boolean, default=False, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)

    __table_args__ = (
        UniqueConstraint("prompt_id", "version_number", name="uq_prompt_version"),
        Index("ix_prompt_active", "prompt_id", unique=True, sqlite_where=text("is_active = 1")),
    )


class PromptActivation(Base):
    __tablename__ = "prompt_activations"

    id = Column(Integer, primary_key=True)
    prompt_version_id = Column(Integer, ForeignKey("prompt_versions.id"), nullable=False, index=True)
    activated_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    activated_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    deactivated_at = Column(DateTime, nullable=True)


