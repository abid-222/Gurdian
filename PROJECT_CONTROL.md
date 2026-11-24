# Smart OS Guardian v7.0 — Project Control & Maintenance Guide

Single reference for running, updating, testing, and deploying **Smart OS Guardian**.

---

## 1. Repository Map (Where Everything Lives)

| Layer | Path | Purpose |
| :--- | :--- | :--- |
| **Backend API** | `backend/app/main.py` | FastAPI entry point, security headers, `X-Guardian-Token`, REST & WebSocket routes |
| **Auth Guard** | `backend/app/auth_guard.py` | Optional first-run & PBKDF2-SHA256 User ID / Password protection |
| **Scan Runner** | `backend/app/runner.py` | Executes OS collectors (`bash/linux`, `bash/windows-bridge`), 5s cache + `fresh=1` |
| **Deadlock Engine** | `backend/app/deadlock.py` | Wait-For Graph DFS cycle detection, Banker's Algorithm, OS `flock`/Mutex scripts |
| **Unified Terminal** | `backend/app/terminal.py` | Safe read-only Bash pipe (`\|`), Linux utilities & `guardian` CLI |
| **Risk Engine** | `backend/risk/engine.py` | 19 behavioral threat rules mapped to MITRE ATT&CK |
| **Database** | `backend/database/schema.sql`, `db.py` | SQLite WAL-mode schema (`scans`, `alerts`, `baselines`, `app_auth`, `app_sessions`) |
| **Frontend App** | `frontend/src/App.jsx` | Routing, keyboard shortcuts, theme sync, 3D AuthGate & top-bar Password Manager |
| **Pages** | `frontend/src/pages/*.jsx` | `Overview`, `Process`, `Network`, `FileVault`, `Deadlock`, `Terminal`, `Settings`, `About`, etc. |
| **Components** | `frontend/src/components/*.jsx` | `Deadlock3D`, `ProcessTreeGraph`, `AttackSimulator`, `AuthGate`, `PasswordModal`, `Radar`, `ui` |
| **OS Scripts** | `bash/linux/`, `bash/windows-bridge/`, `bash/deadlock/`, `bash/demo/` | Native Bash & PowerShell host telemetry and lab scripts |
| **Tests** | `tests/backend/`, `tests/frontend/` | Pytest (51 tests) + Vitest (26 tests) |

---

## 2. Quick Run Commands (Windows PowerShell)

```powershell
# 1. Start Backend (Port 8000)
cd backend
$env:GUARDIAN_TOKEN="dev-token-12345"
python -m uvicorn app.main:app --host 127.0.0.1 --port 8000

# 2. Start Frontend (Port 5173) in another terminal
cd frontend
$env:GUARDIAN_TOKEN="dev-token-12345"
npm run dev
```

Open **`http://localhost:5173`** in your browser.

---

## 3. Verification & Testing Before Git Push

```powershell
# Frontend Build + Unit Tests
cd frontend
npm run build
npx vitest run
cd ..

# Backend Lint + Tests
python -m ruff check backend tests/backend
python -m pytest tests/backend
```

---

## 4. Key Keyboard Shortcuts

- **`1`–`9`**, **`0`**: Jump directly to views (`1` Overview, `4` Processes, `5` Network, `0` Deadlock Lab)
- **`Ctrl+K`**: Open Command Palette
- **`?`**: Open Keyboard Shortcuts Help
