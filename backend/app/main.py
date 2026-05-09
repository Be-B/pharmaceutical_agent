import logging
import os
from contextlib import asynccontextmanager

from fastapi import FastAPI

# 앱 로거를 INFO 레벨로 보이게 (uvicorn은 기본으로 app 로거 INFO 출력 안 함).
# force=True 로 uvicorn 이전 핸들러를 덮어써서 즉시 적용.
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s: %(message)s",
    force=True,
)
from fastapi.middleware.cors import CORSMiddleware
from alembic import command
from alembic.config import Config as AlembicConfig

from .config import settings
from .db.base import SessionLocal
from .db.seed import seed_initial_data
from .auth.routes import router as auth_router
from .chat.routes import router as chat_router
from .prompts.routes import router as prompts_router


def _run_migrations() -> None:
    """alembic upgrade head 프로그램틱 실행."""
    cfg = AlembicConfig("alembic.ini")
    cfg.set_main_option("sqlalchemy.url", settings.DATABASE_URL)
    command.upgrade(cfg, "head")


@asynccontextmanager
async def lifespan(app: FastAPI):
    db_path = settings.DATABASE_URL.replace("sqlite:///", "")
    db_dir = os.path.dirname(db_path)
    if db_dir:
        os.makedirs(db_dir, exist_ok=True)
    _run_migrations()
    db = SessionLocal()
    try:
        seed_initial_data(db)
    finally:
        db.close()
    yield


API_DESCRIPTION = """
의약품 RAG 챗봇 백엔드 API입니다.

## 인증
- 쿠키 기반 세션(`session` 쿠키, HTTPOnly).
- `POST /auth/register` 또는 `POST /auth/login` 성공 시 자동으로 쿠키가 설정됩니다.
- 모든 보호된 엔드포인트는 이 쿠키를 자동 포함합니다(`credentials: "include"`).

## 권한
- `user` — 일반 사용자: 채팅, 본인 프로필 조회/수정.
- `admin` — 관리자: 위 모든 권한 + 프롬프트 생성/버전 관리/활성화.

## 채팅 스트리밍
- `POST /chat/sessions/{session_id}/messages`는 `text/event-stream` (SSE)으로 응답합니다.
- 이벤트 종류: `token`, `tool`, `done`, `error`.
"""

OPENAPI_TAGS = [
    {
        "name": "auth",
        "description": "회원가입 / 로그인 / 로그아웃 / 본인 프로필 조회·수정.",
    },
    {
        "name": "chat",
        "description": "대화 세션 생성·조회 및 메시지 전송(SSE 스트리밍).",
    },
    {
        "name": "prompts",
        "description": "시스템 프롬프트 및 버전 관리. 일부는 admin 전용.",
    },
    {
        "name": "system",
        "description": "헬스체크 등 인프라용 엔드포인트.",
    },
]


app = FastAPI(
    title="Pharmaceutical RAG Chat API",
    description=API_DESCRIPTION,
    version="1.0.0",
    openapi_tags=OPENAPI_TAGS,
    lifespan=lifespan,
    docs_url="/docs",
    redoc_url="/redoc",
    openapi_url="/openapi.json",
    swagger_ui_parameters={
        "docExpansion": "list",
        "defaultModelsExpandDepth": 1,
        "displayRequestDuration": True,
        "filter": True,
        "tryItOutEnabled": True,
    },
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.CORS_ALLOW_ORIGINS.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth_router, prefix="/auth", tags=["auth"])
app.include_router(chat_router, prefix="/chat", tags=["chat"])
app.include_router(prompts_router, prefix="/prompts", tags=["prompts"])


@app.get(
    "/healthz",
    tags=["system"],
    summary="헬스체크",
    description="서버가 살아있는지 확인합니다. 배포·로드밸런서 헬스 프로브용.",
    responses={200: {"content": {"application/json": {"example": {"status": "ok"}}}}},
)
def healthz():
    return {"status": "ok"}
