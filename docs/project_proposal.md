# 의약품·건강기능식품 RAG 챗봇 — 프로젝트 기획안

> **수업** 2026-1학기 빅데이터 자연어처리 기술
> **제출일** 2026-05-12 (화) 23:59
> **저장소** `pharmaceutical_agent/`

---

## 1. 프로젝트 주제

**「PillTalk」 — 한국어 의약품·건강기능식품 RAG 챗봇 에이전트**

식품의약품안전처(MFDS) 공개 데이터를 기반으로, 사용자 프로필(증상·복용 약·알레르기)을 반영한 **개인화된 의약품/건강기능식품 정보 응답** 을 스트리밍으로 제공하는 LLM 에이전트 서비스.

---

## 2. 프로젝트 배경 및 해결 과제

### 2.1 배경
- **셀프 메디케이션의 일상화** — 일반의약품/건기식 시장이 매년 성장하지만 소비자는 정보 비대칭에 노출
- **단편적 검색의 한계** — 약학정보원·식약처 사이트는 신뢰도는 높지만 자연어 질의(예: "공복에 이부프로펜 먹어도 되나?")에 부적합
- **범용 LLM의 위험성** — 환각(hallucination)으로 잘못된 복용 정보를 안내하면 의료 안전 사고 직결
- **개인화 부재** — 일반 LLM은 사용자의 알레르기·복용 중 약물·임신 여부 등 컨텍스트를 모름

### 2.2 해결 과제
| 과제 | 해결 접근 |
|---|---|
| 환각으로 인한 잘못된 약물 정보 안내 | **RAG** — MFDS 공식 데이터로 임베딩 인덱스 구축, 답변 시 반드시 출처(품목코드) 인용 |
| 위험 케이스(임산부·어린이·처방약) 노출 | **Safety Guardrails** — 키워드 트리거로 답변 중단 + 의료진 상담 권고 |
| 사용자 컨텍스트 미반영 | **개인화 프로필** — 알레르기·복용약 정보를 시스템 프롬프트에 동적 주입 |
| 의약품 정보의 빠른 변경(허가 변경 등) | **프롬프트 버전 관리** + Indexer 재실행 멱등성 — 운영자가 안전한 롤백·롤포워드 가능 |

---

## 3. 프로젝트 목표 및 범위

### 3.1 핵심 기능 정의

| # | 기능 | 설명 |
|---|---|---|
| F1 | **하이브리드 검색 도구** | `search_drugs` / `search_health_foods` / `search_all` 3종 LangChain Tool — LLM이 질문에 따라 자동 선택 |
| F2 | **2-stage Retrieval** | FAISS 후보 20건 → Cohere Reranker로 top-5 정제 (Cohere 실패 시 FAISS top-5 fallback) |
| F3 | **SSE 토큰 스트리밍** | `token` / `tool` / `done` / `error` 이벤트로 실시간 UX |
| F4 | **개인화 프로필 주입** | name/age/gender/symptoms/medications/allergies → 시스템 프롬프트에 동적 합성 |
| F5 | **세션 자동 제목 요약** | 첫 응답 + **5턴마다 재요약** (gpt-4o-mini, 8s timeout, fallback) |
| F6 | **Safety Guardrails** | 임산부·어린이·수술·처방 키워드 → 답변 중단 + 의료진 상담 권고 |
| F7 | **인증 & 권한** | 쿠키 기반 JWT, `user`/`admin` 분리 |
| F8 | **프롬프트 버전 관리(admin)** | 시스템 프롬프트 신규 버전 등록 + 활성 버전 PUT 토글 + 활성화 이력 |
| F9 | **OpenAPI 자동 문서** | FastAPI `/docs` (Swagger) `/redoc`, RESTful 경로, ErrorResponse 통일 |

### 3.2 MVP 범위 (5/12 ~ 6/13 까지)

**포함 (Must Have)**
- F1 ~ F8 모두 구현 완료 ✓ (현재 상태)
- 데이터: MFDS 의약품 + 건강기능식품 (`drugs.xlsx`, `health_functional_food.xlsx`)
- 평가용 테스트 쿼리셋 50건 작성 + 정량 평가
- 발표용 데모 시나리오 5종

**제외 (Out of Scope)**
- 처방전 OCR / 약 봉투 인식
- 음성 입력
- 모바일 네이티브 앱 (반응형 웹으로 대체)
- 다국어 (한국어 전용)
- 의료진/약사 라이선스 검증 — 어디까지나 정보 제공용

### 3.3 평가 기준

| 영역 | 평가 방법 |
|---|---|
| **검색 품질** | 50건 골드셋에 대한 Recall@5, MRR (자동 평가) |
| **답변 품질** | 50건에 대한 Likert 5점 human eval (관련성·정확성·안전성 3축) |
| **안전성** | 위험 키워드 15종 trigger rate (자동) |
| **성능** | p95 first-token latency, p95 full-response latency |
| **사용성** | SUS (System Usability Scale) 10문항 — 팀원 외부 5명 |

---

## 4. 시스템 아키텍처 / 서비스 시나리오

### 4.1 전체 구조

```
┌────────────────────┐        ┌────────────────────────────────────┐
│   Browser (Next)   │  HTTPS │            FastAPI Backend         │
│  /chat /prompts    │ ─────► │                                    │
│  SSE EventSource   │ ◄───── │  ┌──────────────────────────────┐  │
└────────────────────┘  text/ │  │  Auth (cookie JWT)           │  │
                        event │  │  Chat Orchestrator (SSE)     │  │
                        stream│  │  Prompt Mgmt (admin)         │  │
                              │  └──────────────────────────────┘  │
                              │                │                   │
                              │                ▼                   │
                              │  ┌──────────────────────────────┐  │
                              │  │  LangGraph ReAct Agent       │  │
                              │  │  GPT-4o-mini + 3 Tools       │  │
                              │  └──────────────────────────────┘  │
                              │                │                   │
                              │                ▼                   │
                              │  ┌─────────────┐  ┌─────────────┐  │
                              │  │  FAISS      │  │  Cohere     │  │
                              │  │  (in-mem)   │  │  Reranker   │  │
                              │  └─────────────┘  └─────────────┘  │
                              │                                    │
                              │  ┌──────────────────────────────┐  │
                              │  │  SQLite (users/sessions/     │  │
                              │  │  messages/prompts)           │  │
                              │  └──────────────────────────────┘  │
                              └────────────────────────────────────┘
                                            ▲
                                            │ (배치, 멱등)
                              ┌─────────────┴──────────────┐
                              │       Indexer Service      │
                              │  xlsx → chunks → OpenAI    │
                              │  Embedding (3072d) → FAISS │
                              └────────────────────────────┘
```

### 4.2 시나리오: 사용자가 "타이레놀 복용 간격" 질문

1. 로그인 사용자가 입력창에 질문 입력 → `POST /chat/sessions/{sid}/messages` (SSE)
2. Orchestrator가 user 메시지 저장 + 활성 시스템 프롬프트 + 사용자 프로필 합성
3. LangGraph ReAct 에이전트가 `search_drugs("타이레놀 복용 간격")` Tool 자동 호출
4. FAISS top-20 검색 → Cohere rerank top-5 → 메타(품목코드, 이미지URL) 포함하여 LLM 컨텍스트 주입
5. LLM이 답변 토큰 생성 → 백엔드가 `token` 이벤트로 즉시 스트림
6. 답변 완료 → assistant 메시지 저장 → 첫 응답이면 자동 제목 생성 → `done` 이벤트
7. 프론트는 토큰 누적 + 사이드바 자동 새로고침

### 4.3 기술 스택

| 레이어 | 기술 |
|---|---|
| **프론트엔드** | Next.js 15 (App Router), React 19, TypeScript, TailwindCSS, shadcn/ui, lucide-react |
| **백엔드** | Python 3.11, FastAPI, SQLAlchemy 2 + Alembic, sse-starlette, pydantic v2 |
| **LLM 오케스트레이션** | LangChain, LangGraph (ReAct), langchain-openai |
| **RAG** | OpenAI `text-embedding-3-large` (3072d), FAISS (CPU), Cohere `rerank-v3.5` |
| **모델** | OpenAI `gpt-4o-mini` (기본), 시스템 프롬프트 DB-versioned |
| **인증** | bcrypt, PyJWT, HTTPOnly cookie session |
| **데이터** | SQLite (개발), MFDS 공개 xlsx |
| **인프라** | Docker Compose, uv (Python deps), Watchfiles 핫리로드 |
| **API 문서** | OpenAPI 3.1 자동 생성 (`/docs`, `/redoc`), 한국어 description |


---

## 6. R&R (Roles & Responsibilities)

TBD

---

## 7. 정량 지표 (KPI)

### 7.1 검색·답변 품질

| 지표 | 측정 방식 | **목표** | 베이스라인 |
|---|---|---|---|
| **Recall@5** | 50건 골드셋, top-5 안에 정답 문서 포함 비율 | **≥ 0.85** | FAISS only ≈ 0.70 |
| **MRR (Mean Reciprocal Rank)** | 정답 문서의 첫 등장 역순위 평균 | **≥ 0.75** | FAISS only ≈ 0.55 |
| **답변 정확성 (human eval)** | 5점 Likert × 50건 평균, 약사 1인 검증 | **≥ 4.2 / 5.0** | — |
| **출처 인용률** | 답변 내 품목코드 1개 이상 포함 비율 | **≥ 95%** | — |

### 7.2 안전성

| 지표 | 측정 방식 | **목표** |
|---|---|---|
| **위험 키워드 차단률** | 임산부·어린이·수술·처방 등 15종 키워드 테스트 케이스 | **100%** |
| **할루시네이션 케이스 발생** | 검색 결과 외 품목 언급 (50건 검토) | **≤ 5%** |
| **PII 누설** | 다른 사용자 프로필 정보 응답에 등장 (cross-session) | **0건** |

### 7.3 성능 / UX

| 지표 | 측정 방식 | **목표** |
|---|---|---|
| **First-token latency (p95)** | SSE 첫 token까지 wall-clock | **< 2.0 s** |
| **Full-response latency (p95)** | `done` 이벤트까지 wall-clock | **< 8.0 s** |
| **SUS (System Usability Scale)** | 외부 5명 × 10문항 표준 SUS | **≥ 75 / 100** |
| **세션 자동 제목 사용성** | 5점 Likert (관련성) | **≥ 4.0 / 5.0** |

### 7.4 운영 / 비용

| 지표 | 측정 방식 | **목표** |
|---|---|---|
| **OpenAI 비용 (1k query)** | 임베딩 + 추론 토큰 합산 | **< $1.50** |
| **백엔드 가용성 (개발 기간)** | uptime % | **≥ 99%** |
| **인덱서 멱등성** | 같은 입력으로 2회 실행 시 0 토큰 소비 | **100% 만족** |

---

## 8. 위험 요소 및 대응

| 위험 | 대응 |
|---|---|
| OpenAI 비용 초과 | gpt-4o-mini 고정, max_tokens 제한, 캐싱 도입 검토 |
| Cohere API 장애 | FAISS top-5 자동 fallback (구현 완료) |
| MFDS 데이터 라이선스 이슈 | 출처 명시, 학술/교육 목적임을 README·UI에 표기 |
| 의료 안전 사고 | UI/응답에 "정보 제공용, 진단·처방 아님" 면책 고지 상시 표시 |
