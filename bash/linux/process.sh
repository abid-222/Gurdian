#!/bin/bash
# Real per-process CPU%: utime+stime sampled twice, 0.5 s apart (100 = one full core).
set -u
. "$(dirname "$0")/../common/lib.sh"
snap() { awk '{i=index($0,") "); split(substr($0,i+2),f," "); print $1, f[12]+f[13]}' /proc/[0-9]*/stat 2>/dev/null; }
tot() { awk '/^cpu /{s=0; for(i=2;i<=NF;i++) s+=$i; print s}' /proc/stat; }
s1=$(snap); t1=$(tot); sleep 0.5; s2=$(snap); t2=$(tot)
ncpu=$(nproc); dt=$((t2 - t1)); declare -A j1 cpu
while read -r p j; do j1[$p]=$j; done <<< "$s1"
while read -r p j; do
  if [ -n "${j1[$p]:-}" ] && [ "$dt" -gt 0 ]; then v=$((1000 * ncpu * (j - j1[$p]) / dt)); cpu[$p]="$((v / 10)).$((v % 10))"; fi
done <<< "$s2"
for d in /proc/[0-9]*; do
  pid=${d#/proc/}; [ "$pid" = "$$" ] && continue
  name=$(cat "$d/comm" 2>/dev/null) || continue
  ppid=$(awk '/^PPid/{print $2}' "$d/status" 2>/dev/null)
  uid=$(awk '/^Uid/{print $2}' "$d/status" 2>/dev/null)
  mem=$(awk '/^VmRSS/{print $2}' "$d/status" 2>/dev/null)
  exe=$(readlink "$d/exe" 2>/dev/null); flag=ok
  case "$exe" in *"(deleted)") flag=deleted_binary;; /tmp/*|/dev/shm/*) flag=tmp_exec;; esac
  emit linux "$pid" "${ppid:-0}" "${uid:-0}" "$name" "${exe:--}" "${cpu[$pid]:-0.0}" "${mem:-0}" "$flag"
done
exit 0
