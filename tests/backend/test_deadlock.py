from fastapi.testclient import TestClient
from app.deadlock import (
    bankers_safety_algorithm,
    detect_deadlock_cycle,
)
from app.main import app

c = TestClient(app, headers={"X-Guardian-Token": "t0k"})


def test_wfg_cycle_detection():
    # Deadlock cycle: P1 -> R2 -> P2 -> R1 -> P1
    deadlock_graph = {
        "P1": ["R2"],
        "R2": ["P2"],
        "P2": ["R1"],
        "R1": ["P1"],
    }
    cycle = detect_deadlock_cycle(deadlock_graph)
    assert cycle is not None
    assert "P1" in cycle and "P2" in cycle

    # Safe acyclic graph: P1 -> R1, P2 -> R2
    safe_graph = {
        "P1": ["R1"],
        "P2": ["R2"],
    }
    assert detect_deadlock_cycle(safe_graph) is None


def test_bankers_safety_algorithm():
    # Classic textbook 5-process, 3-resource safe state
    # Available = [3, 3, 2]
    avail = [3, 3, 2]
    max_m = [
        [7, 5, 3],
        [3, 2, 2],
        [9, 0, 2],
        [2, 2, 2],
        [4, 3, 3],
    ]
    alloc = [
        [0, 1, 0],
        [2, 0, 0],
        [3, 0, 2],
        [2, 1, 1],
        [0, 0, 2],
    ]
    res = bankers_safety_algorithm(avail, max_m, alloc)
    assert res["is_safe"] is True
    assert len(res["safe_sequence"]) == 5
    assert len(res["deadlocked_processes"]) == 0

    # Unsafe / Deadlock state: Available [0, 0, 0] with unsatisfied requests
    res_unsafe = bankers_safety_algorithm([0, 0, 0], max_m, alloc)
    assert res_unsafe["is_safe"] is False
    assert len(res_unsafe["deadlocked_processes"]) > 0


def test_deadlock_api_endpoints():
    # Test WFG endpoint
    res_wfg = c.post(
        "/api/deadlock/wfg",
        json={"graph": {"P1": ["R2"], "R2": ["P2"], "P2": ["R1"], "R1": ["P1"]}},
    )
    assert res_wfg.status_code == 200
    assert res_wfg.json()["has_cycle"] is True

    # Test Banker's endpoint with safe 2-process state
    res_banker = c.post(
        "/api/deadlock/banker",
        json={
            "available": [3, 3, 2],
            "maximum": [[4, 3, 2], [3, 2, 2]],
            "allocation": [[1, 1, 0], [2, 0, 0]],
        },
    )
    assert res_banker.status_code == 200
    assert res_banker.json()["is_safe"] is True
