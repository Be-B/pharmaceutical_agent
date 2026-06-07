from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    OPENAI_API_KEY: str
    COHERE_API_KEY: str | None = None
    COHERE_RERANK_MODEL: str = "rerank-v3.5"
    EMBEDDING_MODEL: str = "text-embedding-3-large"
    DEFAULT_LLM_MODEL: str = "gpt-5.4-mini"
    JWT_SECRET: str
    JWT_ALGORITHM: str = "HS256"
    # HTTP 환경(로컬 개발/HTTP 서버)에선 False, HTTPS 프로덕션에선 True
    COOKIE_SECURE: bool = False
    BOOTSTRAP_ADMIN_EMAIL: str
    BOOTSTRAP_ADMIN_PASSWORD: str
    CORS_ALLOW_ORIGINS: str = "http://localhost:3000"
    SUPP_AI_BASE_URL: str = "https://supp.ai/api"
    SUPP_AI_TIMEOUT: float = 10.0
    SUPP_AI_MAX_EVIDENCE: int = 5
    DATABASE_URL: str = "sqlite:///./var/app.db"

    # Langfuse 관측(tracing) — 키 둘 다 있을 때만 활성. 미설정 시 트레이싱 비활성.
    LANGFUSE_PUBLIC_KEY: str | None = None
    LANGFUSE_SECRET_KEY: str | None = None
    LANGFUSE_BASE_URL: str = "https://cloud.langfuse.com"

    model_config = SettingsConfigDict(env_file=".env", extra="ignore")


settings = Settings()
