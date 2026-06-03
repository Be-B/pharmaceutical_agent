import pytest

from app.agent import supp_ai


@pytest.mark.network
async def test_warfarin_ginkgo_interaction_live():
    supp_ai.clear_cache()
    out = await supp_ai.get_interaction("C0043031", "C3531686")
    assert out is not None
    assert out["evidence_total"] >= 1
    assert any(e["pmid"] for e in out["evidence"])  # PMID가 있는 근거 1개 이상


@pytest.mark.network
async def test_search_warfarin_live():
    supp_ai.clear_cache()
    results = await supp_ai.search_agent("warfarin")
    assert any(r["cui"] == "C0043031" for r in results)
