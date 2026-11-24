#!/bin/bash
# Server-Firewall: von außen (venet0) sind nur die Ports aus OFFEN erreichbar.
# - DOCKER-USER: keine neue Verbindung von außen zu veröffentlichten Container-Ports (nginx läuft auf dem Host)
# - INPUT (Kette STACCATO-IN): nur OFFEN und ICMP; RETURN statt ACCEPT, damit ufw/fail2ban weiter greifen
# Die Sperre 54320-54349 bleibt zusätzlich bestehen. Wiederholbar; Rücknahme der Grundsperre: supabase-firewall.sh zurueck
# Hintergrund: docs/security-incident-2026-10-27.md, Vorfall Filegator 2026-11-24
set -uo pipefail

IFACE="${IFACE:-venet0}"
PORTS="${PORTS:-54320:54349}"
OFFEN="${OFFEN:-22 80 443}"
KETTE=STACCATO-IN
FEHLER=0

add_rule() {  # $1 = iptables|ip6tables, $2 = chain, rest = rule
  local ipt=$1 chain=$2; shift 2
  $ipt -C "$chain" "$@" 2>/dev/null || $ipt -I "$chain" 1 "$@"
}
warn() { echo "WARN: $*"; case "$*" in ip6tables*) ;; *) FEHLER=1 ;; esac; }  # ohne IPv6 kein Fehler
hat_docker_kette() { $1 -n -L DOCKER-USER >/dev/null 2>&1; }

if [ "${1:-}" = zurueck ]; then
  for ipt in iptables ip6tables; do
    command -v $ipt >/dev/null || continue
    $ipt -D INPUT -i "$IFACE" -j $KETTE 2>/dev/null
    $ipt -F $KETTE 2>/dev/null; $ipt -X $KETTE 2>/dev/null
    $ipt -D DOCKER-USER -i "$IFACE" -m conntrack --ctstate NEW --ctdir ORIGINAL -j DROP 2>/dev/null
  done
  echo "Grundsperre entfernt (Sperre $PORTS bleibt)"; exit 0
fi

for ipt in iptables ip6tables; do
  command -v $ipt >/dev/null || continue
  # Docker-veröffentlichte Ports laufen per DNAT durch FORWARD → DOCKER-USER (ufw greift dort nicht).
  if hat_docker_kette $ipt; then
    add_rule $ipt DOCKER-USER -i "$IFACE" -p tcp -m conntrack --ctorigdstport "$PORTS" --ctdir ORIGINAL -j DROP \
      || warn "$ipt DOCKER-USER-Regel fehlgeschlagen"
    add_rule $ipt DOCKER-USER -i "$IFACE" -m conntrack --ctstate NEW --ctdir ORIGINAL -j DROP \
      || warn "$ipt DOCKER-USER-Grundsperre fehlgeschlagen"
  else
    warn "$ipt hat keine DOCKER-USER-Chain"
  fi
  add_rule $ipt INPUT -i "$IFACE" -p tcp --dport "$PORTS" -j DROP || warn "$ipt INPUT-Regel fehlgeschlagen"

  # Grundsperre auf dem Host. Während des Neuaufbaus ist die Kette nicht eingehängt.
  $ipt -D INPUT -i "$IFACE" -j $KETTE 2>/dev/null
  $ipt -N $KETTE 2>/dev/null || $ipt -F $KETTE
  ok=1
  $ipt -A $KETTE -m conntrack --ctstate ESTABLISHED,RELATED -j RETURN || ok=0
  for p in $OFFEN; do $ipt -A $KETTE -p tcp --dport "$p" -j RETURN || ok=0; done
  if [ $ipt = ip6tables ]; then $ipt -A $KETTE -p ipv6-icmp -j RETURN || ok=0; else $ipt -A $KETTE -p icmp -j RETURN || ok=0; fi
  $ipt -A $KETTE -j DROP || ok=0
  # Nur einhängen, wenn alle Ausnahmen stehen – sonst wäre SSH ausgesperrt
  if [ $ok = 1 ]; then $ipt -I INPUT 1 -i "$IFACE" -j $KETTE || warn "$ipt $KETTE nicht eingehängt"; else warn "$ipt $KETTE unvollständig, nicht eingehängt"; fi
done

iptables -n -L DOCKER-USER --line-numbers 2>/dev/null | grep -E "$IFACE|Chain|DROP" || true
iptables -S $KETTE 2>/dev/null || true
exit $FEHLER
