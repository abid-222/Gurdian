#!/bin/bash
set -u
. "$(dirname "$0")/../common/lib.sh"
s() { awk '/^cpu /{print $2+$3+$4+$6+$7+$8, $2+$3+$4+$5+$6+$7+$8}' /proc/stat; }
read -r b1 t1 < <(s); sleep 0.5; read -r b2 t2 < <(s)
cpu=$(awk -v b=$((b2-b1)) -v t=$((t2-t1)) 'BEGIN{printf "%.1f", t?100*b/t:0}')
ram=$(awk '/MemTotal/{t=$2}/MemAvailable/{a=$2}END{printf "%.1f",100*(1-a/t)}' /proc/meminfo)
disk=$(df / | awk 'NR==2{gsub("%","",$5);print $5}')
read -r l1 _ < /proc/loadavg
read -r rx tx < <(awk -F'[: ]+' 'NR>2 && $2!="lo"{r+=$3; t+=$11} END{print r+0, t+0}' /proc/net/dev)   # byte counters, all non-loopback interfaces
emit linux "$cpu" "$ram" "$disk" "$rx" "$tx" "$l1" "$(cut -d. -f1 /proc/uptime)"
