import asyncio, datetime, getpass, json, logging, os, platform, shlex, socket, subprocess, time
from pathlib import Path
from fastapi import WebSocket
import psutil
from starlette.websockets import WebSocketDisconnect
from app import deadlock
from app.runner import ROOT, scan_one
from database.db import current_score, db, record_score

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
    "guardian timeline",
    "guardian score",
    "guardian persistence",
    "guardian integrity",
    "guardian usb",
    "guardian deadlock status",
    "guardian simulate port",
    "guardian simulate reset",
    "whoami",
    "id",
    "hostname",
    "pwd",
    "ls -la",
    "uptime",
    "date",
    "uname -a",
    "ps aux",
    "ss -tulnp",
    "lsof -i",
    "df -h",
    "free -m",
    "ipconfig",
    "clear",
]

DANGEROUS_SUBSTRINGS = [
    "rm ", "rmdir", "del ", "erase", "shutdown", "reboot", "format ", "drop ",
    "mkfs", "dd ", "chmod ", "chown", ":(){ :|:& };:", "kill -9 1", "taskkill /f /im explorer",
    "taskkill /f /im svchost", "curl http", "wget http", ">", ">>", ";", "&&", "$(", "`",
]


def format_bytes(n):
    for unit in ['B', 'KB', 'MB', 'GB', 'TB']:
        if n < 1024.0:
            return f"{n:.1f} {unit}"
        n /= 1024.0
    return f"{n:.1f} PB"


def _apply_pipe_filter(text: str, pipe_cmd: str) -> str:
    """Safely applies Linux text-processing filters (grep, head, tail, wc, sort, uniq)."""
    try:
        parts = shlex.split(pipe_cmd)
    except ValueError:
        parts = pipe_cmd.split()
    if not parts:
        return text

    op = parts[0].lower()
    args = parts[1:]
    lines = text.splitlines()

    if op == "grep":
        ignore_case = "-i" in args
        invert = "-v" in args
        patterns = [a for a in args if not a.startswith("-")]
        if not patterns:
            return "grep: missing pattern"
        pat = patterns[0].lower() if ignore_case else patterns[0]
        matched = []
        for ln in lines:
            hay = ln.lower() if ignore_case else ln
            hit = pat in hay
            if (hit and not invert) or (not hit and invert):
                matched.append(ln)
        return "\n".join(matched) if matched else "(no matches)"

    if op == "head":
        n = 10
        for i, a in enumerate(args):
            if a == "-n" and i + 1 < len(args) and args[i + 1].isdigit():
                n = int(args[i + 1])
            elif a.startswith("-") and a[1:].isdigit():
                n = int(a[1:])
        return "\n".join(lines[:max(1, min(n, 200))])

    if op == "tail":
        n = 10
        for i, a in enumerate(args):
            if a == "-n" and i + 1 < len(args) and args[i + 1].isdigit():
                n = int(args[i + 1])
            elif a.startswith("-") and a[1:].isdigit():
                n = int(a[1:])
        return "\n".join(lines[-max(1, min(n, 200)):])

    if op == "wc":
        if "-l" in args:
            return str(len(lines))
        if "-w" in args:
            return str(sum(len(ln.split()) for ln in lines))
        if "-c" in args:
            return str(len(text))
        return f"  {len(lines)}  {sum(len(ln.split()) for ln in lines)}  {len(text)}"

    if op == "sort":
        rev = "-r" in args
        return "\n".join(sorted(lines, reverse=rev))

    if op == "uniq":
        out = []
        for ln in lines:
            if not out or out[-1] != ln:
                out.append(ln)
        return "\n".join(out)

    return f"pipe: '{op}' is not allowed in safe sandbox (allowed: grep, head, tail, wc, sort, uniq)"


def _run_single_cmd(cmd: str) -> str:
    lower_cmd = cmd.lower()

    # 1. Help
    if lower_cmd == "help":
        return "\n".join([
            "\x1b[36m================================================================================\x1b[0m",
            "\x1b[1;32m               SMART OS GUARDIAN UNIFIED SOC TERMINAL (v7.0)                  \x1b[0m",
            "\x1b[36m================================================================================\x1b[0m",
            "\x1b[33mUNIFIED GUARDIAN CLI:\x1b[0m",
            "  guardian status              - Host posture, CPU, RAM, disk, and risk rating",
            "  guardian score               - Numeric threat score (0-100)",
            "  guardian procs / top / ports - Live processes, top CPU, and listening sockets",
            "  guardian alerts / timeline   - SQLite alerts and chronological forensic events",
            "  guardian inspect <pid>       - Deep-dive process tree, cmdline, and open ports",
            "  guardian ack <id|all>        - Acknowledge security alert(s) and update score",
            "  guardian deadlock <action>   - Control Deadlock Lab (status|create|prevent|resolve|cleanup)",
            "  guardian simulate <action>   - Trigger/reset Attack Sim (port|temp|startup|reset)",
            "  guardian scan <mod>          - Scan module (process|network|integrity|auth|persistence|usb)",
            "",
            "\x1b[33mLINUX / BASH UTILITIES & PIPES:\x1b[0m",
            "  ps [aux], ss [-tulnp], lsof  - Process & network socket inspection",
            "  ls [-la], pwd, cat <file>    - Project-scoped file inspection",
            "  uname [-a], id, hostname     - Kernel, user identity, and host info",
            "  free [-m], df [-h], uptime   - Memory, disk, and uptime telemetry",
            "  Pipe filters: | grep <pat>, | head -n N, | tail -n N, | wc -l, | sort, | uniq",
            "\x1b[36m================================================================================\x1b[0m",
        ])

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
        rating = "\x1b[32mSAFE\x1b[0m" if s < 30 else ("\x1b[33mELEVATED\x1b[0m" if s < 70 else "\x1b[31mCRITICAL\x1b[0m")

        return "\n".join([
            f"Host Node      : {platform.node()}",
            f"Operating Sys  : {platform.system()} {platform.release()} ({platform.machine()})",
            f"Uptime         : {hours}h {minutes}m {seconds}s (Boot: {time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(boot))})",
            f"CPU Utilization: {cpu}% across {psutil.cpu_count(logical=True)} logical cores",
            f"Memory (RAM)   : {format_bytes(vm.used)} / {format_bytes(vm.total)} ({vm.percent}% used)",
            f"Disk Storage   : {format_bytes(disk.used)} / {format_bytes(disk.total)} ({disk.percent}% used)",
            f"Risk Score     : {s} / 100 ({rating})",
            "Defense Daemon : \x1b[32mOnline\x1b[0m (FastAPI + SQLite WAL)",
        ])

    # 4. Top processes (preserves exact test contract headers)
    if lower_cmd in ("guardian top", "top"):
        try:
            procs = []
            for p in psutil.process_iter(['pid', 'name', 'cpu_percent', 'memory_info']):
                try:
                    info = p.info
                    cpu = info.get('cpu_percent') or 0.0
                    mem = (info.get('memory_info').rss // 1024) if info.get('memory_info') else 0
                    procs.append({
                        'pid': info['pid'],
                        'name': info['name'] or 'unknown',
                        'cpu': cpu,
                        'mem': mem,
                        'flag': 'suspect' if cpu > 80.0 else 'ok',
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

    # 5. Process list
    if lower_cmd in ("guardian procs", "procs", "ps", "ps aux", "ps -ef"):
        try:
            lines = [f"{'PID':>6} {'PPID':>6} {'NAME':<22} {'CPU%':>6} {'MEM(MB)':>8} {'STATUS'}"]
            for p in list(psutil.process_iter(['pid', 'ppid', 'name', 'cpu_percent', 'memory_info', 'status']))[:30]:
                try:
                    info = p.info
                    mem_mb = (info['memory_info'].rss / (1024 * 1024)) if info.get('memory_info') else 0
                    lines.append(
                        f"{info['pid']:>6} {info.get('ppid') or 0:>6} {str(info['name'])[:22]:<22} "
                        f"{info['cpu_percent'] or 0:>6.1f} {mem_mb:>8.1f} {info.get('status', 'running')}"
                    )
                except (psutil.NoSuchProcess, psutil.AccessDenied):
                    continue
            return "\n".join(lines)
        except Exception as e:
            return f"error reading processes: {e}"

    # 6. Inspect PID
    if lower_cmd.startswith("guardian inspect "):
        pid_str = cmd.split(maxsplit=2)[2].strip() if len(cmd.split()) >= 3 else ""
        if not pid_str.isdigit():
            return "usage: guardian inspect <pid>"
        try:
            p = psutil.Process(int(pid_str))
            mem_mb = p.memory_info().rss / (1024 * 1024)
            conns = [f"{c.laddr.ip}:{c.laddr.port} ({c.status})" for c in p.net_connections(kind='inet')[:8]]
            return "\n".join([
                f"PID        : {p.pid} (PPID: {p.ppid()})",
                f"Name       : {p.name()}",
                f"Status     : {p.status()}",
                f"Executable : {p.exe() if hasattr(p, 'exe') else 'n/a'}",
                f"Cmdline    : {' '.join(p.cmdline())[:180] or 'n/a'}",
                f"Memory RSS : {mem_mb:.1f} MB",
                f"Sockets    : {', '.join(conns) if conns else 'none'}",
            ])
        except Exception as e:
            return f"inspect error for PID {pid_str}: {e}"

    # 7. Ports / ss / lsof
    if lower_cmd in ("guardian ports", "ports", "netstat", "ss", "ss -tulnp", "ss -tulpn", "lsof -i"):
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
                for proto, laddr, state, pid, name in conns[:30]:
                    lines.append(f"{proto:<6} {laddr:<24} {state:<10} {pid:>6} {name}")
                return "\n".join(lines)

            res = scan_one("network", "windows" if IS_WIN else "linux")
            return "\n".join(f"{r['proto']} {r['local_port']} {r['state']} {r['process']}" for r in res.get("rows", [])) or "no listening ports detected"
        except Exception as e:
            return f"error querying network sockets: {e}"

    # 8. Alerts & Ack
    if lower_cmd in ("guardian alerts", "alerts"):
        with db() as c:
            rows = c.execute("SELECT id, ts, module, severity, message, acknowledged FROM alerts ORDER BY id DESC LIMIT 15").fetchall()
        if not rows:
            return "no security alerts registered in database"
        lines = [f"{'ID':>4} {'TIME':<8} {'MODULE':<12} {'SEV':<8} {'ACK':<4} {'MESSAGE'}"]
        for r in rows:
            t_str = time.strftime('%H:%M:%S', time.localtime(r['ts'])) if r['ts'] else '--:--:--'
            ack = "yes" if r['acknowledged'] else "no"
            lines.append(f"{r['id']:>4} {t_str:<8} {r['module'][:12]:<12} {r['severity']:<8} {ack:<4} {r['message']}")
        return "\n".join(lines)

    if lower_cmd.startswith("guardian ack "):
        arg = cmd.split(maxsplit=2)[2].strip().lower()
        with db() as c:
            if arg == "all":
                c.execute("UPDATE alerts SET acknowledged=1 WHERE acknowledged=0")
            elif arg.isdigit():
                c.execute("UPDATE alerts SET acknowledged=1 WHERE id=?", (int(arg),))
            else:
                return "usage: guardian ack <id|all>"
        s = record_score()
        return f"acknowledged ({arg}). updated risk score: {s}"

    # 9. Timeline
    if lower_cmd in ("guardian timeline", "timeline"):
        with db() as c:
            events = c.execute("SELECT ts, module, kind, summary FROM events ORDER BY ts DESC LIMIT 15").fetchall()
        if not events:
            return "no timeline events recorded"
        return "\n".join(f"[{time.strftime('%H:%M:%S', time.localtime(r['ts']))}] [{r['module']}] {r['kind']}: {r['summary']}" for r in events)

    # 10. Deadlock CLI
    if lower_cmd.startswith("guardian deadlock"):
        parts = lower_cmd.split()
        action = parts[2] if len(parts) > 2 else "status"
        if action not in {"status", "create", "prevent", "resolve", "cleanup"}:
            return "usage: guardian deadlock <status|create|prevent|resolve|cleanup>"
        res = deadlock.run_deadlock_action(action, "windows" if IS_WIN else "linux")
        return json.dumps(res, indent=2)

    # 11. Attack Simulation CLI
    if lower_cmd.startswith("guardian simulate"):
        parts = lower_cmd.split()
        action = parts[2] if len(parts) > 2 else "port"
        src = "windows" if IS_WIN else "linux"
        allowed = {"port", "temp", "startup", "reset"} if IS_WIN else {"port", "temp", "deleted", "file", "reset"}
        if action not in allowed:
            return f"usage: guardian simulate <{'|'.join(sorted(allowed))}>"
        bash_bin = "bash"
        p = subprocess.run([bash_bin, str(ROOT / "bash/demo" / f"{src}-lab.sh"), action], capture_output=True, text=True, timeout=20, shell=False)
        return (p.stdout + p.stderr).strip() or f"simulation '{action}' completed (exit {p.returncode})"

    # 12. Module quick audits & scan
    if lower_cmd in ("guardian persistence", "guardian integrity", "guardian usb"):
        mod = lower_cmd.split()[1]
        res = scan_one(mod, "windows" if IS_WIN else "linux")
        rows = res.get("rows", [])
        alerts = res.get("alerts", [])
        lines = [f"{mod.upper()} AUDIT ({res.get('source')}): {len(rows)} items, {len(alerts)} alerts"]
        for a in alerts[:8]:
            lines.append(f"  [{a.get('severity')}] {a.get('rule')}: {a.get('message')} (+{a.get('points')} pts)")
        return "\n".join(lines)

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

    # 13. Linux / Bash core utilities
    if lower_cmd in ("whoami", "id"):
        user = getpass.getuser()
        if lower_cmd == "id":
            return f"uid=1000({user}) gid=1000({user}) groups=1000({user}),guardian-soc"
        return f"{user} (host: {platform.node()})"

    if lower_cmd == "hostname":
        return platform.node()

    if lower_cmd == "pwd":
        return os.getcwd()

    if lower_cmd in ("ls", "ls -la", "ls -l", "dir"):
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

    if lower_cmd in ("free", "free -m", "free -h", "mem"):
        vm = psutil.virtual_memory()
        swap = psutil.swap_memory()
        return "\n".join([
            f"{'':<12} {'TOTAL':>12} {'USED':>12} {'FREE':>12} {'PERCENT':>10}",
            f"{'Mem:':<12} {format_bytes(vm.total):>12} {format_bytes(vm.used):>12} {format_bytes(vm.available):>12} {vm.percent:>9.1f}%",
            f"{'Swap:':<12} {format_bytes(swap.total):>12} {format_bytes(swap.used):>12} {format_bytes(swap.free):>12} {swap.percent:>9.1f}%",
        ])

    if lower_cmd in ("df", "df -h", "disk"):
        lines = [f"{'FILESYSTEM':<20} {'TOTAL':>10} {'USED':>10} {'FREE':>10} {'USE%':>6} {'MOUNT'}"]
        for part in psutil.disk_partitions(all=False)[:8]:
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

    if lower_cmd == "env":
        safe_keys = ("OS", "USERNAME", "USER", "HOME", "SHELL", "PWD", "PATH", "PROCESSOR_ARCHITECTURE")
        return "\n".join(f"{k}={os.environ.get(k)}" for k in safe_keys if os.environ.get(k))

    if lower_cmd.startswith("which "):
        target = cmd.split(maxsplit=1)[1].strip()
        if target in {"guardian", "ps", "ss", "lsof", "ls", "cat", "grep", "head", "tail", "wc", "sort", "uniq", "uname", "free", "df"}:
            return f"/usr/bin/{target}"
        return f"{target} not found"

    if lower_cmd.startswith("echo "):
        return cmd[5:]

    if lower_cmd.startswith("cat ") or lower_cmd.startswith("type "):
        target = cmd.split(maxsplit=1)[1].strip()
        try:
            p = (Path(os.getcwd()) / target).resolve()
            root_res = ROOT.resolve()
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

    return None


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

    # Split into Bash pipeline stages on '|'
    stages = [s.strip() for s in cmd.split("|") if s.strip()]
    if not stages:
        return ""

    out = _run_single_cmd(stages[0])
    if out is None:
        LOG.parent.mkdir(parents=True, exist_ok=True)
        with LOG.open("a", encoding="utf-8") as f:
            f.write(f"{int(time.time())} REFUSED {cmd}\n")
        return f"refused: '{cmd}' is not allowed (read-only safe shell). Type 'help' for available commands."

    for stage in stages[1:]:
        out = _apply_pipe_filter(out, stage)

    return out


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
