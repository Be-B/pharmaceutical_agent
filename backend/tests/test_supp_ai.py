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
