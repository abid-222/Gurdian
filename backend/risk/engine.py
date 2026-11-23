from datetime import datetime
from app.parsers import annotate
from risk.rules import LEVELS, RULES

HIDE = {"status", "ts", "baseline_sha256", "first_seen"}
raw = lambda r: "\t".join(str(v) for k, v in r.items() if k not in HIDE)   # the evidence line

def _brute(rows):   # 5+ failed logins from ONE ip inside 10 minutes
    by, out = {}, []
    for r in rows:
        if r.get("result") == "FAILED" and r.get("ts"): by.setdefault(r["source_ip"], []).append(r)
    for ip, l in by.items():
        l.sort(key=lambda r: r["ts"]); t = [datetime.fromisoformat(r["ts"]) for r in l]
        for i in range(len(t) - 4):
            if (t[i + 4] - t[i]).total_seconds() <= 600:
                out.append(({"ip": ip, "count": sum(1 for x in t if 0 <= (x - t[i]).total_seconds() <= 600)}, l[i + 4])); break
    return out

def _hot(rows):     # CPU or RAM > 90% for 10 s
    s = sorted(((datetime.fromisoformat(r["ts"]), r) for r in rows if r.get("ts")), key=lambda x: x[0])
    if not s: return []
    w = [x for x in s if (s[-1][0] - x[0]).total_seconds() <= 10]
    hot = lambda r: float(r["cpu_pct"]) > 90 or float(r["ram_pct"]) > 90
    if len(w) >= 2 and (w[-1][0] - w[0][0]).total_seconds() >= 9 and all(hot(r) for _, r in w): return [({"source": w[-1][1]["source"]}, w[-1][1])]
    return []

def _after_brute(rows):   # successful login from an IP that failed 5+ times in the 10 min before
    out, fails = [], {}
    for r in sorted((r for r in rows if r.get("ts") and r.get("source_ip") not in (None, "-")), key=lambda r: r["ts"]):
        t = datetime.fromisoformat(r["ts"])
        if r["result"] == "FAILED": fails.setdefault(r["source_ip"], []).append(t)
        else:
            n = sum(1 for x in fails.get(r["source_ip"], []) if 0 <= (t - x).total_seconds() <= 600)
            if n >= 5: out.append(({"ip": r["source_ip"], "count": n, "user": r["username"]}, r))
    return out

def _sudo(rows):
    by = {}
    for r in rows:
        if r.get("method") in ("sudo", "su"): by.setdefault((r["username"], r["method"]), []).append(r)
    return [({"username": u, "method": m}, l[-1]) for (u, m), l in by.items()]

SKIP_NEW = {"powershell.exe", "conhost.exe", "wmiprvse.exe", "wslhost.exe"}   # helpers started by the collectors themselves
def _newproc(rows):
    n = [r for r in rows if r.get("status") == "NEW" and r["name"].lower() not in SKIP_NEW]
    names = sorted({r["name"] for r in n})
    return [({"count": len(names), "names": ", ".join(names[:5]) + (" ..." if len(names) > 5 else "")}, n[0])] if n else []

is_hosts = lambda r: r["path"].lower().replace("\\", "/").endswith("/etc/hosts")
new = lambda r: r.get("status") == "NEW"
PRED = {
 "brute_force": _brute, "high_resource": _hot, "login_after_bruteforce": _after_brute, "sudo_su_use": _sudo, "new_process": _newproc,
 "file_changed": lambda rows: [({"path": r["path"]}, r) for r in rows if r.get("status") == "CHANGED" and not is_hosts(r)],
 "hosts_file_changed": lambda rows: [({"path": r["path"]}, r) for r in rows if r.get("status") == "CHANGED" and is_hosts(r)],
 "new_user_account": lambda rows: [(r, r) for r in rows if new(r) and r["type"] == "user_account"],
 "new_suid_file": lambda rows: [(r, r) for r in rows if new(r) and r["type"] == "suid_file"],
 "new_world_writable": lambda rows: [(r, r) for r in rows if new(r) and r["type"] == "world_writable"],
 "shell_profile_changed": lambda rows: [(r, r) for r in rows if new(r) and r["type"] == "shell_rc"],
 "unusual_external_ip": lambda rows: [(r, r) for r in rows if new(r) and r["state"] == "ESTABLISHED"],
 "new_cron_service": lambda rows: [(r, r) for r in rows if new(r) and r["source"] == "linux" and r["type"] in ("cron", "service")],
 "new_run_key": lambda rows: [(r, r) for r in rows if new(r) and r["source"] == "windows" and r["type"] in ("run_key", "sched_task", "startup_folder")],
 "new_ssh_key": lambda rows: [(r, r) for r in rows if new(r) and r["type"] == "ssh_key"],
 "deleted_binary": lambda rows: [(r, r) for r in rows if r.get("flag") == "deleted_binary"],
 "tmp_exec": lambda rows: [(r, r) for r in rows if r.get("flag") == "tmp_exec"],
 "new_listening_port": lambda rows: [(r, r) for r in rows if new(r) and r["state"] == "LISTEN"],
 "new_usb": lambda rows: [(r, r) for r in rows if new(r)],
}

def evaluate(module, rows, baseline=None):
    rows, out = annotate(module, rows, baseline), []
    for rule in RULES:
        if rule["module"] != module: continue
        for v, r in PRED[rule["id"]](rows):
            out.append({"rule": rule["id"], "severity": rule["severity"], "points": rule["points"], "reference": rule["reference"],
                        "message": rule["message"].format(**v), "evidence": raw(r), "source": r.get("source")})
    return out

def score(alerts):  # distinct rules only
    return min(100, sum({a["rule"]: a["points"] for a in alerts}.values()))

def level(s): return next(n for m, n in LEVELS if s >= m)
