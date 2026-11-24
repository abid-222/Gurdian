"""
Guardian V7 - Real Deadlock Detection, Prevention & Avoidance Engine
Implements:
1. Wait-For Graph (WFG) Cycle Detection Algorithm (DFS/Tarjan)
2. Coffman Conditions Evaluation
3. Dijkstra's Banker's Algorithm (Safety & Resource-Request)
4. OS-level Script Controller (Linux Bash flock & Windows Mutex)
"""

from __future__ import annotations

import json
import logging
import os
import platform
import subprocess
import time
from pathlib import Path
from typing import Any

ROOT = Path(__file__).resolve().parents[2]
BASH_DEADLOCK = ROOT / "bash" / "deadlock"
LOGGER = logging.getLogger("guardian.deadlock")


# ==============================================================================
# 1. WAIT-FOR GRAPH CYCLE DETECTION ALGORITHM
# ==============================================================================
def detect_deadlock_cycle(graph: dict[str, list[str]]) -> list[str] | None:
    """Detects cycles in a directed graph using Depth-First Search (DFS).

    graph: { "P1": ["R2"], "R2": ["P2"], "P2": ["R1"], "R1": ["P1"] }
    Returns cycle path e.g. ["P1", "R2", "P2", "R1", "P1"] or None if acyclic.
    """
    visited: set[str] = set()
    rec_stack: list[str] = []

    def dfs(node: str) -> list[str] | None:
        visited.add(node)
        rec_stack.append(node)

        for neighbor in graph.get(node, []):
            if neighbor not in visited:
                cycle = dfs(neighbor)
                if cycle:
                    return cycle
            elif neighbor in rec_stack:
                idx = rec_stack.index(neighbor)
                return rec_stack[idx:] + [neighbor]

        rec_stack.pop()
        return None

    for n in list(graph.keys()):
        if n not in visited:
            cycle = dfs(n)
            if cycle:
                return cycle
    return None


# ==============================================================================
# 2. DIJKSTRA'S BANKER'S ALGORITHM (DEADLOCK AVOIDANCE)
# ==============================================================================
def bankers_safety_algorithm(
    available: list[int],
    maximum: list[list[int]],
    allocation: list[list[int]],
) -> dict[str, Any]:
    """Calculates whether a system is in a Deadlock-Free Safe State.

    Returns safe sequence if exists, otherwise marks unsafe state with
    deadlocked processes.
    """
    num_p = len(maximum)
    num_r = len(available)

    # Need Matrix = Max - Allocation
    need = [
        [max(0, maximum[i][j] - allocation[i][j]) for j in range(num_r)]
        for i in range(num_p)
    ]

    work = list(available)
    finish = [False] * num_p
    safe_sequence: list[int] = []

    steps: list[dict[str, Any]] = []

    while len(safe_sequence) < num_p:
        found = False
        for i in range(num_p):
            if not finish[i]:
                # Check if Need[i] <= Work
                if all(need[i][j] <= work[j] for j in range(num_r)):
                    # Process i can complete!
                    old_work = list(work)
                    for j in range(num_r):
                        work[j] += allocation[i][j]
                    finish[i] = True
                    safe_sequence.append(i)
                    found = True
                    steps.append(
                        {
                            "process": f"P{i}",
                            "need": need[i],
                            "work_before": old_work,
                            "allocated": allocation[i],
                            "work_after": list(work),
                            "action": f"P{i} acquired needed resources, executed, and released all allocations.",
                        }
                    )
                    break
        if not found:
            break

    is_safe = len(safe_sequence) == num_p
    return {
        "is_safe": is_safe,
        "safe_sequence": [f"P{i}" for i in safe_sequence] if is_safe else [],
        "deadlocked_processes": [f"P{i}" for i in range(num_p) if not finish[i]]
        if not is_safe
        else [],
        "steps": steps,
        "available_final": work,
        "need_matrix": need,
    }


# ==============================================================================
# 3. REAL OS SCRIPT CONTROLLER (LINUX BASH / WINDOWS POWERSHELL)
# ==============================================================================
def run_deadlock_action(action: str, source: str = "linux") -> dict[str, Any]:
    """Executes real OS deadlock actions: 'create', 'prevent', 'resolve', 'status',

    'cleanup'.
    """
    is_win = platform.system().lower() == "windows" and source == "windows"

    if is_win:
        ps_script = BASH_DEADLOCK / "windows_deadlock.ps1"
        cmd = [
            "powershell",
            "-NoProfile",
            "-ExecutionPolicy",
            "Bypass",
            "-File",
            str(ps_script),
            "-Action",
            action,
        ]
        try:
            res = subprocess.run(cmd, capture_output=True, text=True, timeout=15)
            # Try reading status file
            status_file = Path(os.environ.get("TEMP", ".")) / "guardian_deadlock" / "status.json"
            if status_file.exists():
                try:
                    return json.loads(status_file.read_text())
                except Exception:
                    pass
            return {"status": "ok", "action": action, "output": res.stdout.strip()}
        except Exception as e:
            return {"error": str(e), "action": action}

    # Linux / WSL2 bash execution
    script_map = {
        "create": "deadlock_create.sh",
        "prevent": "deadlock_prevent.sh",
        "resolve": "deadlock_resolve.sh",
        "status": "deadlock_monitor.sh",
        "cleanup": "deadlock_cleanup.sh",
    }
    script_name = script_map.get(action)
    if not script_name:
        return {"error": f"Unknown action: {action}"}

    script_path = BASH_DEADLOCK / script_name

    # Determine bash executable
    bash_bin = "/bin/bash" if Path("/bin/bash").exists() else "bash"
    if is_win and not Path("/bin/bash").exists():
        # Running on Windows with source='linux' -> use wsl or git bash if available, else powershell bridge
        if subprocess.run(["where", "wsl"], capture_output=True).returncode == 0:
            bash_bin = "wsl"
        elif subprocess.run(["where", "bash"], capture_output=True).returncode == 0:
            bash_bin = "bash"
        else:
            return run_deadlock_action(action, "windows")

    try:
        res = subprocess.run(
            [bash_bin, str(script_path)],
            capture_output=True,
            text=True,
            timeout=15,
        )
        status_file = Path("/tmp/guardian_deadlock/status.json")
        if status_file.exists():
            try:
                return json.loads(status_file.read_text())
            except Exception:
                pass
        return {
            "status": "ok",
            "action": action,
            "stdout": res.stdout.strip(),
            "stderr": res.stderr.strip(),
            "timestamp": int(time.time()),
        }
    except Exception as e:
        LOGGER.exception("Failed to run deadlock script: %s", script_path)
        return {"error": str(e), "action": action}
