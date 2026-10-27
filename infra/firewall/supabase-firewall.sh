#!/bin/bash
# Sperrt den öffentlichen Zugriff auf alle lokalen Supabase-Ports (54320–54349).
# Zugriff über localhost (nginx → Kong, deploy.sh → psql, SSH-Tunnel) bleibt unberührt,
# weil die Regeln nur für Traffic auf dem externen Interface gelten.
# Idempotent: kann beliebig oft ausgeführt werden.
# Hintergrund: docs/security-incident-2026-10-27.md
set -uo pipefail

IFACE="${IFACE:-venet0}"
PORTS="${PORTS:-54320:54349}"

add_rule() {  # $1 = iptables|ip6tables, $2 = chain, rest = rule
  local ipt=$1 chain=$2; shift 2
  $ipt -C "$chain" "$@" 2>/dev/null || $ipt -I "$chain" 1 "$@"
}

for ipt in iptables ip6tables; do
  command -v $ipt >/dev/null || continue
  # Docker-veröffentlichte Ports laufen per DNAT durch FORWARD → DOCKER-USER (ufw greift dort nicht).
  # --ctorigdstport matcht den ursprünglichen Host-Port vor dem DNAT.
  if $ipt -n -L DOCKER-USER >/dev/null 2>&1; then
    add_rule $ipt DOCKER-USER -i "$IFACE" -p tcp -m conntrack --ctorigdstport "$PORTS" --ctdir ORIGINAL -j DROP \
      || echo "WARN: $ipt DOCKER-USER-Regel fehlgeschlagen"
  else
    echo "WARN: $ipt hat keine DOCKER-USER-Chain"
  fi
  # Ports, die vom docker-proxy direkt auf dem Host angenommen werden (v.a. IPv6), laufen durch INPUT.
  add_rule $ipt INPUT -i "$IFACE" -p tcp --dport "$PORTS" -j DROP \
    || echo "WARN: $ipt INPUT-Regel fehlgeschlagen"
done

iptables -n -L DOCKER-USER --line-numbers 2>/dev/null | grep -E "$IFACE|Chain" || true
