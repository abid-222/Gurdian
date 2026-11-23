#!/bin/bash
# stdin: output of Windows `quser` (CRLF already removed). stdout: current sessions in auth format.
set -u
now=$(date '+%Y-%m-%dT%H:%M:%S')
tail -n +2 | while read -r line; do
  line=${line#>}; read -r -a f <<< "$line"; user=${f[0]:-}; [ -n "$user" ] || continue
  n=${#f[@]}; ts=$(date -d "${f[n-3]:-} ${f[n-2]:-} ${f[n-1]:-}" '+%Y-%m-%dT%H:%M:%S' 2>/dev/null) || ts=$now
  printf 'windows\t%s\t%s\t-\tSUCCESS\tsession\n' "$ts" "$user"
done
