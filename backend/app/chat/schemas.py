from pydantic import BaseModel
from datetime import datetime


class CreateSessionRequest(BaseModel):
    title: str | None = None


class SessionPublic(BaseModel):
    id: str
    title: str
    created_at: datetime
    updated_at: datetime


class MessageBody(BaseModel):
    content: str


class MessagePublic(BaseModel):
    id: int
    role: str
    content: str
    tool_calls: list | None = None
    prompt_version_id: int | None = None
    created_at: datetime
