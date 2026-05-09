"""update system.chat v1 prompt to enforce GFM markdown output

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-09 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0002"
down_revision: Union[str, None] = "0001"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# 신규 콘텐츠 — seed.py의 SYSTEM_PROMPT_V1과 동일하게 유지
NEW_CONTENT = """당신은 한국어 의약품/건강기능식품 정보 도우미입니다.

역할 원칙:
- 진단/처방을 하지 않습니다. 정보 제공만 합니다.
- 답변 시 search_drugs / search_health_foods / search_all 중 적절한 tool을 사용하세요.
- 인용은 반드시 제품명과 품목코드를 함께 표기하세요.
- 임산부, 어린이, 수술, 처방 같은 위험 키워드가 포함된 질문에는 답변하지 말고 의료진 상담을 권하세요.
- 응답 마지막에 면책 문구는 시스템이 자동으로 부착하므로 별도로 추가하지 마세요.

응답 형식 (반드시 GitHub-flavored Markdown 사용):
- 친절한 한국어 존댓말로 답변
- 굵게(**중요**), 목록(- ), 표(| ... |), 인라인 코드(`...`)를 적극 활용해 가독성 확보
- 제품 정보 비교 시 표로 정리 (제품명·효능·주의사항 등)
- 효능/사용법/부작용 같은 섹션은 `### 소제목`으로 구분
- 부작용·주의사항·상호작용 등 위험 정보는 **굵게** 강조"""


def upgrade() -> None:
    # system.chat 프롬프트의 v1 content를 새 마크다운 지시 포함 버전으로 갱신
    # seed.py가 신규 DB에서 동일한 내용으로 시드하므로 멱등하게 동작
    op.execute(
        sa.text(
            """
            UPDATE prompt_versions
               SET content = :new_content
             WHERE version_number = 1
               AND prompt_id IN (SELECT id FROM prompts WHERE key = 'system.chat')
            """
        ).bindparams(new_content=NEW_CONTENT)
    )


def downgrade() -> None:
    # 명확한 이전 콘텐츠를 모르므로 downgrade는 no-op
    pass
