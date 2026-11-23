#!/bin/bash
cd "$(dirname "$0")" || exit 1
. .venv/bin/activate
export GUARDIAN_TOKEN="${GUARDIAN_TOKEN:-$(python3 -c 'import secrets; print(secrets.token_hex(16))')}"   # API token; the Vite proxy adds it, the browser never sees it
(cd backend && uvicorn app.main:app --host 127.0.0.1 --port 8000) &
API=$!; trap 'kill $API' EXIT
cd frontend && npm run dev
