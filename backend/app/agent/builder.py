from __future__ import annotations
from langchain_openai import ChatOpenAI
from langgraph.prebuilt import create_react_agent
from ..config import settings
from .tools import ALL_TOOLS


def build_agent(prompt: str, model: str | None = None, temperature: float | None = None):
    """system 프롬프트 + LLM + 검색 도구 3종을 묶은 ReAct agent."""
    llm = ChatOpenAI(
        model=model or settings.DEFAULT_LLM_MODEL,
        temperature=temperature if temperature is not None else 0,
        streaming=True,
        api_key=settings.OPENAI_API_KEY,
    )
    return create_react_agent(llm, tools=ALL_TOOLS, prompt=prompt)
