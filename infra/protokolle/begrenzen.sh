#!/bin/bash
# Server-Protokolle auf 14 Tage begrenzen (Datenschutz). Docker schreibt sie sonst unbegrenzt.
# Aufruf: sudo bash infra/protokolle/begrenzen.sh   – kein Neustart von Docker oder Containern nötig
set -euo pipefail
[ "$(id -u)" = 0 ] || { echo "Bitte mit sudo starten."; exit 1; }
Z=/etc/logrotate.d/docker-container
cat > "$Z" <<'L'
/var/lib/docker/containers/*/*-json.log {
    su root root
    daily
    rotate 14
    maxage 14
    compress
    missingok
    notifempty
    copytruncate
}
L
chmod 644 "$Z"
logrotate -d "$Z" > /dev/null 2>&1 || { rm -f "$Z"; echo "FEHLER: logrotate lehnt die Datei ab, zurückgenommen."; exit 1; }
logrotate -f "$Z"
echo "Protokolle jetzt:"; du -ch /var/lib/docker/containers/*/*-json.log* | tail -1
systemctl is-active logrotate.timer >/dev/null && echo "Täglicher Lauf: aktiv" || echo "ACHTUNG: logrotate.timer ist nicht aktiv"
for c in supabase_db_staccato supabase_auth_staccato supabase_kong_staccato supabase_edge_runtime_staccato; do docker inspect -f '{{.Name}} {{.State.Status}}' "$c"; done
curl -s -o /dev/null -m 10 -w 'Web %{http_code}\n' https://app.staccato-music.de
