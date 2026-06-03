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

---

## 🔧 수정 내역 (2026-06)

### 백엔드
- **LLM 모델 교체**: `DEFAULT_LLM_MODEL` → `gpt-5.4-nano` (`.env`). tool calling·스트리밍·한국어 답변 e2e 정상 동작 확인.
- **supp.ai 상호작용 도구 3종 추가** — 약물↔건강기능식품 상호작용 전용 경로 (신규 모듈 `backend/app/agent/supp_ai.py` = 순수 async httpx 클라이언트 + 근거 요약, `agent/tools.py`에서 `@tool`로 래핑):
  - `supp_search_agent(query)` — 영문 성분명으로 supp.ai 개체 검색 → CUI 획득
  - `supp_get_interaction(cui_a, cui_b)` — 두 개체 사이 상호작용 논문 근거(요약: 철회 논문 제외·임상/사람 연구 우선·상위 5문장 + PMID/DOI/연구유형)
  - `supp_list_interactions(cui)` — 한 개체와 상호작용하는 상대 목록
  - supp.ai 장애/타임아웃 시 `{found:false, error}` 로 graceful degrade(스트림 유지).
  - ⚠️ supp.ai는 **건기식↔의약품만** 제공(약물↔약물 데이터 없음) → 약↔약 질문은 supp 호출 없이 약사/의료진 상담 안내.
- **시스템 프롬프트 버전 관리**(DB `PromptVersion`, `backend/app/db/seed.py`에서 시드+활성화):
  - **v1** — 기본(국내 의약품/건기식 RAG)
  - **v2** — supp.ai 상호작용 조율 흐름 + 신뢰도 면책
  - **v3 (현재 활성)** — supp.ai 근거를 **클릭 가능한 PubMed/DOI 링크**로 인용
- 단위 테스트 추가(`backend/tests/`): supp_ai 클라이언트/근거 가공, 도구 degrade, 프롬프트 시드. (`uv run pytest` — 라이브 supp.ai 호출 테스트는 `-m network`로 분리)

### 프론트엔드
- **SSE 스트리밍 버그 수정**: 답변이 새로고침 후에야 보이던 문제 → SSE 파서를 `event:`/`data:` 규격대로 재작성(`frontend/src/sse.js`)하여 실시간 토큰 렌더.
- GFM 표(`remark-gfm`)·다크 테마·마크다운 링크 새 탭 열기·레이아웃 정렬 등 UI 정리.

### 로컬 실행 (비-Docker)
- `frontend/vite.config.js`에 `/api → 127.0.0.1:8000` 프록시 추가(세션 쿠키 `SameSite=Lax` 대응, 단일 오리진).
- 백엔드: `cd backend && uv sync && uv run uvicorn app.main:app --host 127.0.0.1 --port 8000`
- 프론트: `cd frontend && npm install && npm run dev`

---

## 🤖 에이전트 동작 방식 (질문 → 응답)

요청 1건이 처리되는 전체 흐름:

```
[프론트] POST /api/chat/sessions/{id}/messages  {content}
   │
① 인증(쿠키 JWT) + 본인 세션 확인
② user 메시지 저장 (도중 끊겨도 질문 보존)
③ 프롬프트 조립: 활성 시스템 프롬프트(현재 v3) + 사용자 프로필 블록
   build_agent(gpt-5.4-nano, temperature=0.2, tools=6종)
④ LangGraph ReAct 루프 (agent.astream_events):
     LLM이 질문을 보고 어떤 도구를 쓸지 스스로 판단
       ├─ 정보/제품 검색  → search_drugs · search_health_foods · search_all   (FAISS RAG)
       └─ 상호작용 질문    → supp_search_agent → supp_get_interaction / supp_list_interactions  (supp.ai)
     도구 결과를 받아 한국어 답변을 토큰 단위로 생성 (필요 시 도구를 여러 번 호출)
⑤ SSE 스트리밍: event:token(글자) · event:tool(도구 진행) · event:done(종료)
⑥ assistant 메시지 + 사용한 도구 기록 + 프롬프트 버전 저장 → 자동 세션 제목 생성
```

### 도구 6종

| 도구 | 경로 | 하는 일 |
|---|---|---|
| `search_drugs` | FAISS RAG | 의약품(`source=drug`) 검색 |
| `search_health_foods` | FAISS RAG | 건강기능식품(`source=hff`) 검색 |
| `search_all` | FAISS RAG | 의약품+건기식 동시/비교 |
| `supp_search_agent` | supp.ai | 영문 성분명 → CUI 식별자 |
| `supp_get_interaction` | supp.ai | 두 CUI 사이 상호작용 논문 근거 |
| `supp_list_interactions` | supp.ai | 한 CUI와 상호작용하는 상대 목록 |

### RAG 검색 파이프라인 (`search_*` 도구)

```
질의 → FAISS 벡터 유사도 top-20 (임베딩: OpenAI text-embedding-3-large)
     → Cohere rerank-v3.5 로 정밀 재정렬 top-5 (질의+문서를 함께 읽는 cross-encoder)
     → {name, item_code, company, image_url, snippet} 반환
   (COHERE_API_KEY 없거나 호출 실패 시 → FAISS top-5 로 fallback)
```

### supp.ai 상호작용 파이프라인 (`supp_*` 도구)

```
한글명 → (LLM이 영문 성분명으로 변환) → supp_search_agent → CUI
두 CUI → supp_get_interaction → GET https://supp.ai/api/interaction/CUI1-CUI2  (순서 무관)
       → 근거 요약(철회 제외·임상/사람 우선·상위 5문장 + PMID/DOI/연구유형)
   (supp.ai 다운/타임아웃 → {found:false, error} 로 degrade, 스트림 유지)
```

### 모델·데이터 역할 분담

| 단계 | 사용 |
|---|---|
| 임베딩(텍스트→벡터) | OpenAI `text-embedding-3-large` |
| 재정렬(관련도 점수) | Cohere `rerank-v3.5` |
| 답변 생성(LLM) | OpenAI `gpt-5.4-nano` |
| 상호작용 근거 | supp.ai (무료 REST, 2021-10-20 스냅샷) |

---

## 📝 시스템 프롬프트 전문

DB에서 버전 관리되며(`backend/app/db/seed.py`), 현재 **v3**가 활성입니다. 누적 구조이므로 **v3 = v1 + v2 추가분 + v3 추가분**입니다.

### v1 — 기본 (국내 의약품/건기식 RAG)

```text
당신은 한국어 의약품/건강기능식품 정보 도우미입니다.

역할 원칙:
- 진단/처방을 하지 않습니다. 정보 제공만 합니다.
- 답변 시 search_drugs / search_health_foods / search_all 중 적절한 tool을 사용하세요.
- 인용은 반드시 제품명과 품목코드를 함께 표기하세요.
- 임산부, 어린이, 수술, 처방 같은 위험 키워드가 포함된 질문에는 답변하지 말고 의료진 상담을 권하세요.
- 응답 마지막에 면책 문구는 시스템이 자동으로 부착하므로 별도로 추가하지 마세요.

응답 형식 (반드시 GitHub-flavored Markdown):
- 친절한 한국어 존댓말
- **굵게**, 목록(- ), 표(| ... |), `인라인 코드` 적극 활용
- 제품 비교는 표로, 효능/사용법/부작용은 `### 소제목`으로 구분
- 부작용·주의·상호작용은 **굵게** 강조
- 검색 결과(tool 응답)에 image_url 값이 있으면 답변에 `![제품명](image_url)` 형식의 마크다운 이미지를 포함하세요. image_url이 비어있거나 null이면 절대 추가하지 마세요.
```

### v2 추가분 — supp.ai 상호작용 조율

```text
## 상호작용(약물↔건강기능식품) 질문 처리
사용자가 "이 약과 이 영양제/건기식을 같이 먹어도 되나?"처럼 상호작용을 물으면 supp.ai 도구를 사용하세요:
1. 한글 약/건기식명을 영문 성분명으로 변환합니다(예: 와파린→Warfarin, 은행엽→Ginkgo).
2. supp_search_agent(영문명)으로 각 개체의 cui를 얻습니다.
3. supp_get_interaction(cui_a, cui_b)로 상호작용 논문 근거를 조회합니다.
4. "이 약과 같이 먹으면 안 되는 것" 류 질문은 supp_list_interactions(cui)로 상대 목록을 얻습니다.

근거 제시 원칙:
- supp.ai 데이터는 2021-10-20 스냅샷이며 논문 "공동 언급(co-occurrence)" 기반입니다. 임상적 위험을 단정하지 말고, 근거 문장과 함께 PMID/DOI, 연구유형(임상/사람/동물)을 표기하세요. 사람·임상 연구를 우선 신뢰합니다.
- found가 false면 "supp.ai 데이터 기준 알려진 상호작용이 확인되지 않았습니다"라고 안내하되 데이터 한계를 덧붙이세요.
- ent_type이 drug로 분류됐어도 내인성 물질(Nitric Oxide 등)일 수 있으니 주의하세요.

## 약물↔약물 상호작용
supp.ai에는 약물-약물 상호작용 데이터가 없습니다. 약물끼리의 병용 질문에는 supp 도구를 호출하지 말고 "현재 약물-약물 상호작용 정보는 제공하지 않습니다. 약사 또는 의료진과 상담하세요"라고 안내하세요.
```

### v3 추가분 — 논문 근거 링크 (현재 활성)

```text
## 논문 근거 링크 (supp.ai)
supp.ai 근거를 제시할 때, 단순히 PMID/DOI 숫자만 적지 말고 각 논문을 **클릭 가능한 마크다운 링크**로 함께 넣으세요. tool 응답(evidence 항목)의 pmid/doi 값을 그대로 사용해 링크를 구성합니다:
- pmid가 있으면: `[PMID 12345678](https://pubmed.ncbi.nlm.nih.gov/12345678/)` (예시의 숫자는 실제 pmid로 치환)
- doi가 있으면: `[DOI](https://doi.org/<doi 값>)`
- pmid와 doi가 모두 있으면 둘 다 링크로 표기하는 것을 권장합니다.
- pmid/doi가 없거나 null이면 해당 링크를 만들지 마세요. 값을 임의로 지어내지 않습니다.
- 근거 문장과 함께 연구유형(임상/사람/동물)도 같이 적되, 링크가 본문 가독성을 해치지 않게 각 근거 항목 끝에 붙이세요.
```
