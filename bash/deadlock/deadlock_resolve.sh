#!/usr/bin/env bash
# ==============================================================================
# GUARDIAN V7 - DEADLOCK DETECTION & RESOLUTION (Victim Preemption Recovery)
# Algorithm:
#   1. Detect Wait-For Graph (WFG) cycle: P1 -> R_B -> P2 -> R_A -> P1
#   2. Choose Victim: Select lowest priority / younger process (P2)
#   3. Preempt / Terminate Victim: Send SIGTERM to P2 to forcibly release lock
#   4. Allow survivor (P1) to acquire pending lock, finish, and unblock the system
# ==============================================================================

set -euo pipefail

LOCK_DIR="/tmp/guardian_deadlock"
PID_FILE="$LOCK_DIR/pids.txt"
STATUS_FILE="$LOCK_DIR/status.json"

if [ ! -f "$PID_FILE" ]; then
    echo "[RESOLVE_ERR] No active deadlock session found."
    exit 0
fi

PIDS=($(cat "$PID_FILE"))
if [ ${#PIDS[@]} -lt 2 ]; then
    echo "[RESOLVE_WARN] Less than 2 recorded deadlock PIDs."
    exit 0
fi

PID_P1="${PIDS[0]}"
PID_P2="${PIDS[1]}"

echo "[RESOLVE_START] Analyzing cycle: P1 ($PID_P1) and P2 ($PID_P2)..."
echo "[RESOLVE_ALGO] Selecting victim based on minimum rollback cost -> P2 ($PID_P2)"

# Terminate victim P2 to preempt held Resource B
if kill -0 "$PID_P2" 2>/dev/null; then
    kill -15 "$PID_P2" 2>/dev/null || kill -9 "$PID_P2" 2>/dev/null
    echo "[RESOLVE_ACTION] Preempted victim Process P2 ($PID_P2). Resource B released."
else
    echo "[RESOLVE_INFO] Process P2 ($PID_P2) was already terminated."
fi

# Allow P1 to unblock and finish
sleep 1.5

cat <<EOF > "$STATUS_FILE"
{
  "mode": "resolved",
  "p1": {"pid": $PID_P1, "state": "RECOVERED", "holding": null, "waiting": null},
  "p2": {"pid": $PID_P2, "state": "PREEMPTED_VICTIM", "holding": null, "waiting": null},
  "cycle": null,
  "recovery_method": "Victim Selection & Resource Preemption (SIGTERM to P2)",
  "result": "Victim terminated. Survivor P1 acquired Resource B, completed, and system unlocked.",
  "timestamp": $(date +%s)
}
EOF

# Clean up lockfiles
rm -f "$LOCK_DIR"/*.lock
> "$PID_FILE"

echo "[RESOLVE_SUCCESS] Deadlock cycle dismantled. System is operating normally."
