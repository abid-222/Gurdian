from fastapi.testclient import TestClient
from app.main import TOKEN, app
from database import db as database

H = {"X-Guardian-Token": TOKEN}


def test_optional_first_run_and_protected_flow(tmp_path, monkeypatch):
    # Isolate DB for auth lifecycle test
    monkeypatch.setattr(database, "DB", tmp_path / "auth_test.db")
    database.init()
    c = TestClient(app)

    # 1. Fresh DB -> not initialized, open by default
    st = c.get("/api/auth/status", headers=H).json()
    assert st["initialized"] is False
    assert st["enabled"] is False

    # 2. User chooses Protected Mode with User ID & Password
    res = c.post("/api/auth/setup", headers=H, json={"mode": "protected", "username": "abid", "password": "secret123"})
    assert res.status_code == 200
    tok = res.json()["session_token"]
    assert res.json()["enabled"] is True

    # 3. Protected endpoint rejects missing session token, accepts valid session token
    assert c.get("/api/score", headers=H).status_code == 401
    assert c.get("/api/score", headers={**H, "X-Session-Token": tok}).status_code == 200

    # 4. Wrong password rejected, right password succeeds
    assert c.post("/api/auth/login", headers=H, json={"username": "abid", "password": "wrong"}).status_code == 401
    login_res = c.post("/api/auth/login", headers=H, json={"username": "abid", "password": "secret123"})
    assert login_res.status_code == 200
    tok2 = login_res.json()["session_token"]

    # 4b. Change password (old -> new)
    chg = c.post(
        "/api/auth/change-password",
        headers={**H, "X-Session-Token": tok2},
        json={"old_password": "secret123", "new_password": "newpass456"},
    )
    assert chg.status_code == 200
    tok3 = chg.json()["session_token"]
    assert c.post("/api/auth/login", headers=H, json={"username": "abid", "password": "secret123"}).status_code == 401
    assert c.post("/api/auth/login", headers=H, json={"username": "abid", "password": "newpass456"}).status_code == 200

    # 5. Disable protection -> returns to Open Mode
    dis = c.post("/api/auth/disable", headers={**H, "X-Session-Token": tok3}, json={"password": "newpass456"})
    assert dis.status_code == 200
    assert dis.json()["enabled"] is False
    assert c.get("/api/score", headers=H).status_code == 200
