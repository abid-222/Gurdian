#!/bin/bash
# shellcheck disable=SC2016  # $ inside single quotes is PowerShell, on purpose
set -u
. "$(dirname "$0")/../common/lib.sh"
need_cmd powershell.exe || { printf '#ERROR\tpowershell.exe not found\n'; exit 2; }
powershell.exe -NoProfile -Command '
Get-NetTCPConnection | Where-Object { $_.State -eq "Listen" -or $_.State -eq "Established" } | ForEach-Object {
  $p = (Get-Process -Id $_.OwningProcess -EA 0).ProcessName
  $ra = "-"; if ($_.State -eq "Established") { $ra = $_.RemoteAddress }
  "windows`ttcp`t$($_.LocalAddress)`t$($_.LocalPort)`t$($_.State.ToString().ToUpper())`t$p`t$ra"
}
Get-NetUDPEndpoint | ForEach-Object {
  $p = (Get-Process -Id $_.OwningProcess -EA 0).ProcessName
  "windows`tudp`t$($_.LocalAddress)`t$($_.LocalPort)`tLISTEN`t$p`t-"
}' | tr -d '\r'
