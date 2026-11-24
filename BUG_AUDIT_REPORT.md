# GUARDIAN V7.0 — DEEP BUG & LOGIC AUDIT REPORT

**Audit Date:** 2026-11-24  
**Audit Scope:** Frontend Components, Hooks, REST APIs, Database Layer, System Collectors  

---

## 1. Summary of Bug Findings

| Finding ID | Component | Severity | Description | Status |
|---|---|---|---|---|
| **BUG-01** | `frontend/src/api.js` | **HIGH** | `api.post` and `api.get` helper methods missing on `api` function object, causing `TypeError: api.post is not a function` during component actions. | Identified |
| **BUG-02** | `frontend/src/hooks/useLive.js` | **MEDIUM** | Insecure protocol hardcoding (`ws://` instead of dynamic `wss://` over HTTPS); unhandled `JSON.parse` crashes on unexpected telemetry packets. | Identified |
| **BUG-03** | `frontend/src/pages/Terminal.jsx` | **MEDIUM** | Insecure protocol hardcoding (`ws://` instead of dynamic `wss://` over HTTPS). | Identified |
| **BUG-04** | `backend/database/schema.sql` | **MEDIUM** | Missing database indexes on critical high-frequency lookup tables (`alerts(acknowledged, rule_id)`, `events(ts DESC)`), leading to performance degradation over time. | Identified |
| **BUG-05** | `backend/database/db.py` | **MEDIUM** | Default SQLite connection timeout (5s) without WAL mode configuration can result in `sqlite3.OperationalError: database is locked` during concurrent scan + live metrics recording. | Identified |
| **BUG-06** | `backend/app/main.py` | **LOW** | Watchlist regex validation `/[\w./@+ -]{1,300}` rejects valid Windows drive letters (e.g. `C:\file.txt`), breaking File Vault on Windows hosts. | Identified |
| **BUG-07** | `frontend/src/api.js` | **LOW** | Memory leak in `toCsv` utility: `URL.createObjectURL` references are not revoked via `URL.revokeObjectURL`. | Identified |

---

## 2. Root Cause Analysis

### 2.1 BUG-01: Missing `api.post` and `api.get` Method Bindings
- **Location:** `frontend/src/api.js`
- **Root Cause:** `api` is declared as an arrow function `(p, m = 'GET', body) => fetch(...)`. While components call `api.post(...)`, these helper methods were never assigned to the function instance.
- **Fix:** Assign `api.get = (p) => api(p, 'GET')` and `api.post = (p, body) => api(p, 'POST', body)` before export.

### 2.2 BUG-02 & BUG-03: Hardcoded Insecure WebSocket Protocols
- **Location:** `frontend/src/hooks/useLive.js`, `frontend/src/pages/Terminal.jsx`
- **Root Cause:** Both files construct WebSockets with hardcoded `ws://${location.host}/...`. In production behind TLS/SSL reverse proxies (`https://`), modern browsers block `ws://` connections under the Mixed Content Security Specification.
- **Fix:** Determine protocol dynamically: `const proto = location.protocol === 'https:' ? 'wss:' : 'ws:'`.

### 2.3 BUG-04 & BUG-05: SQLite Lock Contention & Missing Indexes
- **Location:** `backend/database/db.py`, `backend/database/schema.sql`
- **Root Cause:** Standard SQLite without WAL mode defaults to single-writer exclusive locks with a 5-second timeout. When background scripts, live telemetry, and REST queries write simultaneously, transactions can collide.
- **Fix:** Execute `PRAGMA journal_mode=WAL; PRAGMA busy_timeout=30000;` on initialization, set `timeout=30.0` on connection, and add covering indexes on `alerts`, `events`, and `scans`.

### 2.4 BUG-06: Windows Path Traversal Validation Discrepancy
- **Location:** `backend/app/main.py:watch`
- **Root Cause:** Regex `r"/[\w./@+ -]{1,300}"` strictly requires a leading forward slash, rejecting valid Windows paths (`C:\...` or `C:/...`).
- **Fix:** Update regex to support POSIX absolute paths and Windows drive letter paths safely without allowing traversal `..`.
