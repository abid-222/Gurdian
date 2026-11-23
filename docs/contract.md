# Collector contract (v6 extensions of CLAUDE.md)
- process.cpu = % of ONE core (measured over 0.5 s on Linux, PerfProc counter on Windows).
- network gets a 7th column `remote_addr` (peer IP for ESTABLISHED, `-` for LISTEN). ESTABLISHED rows exist for every connection; only LISTEN rows and PUBLIC remote IPs are baselined.
- persistence types added: `user_account`, `suid_file`, `world_writable` (content_hash = hash of the passwd line / file mode).
- auth.method values: ssh, sudo, su, last, session, event (Windows). `session` rows are live sessions and are not stored in the timeline.
- windows system.sh one-shot = 8 columns; `--stream` = `source cpu ram disk rx_KBps tx_KBps` every 3 s.
- Env: GUARDIAN_WATCHLIST_USER (user watch file), GUARDIAN_AUTH_LOG (test override of the auth log path).
