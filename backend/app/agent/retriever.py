from __future__ import annotations
from pathlib import Path
from typing import Optional
from langchain_community.vectorstores import FAISS
from langchain_openai import OpenAIEmbeddings
from langchain_core.documents import Document
from ..config import settings

_VS: Optional[FAISS] = None
INDEX_DIR = Path("var/faiss/index")


def _embeddings() -> OpenAIEmbeddings:
    return OpenAIEmbeddings(model=settings.EMBEDDING_MODEL, api_key=settings.OPENAI_API_KEY)


def load_retriever() -> FAISS:
    global _VS
    if _VS is not None:
        return _VS
    if not INDEX_DIR.is_dir():
        raise RuntimeError(
            f"FAISS 인덱스를 찾을 수 없습니다 ({INDEX_DIR}). "
            "먼저 'docker compose --profile indexing run --rm indexer python -m indexer.build'로 인덱싱을 수행하세요."
        )
    _VS = FAISS.load_local(
        str(INDEX_DIR), _embeddings(), allow_dangerous_deserialization=True
    )
    return _VS


def search_with_score(query: str, source: Optional[str] = None, k: int = 20) -> list[tuple[Document, float]]:
    vs = load_retriever()
    flt = {"source": source} if source else None
    return vs.similarity_search_with_score(query, k=k, filter=flt)
