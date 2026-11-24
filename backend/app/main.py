import hmac, os, platform, re, secrets, sys, time
from pathlib import Path
from fastapi import APIRouter, Depends, FastAPI, HTTPException, Request, WebSocket, WebSocketException
from fastapi.middleware.cors import CORSMiddleware
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from app import auth_guard, deadlock, live, report, terminal
from app.parsers import COLS, KEY
from app.runner import BASH, CACHE, FOLDER, ROOT, USER_WATCH, history, save_baseline, scan_one
from database import db as database
from risk.engine import level

TOKEN = os.environ.get("GUARDIAN_TOKEN") or secrets.token_hex(16)   # start.sh exports it; the Vite proxy sends it
database.init()
app = FastAPI(title="Smart OS Guardian")
app.add_middleware(CORSMiddleware, allow_origins=["http://localhost:5173", "http://127.0.0.1:5173", "http://localhost:8000", "http://127.0.0.1:8000"], allow_methods=["*"], allow_headers=["*"])

@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    return response

def ok_token(conn): return hmac.compare_digest(conn.headers.get("x-guardian-token", ""), TOKEN)
def auth_http(request: Request):
    if not ok_token(request): raise HTTPException(401, "bad or missing X-Guardian-Token")
    if auth_guard.is_protection_enabled() and request.url.path not in {"/api/auth/status", "/api/auth/login"}:
        if not auth_guard.verify_session(request.headers.get("x-session-token")):
            raise HTTPException(401, "session login required")
def auth_ws(ws: WebSocket):
    if not ok_token(ws): raise WebSocketException(code=1008)
api = APIRouter(dependencies=[Depends(auth_http)])

@app.get("/api/health")
def health(): return {"ok": True, "sources": list(FOLDER)}

@api.api_route("/api/scan/{module}", methods=["GET", "POST"])
def scan(module: str, source: str = "linux", fresh: bool = False):
    if module not in COLS or source not in FOLDER: raise HTTPException(404)   # fixed lists only
    return scan_one(module, source, fresh=fresh)

@api.post("/api/process/{pid}/kill")
def kill_process(pid: int):
    import psutil
    if pid <= 4 or pid == os.getpid():
        raise HTTPException(400, "cannot terminate critical system or guardian process")
    try:
        p = psutil.Process(pid)
        p.terminate()
        CACHE.clear()
        return {"ok": True, "pid": pid}
    except psutil.NoSuchProcess:
        CACHE.clear()
        return {"ok": True, "pid": pid, "note": "already exited"}
    except psutil.AccessDenied:
        raise HTTPException(403, f"permission denied terminating PID {pid}")
    except Exception as e:
        raise HTTPException(500, str(e))

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
    if severity:
        sev = severity.upper()
        if sev not in {"CRITICAL", "HIGH", "MEDIUM", "LOW", "SAFE", "WARNING"}:
            raise HTTPException(400, "invalid severity filter")
        q += " WHERE severity=?"; a = (sev,)
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
    def _flt(v, default=0.0):
        try: return float(v)
        except (ValueError, TypeError): return default
    row = (
        int(time.time()),
        str(d.get("source", "linux"))[:20],
        _flt(d.get("cpu")),
        _flt(d.get("ram")),
        _flt(d.get("disk")),
        _flt(d.get("rx")),
        _flt(d.get("tx")),
    )
    with database.db() as c: c.execute("INSERT INTO system_stats(ts,source,cpu,ram,disk,rx,tx) VALUES(?,?,?,?,?,?,?)", row)
    database.add_events([(row[0], "system", row[1], "snapshot", f"cpu {row[2]}% ram {row[3]}% disk {row[4]}%")])
    return {"ok": True}

@api.post("/api/watch")   # File Vault: add a file to the watchlist (path is validated and is never passed to a shell)
def watch(d: dict):
    p = str(d.get("path", "")).strip()
    is_posix = bool(re.fullmatch(r"/[\w./@+ -]{1,300}", p))
    is_win = bool(re.fullmatch(r"[A-Za-z]:[/\\][\w./@+ \\-]{1,300}", p))
    if (not is_posix and not is_win) or ".." in p or not os.path.isfile(p) or os.path.getsize(p) > 5_000_000:
        raise HTTPException(400, "invalid path (absolute file, max 5 MB)")
    USER_WATCH.parent.mkdir(parents=True, exist_ok=True)   # your own list, the shipped watchlist.conf is never modified
    txt = USER_WATCH.read_text(encoding="utf-8") if USER_WATCH.exists() else ""
    if p not in txt.split("\n"): USER_WATCH.write_text(txt.rstrip("\n") + ("\n" if txt else "") + p + "\n", encoding="utf-8")
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
    # Matrix dimension sanity & DoS boundary checks
    if not (1 <= len(avail) <= 20 and 1 <= len(max_m) <= 50 and len(max_m) == len(alloc)):
        raise HTTPException(400, "matrix dimensions must be 1-50 processes and 1-20 resources")
    return deadlock.bankers_safety_algorithm(avail, max_m, alloc)

@api.post("/api/deadlock/wfg")
def deadlock_wfg(d: dict):
    graph = d.get("graph", {})
    if not isinstance(graph, dict): raise HTTPException(400, "graph must be dict")
    cycle = deadlock.detect_deadlock_cycle(graph)
    return {"has_cycle": cycle is not None, "cycle": cycle}

@api.get("/api/auth/status")
def auth_status(request: Request):
    return auth_guard.get_status(request.headers.get("x-session-token"))

@api.post("/api/auth/setup")
def auth_setup(d: dict, request: Request):
    mode = str(d.get("mode", "open"))
    if mode not in ("open", "protected"): raise HTTPException(400, "mode must be 'open' or 'protected'")
    try:
        return auth_guard.setup_auth(mode, str(d.get("username", "")), str(d.get("password", "")), request.headers.get("x-session-token"))
    except PermissionError as e: raise HTTPException(401, str(e))
    except ValueError as e: raise HTTPException(400, str(e))

@api.post("/api/auth/login")
def auth_login(d: dict):
    try:
        return auth_guard.login(str(d.get("username", "")), str(d.get("password", "")))
    except PermissionError as e: raise HTTPException(401, str(e))

@api.post("/api/auth/logout")
def auth_logout(request: Request):
    return auth_guard.logout(request.headers.get("x-session-token"))

@api.post("/api/auth/disable")
def auth_disable(d: dict, request: Request):
    try:
        return auth_guard.disable_auth(str(d.get("password", "")), request.headers.get("x-session-token"))
    except PermissionError as e: raise HTTPException(401, str(e))

@api.post("/api/auth/change-password")
def auth_change_password(d: dict, request: Request):
    try:
        return auth_guard.change_password(
            str(d.get("old_password", "")),
            str(d.get("new_password", "")),
            str(d.get("new_username", "")),
            request.headers.get("x-session-token"),
        )
    except PermissionError as e: raise HTTPException(401, str(e))
    except ValueError as e: raise HTTPException(400, str(e))

@api.get("/api/report")
def get_report(fmt: str = "html"):
    if fmt not in ("html", "txt", "json"): raise HTTPException(404)
    return report.build(fmt)

app.include_router(api)

@app.websocket("/ws/live")
async def ws_live(ws: WebSocket, source: str = "linux", _=Depends(auth_ws)): await live.live_ws(ws, "windows" if source == "windows" else "linux")
@app.websocket("/api/terminal")
async def ws_term(ws: WebSocket, _=Depends(auth_ws)): await terminal.terminal_ws(ws)
