FROM python:3.11-slim

ARG UID=1000
RUN useradd -u $UID -m app

RUN pip install --no-cache-dir uv

WORKDIR /app

COPY pyproject.toml .
RUN uv sync

COPY alembic.ini .
COPY alembic ./alembic
COPY app ./app

USER app

CMD ["uv", "run", "uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
