import hmac, os, platform, re, secrets, sys, time
from pathlib import Path
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketException
from fastapi.middleware.cors import CORSMiddleware
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import deadlock, live, report, terminal
from app.parsers import COLS, KEY
from app.runner import BASH, CACHE, FOLDER, ROOT, USER_WATCH, history, save_baseline, scan_one
from database import db as database
from risk.engine import level

TOKEN = os.environ.get("GUARDIAN_TOKEN") or secrets.token_hex(16)   # start.sh exports it; the Vite proxy sends it
database.init()
app = FastAPI(title="Smart OS Guardian")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173"], allow_methods=["*"], allow_headers=["*"])

def ok_token(conn): return hmac.compare_digest(conn.headers.get("x-guardian-token", ""), TOKEN)
def auth_http(request: Request):
    if not ok_token(request): raise HTTPException(401, "bad or missing X-Guardian-Token")
def auth_ws(ws: WebSocket):
    if not ok_token(ws): raise WebSocketException(code=1008)
api = APIRouter(dependencies=[Depends(auth_http)])

@app.get("/api/health")
def health(): return {"ok": True, "sources": list(FOLDER)}

@api.api_route("/api/scan/{module}", methods=["GET", "POST"])
def scan(module: str, source: str = "linux"):
    if module not in COLS or source not in FOLDER: raise HTTPException(404)   # fixed lists only
    return scan_one(module, source)

@api.post("/api/baseline/{module}")
def baseline(module: str, source: str = "linux"):
    if module not in KEY or source not in FOLDER: raise HTTPException(404)
    return {"saved": save_baseline(module, source)}

@api.get("/api/history/{module}")
def hist(module: str):
    if module not in COLS: raise HTTPException(404)
    return history(module)

@api.get("/api/alerts")
def alerts(severity: str | None = None):
    q, a = "SELECT * FROM alerts", ()
    if severity: q += " WHERE severity=?"; a = (severity.upper(),)
    with database.db() as c: return [dict(r) for r in c.execute(q + " ORDER BY id DESC LIMIT 200", a)]

@api.post("/api/alerts/{aid}/ack")
def ack(aid: int):
    with database.db() as c: c.execute("UPDATE alerts SET acknowledged=1 WHERE id=?", (aid,))
    database.record_score(); return {"ok": True}

@api.get("/api/score")
def score(): s = database.current_score(); return {"score": s, "level": level(s)}

@api.get("/api/timeline")
def timeline(hours: int = 24, module: str | None = None):
    q, a = "SELECT ts, module, source, kind, summary FROM events WHERE ts>?", [int(time.time()) - max(1, min(hours, 24 * 30)) * 3600]
    if module in COLS: q += " AND module=?"; a.append(module)
    with database.db() as c: return [dict(r) for r in c.execute(q + " ORDER BY ts DESC LIMIT 500", a)]

@api.get("/api/score/history")
def score_history(hours: int = 24):
    with database.db() as c: return [dict(r) for r in c.execute("SELECT ts, score FROM score_history WHERE ts>? ORDER BY ts", (int(time.time()) - max(1, min(hours, 24 * 30)) * 3600,))]

@api.get("/api/info")
def info():
    mem = 0; up = 0
    if os.path.exists("/proc/meminfo"):
        mem = int([l for l in open("/proc/meminfo") if l.startswith("MemTotal")][0].split()[1]) // 1024
    else:
        try:
            import psutil
            mem = int(psutil.virtual_memory().total // (1024 * 1024))
        except Exception:
            pass
    if os.path.exists("/proc/uptime"):
        up = int(float(open("/proc/uptime").read().split()[0]))
    else:
        try:
            import psutil
            up = int(time.time() - psutil.boot_time())
        except Exception:
            pass
    return {"os": platform.platform(), "kernel": platform.release(), "host": platform.node(), "cpus": os.cpu_count(), "mem_mb": mem, "uptime_s": up}

@api.post("/api/snapshot")
def snapshot(d: dict):
    row = (int(time.time()), d.get("source", "linux"), d.get("cpu"), d.get("ram"), d.get("disk"), d.get("rx"), d.get("tx"))
    with database.db() as c: c.execute("INSERT INTO system_stats(ts,source,cpu,ram,disk,rx,tx) VALUES(?,?,?,?,?,?,?)", row)
    database.add_events([(row[0], "system", row[1], "snapshot", f"cpu {row[2]}% ram {row[3]}% disk {row[4]}%")])
    return {"ok": True}

@api.post("/api/watch")   # File Vault: add a file to the watchlist (path is validated and is never passed to a shell)
def watch(d: dict):
    p = str(d.get("path", ""))
    if not re.fullmatch(r"/[\w./@+ -]{1,300}", p) or ".." in p or not os.path.isfile(p) or os.path.getsize(p) > 5_000_000: raise HTTPException(400, "invalid path (absolute file, max 5 MB)")
    USER_WATCH.parent.mkdir(parents=True, exist_ok=True)   # your own list, the shipped watchlist.conf is never modified
    txt = USER_WATCH.read_text() if USER_WATCH.exists() else ""
    if p not in txt.split("\n"): USER_WATCH.write_text(txt.rstrip("\n") + ("\n" if txt else "") + p + "\n")
    CACHE.clear(); return {"ok": True}

DEMO = {"linux": {"port", "temp", "deleted", "file", "reset"}, "windows": {"port", "temp", "startup", "reset"}}
@api.post("/api/demo/{action}")
def demo(action: str, source: str = "linux"):
    import subprocess
    if source not in DEMO or action not in DEMO[source]: raise HTTPException(404)
    p = subprocess.run([BASH, str(ROOT / "bash/demo" / f"{source}-lab.sh"), action], capture_output=True, text=True, timeout=20, shell=False)
    CACHE.clear(); return {"ok": p.returncode == 0, "output": (p.stdout + p.stderr).strip()}

@api.post("/api/deadlock/action/{action}")
def deadlock_action(action: str, source: str = "linux"):
    if action not in {"create", "prevent", "resolve", "status", "cleanup"}: raise HTTPException(404, "invalid deadlock action")
    return deadlock.run_deadlock_action(action, source)

@api.post("/api/deadlock/banker")
def deadlock_banker(d: dict):
    avail = d.get("available", [])
    max_m = d.get("maximum", [])
    alloc = d.get("allocation", [])
    if not isinstance(avail, list) or not isinstance(max_m, list) or not isinstance(alloc, list):
        raise HTTPException(400, "available, maximum, allocation must be lists")
    return deadlock.bankers_safety_algorithm(avail, max_m, alloc)

@api.post("/api/deadlock/wfg")
def deadlock_wfg(d: dict):
    graph = d.get("graph", {})
    if not isinstance(graph, dict): raise HTTPException(400, "graph must be dict")
    cycle = deadlock.detect_deadlock_cycle(graph)
    return {"has_cycle": cycle is not None, "cycle": cycle}

@api.get("/api/report")
def get_report(fmt: str = "html"):
    if fmt not in ("html", "txt", "json"): raise HTTPException(404)
    return report.build(fmt)

app.include_router(api)

@app.websocket("/ws/live")
async def ws_live(ws: WebSocket, source: str = "linux", _=Depends(auth_ws)): await live.live_ws(ws, "windows" if source == "windows" else "linux")
@app.websocket("/api/terminal")
async def ws_term(ws: WebSocket, _=Depends(auth_ws)): await terminal.terminal_ws(ws)
