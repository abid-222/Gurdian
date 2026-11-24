# GUARDIAN V7.0 — COMPLETE PROJECT FILE INVENTORY

**Audit Date:** 2026-11-24  
**Total Source Files Tracked:** 111  
**Total Source Size:** ~728 KB  

---

## 1. Directory Tree & Module Mapping

```
smart-os-guardian/
├── backend/
│   ├── app/
│   │   ├── __init__.py         # Package root
│   │   ├── deadlock.py         # WFG Cycle Detection, Banker's Algorithm, OS Script Controller
│   │   ├── live.py             # WebSocket streaming, CPU per-core & Network I/O sampling
│   │   ├── main.py             # FastAPI entry point, routing, auth middleware, REST handlers
│   │   ├── parsers.py          # TSV line parsers, column mapping, baseline diff annotations
│   │   ├── report.py           # Multi-format forensic report generator (HTML, JSON, TXT)
│   │   ├── runner.py           # Script runner, bash discovery, baseline database synchronizer
│   │   └── terminal.py         # Secure read-only terminal WebSocket & command executor
│   ├── database/
│   │   ├── db.py               # SQLite connection pool, transactions, risk score aggregation
│   │   └── schema.sql          # DDL definitions (scans, alerts, baselines, items, events)
│   ├── risk/
│   │   ├── engine.py           # Behavioral inference engine, brute-force & heuristic evaluators
│   │   └── rules.py            # 19 MITRE ATT&CK risk rule definitions & weights
│   └── requirements.txt        # Backend dependencies (fastapi, uvicorn, psutil, httpx)
├── bash/
│   ├── common/                 # Shared helper libraries
│   ├── deadlock/
│   │   ├── deadlock_cleanup.sh # Teardown for lab processes and lock files
│   │   ├── deadlock_create.sh  # Real Linux kernel POSIX flock circular wait generator
│   │   ├── deadlock_monitor.sh # Lockfile & /proc/locks JSON status inspector
│   │   ├── deadlock_prevent.sh # Dijkstra/Havender strict hierarchical ordering algorithm
│   │   ├── deadlock_resolve.sh # Wait-For Graph victim preemption & recovery script
│   │   └── windows_deadlock.ps1# Native Windows .NET Mutex deadlock cross-platform bridge
│   ├── demo/
│   │   ├── linux-lab.sh        # Harmless attack simulations for Linux host
│   │   └── windows-lab.sh      # Harmless attack simulations for Windows host
│   ├── linux/
│   │   ├── auth.sh             # Linux authentication & session collector (/var/log/auth.log)
│   │   ├── integrity.sh        # SHA-256 cryptographic file hashing collector
│   │   ├── network.sh          # Socket & listening port collector (`ss -tulpn`)
│   │   ├── persistence.sh      # Crontab, systemd services, shell profile collector
│   │   ├── process.sh          # Process tree, cmdline, deleted binary collector
│   │   ├── system.sh           # CPU, memory, load, disk, and network stats collector
│   │   └── usb.sh              # USB device descriptor collector (`lsusb` / `sysfs`)
│   └── windows-bridge/         # Windows PowerShell equivalents for host telemetry
├── data/                       # Local SQLite runtime database, watchlist, commands log
├── docs/                       # Project documentation, guides, and specifications
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── Deadlock3D.jsx  # True 3D Mathematical Projection Engine for RAG
│   │   │   ├── Radar.jsx       # SVG Port Geometry Radar with azimuth markers
│   │   │   └── ui.jsx          # Design tokens, Stat cards, Badges, Tabular metrics
│   │   ├── hooks/
│   │   │   ├── useLive.js      # WebSocket telemetry hook with auto-reconnection
│   │   │   └── useScan.js      # Module scan fetcher with baseline synchronization
│   │   ├── pages/
│   │   │   ├── About.jsx       # Team roster, forensic defense highlights, viva guide
│   │   │   ├── Alerts.jsx      # Security alert drawer, triage, evidence inspector
│   │   │   ├── Auth.jsx        # Login failure matrix, IP distribution, sudo auditor
│   │   │   ├── Deadlock.jsx    # Deadlock Engineering Lab, Banker's simulator, bash viewer
│   │   │   ├── Demo.jsx        # MITRE attack simulation launcher
│   │   │   ├── FileVault.jsx   # Cryptographic file integrity auditor & watchlist manager
│   │   │   ├── Generic.jsx     # System hardware health & telemetry gauges
│   │   │   ├── Live.jsx        # High-frequency telemetry stream with per-core gauges
│   │   │   ├── Network.jsx     # Open sockets, suspicious connection alerts, Radar
│   │   │   ├── Overview.jsx    # Dual-ring Threat Dial, MITRE Defense Matrix, Vitality
│   │   │   ├── Persistence.jsx # Auto-start, cron, run-key forensic auditor
│   │   │   ├── Process.jsx     # Process tree hierarchy, ancestry flow, suspicious flags
│   │   │   ├── Reports.jsx     # Executive forensic export center (HTML, TXT, JSON)
│   │   │   ├── Settings.jsx    # Host configuration, scan cache controls, theme picker
│   │   │   ├── Terminal.jsx    # Web-based secure terminal emulator
│   │   │   ├── Timeline.jsx    # Chronological forensic incident log
│   │   │   └── Usb.jsx         # Peripheral device forensic registry
│   │   ├── theme/
│   │   │   └── theme.css       # Unslop graphite theme variables, dark ramps, typography
│   │   ├── api.js              # REST client with auth headers and error handling
│   │   ├── App.jsx             # Shell layout, navigation, keybindings engine, shortcuts HUD
│   │   └── main.jsx            # React root DOM mount
│   ├── package.json            # Frontend dependencies & scripts
│   └── vite.config.js          # Vite build & proxy configuration
└── tests/
    ├── backend/
    │   ├── conftest.py         # Pytest fixtures & test token
    │   ├── test_api.py         # Comprehensive REST API endpoint tests
    │   ├── test_deadlock.py    # Cycle detection, Banker's algorithm, WFG tests
    │   └── test_rules.py       # 19 MITRE ATT&CK detection rule validation tests
    ├── fixtures/               # Real TSV telemetry fixtures for offline testing
    └── frontend/
        ├── fakeApi.js          # Mock API router for Vitest component testing
        ├── pages.test.jsx      # Vitest smoke tests for all 16 page views
        └── terminal.test.jsx   # Xterm & WebSocket frontend contract tests
```
