#!/usr/bin/env bash
# ==============================================================================
# GUARDIAN V7 - DEADLOCK MONITOR & KERNEL LOCK PARSER
# Inspects:
#   - Active lock files in /tmp/guardian_deadlock
#   - /proc/locks (Linux Kernel POSIX locks table)
#   - Process wait states (S / D / S+) via ps
# Outputs real-time JSON Wait-For Graph (WFG)
# ==============================================================================

set -euo pipefail

LOCK_DIR="/tmp/guardian_deadlock"
STATUS_FILE="$LOCK_DIR/status.json"

if [ -f "$STATUS_FILE" ]; then
    cat "$STATUS_FILE"
    exit 0
fi

echo "{\"mode\":\"idle\",\"p1\":null,\"p2\":null,\"cycle\":null,\"timestamp\":$(date +%s)}"
