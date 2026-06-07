from app.db import seed
from app.db.models import Prompt, PromptVersion


def test_seed_creates_and_activates_v3(db_session):
    seed.seed_initial_data(db_session)
    prompt = db_session.query(Prompt).filter_by(key="system.chat").first()
    active = (
        db_session.query(PromptVersion)
        .filter_by(prompt_id=prompt.id, is_active=True)
        .first()
    )
    assert active.version_number == 3
    # v3는 v2의 supp 지침을 포함하고, 추가로 논문 링크 지침을 담는다.
    assert "supp_get_interaction" in active.content
    assert "약물-약물" in active.content
    assert "pubmed.ncbi.nlm.nih.gov" in active.content
    # 이전 버전들은 보존되되 비활성
    for vn in (1, 2):
        v = db_session.query(PromptVersion).filter_by(prompt_id=prompt.id, version_number=vn).first()
        assert v is not None and v.is_active is False


def test_seed_is_idempotent(db_session):
    seed.seed_initial_data(db_session)
    seed.seed_initial_data(db_session)  # 두 번 호출해도 안전
    prompt = db_session.query(Prompt).filter_by(key="system.chat").first()
    versions = db_session.query(PromptVersion).filter_by(prompt_id=prompt.id).count()
    assert versions == 3  # v1, v2, v3만
