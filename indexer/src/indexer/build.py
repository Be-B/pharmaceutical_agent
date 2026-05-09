"""FAISS 인덱스 빌더.

경고: 이 스크립트는 OpenAI 임베딩 비용 $5~25를 발생시킵니다.
전체 실행 전에 반드시 --sample 100 모드로 100행만 먼저 검증하세요.

사용 예:
    # 샘플 검증 (소액 비용)
    python -m indexer.build --sample 100

    # 전체 인덱싱 (비용 발생)
    python -m indexer.build

    # 강제 재빌드 (기존 인덱스 무시)
    python -m indexer.build --rebuild
"""

from __future__ import annotations

import math
import os
import random
import shutil
import time

from tqdm import tqdm

from .document import to_drug_document, to_hff_document
from .load import load_drugs, load_hff
from .manifest import (
    compute_data_hash,
    manifests_match,
    read_manifest,
    slug,
    write_manifest,
)

# 비용 상수: text-embedding-3-large 기준 (2024년 기준)
_COST_PER_1M_TOKENS = 0.13
_BATCH_SIZE = 100
_RETRY_MAX = 3
_RETRY_BASE_SLEEP = 2.0  # seconds

# 데이터 파일 경로 (build.py 기준 3단계 위 = 프로젝트 root)
# 환경변수로 오버라이드 가능 (Docker /app/data 마운트 등)
_PROJECT_ROOT = os.environ.get(
    "PROJECT_ROOT",
    os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "..")),
)
_DATA_DIR = os.environ.get("DATA_DIR", os.path.join(_PROJECT_ROOT, "data"))
_DRUG_XLSX = os.path.join(_DATA_DIR, "drugs.xlsx")
_HFF_XLSX = os.path.join(_DATA_DIR, "health_functional_food.xlsx")
_VAR_FAISS = os.environ.get("VAR_FAISS", os.path.join(_PROJECT_ROOT, "var", "faiss"))


def _embed_with_retry(embeddings, texts: list[str]) -> list[list[float]]:
    """배치 임베딩 요청, 실패 시 exponential backoff 재시도."""
    for attempt in range(1, _RETRY_MAX + 1):
        try:
            return embeddings.embed_documents(texts)
        except Exception as exc:
            if attempt == _RETRY_MAX:
                raise
            sleep_sec = _RETRY_BASE_SLEEP * (2 ** (attempt - 1))
            print(f"[retry {attempt}/{_RETRY_MAX}] 임베딩 실패: {exc}. {sleep_sec:.1f}s 후 재시도...")
            time.sleep(sleep_sec)
    raise RuntimeError("unreachable")


def _estimate_tokens(docs: list) -> int:
    """doc list의 총 토큰 수 추정 (4자당 1토큰 근사)."""
    total_chars = sum(len(d.page_content) for d in docs)
    return math.ceil(total_chars / 4)


def _atomic_replace(src: str, dst: str) -> None:
    """src 디렉터리를 dst로 atomic 교체 (기존 dst 제거 후 rename)."""
    if os.path.exists(dst):
        shutil.rmtree(dst)
    os.replace(src, dst)


# 고정 인덱스 디렉토리 이름 (manifest가 model+data_hash 추적)
_INDEX_DIR_NAME = "index"


def main(rebuild: bool = False, sample_size: int | None = None) -> None:
    """FAISS 인덱스 빌드 진입점.

    Args:
        rebuild: True면 기존 인덱스가 있어도 강제 재빌드
        sample_size: 지정 시 해당 행 수만 샘플링 (spike / 비용 검증용)
    """
    # 1. 환경 변수 로드
    api_key = os.environ.get("OPENAI_API_KEY")
    if not api_key:
        raise EnvironmentError("OPENAI_API_KEY 환경 변수가 설정되지 않았습니다.")
    embedding_model = os.environ.get("EMBEDDING_MODEL", "text-embedding-3-large")

    # 2. 데이터 파일 해시 계산
    data_file_paths = [_DRUG_XLSX, _HFF_XLSX]
    data_hash = compute_data_hash(data_file_paths)

    # data_files: {경로: 해시} 매핑 (manifest 비교용)
    import hashlib

    def _file_sha256(path: str) -> str:
        h = hashlib.sha256()
        with open(path, "rb") as f:
            for chunk in iter(lambda: f.read(65536), b""):
                h.update(chunk)
        return h.hexdigest()

    data_files = {p: _file_sha256(p) for p in data_file_paths}

    faiss_dir = os.path.realpath(_VAR_FAISS)
    index_dir = os.path.join(faiss_dir, _INDEX_DIR_NAME)
    tmp_dir = index_dir + "_tmp"

    # 3. manifest 확인 → skip (model 또는 data_files 변경 시 재빌드)
    if not rebuild:
        existing = read_manifest(index_dir)
        if existing and manifests_match(existing, embedding_model, data_files):
            print(f"[skip] 인덱스가 최신 상태입니다: {index_dir}")
            return

    # 4. 데이터 로드
    print("[load] 의약품 데이터 로딩...")
    drug_rows, drug_skipped = load_drugs(_DRUG_XLSX)
    print(f"  의약품: {len(drug_rows)}행 로드, {drug_skipped}행 스킵")

    print("[load] 건강기능식품 데이터 로딩...")
    hff_rows, hff_skipped = load_hff(_HFF_XLSX)
    print(f"  건강기능식품: {len(hff_rows)}행 로드, {hff_skipped}행 스킵")

    # 5. Document 변환
    all_docs = [to_drug_document(r) for r in drug_rows] + [to_hff_document(r) for r in hff_rows]

    # 6. 샘플 모드
    if sample_size is not None and sample_size < len(all_docs):
        print(f"[sample] {len(all_docs)}건 중 {sample_size}건만 샘플링")
        all_docs = random.sample(all_docs, sample_size)

    total_docs = len(all_docs)
    print(f"[build] 총 {total_docs}개 문서 임베딩 시작 (모델: {embedding_model})")

    # 비용 예상
    est_tokens = _estimate_tokens(all_docs)
    est_cost = est_tokens / 1_000_000 * _COST_PER_1M_TOKENS
    print(f"[cost] 예상 토큰: {est_tokens:,} → 예상 비용: ${est_cost:.4f}")

    # 7. 임베딩 + FAISS 빌드
    from langchain_community.vectorstores import FAISS
    from langchain_openai import OpenAIEmbeddings

    embeddings = OpenAIEmbeddings(model=embedding_model, openai_api_key=api_key)

    os.makedirs(tmp_dir, exist_ok=True)

    # 첫 배치로 FAISS 초기화, 이후 배치는 merge
    vectorstore = None
    batches = [all_docs[i : i + _BATCH_SIZE] for i in range(0, total_docs, _BATCH_SIZE)]

    for batch in tqdm(batches, desc="임베딩 배치", unit="batch"):
        texts = [d.page_content for d in batch]
        vectors = _embed_with_retry(embeddings, texts)

        text_embedding_pairs = list(zip(texts, vectors))
        metadatas = [d.metadata for d in batch]

        if vectorstore is None:
            vectorstore = FAISS.from_embeddings(
                text_embeddings=text_embedding_pairs,
                embedding=embeddings,
                metadatas=metadatas,
            )
        else:
            vectorstore.add_embeddings(
                text_embeddings=text_embedding_pairs,
                metadatas=metadatas,
            )

    if vectorstore is None:
        raise RuntimeError("인덱싱할 문서가 없습니다.")

    # 8. tmp에 저장
    vectorstore.save_local(tmp_dir)

    # 9. 실제 비용 계산 (토큰 기반 추정)
    actual_cost = est_cost

    # 10. atomic rename: tmp → index_dir
    _atomic_replace(tmp_dir, index_dir)

    # 11. manifest 작성
    write_manifest(
        dir_path=index_dir,
        embedding_model=embedding_model,
        data_files=data_files,
        doc_count=total_docs,
        openai_cost_usd=actual_cost,
    )

    print(f"[done] 인덱스 완료: {index_dir}")
    print(f"[done] 문서 수: {total_docs}, 추정 비용: ${actual_cost:.4f}")


if __name__ == "__main__":
    import argparse

    parser = argparse.ArgumentParser(description="FAISS 인덱스 빌더")
    parser.add_argument(
        "--rebuild",
        action="store_true",
        help="기존 인덱스가 있어도 강제 재빌드",
    )
    parser.add_argument(
        "--sample",
        type=int,
        default=None,
        metavar="N",
        help="N행만 샘플링 (비용 검증용). 예: --sample 100",
    )
    args = parser.parse_args()
    main(rebuild=args.rebuild, sample_size=args.sample)
