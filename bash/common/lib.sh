# shellcheck shell=bash
# Shared helpers. Scripts are read-only.
emit() { local IFS=$'\t'; printf '%s\n' "$*"; }
need_cmd() { command -v "$1" >/dev/null 2>&1; }
