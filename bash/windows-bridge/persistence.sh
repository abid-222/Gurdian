#!/bin/bash
# shellcheck disable=SC2016  # $ inside single quotes is PowerShell, on purpose
set -u
. "$(dirname "$0")/../common/lib.sh"
need_cmd reg.exe || { printf '#ERROR\t%s\n' \"reg.exe not found\"; exit 2; }
h() { printf %s "$1" | sha256sum | cut -c1-16; }
for k in 'HKCU\Software\Microsoft\Windows\CurrentVersion\Run' 'HKLM\Software\Microsoft\Windows\CurrentVersion\Run'; do
  reg.exe query "$k" 2>/dev/null | tr -d '\r' | awk '$2 ~ /^REG_/ {n=$1; $1=$2=""; print n "\t" $0}' |
  while IFS=$'\t' read -r n v; do emit windows run_key "$k\\$n" "$(h "$v")"; done
done
schtasks.exe /query /fo csv /nh 2>/dev/null | tr -d '\r' | cut -d, -f1 | tr -d '"' | sort -u |
  while read -r t; do [ -n "$t" ] && emit windows sched_task "$t" "$(h "$t")"; done
for f in /mnt/c/Users/*/AppData/Roaming/Microsoft/Windows/"Start Menu"/Programs/Startup/*; do [ -f "$f" ] && emit windows startup_folder "$f" "$(h "$f")"; done
powershell.exe -NoProfile -Command 'Get-LocalUser | ForEach-Object { "$($_.Name)|$($_.Enabled)" }' 2>/dev/null | tr -d '\r' |
  while IFS='|' read -r n e; do [ -n "$n" ] && emit windows user_account "$n" "$(h "$n|$e")"; done
exit 0
