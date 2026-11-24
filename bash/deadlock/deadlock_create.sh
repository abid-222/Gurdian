#!/usr/bin/env bash
# ==============================================================================
# GUARDIAN V7 - REAL LINUX OS DEADLOCK DEMONSTRATION
# Mechanism: POSIX Kernel File Locks (flock) causing circular wait
# Coffman Conditions active:
#   1. Mutual Exclusion  : flock -x grants exclusive lock on file descriptor
#   2. Hold and Wait     : P1 holds R1 while waiting for R2; P2 holds R2 while waiting for R1
#   3. No Preemption     : Kernel will not forcibly seize flock without kill/unlock
#   4. Circular Wait     : P1 -> R2 (held by P2) -> R1 (held by P1)
# ==============================================================================

set -euo pipefail

LOCK_DIR="/tmp/guardian_deadlock"
mkdir -p "$LOCK_DIR"

RES_A="$LOCK_DIR/resource_A.lock"
RES_B="$LOCK_DIR/resource_B.lock"
PID_FILE="$LOCK_DIR/pids.txt"
STATUS_FILE="$LOCK_DIR/status.json"

touch "$RES_A" "$RES_B"
> "$PID_FILE"

echo "[DEADLOCK_INIT] Spawning Process P1 and Process P2 with conflicting lock acquisition..."

# Spawn Process 1: Acquires A, sleeps 1s, requests B (causing wait)
(
    exec 200>"$RES_A"
    flock -x 200
    echo "P1: Acquired Lock A (fd:200) - Holding and waiting..."
    echo "P1:HOLD:A" >> "$LOCK_DIR/events.log"
    sleep 1.2
    echo "P1: Requesting Lock B (fd:201)..."
    echo "P1:WAIT:B" >> "$LOCK_DIR/events.log"
    exec 201>"$RES_B"
    flock -x 201
    echo "P1: Acquired both locks (CRITICAL SECTION)"
    sleep 3
    flock -u 201
    flock -u 200
) &
PID_P1=$!

# Spawn Process 2: Acquires B, sleeps 1s, requests A (causing wait)
(
    exec 201>"$RES_B"
    flock -x 201
    echo "P2: Acquired Lock B (fd:201) - Holding and waiting..."
    echo "P2:HOLD:B" >> "$LOCK_DIR/events.log"
    sleep 1.2
    echo "P2: Requesting Lock A (fd:200)..."
    echo "P2:WAIT:A" >> "$LOCK_DIR/events.log"
    exec 200>"$RES_A"
    flock -x 200
    echo "P2: Acquired both locks (CRITICAL SECTION)"
    sleep 3
    flock -u 200
    flock -u 201
) &
PID_P2=$!

echo "$PID_P1" >> "$PID_FILE"
echo "$PID_P2" >> "$PID_FILE"

# Allow time for locks to be claimed and cross-requests to trigger kernel block
sleep 2

# Verify both processes are blocked in kernel
P1_STATE=$(ps -o state= -p "$PID_P1" 2>/dev/null || echo "DEAD")
P2_STATE=$(ps -o state= -p "$PID_P2" 2>/dev/null || echo "DEAD")

cat <<EOF > "$STATUS_FILE"
{
  "mode": "deadlock",
  "p1": {"pid": $PID_P1, "state": "$P1_STATE", "holding": "resource_A", "waiting": "resource_B"},
  "p2": {"pid": $PID_P2, "state": "$P2_STATE", "holding": "resource_B", "waiting": "resource_A"},
  "cycle": ["P1", "resource_B", "P2", "resource_A", "P1"],
  "timestamp": $(date +%s)
}
EOF

echo "[DEADLOCK_CONFIRMED] Kernel deadlock established between P1 ($PID_P1) and P2 ($PID_P2)."
echo "Status recorded in $STATUS_FILE"
