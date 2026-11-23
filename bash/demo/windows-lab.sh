#!/bin/bash
# Harmless Windows demo events (port 9998, temp exe, HKCU Run value). Usage: port|temp|startup|reset
# shellcheck disable=SC2016  # $ inside single quotes is PowerShell, on purpose
case "${1:-}" in
  port) powershell.exe -NoProfile -Command 'Start-Process powershell -WindowStyle Hidden -ArgumentList "-NoProfile","-Command","[Net.Sockets.TcpListener]::new(9998).Start(); Start-Sleep 600"' ;;
  temp) powershell.exe -NoProfile -Command 'Copy-Item C:\Windows\System32\PING.EXE $env:TEMP\guardian_demo.exe -Force; Start-Process $env:TEMP\guardian_demo.exe -ArgumentList "-n","300","127.0.0.1" -WindowStyle Hidden' ;;
  startup) reg.exe add 'HKCU\Software\Microsoft\Windows\CurrentVersion\Run' /v GuardianDemo /t REG_SZ /d 'cmd /c echo guardian-demo' /f ;;
  reset) taskkill.exe /F /IM guardian_demo.exe >/dev/null 2>&1
         reg.exe delete 'HKCU\Software\Microsoft\Windows\CurrentVersion\Run' /v GuardianDemo /f >/dev/null 2>&1
         powershell.exe -NoProfile -Command 'Get-NetTCPConnection -LocalPort 9998 -EA 0 | ForEach-Object { Stop-Process -Id $_.OwningProcess -Force }' ;;
  *) echo "usage: $0 port|temp|startup|reset" ;;
esac
