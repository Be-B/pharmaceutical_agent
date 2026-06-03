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
