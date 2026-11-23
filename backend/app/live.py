import asyncio, logging, os
from datetime import datetime
from fastapi import WebSocket
from starlette.websockets import WebSocketDisconnect
from database.db import save_alerts
from risk.engine import evaluate

log = logging.getLogger('guardian.live')

def _check(buf, source, cpu, ram):   # CPU or RAM > 90% for 10 s -> LOW alert
    buf.append({"source": source, "cpu_pct": str(cpu), "ram_pct": str(ram), "ts": datetime.now().isoformat(timespec="seconds")})
    del buf[:-12]
    a = evaluate("system", buf)
    if a:
        save_alerts("system", source, a)

def read_cores():
    out = []
    if not os.path.exists("/proc/stat"):
        try:
            import psutil
            times = psutil.cpu_times(percpu=True)
            for t in times:
                busy = t.user + getattr(t, 'system', 0)
                total = busy + getattr(t, 'idle', 0)
                out.append((int(busy * 100), int(total * 100)))
            return out
        except Exception:
            return [(0, 100)]
    for l in open("/proc/stat"):
        if l.startswith("cpu") and l[3].isdigit():
            v = list(map(int, l.split()[1:]))
            out.append((sum(v) - v[3] - v[4], sum(v)))
    return out

def net_bytes():
    rx = tx = 0
    if not os.path.exists("/proc/net/dev"):
        try:
            import psutil
            n = psutil.net_io_counters()
            return int(n.bytes_recv), int(n.bytes_sent)
        except Exception:
            return 0, 0
    for l in list(open("/proc/net/dev"))[2:]:
        n, d = l.split(":")
        f = d.split()
        if n.strip() != "lo":
            rx += int(f[0])
            tx += int(f[8])
    return rx, tx

async def live_ws(ws: WebSocket, source: str):
    await ws.accept()
    buf = []
    try:
        prev, nb = read_cores(), net_bytes()
        while True:
            await asyncio.sleep(1)
            cur, nb2 = read_cores(), net_bytes()
            cores = [round(100 * (b2 - b1) / max(t2 - t1, 1), 1) for (b1, t1), (b2, t2) in zip(prev, cur)]
            if not cores:
                cores = [0.0]

            mem_total = 1
            mem_avail = 1
            if os.path.exists("/proc/meminfo"):
                mem = {l.split(":")[0]: int(l.split()[1]) for l in open("/proc/meminfo") if l.split(":")[0] in ("MemTotal", "MemAvailable")}
                mem_total = mem.get("MemTotal", 1)
                mem_avail = mem.get("MemAvailable", 1)
            else:
                try:
                    import psutil
                    vm = psutil.virtual_memory()
                    mem_total = vm.total
                    mem_avail = vm.available
                except Exception:
                    pass

            disk_pct = 0.0
            if hasattr(os, "statvfs"):
                try:
                    st = os.statvfs("/")
                    disk_pct = round(100 * (1 - st.f_bavail / st.f_blocks), 1)
                except Exception:
                    pass
            else:
                try:
                    import psutil
                    disk_path = "C:\\" if os.name == 'nt' else "/"
                    disk_pct = round(psutil.disk_usage(disk_path).percent, 1)
                except Exception:
                    pass

            cpu = round(sum(cores) / max(len(cores), 1), 1)
            ram = round(100 * (1 - mem_avail / max(mem_total, 1)), 1)
            rx = max(0.0, round((nb2[0] - nb[0]) / 1024, 1))
            tx = max(0.0, round((nb2[1] - nb[1]) / 1024, 1))

            await asyncio.to_thread(_check, buf, source, cpu, ram)
            await ws.send_json({
                "cpu": cpu,
                "cores": cores,
                "ram": ram,
                "disk": disk_pct,
                "rx": rx,
                "tx": tx,
                "source": source
            })
            prev, nb = cur, nb2
    except (WebSocketDisconnect, ConnectionError):
        pass
    except Exception as e:
        log.exception("live websocket failed")
        try:
            await ws.send_json({"error": f"{type(e).__name__}: {e}"})
        except Exception:
            pass
