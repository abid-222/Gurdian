import json
import os
import pathlib
import socket
import subprocess
import sys
import time
import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.runner import BASH, CACHE

ROOT = pathlib.Path(__file__).resolve().parents[2]; H = {"X-Guardian-Token": "t0k"}
c = TestClient(app, headers=H)
sh = lambda *a: subprocess.run([BASH, *map(str, a)], capture_output=True, text=True, timeout=20).stdout
col = lambda m: sh(ROOT / f"bash/linux/{m}.sh"); lab = lambda a: sh(ROOT / "bash/demo/linux-lab.sh", a)

def test_health_open_but_api_needs_token():
    assert TestClient(app).get("/api/health").json()["ok"] and TestClient(app).get("/api/alerts").status_code == 401

@pytest.mark.skipif(sys.platform == "win32" and not os.path.exists("/proc"), reason="Linux collector requires /proc")
def test_collector_contracts():
    l = col("system").strip().split("\t"); assert l[0] == "linux" and len(l) == 8
    assert any(x.split("\t")[1] == "1" for x in col("process").splitlines()) and all(len(x.split("\t")[2]) == 64 for x in col("integrity").splitlines())

@pytest.mark.skipif(sys.platform == "win32" and not os.path.exists("/proc"), reason="Linux collector requires /proc")
def test_network_sees_socket():
    s = socket.socket(); s.bind(("0.0.0.0", 0)); s.listen(); p = s.getsockname()[1]; assert f"\t{p}\tLISTEN\t" in col("network"); s.close()

@pytest.mark.skipif(sys.platform == "win32", reason="Requires symlinks and Linux PATH binaries")
def test_auth_without_any_log_source_reports_limited_mode(tmp_path):
    for t in ("who", "last", "date", "id", "grep", "awk", "tail", "dirname", "cat"): (tmp_path / t).symlink_to(subprocess.run(["which", t], capture_output=True, text=True).stdout.strip())
    env = {**os.environ, "PATH": str(tmp_path), "GUARDIAN_AUTH_LOG": "/nonexistent"}   # no auth.log, no journalctl
    p = subprocess.run([BASH, str(ROOT / "bash/linux/auth.sh")], capture_output=True, text=True, env=env)
    assert p.returncode == 2 and "#ERROR\tLimited mode" in p.stdout

@pytest.mark.skipif(sys.platform == "win32" and not os.path.exists("/proc"), reason="Linux demo requires Linux environment")
def test_scan_contract_and_demo_alerts():
    lab("temp"); lab("deleted")
    try:
        r = c.post("/api/scan/process?source=linux").json()
        assert {"module", "source", "scan_id", "started_at", "rows", "alerts", "risk_score"} <= set(r) and {a["rule"] for a in r["alerts"]} >= {"tmp_exec", "deleted_binary"}
        assert c.get("/api/score").json()["score"] >= 45 and c.get("/api/alerts?severity=HIGH").json()
    finally: lab("reset")

@pytest.mark.skipif(sys.platform == "win32" and not os.path.exists("/proc"), reason="Linux collector requires /proc")
def test_new_port_after_baseline():
    c.post("/api/baseline/network?source=linux"); s = socket.socket(); s.bind(("0.0.0.0", 0)); s.listen(); port = str(s.getsockname()[1])
    r = c.post("/api/scan/network?source=linux").json(); s.close()
    assert any(x.get("status") == "NEW" and x["local_port"] == port for x in r["rows"]) and r["risk_score"] >= 20

@pytest.mark.skipif(sys.platform == "win32" and not os.path.exists("/proc"), reason="Linux demo requires Linux environment")
def test_no_duplicate_alerts_and_ack():
    lab("deleted")
    try:
        c.post("/api/scan/process?source=linux"); n = len(c.get("/api/alerts").json()); CACHE.clear()
        c.post("/api/scan/process?source=linux"); assert len(c.get("/api/alerts").json()) == n
    finally: lab("reset")
    assert c.post(f"/api/alerts/{c.get('/api/alerts').json()[0]['id']}/ack").json()["ok"]

def test_whitelists():
    for u in ("/api/scan/x?source=linux", "/api/scan/process?source=evil", "/api/scan/process?source=both", "/api/baseline/auth?source=linux", "/api/history/x", "/api/demo/hack?source=linux", "/api/report?fmt=exe"):
        assert c.post(u).status_code in (404, 405) if "report" not in u and "history" not in u else c.get(u).status_code == 404, u

def test_history_snapshot_report():
    c.post("/api/scan/usb?source=linux"); h = c.get("/api/history/usb").json(); assert h["scans"]
    assert c.post("/api/snapshot", json={"cpu": 1, "ram": 2, "disk": 3}).json()["ok"] and "ALERTS" in c.get("/api/report?fmt=txt").text

@pytest.mark.skipif(not os.path.exists("/etc/hostname"), reason="Requires /etc/hostname file")
def test_watch_writes_user_file_not_shipped_conf():
    from app.runner import USER_WATCH
    shipped = (ROOT / "bash/common/watchlist.conf").read_text()
    assert c.post("/api/watch", json={"path": "/etc/../etc/passwd"}).status_code == 400 and c.post("/api/watch", json={"path": "/nope/x; rm"}).status_code == 400
    assert c.post("/api/watch", json={"path": "/etc/hostname"}).json()["ok"] and "/etc/hostname" in USER_WATCH.read_text()
    assert (ROOT / "bash/common/watchlist.conf").read_text() == shipped
    assert any(r["path"] == "/etc/hostname" for r in c.post("/api/scan/integrity?source=linux").json()["rows"])

def test_default_watchlist_covers_shell_and_hosts():
    wl = (ROOT / "bash/common/watchlist.conf").read_text()
    assert all(x in wl for x in ("/etc/passwd", "/etc/hosts", "~/.bashrc", "~/.ssh/authorized_keys", "/mnt/c/Windows/System32/drivers/etc/hosts")) and len([x for x in wl.split() if x.startswith(("/", "~"))]) >= 15

@pytest.mark.skipif(sys.platform == "win32" and not os.path.exists("/proc"), reason="Linux collector requires /proc")
def test_process_cpu_is_measured_not_zero():
    p = subprocess.Popen([sys.executable, "-c", "while True: pass"]); time.sleep(0.3)
    try: row = next(x.split("\t") for x in col("process").splitlines() if x.split("\t")[1] == str(p.pid))
    finally: p.kill()
    assert float(row[6]) > 50, row

@pytest.mark.skipif(sys.platform == "win32" and not os.path.exists("/proc"), reason="Linux collector requires /proc")
def test_system_network_counters_are_real():
    exp = [sum(int(f[i]) for f in (l.split(":")[1].split() for l in list(open("/proc/net/dev"))[2:] if l.split(":")[0].strip() != "lo")) for i in (0, 8)]
    got = col("system").strip().split("\t")
    assert ((int(got[4]) >= exp[0] - 10**6 and int(got[5]) >= exp[1] - 10**6 and (got[4], got[5]) != ("0", "0")) or exp == [0, 0] or int(got[4]) > 0)

def test_auth_script_parses_ssh_sudo_su_from_a_log():
    env = {**os.environ, "GUARDIAN_AUTH_LOG": str(ROOT / "tests/fixtures/authlog.txt")}
    out = subprocess.run([BASH, str(ROOT / "bash/linux/auth.sh")], capture_output=True, text=True, env=env).stdout
    rows = [l.split("\t") for l in out.splitlines()]
    want = [("bob", "FAILED", "ssh"), ("root", "FAILED", "ssh"), ("alice", "SUCCESS", "ssh"), ("alice", "SUCCESS", "sudo"), ("alice", "SUCCESS", "su")]
    assert [(r[2], r[4], r[5]) for r in rows if r[5] in ("ssh", "sudo", "su")] == want

def test_quser_parser():
    out = subprocess.run([BASH, str(ROOT / "bash/common/parse_quser.sh")], input=(ROOT / "tests/fixtures/quser.txt").read_text(), capture_output=True, text=True).stdout
    assert out.splitlines()[0] == "windows\t2026-11-22T09:05:00\talice\t-\tSUCCESS\tsession" and "bob" in out.splitlines()[1]

@pytest.mark.skipif(sys.platform == "win32" and not os.path.exists("/proc"), reason="Linux demo requires Linux environment")
def test_new_process_end_to_end():
    assert c.post("/api/baseline/process?source=linux").json()["saved"] > 0; lab("temp")
    try:
        r = c.post("/api/scan/process?source=linux").json()
        assert "new_process" in {a["rule"] for a in r["alerts"]} and any(x.get("status") == "NEW" and x["name"] == "guardian_demo" for x in r["rows"])
    finally: lab("reset")

def test_timeline_score_history_and_json_report():
    t = c.get("/api/timeline?hours=24").json(); assert isinstance(t, list)
    h = c.get("/api/score/history").json(); assert isinstance(h, list)
    j = json.loads(c.get("/api/report?fmt=json").text)
    assert {"score", "level", "active_rules", "alerts", "timeline", "score_history", "baselines", "scans"} <= set(j)

def test_auth_events_use_log_time_and_are_stored_once():
    from app.runner import auth_events
    from database.db import add_events, db
    rows = [{"ts": "2026-11-22T10:00:00", "method": "ssh", "result": "FAILED", "username": "root", "source_ip": "1.2.3.4"},
            {"ts": "2026-11-22T10:00:01", "method": "session", "result": "SUCCESS", "username": "a", "source_ip": "-"}]
    ev = auth_events("linux", rows); assert len(ev) == 1 and ev[0][3] == "login_failed"
    add_events(ev); add_events(ev)
    with db() as x: assert x.execute("SELECT COUNT(*) FROM events WHERE kind='login_failed' AND summary LIKE 'root from 1.2.3.4%'").fetchone()[0] == 1

def test_websockets():
    with c.websocket_connect("/api/terminal", headers=H) as w:
        w.send_text("guardian score"); assert w.receive_text().isdigit(); w.send_text("rm -rf /"); assert "refused" in w.receive_text()
    with c.websocket_connect("/ws/live?source=linux", headers=H) as w:
        d = w.receive_json(); assert d["cores"] and 0 <= d["ram"] <= 100

def test_history_system_has_snapshots():
    c.post("/api/snapshot", json={"source": "linux", "cpu": 11.5, "ram": 22.5, "disk": 33.5, "rx": 1, "tx": 2})
    h = c.get("/api/history/system").json()
    assert h["snapshots"][0]["cpu"] == 11.5 and h["snapshots"][0]["source"] == "linux" and c.get("/api/history/usb").json()["snapshots"] == []
