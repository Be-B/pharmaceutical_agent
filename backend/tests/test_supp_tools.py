import pytest

from app.agent import tools
from app.agent.supp_ai import SuppAIError


async def test_supp_search_agent_caps_to_five(monkeypatch):
    async def fake(query, page=0):
        return [{"cui": f"C{i}", "preferred_name": str(i), "ent_type": "drug", "interacts_with_count": i} for i in range(10)]

    monkeypatch.setattr(tools, "_supp_search_agent", fake)
    out = await tools.supp_search_agent.ainvoke({"query": "Warfarin"})
    assert len(out) == 5


async def test_supp_search_agent_degrades_on_error(monkeypatch):
    async def boom(query, page=0):
        raise SuppAIError("down")

    monkeypatch.setattr(tools, "_supp_search_agent", boom)
    out = await tools.supp_search_agent.ainvoke({"query": "Warfarin"})
    assert out == [{"error": "supp.ai 조회 실패: down"}]


async def test_supp_get_interaction_not_found(monkeypatch):
    async def none_ret(cui_a, cui_b):
        return None

    monkeypatch.setattr(tools, "_supp_get_interaction", none_ret)
    out = await tools.supp_get_interaction.ainvoke({"cui_a": "C1", "cui_b": "C2"})
    assert out == {"found": False}


async def test_supp_get_interaction_found(monkeypatch):
    async def found(cui_a, cui_b):
        return {"agents": [], "evidence": [], "evidence_total": 0}

    monkeypatch.setattr(tools, "_supp_get_interaction", found)
    out = await tools.supp_get_interaction.ainvoke({"cui_a": "C1", "cui_b": "C2"})
    assert out["found"] is True
    assert out["evidence_total"] == 0


async def test_all_tools_includes_supp_tools():
    names = {t.name for t in tools.ALL_TOOLS}
    assert {"supp_search_agent", "supp_get_interaction", "supp_list_interactions"} <= names
