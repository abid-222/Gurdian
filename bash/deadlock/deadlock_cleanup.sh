#!/usr/bin/env bash
# ==============================================================================
# GUARDIAN V7 - DEADLOCK CLEANUP
# ==============================================================================

LOCK_DIR="/tmp/guardian_deadlock"

if [ -f "$LOCK_DIR/pids.txt" ]; then
    while IFS= read -r pid; do
        if [ -n "$pid" ] && kill -0 "$pid" 2>/dev/null; then
            kill -9 "$pid" 2>/dev/null || true
        fi
    done < "$LOCK_DIR/pids.txt"
fi

rm -rf "$LOCK_DIR"
echo "[CLEANUP] Deadlock lab environment reset."
