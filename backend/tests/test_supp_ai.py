import httpx
import pytest

from app.agent import supp_ai


@pytest.fixture(autouse=True)
def _clear_cache():
    supp_ai.clear_cache()
    yield
    supp_ai.clear_cache()


class _FakeResp:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def _fake_client_factory(resp=None, exc=None):
    class _FakeClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            if exc is not None:
                raise exc
            return resp

    return _FakeClient


async def test_request_404_returns_none(monkeypatch):
    monkeypatch.setattr(
        supp_ai.httpx, "AsyncClient", _fake_client_factory(_FakeResp(404, {}))
    )
    out = await supp_ai._request("/interaction/C1-C2")
    assert out is None


async def test_request_timeout_raises_suppaierror(monkeypatch):
    monkeypatch.setattr(
        supp_ai.httpx,
        "AsyncClient",
        _fake_client_factory(exc=httpx.ConnectTimeout("boom")),
    )
    with pytest.raises(supp_ai.SuppAIError):
        await supp_ai._request("/agent/search", {"q": "x"})


async def test_request_caches_result(monkeypatch):
    calls = {"n": 0}

    class _CountingClient:
        def __init__(self, *a, **k):
            pass

        async def __aenter__(self):
            return self

        async def __aexit__(self, *a):
            return False

        async def get(self, *a, **k):
            calls["n"] += 1
            return _FakeResp(200, {"ok": True})

    monkeypatch.setattr(supp_ai.httpx, "AsyncClient", _CountingClient)
    a = await supp_ai._request("/agent/C1")
    b = await supp_ai._request("/agent/C1")
    assert a == b == {"ok": True}
    assert calls["n"] == 1  # 두 번째는 캐시


def test_reconstruct_sentence_joins_and_cleans_punctuation():
    spans = [
        {"text": "Co-treatment with"},
        {"text": "GbE"},
        {"text": "increased the level ."},
    ]
    assert (
        supp_ai.reconstruct_sentence(spans)
        == "Co-treatment with GbE increased the level."
    )


def test_reconstruct_sentence_skips_empty_spans():
    spans = [{"text": "A"}, {"text": ""}, {"cui": "C1"}, {"text": "B ."}]
    assert supp_ai.reconstruct_sentence(spans) == "A B."


def _ev(pmid, year, *, clinical=False, human=False, animal=False, retraction=False, text="finding ."):
    return {
        "paper": {
            "pmid": pmid,
            "doi": f"doi-{pmid}",
            "year": year,
            "venue": f"V{pmid}",
            "clinical_study": clinical,
            "human_study": human,
            "animal_study": animal,
            "retraction": retraction,
        },
        "sentences": [{"spans": [{"text": text}]}],
    }


def test_summarize_evidence_filters_sorts_and_caps():
    evidence = [
        _ev(1, 2010, animal=True),
        _ev(2, 2020, human=True),
        _ev(3, 2005, clinical=True),
        _ev(4, 2021, human=True, retraction=True),  # 철회 -> 제외
    ]
    out = supp_ai.summarize_evidence(evidence, max_items=5)
    # 철회 제외 + 사람/임상 우선 + 최신연도순: clinical(3) -> human(2) -> animal(1)
    assert [e["pmid"] for e in out] == [3, 2, 1]
    assert [e["study_type"] for e in out] == ["clinical", "human", "animal"]
    assert out[0]["sentence"] == "finding."
    assert out[0]["doi"] == "doi-3"


def test_summarize_evidence_respects_max_items():
    evidence = [_ev(i, 2000 + i, human=True) for i in range(10)]
    out = supp_ai.summarize_evidence(evidence, max_items=3)
    assert len(out) == 3


async def test_search_agent_shapes_results(monkeypatch):
    async def fake_request(path, params=None):
        assert path == "/agent/search"
        return {
            "results": [
                {
                    "cui": "C0043031",
                    "preferred_name": "Warfarin",
                    "ent_type": "drug",
                    "interacts_with_count": 80,
                    "synonyms": ["x"],
                    "definition": "long text",
                }
            ]
        }

    monkeypatch.setattr(supp_ai, "_request", fake_request)
    out = await supp_ai.search_agent("Warfarin")
    assert out == [
        {
            "cui": "C0043031",
            "preferred_name": "Warfarin",
            "ent_type": "drug",
            "interacts_with_count": 80,
        }
    ]


async def test_get_interaction_found(monkeypatch):
    async def fake_request(path, params=None):
        return {
            "agents": [
                {"cui": "C0043031", "preferred_name": "Warfarin", "ent_type": "drug"},
                {"cui": "C3531686", "preferred_name": "Ginkgo Biloba Whole", "ent_type": "supplement"},
            ],
            "evidence": [_ev(22282402, 2012, human=True, text="GbE increased warfarin levels .")],
        }

    monkeypatch.setattr(supp_ai, "_request", fake_request)
    out = await supp_ai.get_interaction("C0043031", "C3531686")
    assert out["evidence_total"] == 1
    assert out["agents"][0] == {"cui": "C0043031", "name": "Warfarin", "ent_type": "drug"}
    assert out["evidence"][0]["pmid"] == 22282402


async def test_get_interaction_404_returns_none(monkeypatch):
    async def fake_request(path, params=None):
        return None

    monkeypatch.setattr(supp_ai, "_request", fake_request)
    assert await supp_ai.get_interaction("C1", "C2") is None


async def test_list_interactions_shapes(monkeypatch):
    async def fake_request(path, params=None):
        return {
            "total": 69,
            "interactions_per_page": 50,
            "page": 1,
            "interactions": [
                {
                    "agent": {"cui": "C0028128", "preferred_name": "Nitric Oxide", "ent_type": "drug"},
                    "evidence": [{}, {}],
                }
            ],
        }

    monkeypatch.setattr(supp_ai, "_request", fake_request)
    out = await supp_ai.list_interactions("C3531686")
    assert out["total"] == 69
    assert out["has_more"] is True  # 1*50 < 69
    assert out["partners"][0] == {
        "cui": "C0028128",
        "name": "Nitric Oxide",
        "ent_type": "drug",
        "evidence_count": 2,
    }
