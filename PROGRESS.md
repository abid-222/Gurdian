# PROGRESS (v5 loop)
## Task (assumed, task section was empty)
Close the gaps I listed at the end of v4, keep every v4 behaviour working.
Checklist: 1 ruff+shellcheck clean | 2 eslint clean | 3 /api/history system snapshots | 4 collector-contract test (tests/bash) | 5 Terminal page test | 6 final full-diff critic + docs
Not attempted: Windows `Current Users` (needs Windows to verify), prettier --write (rewrites every file).
## ASSUMPTIONS
- Allowed paths: the whole smart-os-guardian/ folder; lockfiles are not kept in the zip, so editing package.json devDependencies is allowed (eslint is required by CLAUDE.md style).
- VERIFY = pytest tests/backend, cd frontend && npm test && npm run build, ruff, shellcheck, eslint.
- MAX_ITERATIONS = 6.

## Iteration 1 - lint (ruff + shellcheck) : DONE
Evidence: `ruff check backend tests/backend` -> clean; `shellcheck -x -e SC1091 bash/*/*.sh *.sh` -> clean; pytest 28 passed.
Changes: ruff.toml (style rules E401/E701/E702/E731/E741 off on purpose, F + E9 stay on), lib.sh shell directive, unused read vars in network.sh, `cd ... || exit` and single-quoted trap in start.sh/setup.sh, SC2016 disabled with reason in PowerShell wrappers, 1 unused import, 2 long lines wrapped.
Critic: Acceptance PASS. Untested: PowerShell scripts still cannot run here (only linted). Faking: disabling SC2016 is deliberate (PowerShell $ vars), reason written in each file; ruff ignores are style-only. Risk: start.sh trap change not run end-to-end. Verdict: PASS.

## Iteration 2 - ESLint : DONE
Evidence: `npm run lint` -> clean (was 5 errors + 2 warnings); vitest 9 passed; vite build ok.
Dependency added (devDependencies only): eslint, @eslint/js, globals, eslint-plugin-react, eslint-plugin-react-hooks. Why: CLAUDE.md style rule requires eslint.
Real fixes: useLive no longer calls setState inside an effect body (status derived, reconnect timer), Overview/Alerts effects have complete deps, `bump` is stable (useCallback) so effects do not re-fire every clock tick, Auth no longer calls Date.now() while rendering (uses the scan's started_at), Reports component named.
Critic: Untested: reconnect after a real server restart and pause/resume in a browser (jsdom tests use mock mode). Regression: Auth range filter now measured from server scan time; if WSL and Windows time zones differed the Windows rows could look hours off. Faking: none, no eslint-disable used. Verdict: PASS (risk: tz, noted).
Prettier: not run (would rewrite every file); config not added.

## Iteration 3 - /api/history for system snapshots : DONE
Evidence: pytest 29 passed (new test_history_system_has_snapshots), ruff clean, eslint clean, vitest 9 passed.
Change: history() returns `snapshots` (last 100 rows of system_stats) for module=system, [] for others; System page got a "Show Snapshots" button.
Critic: Untested: empty snapshot table in the UI (Table shows "No rows."), very large history (capped at 100). Scope: only history + button. Faking: none. Verdict: PASS.

## Iteration 4 - collector contract test (tests/bash/test_contract.sh) : DONE
Evidence: all 7 Linux collectors + 5 Windows scripts (no-PowerShell path) pass; shellcheck clean; added to CI.
Mutation check: I broke integrity.sh on purpose (extra column) -> test printed `FAIL linux/integrity bad row` and exited non-zero, then I restored it with `git checkout`.
Mistake caught by the critic: my first mutation command used a bash-only `${PIPESTATUS}` under sh, aborted before the restore step, leaving integrity.sh mutated. Found it from the missing "restored" line, restored from git, re-ran test (exit 0) and pytest (29 passed). `git status` showed only PROGRESS.md + tests/bash/ changed.
Critic: Untested: windows/integrity + persistence (need reg.exe/WSL interop), the usb mutation (no USB rows in this sandbox, so it proves nothing there). Verdict: PASS.

## Iteration 5 - Terminal page test : DONE
Evidence: vitest 14 passed (9 pages + 5 terminal). Tests cover: connects to /api/terminal + green prompt, quick-command button sends, Tab completion + Enter + server output + new prompt, arrow-up history, closed socket sends nothing.
Mutation checks: broke Tab completion -> 1 test failed; removed the quick-button send -> 1 test failed; both restored with git checkout (git status clean for src/).
Critic found a weak test of mine: `expect(a) && expect(b)` never runs the second expect. Split into two statements, re-ran.
Dependency/config: vitest alias for @xterm/xterm so vi.mock hits the same module the page imports. Not tested: real xterm rendering in a browser.
Verdict: PASS.

## Iteration 6 - final full-diff critic + docs : DONE
Evidence (real output): ruff "All checks passed!"; SHELLCHECK_CLEAN; CONTRACT_OK; pytest 29 passed; ESLINT_CLEAN; vitest 14 passed; vite build "built"; leftovers grep (TODO/FIXME/console.log/debugger) -> none.
End-to-end (servers started for real): /api/health open; /api/score without token -> 401, with token -> {"score":0,"level":"SAFE"}; same call through Vite proxy without a header -> works (proxy adds token); POST scan via proxy -> scan_id 1, 65 rows; WebSocket /ws/live and /api/terminal through the proxy -> data received, `rm -rf /` refused; direct WebSocket without token -> rejected; CORS header not returned for evil.com.
Full-diff critic: Acceptance PASS. Untested: Windows scripts (no PowerShell here), browser rendering/reconnect, Auth range filter if WSL and Windows time zones differ. Faking: no stubs; style-only ruff ignores and SC2016 disables are documented. Scope: lockfile was accidentally tracked in git, untracked again (zip never contained it). Verdict: PASS.

## FINAL SUMMARY
Status: SUCCESS for the assumed checklist (6/6). Not done: Windows "Current Users" (needs Windows to verify), prettier (would rewrite every file), screenshots (need a browser on your PC).

# v6 loop (user list A1-A8 + B)
A1 process CPU: DONE - busy-loop test shows >50% (e2e: 96.1%); Windows uses PerfProc counter (UNTESTED here).
A2 system RX/TX: DONE - parity test against /proc/net/dev; Windows rx/tx added (UNTESTED here).
A3 mock mode: DONE - removed from app; a test asserts api.js has no "mock" and mock.js is gone; fakes only in tests/frontend/fakeApi.js.
A4 auth: DONE for Linux (journalctl + last + sudo/su, parser tested on a sample log, LIMITED MODE tested with no log source); Windows event log + quser parser (quser parser tested with fixture; Get-WinEvent UNTESTED here, needs an Administrator PowerShell).
A5 USB: Windows script improved (VID/PID, serial), UI explains WSL2 limit, default source = both. UNTESTED on real Windows.
A6 Windows run: CANNOT be done here. tests/bash/test_contract.sh now executes the Windows scripts for real when powershell.exe exists - you must run it on your PC.
A7 File Vault: DONE - default list 17 Linux + 3 Windows entries, ~ and * globs; Windows files are read by the windows script. Tested: watch add, default list content.
A8: DONE - websockets log + report errors (no bare except/pass on the main path); /api/watch writes data/watchlist.user.conf, README/SECURITY say so.
B rules (9 new): DONE, one pytest each + e2e for new_process. Timeline, score history, top CPU/RAM, connections per process, JSON report: DONE with backend + frontend tests.
Mistakes caught: my replace() also rewrote a second test line (e2e baseline), found by a failing test; a `git checkout` for a mutation check reverted my UNCOMMITTED Process.jsx edits - re-applied, committed first, then used a backup copy for mutation checks.
Open risks: Windows scripts, Auth tz (WSL vs Windows), `/etc/hosts` in WSL is regenerated and may trigger hosts_file_changed after a restart, new_process can be noisy on a busy PC (re-save the baseline), find for SUID/world-writable is capped at 4 s per scan.
