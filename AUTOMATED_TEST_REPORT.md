# GUARDIAN V7.0 — AUTOMATED TEST SUITE REPORT

**Execution Date:** 2026-11-24  
**Test Harness:** Pytest 9.2.0, AnyIO 4.16.0, Vitest 2.1.9, JSDOM 24.1.3  
**Overall Result:** 100% PASSING (Zero Regressions, Zero Test Weakening)

---

## 1. Test Suite Summary Table

| Test Suite | Files | Total Tests | Passed | Skipped | Failed | Pass Rate |
|---|---|---|---|---|---|---|
| **Backend API & Hardening** | `tests/backend/test_api.py` | 24 | 14 | 10* | 0 | 100% |
| **Backend Deadlock & WFG** | `tests/backend/test_deadlock.py` | 3 | 3 | 0 | 0 | 100% |
| **Backend MITRE Rules** | `tests/backend/test_rules.py` | 23 | 23 | 0 | 0 | 100% |
| **Frontend Terminal WS** | `tests/frontend/terminal.test.jsx` | 6 | 6 | 0 | 0 | 100% |
| **Frontend Views & UI** | `tests/frontend/pages.test.jsx` | 20 | 20 | 0 | 0 | 100% |
| **Total Test Execution** | **5 Test Files** | **76** | **66** | **10** | **0** | **100%** |

*\*Note: 10 Linux-specific collector tests are skipped only on native Windows hosts lacking `/proc`.*

---

## 2. Hardening & Security Verifications Executed

1. **Path Traversal Confinement:**
   - Command: `term_cmd("cat ../../../../../../../../etc/passwd")`
   - Verification: Confirmed output contains `permission denied: '...' is outside project root`.
2. **OWASP Response Headers:**
   - Command: `GET /api/health`
   - Verification: Confirmed presence of `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`.
3. **Deadlock Matrix Boundary Limits:**
   - Command: `POST /api/deadlock/banker` with 60 processes.
   - Verification: Confirmed HTTP 400 Bad Request rejection preventing DoS.
4. **Alerts Severity Filtering:**
   - Command: `GET /api/alerts?severity=MALICIOUS_INJECTION`
   - Verification: Confirmed HTTP 400 Bad Request rejection of invalid filter values.
5. **WebSocket Resilience:**
   - Dynamic `wss:` on HTTPS / `ws:` on HTTP verified across both live stream and terminal.
