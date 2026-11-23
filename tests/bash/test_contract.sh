#!/bin/bash
# Collector contract check. Linux: runs everywhere. Windows scripts: if powershell.exe is missing they must answer
# "#ERROR<TAB>..." + exit 2; if it exists (run this on your Windows PC inside WSL!) they are executed for real and the rows are validated.
set -u
cd "$(dirname "$0")/../.." || exit 1
declare -A N=([system]=8 [process]=9 [network]=7 [auth]=6 [integrity]=3 [persistence]=4 [usb]=5)
fail=0
check() {   # $1 = linux|windows, $2 = module
  local out rc bad
  out=$(bash "bash/$3/$2.sh" 2>/dev/null); rc=$?
  if [ "$rc" -eq 2 ]; then
    if grep -q "^#ERROR	" <<< "$out"; then echo "ok   $1/$2 (#ERROR, exit 2)"; else echo "FAIL $1/$2 exit 2 without #ERROR<TAB>"; fail=1; fi
    out=$(grep -v '^#ERROR' <<< "$out")
  elif [ "$rc" -ne 0 ]; then echo "FAIL $1/$2 exit code $rc"; fail=1; return; fi
  bad=$(awk -F'\t' -v n="${N[$2]}" -v s="$1" 'NF>0 && ($1!=s || NF!=n)' <<< "$out" | head -1)
  if [ -z "$bad" ]; then echo "ok   $1/$2 ($(grep -c . <<< "$out") rows)"; else echo "FAIL $1/$2 bad row: $bad"; fail=1; fi
}
for m in "${!N[@]}"; do check linux "$m" linux; done
if command -v powershell.exe >/dev/null 2>&1; then
  echo "--- powershell.exe found: running the Windows scripts for real ---"
  for m in "${!N[@]}"; do check windows "$m" windows-bridge; done
else
  for m in system process network auth usb; do
    out=$(bash "bash/windows-bridge/$m.sh" 2>/dev/null); rc=$?
    if [ "$rc" -eq 2 ] && grep -q "^#ERROR	" <<< "$out"; then echo "ok   windows/$m (no PowerShell -> #ERROR, exit 2)"; else echo "FAIL windows/$m rc=$rc"; fail=1; fi
  done
fi
exit "$fail"
