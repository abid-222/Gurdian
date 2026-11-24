import asyncio, datetime, getpass, logging, os, platform, socket, time
from pathlib import Path
from fastapi import WebSocket
import psutil
from starlette.websockets import WebSocketDisconnect
from app.runner import ROOT, scan_one
from database.db import current_score, db

log = logging.getLogger('guardian.terminal')
LOG = ROOT / "data" / "commands.log"
IS_WIN = platform.system() == "Windows"

CMDS = [
    "help",
    "guardian status",
    "guardian procs",
    "guardian top",
    "guardian ports",
    "guardian alerts",
    "guardian score",
    "guardian timeline",
    "whoami",
    "pwd",
    "ls",
    "dir",
    "uptime",
    "date",
    "uname",
    "ps",
    "top",
    "netstat",
    "df",
    "free",
    "ipconfig",
    "ifconfig",
    "clear",
]

DANGEROUS_SUBSTRINGS = [
    "rm ", "rmdir", "del ", "erase", "shutdown", "reboot", "format ", "drop ",
    "mkfs", "dd ", "chmod ", "chown", ":(){ :|:& };:", "kill -9 1", "taskkill /f /im explorer",
    "taskkill /f /im svchost", "curl http", "wget http"
]

def format_bytes(n):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if n < 1024.0:
            return f"{n:.1f} {unit}"
        n /= 1024.0
    return f"{n:.1f} PB"

def term_cmd(raw_cmd):
    cmd = " ".join(raw_cmd.strip().split())
    if not cmd:
        return ""

    lower_cmd = cmd.lower()

    # Safety check: block destructive commands and log refusal
    for bad in DANGEROUS_SUBSTRINGS:
        if bad in lower_cmd or lower_cmd == bad.strip():
            LOG.parent.mkdir(parents=True, exist_ok=True)
            with LOG.open("a", encoding="utf-8") as f:
                f.write(f"{int(time.time())} REFUSED {cmd}\n")
            return f"refused: '{cmd}' is not allowed (read-only safe terminal)"

    # 1. Help
    if lower_cmd == "help":
        lines = [
            "================================================================================",
            "                   SMART OS GUARDIAN SECURE TERMINAL (v6.0)                     ",
            "================================================================================",
            "SECURITY & AUDIT COMMANDS:",
            "  guardian status     - Full OS host posture, memory, CPU, and risk rating",
            "  guardian score      - Current calculated mathematical threat score (0-100)",
            "  guardian procs      - Active processes with flag annotations & CPU usage",
            "  guardian top        - Top resource-consuming processes (htop style)",
            "  guardian ports      - Active listening TCP/UDP sockets & bound processes",
            "  guardian alerts     - Recent security anomalies from SQLite",
            "  guardian timeline   - Chronological forensic event timeline",
            "  guardian scan <mod> - Trigger live inspection (process, network, auth, etc.)",
            "",
            "CORE SHELL UTILITIES:",
            "  whoami, pwd, ls/dir - Host user context, working directory, file browser",
            "  uptime, date, uname - Kernel version, boot time, system timestamp",
            "  ps, top, netstat    - Process tables and socket connections",
            "  df, free, ipconfig  - Disk partitions, RAM capacity, network adapters",
            "  echo <msg>, clear   - Standard terminal output & screen clear",
            "================================================================================"
        ]
        return "\n".join(lines)

    # 2. Score (test requirement: must return digit alone!)
    if lower_cmd in ("guardian score", "score"):
        return str(current_score())

    # 3. Status
    if lower_cmd in ("guardian status", "status"):
        boot = psutil.boot_time()
        uptime_sec = int(time.time() - boot)
        hours, remainder = divmod(uptime_sec, 3600)
        minutes, seconds = divmod(remainder, 60)
        vm = psutil.virtual_memory()
        cpu = psutil.cpu_percent(interval=None)
        disk = psutil.disk_usage(os.getcwd())
        s = current_score()

        return "\n".join([
            f"Host Node      : {platform.node()}",
            f"Operating Sys  : {platform.system()} {platform.release()} ({platform.version()})",
            f"Architecture   : {platform.machine()}",
            f"Uptime         : {hours}h {minutes}m {seconds}s (Boot: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(boot))})",
            f"CPU Utilization: {cpu}% across {psutil.cpu_count(logical=True)} logical cores",
            f"Memory (RAM)   : {format_bytes(vm.used)} / {format_bytes(vm.total)} ({vm.percent}% used)",
            f"Disk Storage   : {format_bytes(disk.used)} / {format_bytes(disk.total)} ({disk.percent}% used)",
            f"Risk Score     : {s} / 100 ({'SAFE' if s < 30 else 'ELEVATED' if s < 70 else 'CRITICAL'})",
            "Defense Daemon : Online (FastAPI + SQLite Engine)"
        ])

    # 4. Top processes (preserves exact test contract headers)
    if lower_cmd in ("guardian top", "top"):
        try:
            procs = []
            for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 'status']):
                try:
                    info = p.info
                    cpu = info.get('cpu_percent') or 0.0
                    mem = (info.get('memory_info').rss // 1024) if info.get('memory_info') else 0
                    procs.append({
                        'pid': info['pid'],
                        'name': info['name'] or 'unknown',
                        'cpu': cpu,
                        'mem': mem,
                        'flag': 'suspect' if cpu > 80.0 else 'ok'
                    })
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue

            top_procs = sorted(procs, key=lambda r: float(r['cpu']), reverse=True)[:10]
            if not top_procs:
                return "no process data"

            lines = [f"{'PID':>6} {'NAME':<20} {'CPU%':>6} {'MEM(KB)':>8} {'FLAG'}"]
            for r in top_procs:
                lines.append(f"{r['pid']:>6} {r['name'][:20]:<20} {r['cpu']:>6.1f} {r['mem']:>8} {r['flag']}")
            return "\n".join(lines)
        except Exception as e:
            return f"error querying top processes: {e}"

    # 5. Process list (guardian procs / procs / ps)
    if lower_cmd in ("guardian procs", "procs", "ps"):
        try:
            # Check native scan first if available
            try:
                native = scan_one("process", "windows" if IS_WIN else "linux")
                rows = native.get("rows", [])
                if rows:
                    return "\n".join(f"{r.get('pid', 0):>6} {str(r.get('name', ''))[:22]:<22} {r.get('flag', 'ok')}" for r in rows[:25])
            except Exception:
                pass

            # Fallback to direct psutil
            lines = [f"{'PID':>6} {'NAME':<24} {'CPU%':>6} {'MEM(MB)':>8} {'STATUS'}"]
            for p in list(psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info', 'status']))[:25]:
                try:
                    info = p.info
                    mem_mb = (info['memory_info'].rss / (1024 * 1024)) if info.get('memory_info') else 0
                    lines.append(f"{info['pid']:>6} {str(info['name'])[:24]:<24} {info['cpu_percent'] or 0:>6.1f} {mem_mb:>8.1f} {info.get('status', 'running')}")
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            return "\n".join(lines)
        except Exception as e:
            return f"error reading processes: {e}"

    # 6. Ports (guardian ports / ports / netstat)
    if lower_cmd in ("guardian ports", "ports", "netstat"):
        try:
            conns = []
            for c in psutil.net_connections(kind='inet'):
                if c.status == 'LISTEN':
                    pname = "unknown"
                    if c.pid:
                        try:
                            pname = psutil.Process(c.pid).name()
                        except Exception:
                            pname = str(c.pid)
                    laddr = f"{c.laddr.ip}:{c.laddr.port}"
                    proto = "tcp" if c.type == socket.SOCK_STREAM else "udp"
                    conns.append((proto, laddr, c.status, c.pid or 0, pname))

            if conns:
                lines = [f"{'PROTO':<6} {'LOCAL ADDRESS':<24} {'STATE':<10} {'PID':>6} {'PROCESS'}"]
                for proto, laddr, state, pid, name in conns[:25]:
                    lines.append(f"{proto:<6} {laddr:<24} {state:<10} {pid:>6} {name}")
                return "\n".join(lines)

            # Fallback to runner
            res = scan_one("network", "windows" if IS_WIN else "linux")
            return "\n".join(f"{r['proto']} {r['local_port']} {r['state']} {r['process']}" for r in res.get("rows", [])) or "no listening ports detected"
        except Exception as e:
            return f"error querying network sockets: {e}"

    # 7. Alerts
    if lower_cmd in ("guardian alerts", "alerts"):
        with db() as c:
            rows = c.execute("SELECT id, ts, module, severity, message, reference FROM alerts ORDER BY id DESC LIMIT 15").fetchall()
        if not rows:
            return "no security alerts registered in database"
        lines = [f"{'ID':>4} {'TIME':<8} {'MODULE':<12} {'SEV':<8} {'MESSAGE'}"]
        for r in rows:
            t_str = time.strftime('%H:%M:%S', time.localtime(r['ts'])) if r['ts'] else '--:--:--'
            lines.append(f"{r['id']:>4} {t_str:<8} {r['module'][:12]:<12} {r['severity']:<8} {r['message']}")
        return "\n".join(lines)

    # 8. Timeline
    if lower_cmd in ("guardian timeline", "timeline"):
        with db() as c:
            events = c.execute("SELECT ts, module, kind, summary FROM events ORDER BY ts DESC LIMIT 15").fetchall()
        if not events:
            return "no timeline events recorded"
        return "\n".join(f"[{time.strftime('%H:%M:%S', time.localtime(r['ts']))}] [{r['module']}] {r['kind']}: {r['summary']}" for r in events)

    # 9. Trigger scan
    if lower_cmd.startswith("guardian scan ") or lower_cmd.startswith("scan "):
        parts = lower_cmd.split()
        target_mod = parts[2] if lower_cmd.startswith("guardian scan ") and len(parts) > 2 else (parts[1] if len(parts) > 1 else "system")
        try:
            res = scan_one(target_mod, "windows" if IS_WIN else "linux")
            rows = res.get("rows", [])
            errs = res.get("errors", [])
            return f"scan completed for '{target_mod}' ({res.get('source')}): {len(rows)} items discovered, {len(errs)} errors."
        except Exception as e:
            return f"scan error: {e}"

    # 10. Shell utilities
    if lower_cmd == "whoami":
        return f"{getpass.getuser()} (host: {platform.node()})"

    if lower_cmd == "pwd":
        return os.getcwd()

    if lower_cmd in ("ls", "dir"):
        try:
            items = os.listdir(os.getcwd())
            lines = [f"{'PERM':<10} {'SIZE':>10}  {'MODIFIED':<19}  {'NAME'}"]
            for item in sorted(items)[:40]:
                p = Path(os.getcwd()) / item
                try:
                    stat = p.stat()
                    is_dir = p.is_dir()
                    perm = "drwxr-xr-x" if is_dir else "-rw-r--r--"
                    size_str = "<DIR>" if is_dir else format_bytes(stat.st_size)
                    mtime_str = datetime.datetime.fromtimestamp(stat.st_mtime).strftime('%Y-%m-%d %H:%M:%S')
                    lines.append(f"{perm:<10} {size_str:>10}  {mtime_str}  {item}{'/' if is_dir else ''}")
                except Exception:
                    lines.append(f"{'???':<10} {'???':>10}  {'????-??-??':<19}  {item}")
            return "\n".join(lines)
        except Exception as e:
            return f"ls error: {e}"

    if lower_cmd in ("uname", "uname -a"):
        return f"{platform.system()} {platform.node()} {platform.release()} {platform.version()} {platform.machine()}"

    if lower_cmd == "uptime":
        uptime_sec = int(time.time() - psutil.boot_time())
        days, rem = divmod(uptime_sec, 86400)
        hours, rem = divmod(rem, 3600)
        mins, secs = divmod(rem, 60)
        return f"system uptime: {days} days, {hours} hours, {mins} minutes, {secs} seconds"

    if lower_cmd == "date":
        return datetime.datetime.now().strftime("%a %b %d %H:%M:%S %Z %Y")

    if lower_cmd in ("free", "mem"):
        vm = psutil.virtual_memory()
        swap = psutil.swap_memory()
        lines = [
            f"{'':<12} {'TOTAL':>12} {'USED':>12} {'FREE':>12} {'PERCENT':>10}",
            f"{'Mem:':<12} {format_bytes(vm.total):>12} {format_bytes(vm.used):>12} {format_bytes(vm.available):>12} {vm.percent:>9.1f}%",
            f"{'Swap:':<12} {format_bytes(swap.total):>12} {format_bytes(swap.used):>12} {format_bytes(swap.free):>12} {swap.percent:>9.1f}%"
        ]
        return "\n".join(lines)

    if lower_cmd in ("df", "disk"):
        lines = [f"{'FILESYSTEM':<20} {'TOTAL':>10} {'USED':>10} {'FREE':>10} {'USE%':>6} {'MOUNT'}"]
        for part in psutil.disk_partitions(all=False)[:6]:
            try:
                usage = psutil.disk_usage(part.mountpoint)
                lines.append(f"{part.device[:20]:<20} {format_bytes(usage.total):>10} {format_bytes(usage.used):>10} {format_bytes(usage.free):>10} {usage.percent:>5.1f}% {part.mountpoint}")
            except Exception:
                continue
        return "\n".join(lines)

    if lower_cmd in ("ipconfig", "ifconfig"):
        addrs = psutil.net_if_addrs()
        lines = []
        for iface, addr_list in addrs.items():
            lines.append(f"Interface: {iface}")
            for a in addr_list:
                family_str = "IPv4" if a.family == socket.AF_INET else ("IPv6" if a.family == getattr(socket, 'AF_INET6', -1) else "MAC")
                lines.append(f"  {family_str:<6} : {a.address} (netmask: {a.netmask})")
        return "\n".join(lines) if lines else "no network interfaces found"

    if lower_cmd.startswith("echo "):
        return cmd[5:]

    if lower_cmd.startswith("cat ") or lower_cmd.startswith("type "):
        target = cmd.split(maxsplit=1)[1].strip()
        try:
            p = (Path(os.getcwd()) / target).resolve()
            root_res = ROOT.resolve()
            # Path traversal prevention: strictly confined to project root
            if root_res not in p.parents and p != root_res:
                return f"cat: permission denied: '{target}' is outside project root"
        except Exception:
            return f"cat: invalid path '{target}'"
        if not p.exists():
            return f"cat: {target}: No such file or directory"
        if p.is_dir():
            return f"cat: {target}: Is a directory"
        if p.stat().st_size > 32 * 1024:
            return f"cat: {target}: File exceeds 32KB view limit"
        try:
            return p.read_text(encoding="utf-8", errors="replace")[:4000]
        except Exception as e:
            return f"cat: error reading {target}: {e}"

    if lower_cmd == "clear":
        return "\x1b[2J\x1b[H"

    # Any unknown command: log and return helpful message
    LOG.parent.mkdir(parents=True, exist_ok=True)
    with LOG.open("a", encoding="utf-8") as f:
        f.write(f"{int(time.time())} REFUSED {cmd}\n")
    return f"refused: '{cmd}' is not allowed (read-only safe shell). Type 'help' for available commands."

async def terminal_ws(ws: WebSocket):
    await ws.accept()
    try:
        while True:
            raw = await ws.receive_text()
            if len(raw) > 1024:
                await ws.send_text("refused: command exceeds 1024 character buffer limit")
                continue
            out = await asyncio.to_thread(term_cmd, raw)
            await ws.send_text(out)
    except (WebSocketDisconnect, ConnectionError):
        pass
    except Exception:
        log.exception("terminal websocket failed")
