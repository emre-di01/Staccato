#!/bin/bash
# Einmalig mit sudo ausführen: sudo bash infra/firewall/install.sh
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Bitte mit sudo ausführen"; exit 1; }
DIR="$(cd "$(dirname "$0")" && pwd)"
install -m 0755 "$DIR/supabase-firewall.sh" /usr/local/sbin/supabase-firewall.sh
install -m 0644 "$DIR/supabase-firewall.service" /etc/systemd/system/supabase-firewall.service
systemctl daemon-reload
systemctl enable --now supabase-firewall.service
systemctl restart supabase-firewall.service
echo; echo "== Status"; systemctl --no-pager -l status supabase-firewall.service | head -20
