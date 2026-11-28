from __future__ import annotations

from app.cli import reset_password


def test_register_and_me(client):
    response = client.post(
        "/api/auth/register", json={"username": "alice", "password": "password123"}
    )
    assert response.status_code == 201
    assert response.json()["username"] == "alice"

    me = client.get("/api/auth/me")
    assert me.status_code == 200
    assert me.json()["username"] == "alice"


def test_duplicate_username(client, register):
    register("alice")
    response = client.post(
        "/api/auth/register", json={"username": "alice", "password": "password123"}
    )
    assert response.status_code == 409


def test_short_password(client):
    response = client.post(
        "/api/auth/register", json={"username": "bob", "password": "short"}
    )
    assert response.status_code == 422


def test_login_wrong_password(client, register):
    register("alice")
    client.post("/api/auth/logout")
    response = client.post(
        "/api/auth/login", json={"username": "alice", "password": "wrongpass"}
    )
    assert response.status_code == 401
    assert response.json()["detail"] == "用户名或密码错误"


def test_login_success(client, register):
    register("alice")
    client.post("/api/auth/logout")
    response = client.post(
        "/api/auth/login", json={"username": "alice", "password": "password123"}
    )
    assert response.status_code == 200
    assert response.json()["username"] == "alice"


def test_username_case_insensitive(client, register):
    register("Alice")

    duplicate = client.post(
        "/api/auth/register", json={"username": "alice", "password": "password123"}
    )
    assert duplicate.status_code == 409

    client.post("/api/auth/logout")
    login = client.post(
        "/api/auth/login", json={"username": "ALICE", "password": "password123"}
    )
    assert login.status_code == 200

    token = client.post(
        "/api/auth/token", json={"username": "aLiCe", "password": "password123"}
    )
    assert token.status_code == 200


def test_token_login_and_bearer_auth(client, register):
    register("alice")
    client.post("/api/auth/logout")

    response = client.post(
        "/api/auth/token", json={"username": "alice", "password": "password123"}
    )
    assert response.status_code == 200
    token = response.json()["token"]

    me = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me.status_code == 200
    assert me.json()["username"] == "alice"

    logout = client.post(
        "/api/auth/logout", headers={"Authorization": f"Bearer {token}"}
    )
    assert logout.status_code == 204
    assert (
        client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"}).status_code
        == 401
    )


def test_token_login_wrong_password(client, register):
    register("alice")
    client.post("/api/auth/logout")
    response = client.post(
        "/api/auth/token", json={"username": "alice", "password": "wrongpass"}
    )
    assert response.status_code == 401


def test_logout_invalidates_session(client, register):
    register("alice")
    assert client.get("/api/auth/me").status_code == 200
    client.post("/api/auth/logout")
    assert client.get("/api/auth/me").status_code == 401


def test_unauthenticated_me(client):
    assert client.get("/api/auth/me").status_code == 401


def test_login_rate_limit(client, register):
    register("alice")
    client.post("/api/auth/logout")
    for _ in range(10):
        response = client.post(
            "/api/auth/login", json={"username": "alice", "password": "wrongpass"}
        )
        assert response.status_code == 401
    blocked = client.post(
        "/api/auth/login", json={"username": "alice", "password": "wrongpass"}
    )
    assert blocked.status_code == 429


def test_successful_logins_not_limited(client, register):
    register("alice")
    client.post("/api/auth/logout")
    for _ in range(12):
        response = client.post(
            "/api/auth/login", json={"username": "alice", "password": "password123"}
        )
        assert response.status_code == 200


def test_admin_reset_password(client, db, register):
    register("alice")
    assert reset_password(db, "alice", "newpassword123") is True
    # Password reset must revoke existing sessions
    assert client.get("/api/auth/me").status_code == 401
    old = client.post(
        "/api/auth/login", json={"username": "alice", "password": "password123"}
    )
    assert old.status_code == 401
    new = client.post(
        "/api/auth/login", json={"username": "alice", "password": "newpassword123"}
    )
    assert new.status_code == 200


def test_login_ip_limiter_blocks_username_rotation(client):
    from app.api.auth import login_ip_limiter

    for _ in range(30):
        login_ip_limiter.record("login-ip:testclient")
    response = client.post(
        "/api/auth/login", json={"username": "someone-new", "password": "password123"}
    )
    assert response.status_code == 429


def test_registration_rate_limit(client):
    from app.api.auth import register_limiter

    for _ in range(20):
        register_limiter.record("register:testclient")
    response = client.post(
        "/api/auth/register", json={"username": "newuser", "password": "password123"}
    )
    assert response.status_code == 429


def test_expired_session_rejected(client, db, register):
    from datetime import datetime, timedelta

    from app.models import AuthSession

    register("alice")
    session = db.query(AuthSession).first()
    session.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db.commit()
    assert client.get("/api/auth/me").status_code == 401


def test_purge_expired_sessions(db, register):
    from datetime import datetime, timedelta

    from app.models import AuthSession
    from app.services.auth import purge_expired

    register("alice")
    session = db.query(AuthSession).first()
    session.expires_at = datetime.utcnow() - timedelta(seconds=1)
    db.commit()
    assert purge_expired(db) >= 1
    assert db.query(AuthSession).count() == 0
