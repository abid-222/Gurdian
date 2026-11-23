# Security design
- All collector scripts are read-only; command text is fixed inside the script files, no user input reaches a shell. The API writes only data/guardian.db and data/watchlist.user.conf (validated absolute file path, max 5 MB, never passed to a shell; the shipped watchlist.conf is never modified).
- API binds to 127.0.0.1; module/source/demo-action names come from fixed lists (unknown -> 404).
- Terminal accepts only whitelisted commands; refused ones are logged to data/commands.log.
- Demo Lab touches only harmless test items (ports 9999/9998, /tmp and %TEMP% demo files, HKCU Run value GuardianDemo) and `reset` removes them.
- Windows Security log and HKLM reads need an Administrator terminal; otherwise the UI shows a limited-mode message.
