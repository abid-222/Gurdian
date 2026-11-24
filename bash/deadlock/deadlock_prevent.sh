#!/usr/bin/env bash
# ==============================================================================
# GUARDIAN V7 - DEADLOCK PREVENTION ALGORITHM (Havender / Dijkstra Resource Ordering)
# Theory:
#   Deadlock occurs ONLY when all 4 Coffman conditions hold simultaneously.
#   Prevention Strategy: Invalidate Condition 4 ("Circular Wait") by imposing
#   a strict total ordering on all resources:
#     F(Resource_A) = 1 < F(Resource_B) = 2
#
# Rule: A process can only request resources in strictly ascending order.
#   - P1 requests Resource_A (1), then Resource_B (2) -> Allowed
#   - P2 requests Resource_A (1), then Resource_B (2) -> Allowed (Order preserved!)
#
# Mathematical Proof:
#   Since both processes request Resource_A first, whichever wins A will proceed
#   to request B, and the other process will wait for A without holding any resource.
#   Therefore, a circular wait chain P1 -> B -> P2 -> A -> P1 can NEVER form!
# ==============================================================================

set -euo pipefail

LOCK_DIR="/tmp/guardian_deadlock"
mkdir -p "$LOCK_DIR"

RES_A="$LOCK_DIR/resource_A.lock"
RES_B="$LOCK_DIR/resource_B.lock"
STATUS_FILE="$LOCK_DIR/status.json"

touch "$RES_A" "$RES_B"

echo "[PREVENTION_INIT] Running with Dijkstra's Global Resource Hierarchy Order: F(A)=1 < F(B)=2"

# Process 1: Requests in strict order A -> B
(
    exec 200>"$RES_A"
    flock -x 200
    echo "P1 (PID: $$): Acquired Resource A (Rank 1)"
    sleep 0.8
    exec 201>"$RES_B"
    flock -x 201
    echo "P1 (PID: $$): Acquired Resource B (Rank 2) -> Executing Critical Task"
    sleep 1.2
    echo "P1: Task complete, releasing Resource B and Resource A"
    flock -u 201
    flock -u 200
) &
PID_P1=$!

# Process 2: ALSO requests in strict order A -> B (Prevents Circular Wait!)
(
    sleep 0.2
    echo "P2 (PID: $$): Requesting Resource A (Rank 1) first under Hierarchy Rule..."
    exec 200>"$RES_A"
    flock -x 200
    echo "P2 (PID: $$): Acquired Resource A (Rank 1)"
    exec 201>"$RES_B"
    flock -x 201
    echo "P2 (PID: $$): Acquired Resource B (Rank 2) -> Executing Critical Task"
    sleep 1.0
    echo "P2: Task complete, releasing Resource B and Resource A"
    flock -u 201
    flock -u 200
) &
PID_P2=$!

# Wait for both processes to complete gracefully
wait "$PID_P1" "$PID_P2"

cat <<EOF > "$STATUS_FILE"
{
  "mode": "prevented",
  "p1": {"pid": $PID_P1, "state": "COMPLETED", "holding": null, "waiting": null},
  "p2": {"pid": $PID_P2, "state": "COMPLETED", "holding": null, "waiting": null},
  "cycle": null,
  "prevention_rule": "Hierarchical Resource Ordering (Dijkstra/Havender): F(A)=1 < F(B)=2",
  "result": "Circular wait broken. Both processes completed safely with zero deadlock.",
  "timestamp": $(date +%s)
}
EOF

echo "[PREVENTION_SUCCESS] Both processes executed sequentially with zero deadlock!"
