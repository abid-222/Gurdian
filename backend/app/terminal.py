import asyncio, logging, time
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from app.runner import ROOT, scan_one
from database.db import current_score, db

log = logging.getLogger('guardian.terminal')
LOG = ROOT / "data" / "commands.log"
CMDS = ["help", "guardian status", "guardian procs", "guardian ports", "guardian alerts", "guardian score"]

def term_cmd(cmd):   # whitelist only; everything else is refused and logged
    cmd = " ".join(cmd.split())
    if cmd == "help": return "commands: " + ", ".join(CMDS)
    if cmd == "guardian status":
        rows = scan_one("system", "linux")["rows"]; return "\n".join(f"{k}: {v}" for k, v in rows[0].items()) if rows else "no data"
    if cmd == "guardian procs": return "\n".join(f"{r['pid']:>6} {r['name']:<22} {r['flag']}" for r in scan_one("process", "linux")["rows"][:25])
    if cmd == "guardian ports":
        res = scan_one("network", "linux"); return "\n".join(f"{r['proto']} {r['local_port']} {r['state']} {r['process']}" for r in res["rows"]) or "\n".join(res["errors"]) or "none"
    if cmd == "guardian alerts":
        with db() as c: return "\n".join(f"[{r['module']}] {r['severity']} {r['message']}" for r in c.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 10")) or "no alerts"
    if cmd == "guardian score": return str(current_score())
    if cmd:
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
