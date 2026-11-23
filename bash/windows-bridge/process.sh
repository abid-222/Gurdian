#!/bin/bash
# shellcheck disable=SC2016  # $ inside single quotes is PowerShell, on purpose
set -u
. "$(dirname "$0")/../common/lib.sh"
need_cmd powershell.exe || { printf '#ERROR\t%s\n' \"powershell.exe not found\"; exit 2; }
powershell.exe -NoProfile -Command '
$perf = @{}
Get-CimInstance Win32_PerfFormattedData_PerfProc_Process | ForEach-Object { $perf[[int]$_.IDProcess] = $_.PercentProcessorTime }
Get-CimInstance Win32_Process | ForEach-Object {
  $e = $_.ExecutablePath; $f = "ok"
  if ($e -match "\\(Temp|Downloads)\\") { $f = "tmp_exec" }
  $c = $perf[[int]$_.ProcessId]; if ($null -eq $c) { $c = 0 }
  "windows`t$($_.ProcessId)`t$($_.ParentProcessId)`t-`t$($_.Name)`t$e`t$c`t$([int]($_.WorkingSetSize/1KB))`t$f"
}' | tr -d '\r'
