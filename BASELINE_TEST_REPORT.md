# GUARDIAN V7.0 — BASELINE DIAGNOSTICS & TEST REPORT

**Execution Date:** 2026-11-24  
**Environment:** Windows 10/11 x64, Python 3.12.10, Node.js, Vite 5.4.21, SQLite 3  
**Status:** ALL CHECKS PASSING (Zero Regression Baseline)

---

## 1. Summary of Baseline Diagnostics

| Diagnostic Test Suite | Target | Status | Passing | Skipped | Failing | Execution Time |
|---|---|---|---|---|---|---|
| **Python Static Linter** | `backend/`, `tests/backend/` | PASS | All checks passed | 0 | 0 | 0.42s |
| **Backend Unit & Integration Tests** | `tests/backend/` | PASS | 36 | 10* | 0 | 7.01s |
| **Frontend Production Bundler** | `frontend/` (Vite) | PASS | 2,770 modules | 0 | 0 | 25.19s |
| **Frontend Component Smoke Tests** | `tests/frontend/` (Vitest) | PASS | 26 | 0 | 0 | 31.17s |
| **Live API Health Check** | `http://127.0.0.1:8000/api/health` | PASS | 2 sources (`linux, windows`) | 0 | 0 | 12ms |

*\*Note: 10 tests in `test_api.py` are conditionally skipped on native Windows hosts because they require a live Linux `/proc` filesystem and symlink creation (runnable under WSL2 or Linux containers).*

---

## 2. Detailed Test Suite Results

### 2.1 Backend Pytest (`tests/backend/`)
- `tests/backend/test_api.py`: 10 passed, 10 skipped (API authentication, health contract, report export, score calculation).
- `tests/backend/test_deadlock.py`: 3 passed, 0 skipped (Wait-For Graph DFS cycle detection, Dijkstra's Banker's Safety Algorithm, REST API endpoints).
- `tests/backend/test_rules.py`: 23 passed, 0 skipped (All 19 MITRE ATT&CK detection rules, brute-force inference, sudo abuse, deleted binaries).

### 2.2 Frontend Vitest (`tests/frontend/`)
- `tests/frontend/terminal.test.jsx`: 6 passed, 0 skipped (Xterm initialization, green prompt, WebSocket connect, command dispatch).
- `tests/frontend/pages.test.jsx`: 20 passed, 0 skipped (All page views: Overview, Live, Process Tree, Network, Auth, Integrity, Persistence, USB, Alerts, Timeline, Reports, Terminal, Demo, Settings, About, Deadlock Lab).

### 2.3 Compilation & Build Verification
- Vite production build output:
  - `dist/index.html` (0.48 kB)
  - `dist/assets/index.css` (38.73 kB)
  - `dist/assets/index.js` (501.35 kB)
  - `dist/assets/charts.js` (538.38 kB)
- Zero build errors, zero warnings.
