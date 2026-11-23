import asyncio, logging, time
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from app.runner import ROOT, scan_one
from database.db import current_score, db

log = logging.getLogger('guardian.terminal')
LOG = ROOT / "data" / "commands.log"
CMDS = ["help", "guardian status", "guardian procs", "guardian top", "guardian ports", "guardian alerts", "guardian score", "guardian timeline"]

def term_cmd(cmd):   # whitelist only; everything else is refused and logged
    cmd = " ".join(cmd.split())
    if cmd == "help": return "commands: " + ", ".join(CMDS)
    if cmd == "guardian status":
        rows = scan_one("system", "linux")["rows"]; return "\n".join(f"{k}: {v}" for k, v in rows[0].items()) if rows else "no data"
    if cmd == "guardian procs": return "\n".join(f"{r['pid']:>6} {r['name']:<22} {r['flag']}" for r in scan_one("process", "linux")["rows"][:25])
    if cmd == "guardian top":
        rows = scan_one("process", "linux")["rows"]
        top_procs = sorted(rows, key=lambda r: float(r.get("cpu", 0)), reverse=True)[:10]
        if not top_procs: return "no process data"
        lines = [f"{'PID':>6} {'NAME':<20} {'CPU%':>6} {'MEM(KB)':>8} {'FLAG'}"]
        for r in top_procs:
            lines.append(f"{r['pid']:>6} {r['name']:<20} {r.get('cpu', '0'):>6} {r.get('mem', '0'):>8} {r.get('flag', 'ok')}")
        return "\n".join(lines)
    if cmd == "guardian ports":
        res = scan_one("network", "linux"); return "\n".join(f"{r['proto']} {r['local_port']} {r['state']} {r['process']}" for r in res["rows"]) or "\n".join(res["errors"]) or "none"
    if cmd == "guardian alerts":
        with db() as c: return "\n".join(f"[{r['module']}] {r['severity']} {r['message']}" for r in c.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 10")) or "no alerts"
    if cmd == "guardian score": return str(current_score())
    if cmd == "guardian timeline":
        with db() as c:
            events = c.execute("SELECT ts, module, kind, summary FROM events ORDER BY ts DESC LIMIT 10").fetchall()
        if not events: return "no timeline events recorded"
        return "\n".join(f"[{time.strftime('%H:%M:%S', time.localtime(r['ts']))}] [{r['module']}] {r['kind']}: {r['summary']}" for r in events)
    if cmd:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a") as f: f.write(f"{int(time.time())} REFUSED {cmd}\n")
        return f"refused: '{cmd}' is not allowed (read-only terminal)"
    return ""

async def terminal_ws(ws: WebSocket):
    await ws.accept()
    try:
        while True: await ws.send_text(await asyncio.to_thread(term_cmd, await ws.receive_text()))
    except (WebSocketDisconnect, ConnectionError):
        pass
    except Exception:
        log.exception("terminal websocket failed")
