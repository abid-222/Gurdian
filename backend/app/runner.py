import os, shutil, subprocess, time
from datetime import datetime
from pathlib import Path
from app.parsers import KEY, VAL, annotate, parse
from database.db import add_events, db, save_alerts
from risk.engine import evaluate, score

ROOT = Path(__file__).resolve().parents[2]
FOLDER = {"linux": "bash/linux", "windows": "bash/windows-bridge"}   # fixed whitelist
USER_WATCH = Path(os.environ.get("GUARDIAN_WATCHLIST_USER", ROOT / "data" / "watchlist.user.conf"))   # files added with "Add File to Watch"
CACHE = {}
iso = lambda t: datetime.fromtimestamp(t).isoformat(timespec="seconds")

def find_bash():
    b = shutil.which("bash")
    if b: return b
    for candidate in [
        r"C:\Program Files\Git\bin\bash.exe",
        r"C:\Program Files\Git\usr\bin\bash.exe",
        r"C:\Program Files (x86)\Git\bin\bash.exe",
    ]:
        if os.path.exists(candidate):
            return candidate
    return "bash"

BASH = find_bash()

def run_script(source, module):
    script = ROOT / FOLDER[source] / f"{module}.sh"
    if not script.exists(): return "", [f"{module} not available for {source}"]
    p = subprocess.run([BASH, str(script)], capture_output=True, text=True, timeout=20, shell=False, env={**os.environ, "GUARDIAN_WATCHLIST_USER": str(USER_WATCH)})
    return p.stdout, ([p.stderr.strip()] if p.returncode not in (0, 2) and p.stderr.strip() else [])

def baseline(module, source):
    with db() as c: rows = c.execute("SELECT k, v FROM baselines WHERE module=? AND source=?", (module, source)).fetchall()
    return {r["k"]: r["v"] for r in rows} if rows else None

def save_baseline(module, source):
    CACHE.clear(); rows, _ = parse(module, run_script(source, module)[0])
    pairs = {KEY[module](r): (VAL[module](r) if module in VAL else "") for r in rows if KEY[module](r)}
    with db() as c:
        c.execute("DELETE FROM baselines WHERE module=? AND source=?", (module, source))
        c.executemany("INSERT OR REPLACE INTO baselines VALUES(?,?,?,?)", [(module, source, k, v) for k, v in pairs.items()])
    add_events([(int(time.time()), module, source, "baseline_saved", f"{len(pairs)} items")]); return len(pairs)

def track(module, source, rows, now):   # first-seen time for persistence / usb items
    seen = {}
    with db() as c:
        for r in rows:
            k = KEY[module](r)
            c.execute("INSERT OR IGNORE INTO items VALUES(?,?,?,?,?,?)", (module, source, k, r.get("location") or r.get("name"), now, now))
            c.execute("UPDATE items SET last_seen=? WHERE module=? AND source=? AND k=?", (now, module, source, k))
            seen[k] = iso(c.execute("SELECT first_seen FROM items WHERE module=? AND source=? AND k=?", (module, source, k)).fetchone()[0])
    return seen

def auth_events(source, rows):   # real log times, stored once even if the scan repeats
    kind = {"sudo": "sudo", "su": "su"}
    return [(int(datetime.fromisoformat(r["ts"]).timestamp()), "auth", source, kind.get(r["method"], "login_failed" if r["result"] == "FAILED" else "login_ok"),
             f"{r['username']} from {r['source_ip']} ({r['method']})") for r in rows if r.get("ts") and r["method"] != "session"]

def scan_one(module, source):
    hit = CACHE.get((module, source))
    if hit and time.time() - hit[0] < 5: return hit[1]            # 5 s cache
    t0 = time.time(); out, errs = run_script(source, module)
    rows, e2 = parse(module, out); errs = list(dict.fromkeys(errs + e2)); base = baseline(module, source)
    annotate(module, rows, base, track(module, source, rows, int(t0)) if module in ("persistence", "usb") else None)
    alerts = evaluate(module, rows, base)
    if module == "auth": add_events(auth_events(source, rows))
    with db() as c:
        sid = c.execute("INSERT INTO scans(module,source,ts,duration_ms,row_count) VALUES(?,?,?,?,?)", (module, source, int(t0), int((time.time() - t0) * 1000), len(rows))).lastrowid
    save_alerts(module, source, alerts, t0)
    res = {"module": module, "source": source, "scan_id": sid, "started_at": iso(t0), "rows": rows, "alerts": alerts, "risk_score": score(alerts), "errors": errs}
    CACHE[(module, source)] = (time.time(), res); return res

def history(module):
    with db() as c:
        scans = [dict(r) for r in c.execute("SELECT * FROM scans WHERE module=? ORDER BY id DESC LIMIT 50", (module,))]
        items = [dict(r) for r in c.execute("SELECT source, name, first_seen, last_seen FROM items WHERE module=? ORDER BY first_seen DESC", (module,))]
        snaps = [dict(r) for r in c.execute("SELECT ts, source, cpu, ram, disk, rx, tx FROM system_stats ORDER BY id DESC LIMIT 100")] if module == "system" else []
    return {"module": module, "scans": scans, "items": items, "snapshots": snaps}
