"""FAISS 인덱스 매니페스트: 데이터 해시 기반 rebuild 스킵 로직."""

from __future__ import annotations

import hashlib
import json
import os
from datetime import datetime, timezone


def compute_data_hash(file_paths: list[str]) -> str:
    """각 파일 sha256 → 결합 sha256 첫 8자 반환."""
    combined = hashlib.sha256()
    for path in sorted(file_paths):
        file_hash = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                file_hash.update(chunk)
        combined.update(file_hash.hexdigest().encode())
    return combined.hexdigest()[:8]


def slug(embedding_model: str, data_hash: str) -> str:
    """임베딩 모델명 + 데이터 해시 → 디렉터리 슬러그.

    예) 'text-embedding-3-large', 'abc12345' → '3-large-abc12345'
    """
    # 'text-embedding-3-large' → '3-large'
    model_slug = embedding_model.split("text-embedding-")[-1] if "text-embedding-" in embedding_model else embedding_model
    # 알파벳, 숫자, 하이픈만 허용
    model_slug = "".join(c if c.isalnum() or c == "-" else "_" for c in model_slug)
    return f"{model_slug}-{data_hash}"


def write_manifest(
    dir_path: str,
    embedding_model: str,
    data_files: dict[str, str],
    doc_count: int,
    openai_cost_usd: float | None,
) -> None:
    """매니페스트 JSON을 dir_path/manifest.json에 저장.

    Args:
        dir_path: FAISS 인덱스 디렉터리 경로
        embedding_model: 사용한 임베딩 모델명
        data_files: {파일경로: sha256hex} 매핑
        doc_count: 인덱싱된 Document 수
        openai_cost_usd: 추정 비용 (None 이면 미기록)
    """
    manifest = {
        "embedding_model": embedding_model,
        "data_files": data_files,
        "doc_count": doc_count,
        "built_at": datetime.now(timezone.utc).isoformat(),
    }
    if openai_cost_usd is not None:
        manifest["openai_cost_usd"] = openai_cost_usd

    os.makedirs(dir_path, exist_ok=True)
    manifest_path = os.path.join(dir_path, "manifest.json")
    with open(manifest_path, "w", encoding="utf-8") as f:
        json.dump(manifest, f, ensure_ascii=False, indent=2)


def read_manifest(dir_path: str) -> dict | None:
    """매니페스트 JSON 읽기. 없거나 파싱 실패 시 None 반환."""
    manifest_path = os.path.join(dir_path, "manifest.json")
    if not os.path.exists(manifest_path):
        return None
    try:
        with open(manifest_path, encoding="utf-8") as f:
            return json.load(f)
    except (json.JSONDecodeError, OSError):
        return None


def manifests_match(existing: dict, new_model: str, new_data_files: dict) -> bool:
    """기존 매니페스트와 신규 설정이 일치하는지 확인.

    일치 조건:
    - embedding_model 동일
    - data_files 키/값 동일 (파일 경로 + 해시)
    """
    if existing.get("embedding_model") != new_model:
        return False
    if existing.get("data_files") != new_data_files:
        return False
    return True
