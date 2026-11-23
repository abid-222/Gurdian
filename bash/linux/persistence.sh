#!/bin/bash
# cron, systemd services, ssh keys, shell startup files, user accounts, SUID files, world-writable files.
set -u
. "$(dirname "$0")/../common/lib.sh"
h() { printf %s "$1" | sha256sum | cut -c1-16; }
crontab -l 2>/dev/null | grep -v '^#' | while read -r l; do [ -n "$l" ] && emit linux cron user "$(h "$l")"; done
for f in /etc/cron.d/*; do [ -f "$f" ] && emit linux cron "$f" "$(sha256sum "$f" | cut -c1-16)"; done
for f in /etc/systemd/system/*.service; do [ -f "$f" ] && emit linux service "$f" "$(sha256sum "$f" | cut -c1-16)"; done
[ -f ~/.ssh/authorized_keys ] && while read -r l; do emit linux ssh_key authorized_keys "$(h "$l")"; done < ~/.ssh/authorized_keys
for f in ~/.bashrc ~/.profile ~/.bash_profile ~/.bash_login /etc/profile /etc/bash.bashrc; do [ -f "$f" ] && emit linux shell_rc "$f" "$(sha256sum "$f" | cut -c1-16)"; done
awk -F: '$3==0 || $3>=1000 {print $0}' /etc/passwd | while read -r l; do emit linux user_account "${l%%:*}" "$(h "$l")"; done
timeout 4 find /usr /bin /sbin /opt /home -xdev -type f -perm -4000 2>/dev/null | while read -r f; do emit linux suid_file "$f" "$(stat -c %a "$f")"; done
timeout 4 find /etc /usr /bin /sbin /opt -xdev -type f -perm -0002 2>/dev/null | while read -r f; do emit linux world_writable "$f" "$(stat -c %a "$f")"; done
exit 0
