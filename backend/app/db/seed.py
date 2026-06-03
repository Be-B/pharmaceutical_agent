from datetime import datetime

from sqlalchemy.orm import Session as DBSession

from ..config import settings
from ..auth.service import hash_password, verify_password
from .models import User, UserRole, Prompt, PromptVersion

SYSTEM_PROMPT_V1 = """당신은 한국어 의약품/건강기능식품 정보 도우미입니다.

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
- 검색 결과(tool 응답)에 image_url 값이 있으면 답변에 `![제품명](image_url)` 형식의 마크다운 이미지를 포함하세요. image_url이 비어있거나 null이면 절대 추가하지 마세요."""

SYSTEM_PROMPT_V2 = SYSTEM_PROMPT_V1 + """

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
supp.ai에는 약물-약물 상호작용 데이터가 없습니다. 약물끼리의 병용 질문에는 supp 도구를 호출하지 말고 "현재 약물-약물 상호작용 정보는 제공하지 않습니다. 약사 또는 의료진과 상담하세요"라고 안내하세요."""


def seed_initial_data(db: DBSession) -> None:
    # 1. admin user — .env 의 BOOTSTRAP_ADMIN_* 를 매 startup마다 force-sync.
    #    누군가 DB에서 비번/role 을 바꿨더라도 .env 값으로 되돌립니다 (개발 편의).
    admin = db.query(User).filter_by(email=settings.BOOTSTRAP_ADMIN_EMAIL).first()
    if not admin:
        admin = User(
            email=settings.BOOTSTRAP_ADMIN_EMAIL,
            password_hash=hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD),
            role=UserRole.admin,
            pii_consent_at=datetime.utcnow(),
        )
        db.add(admin)
        db.commit()
        db.refresh(admin)
    else:
        changed = False
        if admin.role != UserRole.admin:
            admin.role = UserRole.admin
            changed = True
        if not verify_password(settings.BOOTSTRAP_ADMIN_PASSWORD, admin.password_hash):
            admin.password_hash = hash_password(settings.BOOTSTRAP_ADMIN_PASSWORD)
            changed = True
        if changed:
            db.commit()
            db.refresh(admin)

    # 2. system.chat prompt + v1 (idempotent)
    prompt = db.query(Prompt).filter_by(key="system.chat").first()
    if not prompt:
        prompt = Prompt(key="system.chat", description="채팅 시스템 프롬프트")
        db.add(prompt)
        db.commit()
        db.refresh(prompt)

    has_v1 = db.query(PromptVersion).filter_by(prompt_id=prompt.id, version_number=1).first()
    if not has_v1:
        v1 = PromptVersion(
            prompt_id=prompt.id,
            version_number=1,
            content=SYSTEM_PROMPT_V1,
            model=None,
            temperature=0.2,
            is_active=True,
            created_by=admin.id,
        )
        db.add(v1)
        db.commit()

    # 3. system.chat v2 — supp.ai 상호작용 지침 추가. v2를 활성화하고 v1은 롤백용 보존.
    from ..prompts.service import activate_version  # 순환 import 방지: 지연 import

    has_v2 = db.query(PromptVersion).filter_by(prompt_id=prompt.id, version_number=2).first()
    if not has_v2:
        v2 = PromptVersion(
            prompt_id=prompt.id,
            version_number=2,
            content=SYSTEM_PROMPT_V2,
            model=None,
            temperature=0.2,
            is_active=False,
            created_by=admin.id,
        )
        db.add(v2)
        db.commit()
        activate_version(db, prompt.id, 2, admin.id)
