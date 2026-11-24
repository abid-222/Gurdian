# GUARDIAN V7.0 — MASTER REPAIR & HARDENING PLAN

**Plan Date:** 2026-11-24  
**Author:** Senior DevSecOps Engineering Lead  
**Execution Strategy:** Incremental, Test-Verified, Zero-Regression Batch Rollout  

---

## 1. Prioritized Task Matrix

| Task ID | Priority | Category | Files Affected | Description | Verification Method |
|---|---|---|---|---|---|
| **TASK-01** | **P0** | Security (Path Traversal) | `backend/app/terminal.py` | Confine `cat`/`type` command paths to resolved canonical project root | `pytest tests/backend/test_api.py` with traversal payload |
| **TASK-02** | **P0** | Reliability (Concurrency) | `backend/database/db.py`, `backend/database/schema.sql` | Enable SQLite WAL mode, set 30s timeout, add database covering indexes | Concurrency test & database initialization verification |
| **TASK-03** | **P1** | Frontend Architecture | `frontend/src/api.js` | Attach `api.get` and `api.post` helper methods to `api` function object | Vitest suite & Deadlock lab action testing |
| **TASK-04** | **P1** | Security (TLS/WSS) | `frontend/src/hooks/useLive.js`, `frontend/src/pages/Terminal.jsx` | Dynamic WSS protocol selection (`https:` -> `wss:`, `http:` -> `ws:`) | Vitest terminal & live stream suite |
| **TASK-05** | **P2** | Security (OWASP Headers) | `backend/app/main.py` | Add ASGI middleware for `X-Content-Type-Options`, `X-Frame-Options`, `Referrer-Policy` | HTTP response header assertion test |
| **TASK-06** | **P2** | Security (DoS Bounds) | `backend/app/main.py`, `backend/app/deadlock.py` | Validate and bound Banker's Algorithm matrix dimensions ($N \le 50, M \le 20$) | `pytest tests/backend/test_deadlock.py` with oversized matrix |
| **TASK-07** | **P2** | Cross-Platform (File Vault) | `backend/app/main.py` | Support Windows drive paths (e.g. `C:\...`) alongside POSIX paths in `/api/watch` | Test path validation with Windows and POSIX paths |
| **TASK-08** | **P3** | Concurrency / Terminal DoS | `backend/app/terminal.py` | Cap terminal input length to 1,024 characters per frame | Terminal length boundary verification |
| **TASK-09** | **P4** | Frontend Optimization | `frontend/src/api.js` | Automatically revoke Blob object URLs after CSV export | JavaScript unit assertion |

---

## 2. Execution Sequence
- **Batch 1:** Backend Core Security & Database Concurrency (TASK-01, TASK-02, TASK-05, TASK-06, TASK-07, TASK-08)
- **Batch 2:** Frontend Protocol Resilience & API Helper Attachments (TASK-03, TASK-04, TASK-09)
- **Batch 3:** Full Regression Verification & Self-Healing Testing
