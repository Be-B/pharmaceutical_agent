"""Excel 로더: 의약품 및 건강기능식품 데이터를 dict 리스트로 변환."""

from __future__ import annotations

import openpyxl

_DRUG_COL_MAP: dict[str, str] = {
    "품목기준코드": "item_code",
    "제품명": "name",
    "업체명": "company",
    "효능": "efficacy",
    "사용법": "usage",
    "사용상 경고": "warnings",
    "사용상 주의": "cautions",
    "상호작용": "interactions",
    "부작용": "side_effects",
    "보관법": "storage",
    "이미지URL": "image_url",
    "공개일자": "published_at",
    "갱신일자": "updated_at",
    "사업자번호": "business_number",
}

_HFF_COL_MAP: dict[str, str] = {
    "품목제조관리번호": "item_code",
    "제품명": "name",
    "업체명": "company",
    "주된기능성": "main_function",
    "성상": "appearance",
    "용도용법": "usage",
    "섭취 시 주의사항": "cautions",
    "기준규격": "standard",
    "유통기한": "shelf_life",
    "보존방법": "storage",
    "등록일": "registered_at",
}


def _load_xlsx(path: str, col_map: dict[str, str]) -> tuple[list[dict], int]:
    """공통 xlsx 로더. (rows, skipped_count) 반환."""
    wb = openpyxl.load_workbook(path, read_only=True, data_only=True)
    ws = wb.active

    rows_iter = ws.iter_rows(values_only=True)
    header_raw = next(rows_iter)
    # 헤더를 영문 키로 변환 (매핑 없는 컬럼은 원문 유지)
    header = [col_map.get(str(h).strip() if h is not None else "", str(h)) for h in header_raw]

    results: list[dict] = []
    skipped = 0

    for row in rows_iter:
        record = {header[i]: (cell if cell is not None else "") for i, cell in enumerate(row)}
        name_val = str(record.get("name", "")).strip()
        if not name_val:
            skipped += 1
            continue
        # 모든 값 문자열화 및 strip
        results.append({k: str(v).strip() for k, v in record.items()})

    wb.close()
    return results, skipped


def load_drugs(path: str) -> tuple[list[dict], int]:
    """의약품 xlsx 로드.

    Returns:
        (rows, skipped_count)
    """
    return _load_xlsx(path, _DRUG_COL_MAP)


def load_hff(path: str) -> tuple[list[dict], int]:
    """건강기능식품 xlsx 로드.

    Returns:
        (rows, skipped_count)
    """
    return _load_xlsx(path, _HFF_COL_MAP)
