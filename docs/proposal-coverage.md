# v4 coverage vs CLAUDE.md (checked)
| Item | Status |
|---|---|
| Repo layout (app/runner,live,terminal,report; risk/rules,engine; database/db; frontend pages/components/hooks/theme) | done |
| Collector contract, `#ERROR<TAB>reason` + exit 2, CRLF strip, 7 modules x 2 sources, `--stream` | done |
| API: scan (scan_id, started_at), live WS, `/api/terminal` WS, alerts, history, baseline, demo, report, health | done |
| Hard rules: shell=False, fixed whitelists, 127.0.0.1, `X-Guardian-Token`, CORS only localhost:5173 | done |
| Rules as data + engine; 10 rules, score = distinct rules, levels, 10-min de-dup, evidence line | done, 1 pytest per rule |
| Pages: Overview, Live (Recharts), Process X-Ray, Network Radar, Auth Watch, File Vault, Persistence, USB, Alerts, Terminal | done, tested against a fake backend that lives only in tests |
| Loading / error / "Limited mode" on every button, source tag per row | done |
| Screenshots in docs/screenshots | YOU: take them on your PC |
| Windows scripts run | YOU: not testable here (no PowerShell) |
