FROM python:3.11-slim

ARG UID=1000
RUN useradd -u $UID -m app

RUN apt-get update && apt-get install -y --no-install-recommends \
        build-essential \
    && rm -rf /var/lib/apt/lists/*

# Install uv
RUN pip install --no-cache-dir uv

WORKDIR /app

COPY pyproject.toml ./
RUN uv sync

COPY src/ ./src/

USER app
