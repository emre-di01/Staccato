# Administration & Server-Zugang

## Supabase-Dienste (lokal auf dem Server)

Alle Supabase-Dienste laufen auf `localhost` und sind **nicht direkt von außen erreichbar** (Ports 54321–54327 durch Firewall gesperrt). Zugang nur per SSH-Tunnel.

### SSH-Tunnel einrichten

```bash
ssh -L 54323:localhost:54323 \
    -L 54322:localhost:54322 \
    -L 54324:localhost:54324 \
    edidev@<server-ip>
```

Danach im Browser auf dem eigenen Rechner:

| Dienst | URL | Zweck |
|--------|-----|-------|
| Supabase Studio | http://localhost:54323 | Datenbank-Admin, RLS, SQL-Editor |
| PostgreSQL direkt | localhost:54322 | Direkter DB-Zugriff (z.B. DBeaver, psql) |
| Mailpit | http://localhost:54324 | Lokale E-Mails (Einladungen, Resets) |

### SSH-Config (empfohlen, `~/.ssh/config` auf eigenem Rechner)

```
Host staccato
    HostName <server-ip>
    User edidev
    LocalForward 54323 localhost:54323
    LocalForward 54322 localhost:54322
    LocalForward 54324 localhost:54324
```

Danach reicht: `ssh staccato`

### Supabase Studio Login

Studio fragt nach E-Mail + Passwort — das sind die Supabase-Dashboard-Credentials, nicht die App-Credentials.
Bei lokaler Instanz (`supabase start`) ist kein Login erforderlich: einfach `http://localhost:54323` öffnen.

---

## Öffentlich erreichbare API (`api.401dev.de`)

Nginx routet `api.401dev.de` → `localhost:54321` (Supabase Kong).
Nur folgende Pfade sind durchgelassen:

| Pfad | Zweck |
|------|-------|
| `/rest/v1/` | PostgREST (RLS-geschützt) |
| `/auth/v1/` | Authentifizierung |
| `/storage/v1/` | Datei-Storage |
| `/realtime/v1/` | WebSocket / Realtime |
| `/functions/v1/` | Edge Functions |

Gesperrte Pfade (403): `/mcp`, alles andere.

---

## Supabase starten/stoppen

```bash
# Starten (mit .env für Edge-Function-Secrets)
set -a && source supabase/.env && set +a && supabase start

# Status
supabase status

# Stoppen
supabase stop
```

**Wichtig:** Niemals `supabase db reset` auf dem Server ausführen — löscht alle Produktionsdaten.

---

## Nginx

```bash
# Config testen
sudo nginx -t

# Neu laden (ohne Downtime)
sudo systemctl reload nginx

# Configs
/etc/nginx/sites-available/staccato          # 401dev.de + api.401dev.de
/etc/nginx/sites-available/staccato-music    # staccato-music.de + app.staccato-music.de
```

---

## Firewall (UFW)

Offene Ports: `22` (SSH), `80` (HTTP→HTTPS Redirect), `443` (HTTPS)
Alle anderen Ports (inkl. 54321–54327) sind gesperrt.

```bash
sudo ufw status verbose   # Status prüfen
sudo ufw allow 22         # SSH (falls noch nicht aktiv)
sudo ufw allow 80
sudo ufw allow 443
sudo ufw enable
```

---

## Deployments

```bash
# Frontend neu bauen + deployen
cd /home/edidev/dev/staccato/staccato
npm run build             # → dist/ wird von Nginx ausgeliefert

# Supabase Migration anwenden
supabase db push          # Ausstehende Migrationen auf laufende Instanz anwenden

# Edge Function deployen
supabase functions deploy <name>
```
