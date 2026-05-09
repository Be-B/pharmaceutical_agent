"""update system.chat v1 prompt: GFM markdown + image_url 표시 지시 추가

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-09 00:00:00.000000
"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = "0003"
down_revision: Union[str, None] = "0002"
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


# seed.py SYSTEM_PROMPT_V1과 동일하게 유지
NEW_CONTENT = """당신은 한국어 의약품/건강기능식품 정보 도우미입니다.

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


def upgrade() -> None:
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
    pass
