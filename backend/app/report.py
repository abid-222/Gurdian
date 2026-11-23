import html, json, platform, time
from datetime import datetime
from fastapi.responses import Response
from database.db import current_score, db
from risk.engine import level

def build_json():
    with db() as c:
        al = [dict(r) for r in c.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 200")]
        rules = [dict(r) for r in c.execute("SELECT rule_id, MAX(points) points, MAX(reference) reference, COUNT(*) alerts FROM alerts WHERE acknowledged=0 GROUP BY rule_id")]
        scans = [dict(r) for r in c.execute("SELECT module, source, COUNT(*) scans, MAX(ts) last_ts FROM scans GROUP BY module, source")]
        tl = [dict(r) for r in c.execute("SELECT ts, module, source, kind, summary FROM events ORDER BY ts DESC LIMIT 200")]
        sh = [dict(r) for r in c.execute("SELECT ts, score FROM score_history ORDER BY ts DESC LIMIT 200")]
        bl = {f"{r['module']}/{r['source']}": r["n"] for r in c.execute("SELECT module, source, COUNT(*) n FROM baselines GROUP BY module, source")}
    s = current_score()
    return {"generated_at": datetime.now().isoformat(timespec="seconds"), "host": platform.node(), "score": s, "level": level(s), "active_rules": rules,
            "alerts": al, "scans": scans, "baselines": bl, "timeline": tl, "score_history": sh}

def build(fmt):
    if fmt == "json": return Response(json.dumps(build_json(), indent=2), media_type="application/json", headers={"Content-Disposition": "attachment; filename=guardian_report.json"})
    with db() as c:
        al = [dict(r) for r in c.execute("SELECT * FROM alerts ORDER BY id DESC LIMIT 100")]
        sc = [dict(r) for r in c.execute("SELECT module, source, COUNT(*) n, MAX(ts) last FROM scans GROUP BY module, source")]
    t = lambda x: time.strftime("%Y-%m-%d %H:%M:%S", time.localtime(x)); s = current_score()
    lines = [f"SMART OS GUARDIAN REPORT  {t(time.time())}  host={platform.node()}", f"RISK SCORE {s} ({level(s)})", "", "SCANS"]
    lines += [f"  {x['module']:<12}{x['source']:<8}x{x['n']}  last {t(x['last'])}" for x in sc]
    lines += ["", f"ALERTS ({len(al)})"] + [f"  {t(a['ts'])} [{a['module']}/{a['source']}] {a['severity']} {a['message']}  ref={a['reference']}\n      evidence: {a['evidence']}" for a in al]
    body = "\n".join(lines); h = {"Content-Disposition": f"attachment; filename=guardian_report.{fmt}"}
    if fmt == "txt": return Response(body, media_type="text/plain", headers=h)
    return Response(f"<html><body style='background:#0d1117;color:#c9d1d9;font-family:monospace'><pre>{html.escape(body)}</pre></body></html>", media_type="text/html", headers=h)
