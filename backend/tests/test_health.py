from __future__ import annotations


def test_health_ok(client):
    response = client.get("/api/health")
    assert response.status_code == 200
    assert response.json() == {"status": "ok", "db": True}


def test_health_returns_503_when_db_unavailable():
    from app.main import health

    class BrokenSession:
        def execute(self, *args, **kwargs):
            raise RuntimeError("db down")

    response = health(BrokenSession())
    assert response.status_code == 503
