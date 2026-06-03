from app.db import seed
from app.db.models import Prompt, PromptVersion


def test_seed_creates_and_activates_v2(db_session):
    seed.seed_initial_data(db_session)
    prompt = db_session.query(Prompt).filter_by(key="system.chat").first()
    active = (
        db_session.query(PromptVersion)
        .filter_by(prompt_id=prompt.id, is_active=True)
        .first()
    )
    assert active.version_number == 2
    assert "supp_get_interaction" in active.content
    assert "약물-약물" in active.content
    # v1은 보존되되 비활성
    v1 = db_session.query(PromptVersion).filter_by(prompt_id=prompt.id, version_number=1).first()
    assert v1 is not None and v1.is_active is False


def test_seed_is_idempotent(db_session):
    seed.seed_initial_data(db_session)
    seed.seed_initial_data(db_session)  # 두 번 호출해도 안전
    prompt = db_session.query(Prompt).filter_by(key="system.chat").first()
    versions = db_session.query(PromptVersion).filter_by(prompt_id=prompt.id).count()
    assert versions == 2  # v1, v2만
