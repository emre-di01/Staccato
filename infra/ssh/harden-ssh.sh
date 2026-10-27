#!/bin/bash
# SSH-Härtung in zwei Stufen. Hintergrund: docs/security-incident-2026-10-27.md
#
#   sudo bash infra/ssh/harden-ssh.sh            # Stufe 1: Root-Login aus, fail2ban, Limits
#   sudo bash infra/ssh/harden-ssh.sh --keys-only # Stufe 2: Passwort-Login aus (erst NACH erfolgreichem Key-Login!)
#
# Bestehende SSH-Sitzungen bleiben bei einem Reload offen. Nach jeder Stufe in einem ZWEITEN Terminal
# testen, ob der Login noch klappt, bevor die aktuelle Sitzung geschlossen wird.
set -euo pipefail
[ "$(id -u)" -eq 0 ] || { echo "Bitte mit sudo ausführen"; exit 1; }

ADMIN_USER="${SUDO_USER:-edidev}"
CONF=/etc/ssh/sshd_config.d/00-hardening.conf   # 00-: sshd nimmt den ersten Wert, schlägt also sshd_config

KEYS_ONLY=no
[ "${1:-}" = "--keys-only" ] && KEYS_ONLY=yes

if [ "$KEYS_ONLY" = yes ]; then
  AK="/home/$ADMIN_USER/.ssh/authorized_keys"
  if ! grep -qE '^(ssh-|ecdsa-|sk-)' "$AK" 2>/dev/null; then
    echo "ABBRUCH: $AK enthält keinen Key, du würdest dich aussperren."; exit 1
  fi
  if ! grep -qE "Accepted publickey for $ADMIN_USER" /var/log/auth.log 2>/dev/null; then
    echo "ABBRUCH: Noch kein erfolgreicher Key-Login für $ADMIN_USER in /var/log/auth.log."
    echo "Erst per Key einloggen (ssh -i ... $ADMIN_USER@<server>), dann erneut ausführen."; exit 1
  fi
fi

cp -a /etc/ssh/sshd_config "/etc/ssh/sshd_config.bak.$(date +%Y%m%d%H%M%S)"
[ -f "$CONF" ] && cp -a "$CONF" "$CONF.bak.$(date +%Y%m%d%H%M%S)"

cat > "$CONF" <<EOF
# Verwaltet von staccato/infra/ssh/harden-ssh.sh
PermitRootLogin no
MaxAuthTries 3
LoginGraceTime 30
X11Forwarding no
PubkeyAuthentication yes
KbdInteractiveAuthentication no
PermitEmptyPasswords no
PasswordAuthentication $( [ "$KEYS_ONLY" = yes ] && echo no || echo yes )
EOF

if ! sshd -t; then
  echo "sshd -t fehlgeschlagen, Änderung wird zurückgenommen"; rm -f "$CONF"; exit 1
fi
systemctl reload ssh || systemctl reload sshd

# fail2ban: sperrt IPs nach 5 Fehlversuchen in 10 Minuten für 1 Stunde
if ! command -v fail2ban-client >/dev/null; then
  apt-get update -qq && DEBIAN_FRONTEND=noninteractive apt-get install -y -qq fail2ban
fi
cat > /etc/fail2ban/jail.d/sshd-staccato.local <<'EOF'
[sshd]
enabled  = true
maxretry = 5
findtime = 10m
bantime  = 1h
EOF
systemctl enable --now fail2ban >/dev/null
systemctl restart fail2ban

echo
echo "== Effektive SSH-Einstellungen"
sshd -T | grep -E '^(permitrootlogin|passwordauthentication|pubkeyauthentication|maxauthtries|logingracetime|x11forwarding) '
echo "== fail2ban"
sleep 2; fail2ban-client status sshd | sed -n '1,6p'
echo
echo "JETZT in einem ZWEITEN Terminal neu einloggen und testen, bevor du diese Sitzung schließt!"
