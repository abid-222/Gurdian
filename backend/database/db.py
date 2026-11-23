import os, sqlite3, time
from pathlib import Path
ROOT = Path(__file__).resolve().parents[2]
DB = os.environ.get("GUARDIAN_DB", str(ROOT / "data" / "guardian.db"))

def db():
    c = sqlite3.connect(DB); c.row_factory = sqlite3.Row; return c

def init():
    Path(DB).parent.mkdir(parents=True, exist_ok=True)
    with db() as c: c.executescript((Path(__file__).with_name("schema.sql")).read_text())

def add_events(evs):
    """evs = [(ts, module, source, kind, summary)]; the same event is stored once (timeline)."""
    with db() as c: c.executemany("INSERT OR IGNORE INTO events(ts,module,source,kind,summary) VALUES(?,?,?,?,?)", evs)

def save_alerts(module, source, alerts, now=None):
    """Insert alerts; the same alert (rule+source+message) is skipped for 10 minutes. New alerts also go to the timeline."""
    now, n = int(now or time.time()), 0
    with db() as c:
        for a in alerts:
            if c.execute("SELECT 1 FROM alerts WHERE rule_id=? AND source=? AND message=? AND ts>?", (a["rule"], source, a["message"], now - 600)).fetchone(): continue
            c.execute("INSERT INTO alerts(ts,module,source,severity,rule_id,message,evidence,points,reference) VALUES(?,?,?,?,?,?,?,?,?)",
                      (now, module, source, a["severity"], a["rule"], a["message"], a["evidence"], a["points"], a["reference"]))
            c.execute("INSERT OR IGNORE INTO events(ts,module,source,kind,summary) VALUES(?,?,?,?,?)", (now, module, source, "alert", f"[{a['severity']}] {a['message']}")); n += 1
    if n: record_score(now)
    return n

def record_score(now=None):
    """Append the current risk score to score_history when it changed (or every 5 minutes)."""
    s, now = current_score(), int(now or time.time())
    with db() as c:
        last = c.execute("SELECT ts, score FROM score_history ORDER BY ts DESC LIMIT 1").fetchone()
        if last is None or last["score"] != s or now - last["ts"] >= 300: c.execute("INSERT INTO score_history VALUES(?,?)", (now, s))
    return s

def current_score():
    """min(100, sum of points of DISTINCT active (unacknowledged) rules)."""
    with db() as c:
        return min(100, sum(r[1] for r in c.execute("SELECT rule_id, MAX(points) FROM alerts WHERE acknowledged=0 GROUP BY rule_id")))
