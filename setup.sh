#!/bin/bash
# Run inside Ubuntu (WSL2)
set -e
cd "$(dirname "$0")" || exit 1
chmod +x bash/*/*.sh start.sh
python3 -m venv .venv && . .venv/bin/activate && pip install -r backend/requirements.txt
(cd frontend && npm install)
echo "Setup done. Run ./start.sh"
