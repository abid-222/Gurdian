#!/bin/bash
# shellcheck disable=SC2016  # $ inside single quotes is PowerShell, on purpose
# One sample (8 columns), or --stream = ONE persistent PowerShell, a sample every 3 s: source cpu ram disk rx_KBps tx_KBps
set -u
. "$(dirname "$0")/../common/lib.sh"
need_cmd powershell.exe || { printf '#ERROR\tpowershell.exe not found\n'; exit 2; }
stream=0; [ "${1:-}" = "--stream" ] && stream=1
powershell.exe -NoProfile -Command '
$prev = $null
while ($true) {
  $c = (Get-CimInstance Win32_Processor | Measure-Object LoadPercentage -Average).Average
  $o = Get-CimInstance Win32_OperatingSystem
  $r = [math]::Round(100*(1-$o.FreePhysicalMemory/$o.TotalVisibleMemorySize),1)
  $d = Get-PSDrive C; $dp = [math]::Round(100*$d.Used/($d.Used+$d.Free),1)
  $st = Get-NetAdapterStatistics -ErrorAction SilentlyContinue
  $rb = [int64](($st | Measure-Object ReceivedBytes -Sum).Sum); $tb = [int64](($st | Measure-Object SentBytes -Sum).Sum)
  if ('$stream' -eq 0) {
    $q = (Get-CimInstance Win32_PerfFormattedData_PerfOS_System).ProcessorQueueLength
    $up = [int]((Get-Date) - $o.LastBootUpTime).TotalSeconds
    "windows`t$c`t$r`t$dp`t$rb`t$tb`t$q`t$up"; break
  }
  $rx = 0; $tx = 0
  if ($null -ne $prev) { $rx = [math]::Round(($rb-$prev[0])/3KB,1); $tx = [math]::Round(($tb-$prev[1])/3KB,1) }
  $prev = @($rb, $tb)
  "windows`t$c`t$r`t$dp`t$rx`t$tx"
  Start-Sleep -Seconds 3
}' | tr -d '\r'
