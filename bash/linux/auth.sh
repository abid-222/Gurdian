#!/bin/bash
# Sessions (who) + past logins (last, world-readable) + ssh/sudo/su events from auth.log, else journalctl.
set -u
. "$(dirname "$0")/../common/lib.sh"
who | awk -v t="$(date '+%Y-%m-%dT%H:%M:%S')" '{printf "linux\t%s\t%s\t%s\tSUCCESS\tsession\n", t, $1, ($5 ? $5 : "-")}'
last -w -i -F -n 100 2>/dev/null | while read -r u _ ip _ mon day tm yr _; do
  case "$u" in reboot|wtmp|"") continue;; esac
  [[ "$yr" =~ ^[0-9]{4}$ ]] || continue
  ts=$(date -d "$mon $day $yr $tm" '+%Y-%m-%dT%H:%M:%S' 2>/dev/null) || continue
  emit linux "$ts" "$u" "$ip" SUCCESS last
done
rc=0; src=""
authlog=${GUARDIAN_AUTH_LOG:-/var/log/auth.log}
if [ -r "$authlog" ]; then src=$(tail -n 3000 "$authlog")
elif need_cmd journalctl; then
  src=$(journalctl --no-pager -o short -n 3000 _COMM=sshd _COMM=sudo _COMM=su 2>/dev/null | grep -v '^-- ')
  if [ "$(id -u)" -ne 0 ] && ! id -nG | grep -qwE 'adm|systemd-journal'; then
    rc=2; printf '#ERROR\tLimited mode: journalctl shows only your own messages. Run with sudo or add your user to the adm group.\n'
  fi
else rc=2; printf '#ERROR\tLimited mode: no readable auth log and no journalctl. Run with sudo. Only who/last sessions are shown.\n'; fi
[ -n "$src" ] && awk '
  /sshd.*(Failed password|Accepted)/ { r=($0~/Failed/)?"FAILED":"SUCCESS"; u="-"; ip="-"
    for(i=1;i<=NF;i++){ if($i=="for"){u=$(i+1); if(u=="invalid") u=$(i+3)} if($i=="from") ip=$(i+1) }
    printf "linux\t%s %s %s\t%s\t%s\t%s\tssh\n",$1,$2,$3,u,ip,r }
  / sudo: .*COMMAND=/ { u="-"; for(i=1;i<=NF;i++) if($i=="sudo:"){u=$(i+1); break}; printf "linux\t%s %s %s\t%s\t-\tSUCCESS\tsudo\n",$1,$2,$3,u }
  /pam_unix\(su(-l)?:session\): session opened/ { u="-"; for(i=1;i<=NF;i++) if($i=="by"){u=$(i+1); sub(/\(.*/,"",u)}; printf "linux\t%s %s %s\t%s\t-\tSUCCESS\tsu\n",$1,$2,$3,u }' <<< "$src"
exit "$rc"
