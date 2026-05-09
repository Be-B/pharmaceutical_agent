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
