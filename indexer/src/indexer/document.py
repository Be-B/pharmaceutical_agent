"""dict → LangChain Document 변환."""

from __future__ import annotations

from langchain_core.documents import Document


def _field_line(label: str, value: str) -> str:
    """값이 있으면 '[label] value' 반환, 없으면 빈 문자열."""
    v = (value or "").strip()
    return f"[{label}] {v}" if v else ""


def to_drug_document(row: dict) -> Document:
    """의약품 dict → Document.

    page_content: 빈 필드 생략한 한글 라벨 텍스트
    metadata: 검색 후 카드 표시용 필드 포함
    """
    lines = [
        _field_line("제품명", row.get("name", "")),
        _field_line("업체", row.get("company", "")),
        "[출처] 의약품",
        _field_line("효능", row.get("efficacy", "")),
        _field_line("사용법", row.get("usage", "")),
        _field_line("사용상 경고", row.get("warnings", "")),
        _field_line("사용상 주의", row.get("cautions", "")),
        _field_line("상호작용", row.get("interactions", "")),
        _field_line("부작용", row.get("side_effects", "")),
        _field_line("보관법", row.get("storage", "")),
    ]
    page_content = "\n".join(line for line in lines if line)

    metadata = {
        "source": "drug",
        "item_code": row.get("item_code", ""),
        "name": row.get("name", ""),
        "company": row.get("company", ""),
        "image_url": row.get("image_url", ""),
        "interactions": row.get("interactions", ""),
        "side_effects": row.get("side_effects", ""),
        "warnings": row.get("warnings", ""),
        "cautions": row.get("cautions", ""),
        "storage": row.get("storage", ""),
        "published_at": row.get("published_at", ""),
        "updated_at": row.get("updated_at", ""),
    }

    return Document(page_content=page_content, metadata=metadata)


def to_hff_document(row: dict) -> Document:
    """건강기능식품 dict → Document.

    page_content: 빈 필드 생략한 한글 라벨 텍스트
    metadata: 검색 후 카드 표시용 필드 포함
    """
    lines = [
        _field_line("제품명", row.get("name", "")),
        _field_line("업체", row.get("company", "")),
        "[출처] 건강기능식품",
        _field_line("주된기능성", row.get("main_function", "")),
        _field_line("성상", row.get("appearance", "")),
        _field_line("용도용법", row.get("usage", "")),
        _field_line("섭취 시 주의사항", row.get("cautions", "")),
        _field_line("기준규격", row.get("standard", "")),
        _field_line("보존방법", row.get("storage", "")),
    ]
    page_content = "\n".join(line for line in lines if line)

    metadata = {
        "source": "hff",
        "item_code": row.get("item_code", ""),
        "name": row.get("name", ""),
        "company": row.get("company", ""),
        "main_function": row.get("main_function", ""),
        "appearance": row.get("appearance", ""),
        "cautions": row.get("cautions", ""),
        "storage": row.get("storage", ""),
        "shelf_life": row.get("shelf_life", ""),
        "registered_at": row.get("registered_at", ""),
    }

    return Document(page_content=page_content, metadata=metadata)
