from __future__ import annotations
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from ..config import settings
from ..db.models import PromptVersion
from .tools import ALL_TOOLS


def build_agent(active: PromptVersion):
    model = ChatOpenAI(
        model=active.model or settings.DEFAULT_LLM_MODEL,
        temperature=active.temperature if active.temperature is not None else 0,
        streaming=True,
        api_key=settings.OPENAI_API_KEY,
    )
    return create_react_agent(model, tools=ALL_TOOLS, prompt=active.content)
