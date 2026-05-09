from pydantic import BaseModel, Field
from datetime import datetime


class PromptCreate(BaseModel):
    key: str = Field(..., description="프롬프트 식별 키 (고유)", examples=["system_main"])
    description: str = Field("", description="프롬프트 용도 설명")


class VersionCreate(BaseModel):
    content: str = Field(..., description="프롬프트 본문")
    model: str | None = Field(None, description="이 버전에서 사용할 모델 ID. 미지정 시 서비스 기본값", examples=["gpt-4o-mini"])
    temperature: float | None = Field(None, ge=0, le=2, description="샘플링 온도 (0.0 ~ 2.0). 미지정 시 모델 기본값")


class ActivateVersionRequest(BaseModel):
    """`PUT /prompts/{key}/active-version` 요청 본문."""

    version_number: int = Field(..., ge=1, description="활성화할 버전 번호 (1부터 시작)")


class VersionPublic(BaseModel):
    id: int
    version_number: int
    content: str
    model: str | None
    temperature: float | None
    is_active: bool
    created_by: int | None
    created_at: datetime


class PromptPublic(BaseModel):
    id: int
    key: str
    description: str
    created_at: datetime
    versions: list[VersionPublic] = []


class ActivationPublic(BaseModel):
    id: int
    prompt_version_id: int
    version_number: int
    activated_by: int | None
    activated_by_email: str | None
    activated_at: datetime
    deactivated_at: datetime | None
