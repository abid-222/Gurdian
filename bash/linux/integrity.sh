#!/bin/bash
# Hashes the files in watchlist.conf (+ data/watchlist.user.conf). ~ and * are expanded. Linux paths only, max 5 MB.
set -u
. "$(dirname "$0")/../common/lib.sh"
dir=$(dirname "$0")/../common
user=${GUARDIAN_WATCHLIST_USER:-$dir/../../data/watchlist.user.conf}
cat "$dir/watchlist.conf" "$user" 2>/dev/null | while read -r pat; do
  case "$pat" in ""|\#*|/mnt/c/*) continue;; esac
  pat=${pat/#\~/$HOME}
  compgen -G "$pat" | while read -r f; do
    [ -f "$f" ] && [ -r "$f" ] && [ "$(stat -c %s "$f")" -le 5242880 ] && emit linux "$f" "$(sha256sum "$f" | cut -d' ' -f1)"
  done
done | sort -u -t"$(printf '\t')" -k2,2
exit 0
