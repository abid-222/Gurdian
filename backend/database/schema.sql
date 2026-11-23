CREATE TABLE IF NOT EXISTS scans(id INTEGER PRIMARY KEY, module TEXT, source TEXT, ts INTEGER, duration_ms INTEGER, row_count INTEGER);
CREATE TABLE IF NOT EXISTS alerts(id INTEGER PRIMARY KEY, ts INTEGER, module TEXT, source TEXT, severity TEXT, rule_id TEXT, message TEXT, evidence TEXT, acknowledged INTEGER DEFAULT 0, points INTEGER DEFAULT 0, reference TEXT);
CREATE TABLE IF NOT EXISTS baselines(module TEXT, source TEXT, k TEXT, v TEXT, PRIMARY KEY(module, source, k));
CREATE TABLE IF NOT EXISTS system_stats(id INTEGER PRIMARY KEY, ts INTEGER, source TEXT, cpu REAL, ram REAL, disk REAL, rx REAL, tx REAL);
CREATE TABLE IF NOT EXISTS items(module TEXT, source TEXT, k TEXT, name TEXT, first_seen INTEGER, last_seen INTEGER, PRIMARY KEY(module, source, k));
CREATE TABLE IF NOT EXISTS events(id INTEGER PRIMARY KEY, ts INTEGER, module TEXT, source TEXT, kind TEXT, summary TEXT, UNIQUE(module, source, kind, summary, ts));
CREATE TABLE IF NOT EXISTS score_history(ts INTEGER, score INTEGER);
