#!/bin/bash
set -u
. "$(dirname "$0")/../common/lib.sh"
for d in /sys/bus/usb/devices/*; do
  [ -r "$d/idVendor" ] || continue
  emit linux "$(cat "$d/product" 2>/dev/null || echo -)" "$(cat "$d/idVendor")" "$(cat "$d/idProduct")" "$(cat "$d/serial" 2>/dev/null || echo -)"
done
exit 0
