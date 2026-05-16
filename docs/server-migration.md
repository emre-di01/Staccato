# Server-Migration

Anleitung für den Umzug auf einen neuen Server.

## Voraussetzungen (neuer Server)

- Ubuntu 22.04 LTS
- Mindestens 2 GB RAM (Supabase Docker-Stack)
- Domain-A-Record noch auf alten Server zeigend (erst am Ende umbiegen)

---

## 1. Datenbank-Backup (alter Server)

```bash
docker exec supabase_db_staccato pg_dump -U postgres postgres > ~/staccato_backup.sql
```

Backup auf lokalen Rechner sichern:
```bash
scp user@alter-server:~/staccato_backup.sql ./staccato_backup.sql
```

---

## 2. Neuen Server vorbereiten

### Docker installieren
```bash
sudo apt update && sudo apt install -y ca-certificates curl gnupg
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /usr/share/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/usr/share/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list
sudo apt update && sudo apt install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
sudo usermod -aG docker $USER
```

### Supabase CLI installieren
```bash
curl -fsSL https://supabase.com/install.sh | sh
```

### Nginx + Certbot installieren
```bash
sudo apt install -y nginx certbot python3-certbot-nginx
```

---

## 3. Repo klonen

```bash
git clone https://github.com/emre-di01/Staccato.git /home/edidev/dev/staccato/staccato
cd /home/edidev/dev/staccato/staccato
npm install
```

---

## 4. Env-Dateien anlegen

### `.env`
```
VITE_SUPABASE_URL=https://api.401dev.de
VITE_SUPABASE_ANON_KEY=<anon-key aus supabase start>
```

### `supabase/.env`
```
SMTP_HOST=smtp.1blu.de
SMTP_PORT=465
SMTP_USER=...
SMTP_PASS=...
SMTP_FROM=staccato@401dev.de
APP_URL=https://401dev.de
```

---

## 5. Supabase starten und Daten einspielen

```bash
# Supabase starten
set -a && source supabase/.env && set +a && supabase start

# Backup einspielen
docker exec -i supabase_db_staccato psql -U postgres postgres < ~/staccato_backup.sql
```

> **Kein** `supabase db reset` — das löscht alle Daten.

---

## 6. Frontend bauen

```bash
npm run build
```

---

## 7. Nginx konfigurieren

```bash
sudo cp nginx.conf /etc/nginx/sites-available/staccato
sudo ln -s /etc/nginx/sites-available/staccato /etc/nginx/sites-enabled/staccato
sudo nginx -t && sudo systemctl reload nginx
```

---

## 8. SSL-Zertifikate holen

DNS-A-Record erst jetzt auf neue Server-IP umbiegen, dann warten bis Propagation durch (~5 min), dann:

```bash
sudo certbot --nginx -d 401dev.de -d www.401dev.de -d api.401dev.de
```

---

## 9. Smoke-Test

```bash
# Frontend erreichbar?
curl -s -o /dev/null -w "%{http_code}" https://401dev.de

# API erreichbar?
curl -s -o /dev/null -w "%{http_code}" https://api.401dev.de/auth/v1/health
```

Beide sollten `200` zurückgeben. Dann Login in der App testen.

---

## 10. Alter Server

Erst wenn alles auf dem neuen Server funktioniert, den alten abschalten.
