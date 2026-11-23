#!/bin/bash
# Listening ports + established connections: source proto local_addr local_port state process remote_addr
set -u
. "$(dirname "$0")/../common/lib.sh"
hexip() { printf '%d.%d.%d.%d' "0x${1:6:2}" "0x${1:4:2}" "0x${1:2:2}" "0x${1:0:2}"; }   # /proc/net little-endian IPv4
if need_cmd ss; then
  ss -H -tuanp | while read -r proto state _ _ local peer proc; do
    case "$state" in LISTEN|UNCONN) st=LISTEN; rem=-;; ESTAB) st=ESTABLISHED; rem=${peer%:*}; rem=${rem#[}; rem=${rem%]};; *) continue;; esac
    name=$(grep -o '"[^"]*"' <<< "${proc:-}" | head -1 | tr -d '"')
    emit linux "$proto" "${local%:*}" "${local##*:}" "$st" "${name:--}" "$rem"
  done
else
  for p in tcp tcp6 udp udp6; do
    while read -r _ local remote st _; do
      rem=-; [[ "$p" == *6 ]] || [ "${remote%%:*}" = "00000000" ] || rem=$(hexip "${remote%%:*}")
      case "$p:$st" in tcp*:0A|udp*:07) emit linux "${p%6}" "-" "$((16#${local##*:}))" LISTEN "-" "-";; tcp*:01) emit linux "${p%6}" "-" "$((16#${local##*:}))" ESTABLISHED "-" "$rem";; esac
    done < <(tail -n +2 "/proc/net/$p")
  done | sort -u
fi
exit 0
