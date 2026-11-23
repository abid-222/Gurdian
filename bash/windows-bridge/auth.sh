#!/bin/bash
# shellcheck disable=SC2016  # $ inside single quotes is PowerShell, on purpose
# Needs an Administrator terminal (Security event log).
set -u
set -o pipefail
. "$(dirname "$0")/../common/lib.sh"
need_cmd powershell.exe || { printf '#ERROR\t%s\n' "powershell.exe not found"; exit 2; }
rc=0
powershell.exe -NoProfile -Command '
try {
  Get-WinEvent -FilterHashtable @{LogName="Security";Id=4624,4625} -MaxEvents 300 -ErrorAction Stop | ForEach-Object {
    $x = [xml]$_.ToXml(); $d = @{}
    $x.Event.EventData.Data | ForEach-Object { $d[$_.Name] = $_."#text" }
    $r = "SUCCESS"; if ($_.Id -eq 4625) { $r = "FAILED" }
    $ip = $d.IpAddress; if (-not $ip) { $ip = "-" }
    if ($_.Id -eq 4624 -and @("2","7","10","11") -notcontains $d.LogonType) { return }   # interactive logons only
    "windows`t$($_.TimeCreated.ToString("s"))`t$($d.TargetUserName)`t$ip`t$r`tevent"
  }
} catch {
  "#ERROR`tLimited mode: start Windows Terminal as Administrator"
  exit 2
}' | tr -d '\r' || rc=$?
quser.exe 2>/dev/null | tr -d '\r' | bash "$(dirname "$0")/../common/parse_quser.sh"
exit "$rc"
