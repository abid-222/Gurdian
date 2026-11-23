#!/bin/bash
# Harmless demo events. Usage: linux-lab.sh port|temp|deleted|file|reset
L=~/guardian-lab; mkdir -p "$L"
case "${1:-}" in
  port)    (nc -l 9999 >/dev/null 2>&1 </dev/null &) ;;
  temp)    cp "$(command -v sleep)" /tmp/guardian_demo; (/tmp/guardian_demo 300 >/dev/null 2>&1 </dev/null &) ;;
  deleted) cp "$(command -v sleep)" /tmp/gsleep; (/tmp/gsleep 300 >/dev/null 2>&1 </dev/null &); sleep 0.3; rm /tmp/gsleep ;;
  file)    date >> "$L/watched.txt" ;;
  reset)   pkill -f 'nc -l 9999'; pkill -f '/tmp/guardian_demo'; pkill -f gsleep; rm -rf "$L" /tmp/guardian_demo ;;
  *) echo "usage: $0 port|temp|deleted|file|reset" ;;
esac
