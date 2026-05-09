# 의약품/건강기능식품 RAG 챗봇

OpenAI Embeddings + FAISS + Cohere Reranker 기반으로 한국어 의약품 및 건강기능식품 정보를 검색·제공하는 RAG 채팅 애플리케이션입니다. **정보 제공 목적**으로만 사용합니다.

---

## 의료 면책 고지 (Medical Disclaimer)

> **본 앱은 정보 제공용이며, 진단·처방을 대신하지 않습니다.
> 의료 결정은 반드시 의료진과 상담하세요.**

---

## 데이터 출처

- `data/drugs.xlsx` — 의약품 정보 (식품의약품안전처(MFDS) 공개 데이터로 추정, **사용자 확인 필요**)
- `data/health_functional_food.xlsx` — 건강기능식품 정보 (식품의약품안전처 공개 데이터로 추정, **사용자 확인 필요**)

데이터 출처 라이선스는 사용 전 직접 확인 후 README를 갱신해 주세요.

---

## PII 정책

사용자가 채팅창에 입력한 증상·질문 등은 **서버 로컬 SQLite(`var/app.db`)에 저장**됩니다.
학기 종료 후 또는 더 이상 사용하지 않을 때 `var/` 디렉토리를 삭제하는 것을 권장합니다.
데이터는 학습·교육 목적으로만 사용되며 외부로 전송되지 않습니다.

---

## 설치 및 실행

### 사전 요구사항

- Docker + Docker Compose v2
- `.env` 파일 (아래 Step 1 참고)

### Step 1 — 환경 변수 설정

```bash
cp .env.example .env
# OPENAI_API_KEY, COHERE_API_KEY, JWT_SECRET, 관리자 계정 등 채워넣기
vi .env
```

### Step 2 — 데이터 인덱싱 (최초 1회, $5–25 비용 발생)

```bash
docker compose --profile indexing run --rm indexer python -m indexer.build
```

> 인덱스는 `var/faiss/` 에 저장되며, 데이터·모델이 변경되지 않으면 재실행 시 자동 skip됩니다.

### Step 3 — 서비스 시작

```bash
docker compose up
```

- Frontend: http://localhost:3000
- Backend API (Swagger): http://localhost:8000/docs
