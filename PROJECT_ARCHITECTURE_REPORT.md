# GUARDIAN V7.0 — SYSTEM ARCHITECTURE REPORT

**Generated:** 2026-11-24  
**Project:** Smart OS Guardian (v7.0 Enterprise Forensic Monitoring Platform)  
**Architecture Classification:** Dual-Host Hybrid Defensive Telemetry & Forensic Risk Engine  
**Target Environments:** Linux (Debian/Ubuntu/RHEL), WSL2, Windows 10/11 (PowerShell Bridge)

---

## 1. Executive Summary & Philosophy
Smart OS Guardian is a real-time defensive host telemetry, process tree forensic auditing, and behavioral intrusion detection platform. It is engineered with a **zero-fabrication principle**: every metric, process tree ancestry, socket binding, file hash, and lock condition represents real host OS kernel telemetry collected directly via POSIX `/proc`, `/sys`, PowerShell CIM/WMI, and kernel interfaces.

---

## 2. Technology Stack Overview

### 2.1 Backend Architecture
- **Language / Runtime:** Python 3.11 / 3.12+
- **Application Server:** FastAPI (ASGI framework) + Starlette + Uvicorn
- **Concurrency Model:** Asynchronous event loop (`asyncio`) for WebSocket live streams, thread-pool runners for system scripts.
- **Data Persistence:** SQLite3 with WAL mode, foreign keys, row factories, and transactional isolation.
- **Inter-Process Communication:** UNIX Domain Sockets, WebSockets (`/ws/live`, `/api/terminal`), RESTful JSON endpoints (`/api/*`).
- **Security & Authorization:** Token-based authentication via constant-time HMAC header verification (`X-Guardian-Token`), path traversal sanitization, read-only restricted command execution engine.

### 2.2 Frontend Architecture
- **Language / Runtime:** Modern ECMAScript / React 18.3.1
- **Bundler & Tooling:** Vite 5.4.21, Rollup, PostCSS
- **Design System:** Graphite Neutral Ramp (`#141415`, `#19191b`), Emerald Accent (`#10b981`), 4px geometric rhythm, quiet typography, sentence-case hierarchy (Unslop design guidelines).
- **Visualization Engines:**
  - True 3D Mathematical Projection Engine (HTML5 Canvas 3D with mouse-orbit camera rotation, Z-buffering, and particle streams for Resource Allocation Graphs).
  - SVG Concentric Geometry Radar for network port listening states.
  - Recharts for time-series telemetry (CPU, RAM, Network I/O, Disk, Risk History).
  - Xterm.js 5.5.0 for real-time secure terminal emulation.
- **Routing & State:** URL Hash Navigation (`#overview`, `#process`, `#deadlock`), LocalStorage persistence for user preferences, live WebSocket reactive telemetry hooks (`useLive`, `useScan`).

### 2.3 System Monitoring & Collectors
- **Linux Collectors:** Pure Bash scripts operating on `/proc` filesystem (`/proc/stat`, `/proc/net/dev`, `/proc/locks`, `/proc/[pid]/fd`, `/proc/meminfo`), standard utilities (`ss`, `fuser`, `flock`, `sha256sum`, `lsblk`).
- **Windows Bridge:** PowerShell scripts (`bash/windows-bridge/*.sh`, `windows_deadlock.ps1`) executing CIM/WMI queries, .NET Sockets, and `System.Threading.Mutex` interfaces.
- **Cross-Platform Compatibility:** Automatic fallback detection for Git Bash, WSL, and native PowerShell.

### 2.4 Risk & Intrusion Detection Engine
- **Behavioral Detection Rules:** 19 standardized MITRE ATT&CK aligned behavioral detection rules.
- **Scoring Model:** Non-linear cumulative risk score ($0 - 100$) grouped by distinct active unacknowledged security rules:
  $$\text{Score} = \min\left(100, \sum_{\text{rule} \in \text{distinct}} \max(\text{points}_{\text{rule}})\right)$$
- **Baseline Engine:** Cryptographic hashing (SHA-256) and key-value state differentials to flag `NEW`, `KNOWN`, and `CHANGED` system state modifications.

---

## 3. Data Pipeline & End-to-End Workflow

```
[ Host Operating System (Linux /proc or Windows Bridge) ]
                     │
                     ▼ (Bash / PowerShell Collectors)
[ Raw TSV Telemetry Data ]
                     │
                     ▼ (app.parsers & Annotator)
[ Structured In-Memory Dictionaries + Cryptographic Hash Comparison ]
                     │
                     ▼ (risk.engine & MITRE Rules)
[ Security Alerts + Risk Score Calculation + Event Logging ]
                     │
                     ▼ (SQLite WAL Database)
[ FastAPI REST Endpoints & WebSockets ]
                     │
                     ▼ (Vite React Client + 3D Canvas + Xterm)
[ Professional Operator Interface ]
```

---

## 4. Security Architecture & Threat Model

| Vector | Defense Mechanism |
|---|---|
| API Access | Constant-time HMAC comparison on `X-Guardian-Token` |
| Path Traversal | Regex path validation, `..` rejection, file size caps on watchlist |
| Command Injection | Whitelisted execution arguments; prohibited subshell interpolation |
| Terminal Exploits | Safe read-only command parser; blocklist for destructive shell tokens |
| Deadlock & DoS | Global hierarchical resource ordering ($F(R_1) < F(R_2)$), timeout bounds |
| Database Corruption | Atomic transactions, parameter binding (`?`), automated schema creation |
