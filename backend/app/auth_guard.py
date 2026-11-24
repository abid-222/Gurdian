"""Optional User ID & Password Protection (Open Mode vs PBKDF2-SHA256 Protected Mode)."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import time
from typing import Any

from database import db as database

SESSION_TTL_SECONDS = 24 * 3600


def _hash_password(password: str, salt_hex: str) -> str:
    dk = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), bytes.fromhex(salt_hex), 120_000)
    return dk.hex()


def get_auth_row() -> dict[str, Any] | None:
    with database.db() as c:
        row = c.execute("SELECT initialized, enabled, username, salt, pw_hash FROM app_auth WHERE id=1").fetchone()
        return dict(row) if row else None


def is_protection_enabled() -> bool:
    row = get_auth_row()
    return bool(row and row.get("enabled"))


def verify_session(token: str | None) -> str | None:
    if not token:
        return None
    now = int(time.time())
    with database.db() as c:
        row = c.execute("SELECT username, expires_at FROM app_sessions WHERE token=?", (token,)).fetchone()
        if not row:
            return None
        if int(row["expires_at"]) < now:
            c.execute("DELETE FROM app_sessions WHERE token=?", (token,))
            return None
        return str(row["username"])


def get_status(session_token: str | None = None) -> dict[str, Any]:
    row = get_auth_row()
    if not row:
        return {"initialized": False, "enabled": False, "username": None, "authenticated": True}
    enabled = bool(row["enabled"])
    if not enabled:
        return {"initialized": bool(row["initialized"]), "enabled": False, "username": None, "authenticated": True}
    user = verify_session(session_token)
    return {
        "initialized": True,
        "enabled": True,
        "username": row["username"],
        "authenticated": user is not None,
    }


def setup_auth(mode: str, username: str = "", password: str = "", current_token: str | None = None) -> dict[str, Any]:
    row = get_auth_row()
    if row and row["enabled"] and not verify_session(current_token):
        raise PermissionError("Authentication required to modify protection settings")

    now = int(time.time())
    if mode == "open":
        with database.db() as c:
            c.execute(
                """INSERT INTO app_auth(id, initialized, enabled, username, salt, pw_hash, updated_at)
                   VALUES(1, 1, 0, NULL, NULL, NULL, ?)
                   ON CONFLICT(id) DO UPDATE SET initialized=1, enabled=0, username=NULL, salt=NULL, pw_hash=NULL, updated_at=?""",
                (now, now),
            )
            c.execute("DELETE FROM app_sessions")
        return {"ok": True, "initialized": True, "enabled": False, "authenticated": True}

    clean_user = username.strip()
    if len(clean_user) < 3 or len(clean_user) > 40:
        raise ValueError("User ID must be 3 to 40 characters")
    if len(password) < 6 or len(password) > 128:
        raise ValueError("Password must be 6 to 128 characters")

    salt = secrets.token_hex(16)
    pw_hash = _hash_password(password, salt)
    sess_token = secrets.token_urlsafe(32)
    expires = now + SESSION_TTL_SECONDS

    with database.db() as c:
        c.execute(
            """INSERT INTO app_auth(id, initialized, enabled, username, salt, pw_hash, updated_at)
               VALUES(1, 1, 1, ?, ?, ?, ?)
               ON CONFLICT(id) DO UPDATE SET initialized=1, enabled=1, username=?, salt=?, pw_hash=?, updated_at=?""",
            (clean_user, salt, pw_hash, now, clean_user, salt, pw_hash, now),
        )
        c.execute("DELETE FROM app_sessions")
        c.execute("INSERT INTO app_sessions(token, username, expires_at) VALUES(?,?,?)", (sess_token, clean_user, expires))

    return {"ok": True, "initialized": True, "enabled": True, "username": clean_user, "session_token": sess_token, "authenticated": True}


def login(username: str, password: str) -> dict[str, Any]:
    row = get_auth_row()
    if not row or not row["enabled"]:
        return {"ok": True, "enabled": False, "authenticated": True}

    clean_user = username.strip()
    expected_user = str(row["username"] or "")
    candidate_hash = _hash_password(password, str(row["salt"] or ""))
    user_ok = hmac.compare_digest(clean_user, expected_user)
    pass_ok = hmac.compare_digest(candidate_hash, str(row["pw_hash"] or ""))
    if not (user_ok and pass_ok):
        raise PermissionError("Invalid User ID or Password")

    now = int(time.time())
    sess_token = secrets.token_urlsafe(32)
    with database.db() as c:
        c.execute("DELETE FROM app_sessions WHERE expires_at < ?", (now,))
        c.execute("INSERT INTO app_sessions(token, username, expires_at) VALUES(?,?,?)", (sess_token, expected_user, now + SESSION_TTL_SECONDS))

    return {"ok": True, "enabled": True, "username": expected_user, "session_token": sess_token, "authenticated": True}


def logout(session_token: str | None) -> dict[str, Any]:
    if session_token:
        with database.db() as c:
            c.execute("DELETE FROM app_sessions WHERE token=?", (session_token,))
    return {"ok": True}


def disable_auth(password: str, session_token: str | None) -> dict[str, Any]:
    row = get_auth_row()
    if not row or not row["enabled"]:
        return {"ok": True, "enabled": False}
    if not verify_session(session_token):
        raise PermissionError("Active session required")
    candidate_hash = _hash_password(password, str(row["salt"] or ""))
    if not hmac.compare_digest(candidate_hash, str(row["pw_hash"] or "")):
        raise PermissionError("Incorrect password")
    return setup_auth("open", current_token=session_token)
