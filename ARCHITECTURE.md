# Architecture
React (5173, proxy) -> FastAPI (8000) -> bash/{linux,windows-bridge}/<module>.sh -> tab-separated lines (first column = source) -> parsers.py -> risk/rules.py -> SQLite.
Live: Linux = system.sh every ~1 s; Windows = ONE persistent PowerShell (`system.sh --stream`, 3 s).
Modules: system process network auth integrity persistence usb. Baselines (network, integrity, persistence, usb) live in the `baselines` table.
