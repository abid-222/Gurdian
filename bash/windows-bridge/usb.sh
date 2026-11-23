#!/bin/bash
# shellcheck disable=SC2016  # $ inside single quotes is PowerShell, on purpose
set -u
. "$(dirname "$0")/../common/lib.sh"
need_cmd powershell.exe || { printf '#ERROR\tpowershell.exe not found\n'; exit 2; }
powershell.exe -NoProfile -Command '
Get-PnpDevice -PresentOnly -ErrorAction SilentlyContinue | Where-Object { $_.InstanceId -like "USB\VID_*" } | ForEach-Object {
  $v = "-"; $p = "-"; $n = $_.FriendlyName; if (-not $n) { $n = $_.Name }
  if ($_.InstanceId -match "VID_(\w+)&PID_(\w+)") { $v = $Matches[1]; $p = $Matches[2] }
  "windows`t$n`t$v`t$p`t$(($_.InstanceId -split "\\")[-1])"
}' | tr -d '\r'
