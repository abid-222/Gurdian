"""One test per rule, using tests/fixtures (no Windows, no admin needed)."""
import pathlib, time
from app.parsers import KEY, parse
from database import db
from risk.engine import evaluate, level, score
from risk.rules import RULES
FX = pathlib.Path(__file__).resolve().parents[1] / "fixtures"

def ev(module, name, base=None):
    rows, _ = parse(module, (FX / name).read_text()); return evaluate(module, rows, base)
def keys(module, name): return {KEY[module](r): "" for r in parse(module, (FX / name).read_text())[0]}
def one(a, rule, pts, sev):
    assert len(a) == 1 and a[0]["rule"] == rule and a[0]["points"] == pts and a[0]["severity"] == sev and a[0]["evidence"]; return a[0]

def test_rules_are_data():
    assert len(RULES) == 19 and all({"id", "module", "points", "severity", "reference", "message"} <= set(r) for r in RULES)
def test_brute_force():
    a = one(ev("auth", "auth_bruteforce.tsv"), "brute_force", 30, "HIGH"); assert a["reference"] == "T1110" and "10.0.0.9" in a["evidence"] and "5 failed" in a["message"]
def test_brute_force_needs_10_minutes():
    assert ev("auth", "auth_spread.tsv") == []
def test_file_changed():
    a = one(ev("integrity", "integrity.tsv", {"/etc/passwd": "oldhash"}), "file_changed", 40, "HIGH"); assert "newhash" in a["evidence"]
def test_file_unchanged_is_silent():
    assert ev("integrity", "integrity.tsv", {"/etc/passwd": "newhash"}) == []
def test_new_cron_and_service():
    b = keys("persistence", "persistence_linux.tsv"); del b["cron:/etc/cron.d/evil:def"]; del b["service:/etc/systemd/system/x.service:123"]
    a = ev("persistence", "persistence_linux.tsv", b); assert {x["rule"] for x in a} == {"new_cron_service"} and len(a) == 2 and a[0]["reference"] == "T1053.003, T1543.002"
def test_new_run_key_and_task():
    b = {"run_key:HKCU\\Run\\Old:ccc": ""}; a = ev("persistence", "persistence_windows.tsv", b)
    assert len(a) == 2 and {x["rule"] for x in a} == {"new_run_key"} and a[0]["points"] == 30 and "T1547.001" in a[0]["reference"]
def test_new_ssh_key():
    a = one(ev("persistence", "ssh_keys.tsv", {"ssh_key:authorized_keys:k1": ""}), "new_ssh_key", 30, "HIGH"); assert a["reference"] == "T1098.004"
def test_deleted_binary():  one(ev("process", "process_flags.tsv")[:1], "deleted_binary", 25, "HIGH")
def test_tmp_exec():        one(ev("process", "process_flags.tsv")[1:], "tmp_exec", 20, "MEDIUM")
def test_new_listening_port():
    base = {"tcp:22": "", "ext:8.8.8.8": "", "ext:1.1.1.1": ""}
    a = one(ev("network", "network.tsv", base), "new_listening_port", 20, "MEDIUM")
    assert a["reference"] == "T1571" and "9999" in a["message"]   # ESTABLISHED row is ignored
def test_new_usb():
    a = one(ev("usb", "usb.tsv", {"USB Mouse:046D:C077:AAA": ""}), "new_usb", 10, "LOW"); assert a["reference"] == "T1200"
def test_high_resource_10s():
    ts = (FX / "system_hot_ts.txt").read_text().split(",")
    rows = lambda cpu: [{"source": "linux", "cpu_pct": cpu, "ram_pct": "40", "ts": t} for t in ts]
    one(evaluate("system", rows("95")), "high_resource", 10, "LOW"); assert evaluate("system", rows("95")[:2]) == [] and evaluate("system", rows("50")) == []
def test_login_after_bruteforce():
    a = ev("auth", "auth_after_brute.tsv"); rules = [x["rule"] for x in a]
    assert rules.count("login_after_bruteforce") == 1 and "brute_force" in rules
    x = next(x for x in a if x["rule"] == "login_after_bruteforce"); assert x["points"] == 40 and "10.0.0.9" in x["message"] and "5 failed" in x["message"] and "SUCCESS" in x["evidence"]
def test_sudo_su_use_one_alert_per_user_and_method():
    a = ev("auth", "auth_sudo.tsv"); assert sorted(x["message"] for x in a) == ["su used by alice", "sudo used by alice"] and a[0]["severity"] == "LOW"
def test_new_user_suid_worldwritable_shell():
    b = {"user_account:root:r1": "", "shell_rc:/home/a/.profile:same": ""}; a = ev("persistence", "persistence_new.tsv", b)
    got = {x["rule"]: x for x in a}; assert set(got) == {"new_user_account", "new_suid_file", "new_world_writable", "shell_profile_changed"}
    assert got["new_user_account"]["points"] == 30 and got["new_suid_file"]["reference"] == "T1548.001" and got["new_world_writable"]["severity"] == "MEDIUM" and "bashrc" in got["shell_profile_changed"]["message"]
def test_new_process_since_baseline_ignores_kernel_threads_and_helpers():
    a = ev("process", "process_new.tsv", {"init:/sbin/init": ""}); x = one(a, "new_process", 10, "LOW")
    assert x["message"].startswith("2 new process name(s)") and "miner" in x["message"] and "newbie" in x["message"]
    assert "powershell" not in x["message"] and "kthreadd" not in x["message"]
def test_unusual_external_ip_only_public_and_new():
    a = ev("network", "network.tsv", {"tcp:22": "", "tcp:9999": "", "ext:1.1.1.1": ""}); x = one(a, "unusual_external_ip", 20, "MEDIUM")
    assert "8.8.8.8" in x["message"] and "curl" in x["message"]   # 192.168.1.7 is private, 1.1.1.1 is in the baseline
def test_hosts_file_changed_replaces_generic_file_changed():
    a = ev("integrity", "hosts.tsv", {"C:\\x\\drivers\\etc\\hosts": "old", "C:\\x\\other.txt": "old"}); r = {x["rule"]: x for x in a}
    assert set(r) == {"hosts_file_changed", "file_changed"} and r["hosts_file_changed"]["points"] == 40 and r["hosts_file_changed"]["reference"] == "T1565.001"
def test_no_baseline_means_no_new_alerts():
    assert ev("network", "network.tsv") == []
def test_score_distinct_and_levels():
    a = ev("process", "process_flags.tsv"); assert score(a) == 45 and score(a + a) == 45 and score([{"rule": "x", "points": 70}, {"rule": "y", "points": 70}]) == 100
    assert [level(0), level(29), level(30), level(59), level(60), level(100)] == ["SAFE", "SAFE", "WARNING", "WARNING", "CRITICAL", "CRITICAL"]
def test_dedupe_10_minutes_and_score():
    db.init()
    with db.db() as c: c.execute("UPDATE alerts SET acknowledged=1")   # ignore alerts left by other tests
    a = ev("process", "process_flags.tsv"); t = int(time.time())
    assert db.save_alerts("process", "linux", a, t) == 2 and db.save_alerts("process", "linux", a, t + 300) == 0 and db.save_alerts("process", "linux", a, t + 601) == 2
    assert db.current_score() == 45
def test_parse_error_line():
    rows, errs = parse("auth", (FX / "error.tsv").read_text()); assert rows == [] and errs == ["Limited mode: cannot read /var/log/auth.log (run with sudo)"]
