import ipaddress
from datetime import datetime
COLS = {
 "system": "source cpu_pct ram_pct disk_pct net_rx net_tx load1 uptime_s", "process": "source pid ppid user name exe_path cpu mem flag",
 "network": "source proto local_addr local_port state process remote_addr", "auth": "source timestamp username source_ip result method",
 "integrity": "source path sha256", "persistence": "source type location content_hash", "usb": "source name vendor_id product_id serial",
}
COLS = {k: v.split() for k, v in COLS.items()}
def _public(ip):
    try: return ipaddress.ip_address(ip).is_global
    except ValueError: return False

def _net_key(r):   # listening port, or the remote IP of an ESTABLISHED connection when that IP is public
    if r["state"] == "LISTEN": return f"{r['proto']}:{r['local_port']}"
    return f"ext:{r.get('remote_addr', '-')}" if r["state"] == "ESTABLISHED" and _public(r.get("remote_addr", "-")) else None

KEY = {"network": _net_key, "integrity": lambda r: r["path"], "persistence": lambda r: f"{r['type']}:{r['location']}:{r['content_hash']}",
       "usb": lambda r: f"{r['name']}:{r['vendor_id']}:{r['product_id']}:{r['serial']}",
       "process": lambda r: f"{r['name']}:{r['exe_path']}" if r["exe_path"] != "-" else None}   # kernel threads have no exe
VAL = {"integrity": lambda r: r["sha256"]}

def parse(module, text):
    rows, errors = [], []
    for line in text.splitlines():
        if line.startswith("#ERROR"): errors.append(line.split("\t", 1)[-1] if "\t" in line else line[6:].strip()); continue
        if line.strip(): rows.append(dict(zip(COLS[module], line.split("\t"))))
    return rows, errors

def to_iso(t):
    for f in (None, "%b %d %H:%M:%S"):
        try:
            d = datetime.fromisoformat(t) if f is None else datetime.strptime(t, f).replace(year=datetime.now().year)
            return d.isoformat(timespec="seconds")
        except ValueError: pass
    return ""

def annotate(module, rows, base, seen=None):
    """Adds status (NEW/KNOWN/CHANGED), baseline_sha256, first_seen, ts. Safe to call twice."""
    for r in rows:
        if module == "auth": r["ts"] = to_iso(r["timestamp"])
        if module in KEY:
            k = KEY[module](r)
            if k is None: continue
            if module == "integrity": r["baseline_sha256"] = (base or {}).get(k, "")
            if base is not None: r["status"] = "NEW" if k not in base else ("CHANGED" if module in VAL and base[k] != VAL[module](r) else "KNOWN")
            if seen and k in seen: r["first_seen"] = seen[k]
    return rows
