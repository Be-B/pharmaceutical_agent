from pydantic import BaseModel, Field


class ErrorResponse(BaseModel):
    """모든 4xx/5xx 응답에서 사용하는 공통 에러 스키마."""

    detail: str = Field(..., description="사람이 읽을 수 있는 에러 메시지", examples=["인증이 필요합니다"])


def err(status: int, description: str) -> dict:
    """OpenAPI `responses=` 항목을 한 줄로 만들기 위한 헬퍼."""
    return {status: {"model": ErrorResponse, "description": description}}


# 자주 쓰는 응답 묶음
UNAUTHORIZED = err(401, "인증되지 않았거나 세션이 만료되었습니다")
FORBIDDEN = err(403, "권한이 없습니다")
NOT_FOUND = err(404, "리소스를 찾을 수 없습니다")
CONFLICT = err(409, "리소스 충돌 (중복 등)")
BAD_REQUEST = err(400, "잘못된 요청 본문 또는 파라미터")
