from dataclasses import dataclass
from typing import Any
import json


@dataclass
class ChatEvent:
    type: str  # 'token' | 'tool' | 'done' | 'error'
    payload: dict[str, Any]


def to_sse_dict(event: ChatEvent) -> dict:
    """sse-starlette EventSourceResponse가 받는 dict 형식."""
    return {"event": event.type, "data": json.dumps(event.payload, ensure_ascii=False)}
