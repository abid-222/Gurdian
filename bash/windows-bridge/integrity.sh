#!/bin/bash
# Windows files from the watchlist (/mnt/c/...), max 5 MB. The Windows drive is slow from WSL, so keep the list short.
set -u
. "$(dirname "$0")/../common/lib.sh"
dir=$(dirname "$0")/../common
user=${GUARDIAN_WATCHLIST_USER:-$dir/../../data/watchlist.user.conf}
{ echo /mnt/c/Windows/System32/drivers/etc/hosts; cat "$dir/watchlist.conf" "$user" 2>/dev/null; } | while read -r pat; do
  case "$pat" in /mnt/c/*) ;; *) continue;; esac
  compgen -G "$pat" | while read -r f; do
    [ -f "$f" ] && [ -r "$f" ] && [ "$(stat -c %s "$f")" -le 5242880 ] && emit windows "$f" "$(sha256sum "$f" | cut -d' ' -f1)"
  done
done | sort -u -t"$(printf '\t')" -k2,2
exit 0
