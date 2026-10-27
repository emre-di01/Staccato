# Sicherheitsvorfall 2026-10-27: Öffentlich erreichbare Supabase-Datenbank

## Zusammenfassung

| | |
|---|---|
| Entdeckt | 2026-10-27, ca. 21:10 UTC (Routine-Check "läuft alles?") |
| Beginn | 2026-10-20, 21:40:16 UTC |
| Angreifer | `85.11.167.7` (automatisierter Krypto-Miner-Bot), dazu vereinzelte Scanner |
| Betroffen | Prod-DB `supabase_db_staccato` (Port 54322), außerdem offen: Studio, Kong, Inbucket von staccato **und** mosque-signage |
| Ergebnis | Kein Code ausgeführt, keine Daten verändert. Lesezugriff auf alle Daten war technisch möglich |
| Spürbare Folge | Postgres-Segfault ca. alle 5 Minuten → DB-Neustart → kurze Ausfälle von App und Realtime |
| Fix | Firewall-Regeln für die Ports 54320–54349 auf dem externen Interface (`infra/firewall/`) |

## Ursache

Die Supabase CLI veröffentlicht alle Ports auf `0.0.0.0`. Docker schreibt dafür eigene iptables-DNAT-Regeln
und **umgeht dadurch ufw**. Die lokale Instanz nutzt das Standard-Passwort `postgres`/`postgres`.
Damit konnten sich beliebige Hosts aus dem Internet als `postgres` anmelden.

Von außen erreichbar waren:

| Port | Dienst | Projekt |
|------|--------|---------|
| 54321 | Kong (API) | staccato |
| 54322 | **Postgres** | staccato |
| 54323 | **Studio (ohne Login = voller DB-Zugriff)** | staccato |
| 54324 | Inbucket | staccato |
| 54341 | Kong (API) | mosque-signage |
| 54342 | **Postgres** | mosque-signage |
| 54344 | **Studio** | mosque-signage |
| 54345 | Inbucket | mosque-signage |
| 54347 | Analytics | mosque-signage |

## Was der Angreifer versucht hat

Über 26.000 Logins in 7 Tagen. Ausgewertet aus `docker logs supabase_db_staccato`:

| Versuch | Ergebnis |
|---------|----------|
| `GRANT pg_execute_server_program TO CURRENT_USER` | abgelehnt: nur Superuser dürfen das |
| `COPY … TO PROGRAM 'echo <base64> \| base64 -d \| bash'` (lädt `/tmp/systemd` von `91.188.254.62`) | abgelehnt: `permission denied to COPY to or from an external program` |
| `CREATE FUNCTION system(cstring) … LANGUAGE c` | abgelehnt: `permission denied for language c` |
| `CREATE USER wog WITH SUPERUSER` | abgelehnt: `permission denied to create role` |
| `ALTER USER postgres/kong/… WITH PASSWORD …` | abgelehnt: `permission denied to alter role` |
| `DROP TABLE IF EXISTS tests` | ausgeführt, die Tabelle existierte nicht (harmlos) |
| `REVOKE pg_execute_server_program FROM CURRENT_USER` | **löst einen Segfault im Postgres-Backend aus** → Neustart der DB |

Geprüft am 2026-10-27:
- Keine C-Funktion mit `libc` in `pg_proc`, kein Superuser außer `supabase_admin`, `postgres` hat keine `pg_execute_server_program`-Mitgliedschaft
- `/tmp`, `/var/tmp` im DB-Container leer. Auf dem Host keine Prozesse oder Dateien mit Miner-Namen (`/tmp/systemd`, `xmrig`, `kinsing` …)
- Daten vollständig (profiles 34, auth.users 34, schulen 1, unterricht 2)
- mosque-signage-DB: keine Segfaults, `/tmp` leer

**Nicht ausschließbar:** Lesende Abfragen (SELECT) werden nicht geloggt (`log_statement = ddl`). Ob jemand Daten
gelesen hat, über Postgres oder das offene Studio, lässt sich nicht nachweisen.

Tatsächlich gespeicherte personenbezogene Daten (Stand 2026-10-27, 34 Profile): Namen und E-Mails aller Nutzer,
7× Telefon, 7× Geburtsdatum, 4× Adresse, 0× Erziehungsberechtigte. Bankdaten: nur 1 IBAN, und zwar die eigene des
Betreibers (Superadmin-Konto). Bankdaten Dritter waren also nicht betroffen.

## Fix

Dateien in `infra/firewall/`:

- `supabase-firewall.sh`: setzt idempotent zwei DROP-Regeln für `venet0`, Ports `54320:54349`
  - `DOCKER-USER` mit `--ctorigdstport` (Docker-DNAT-Traffic, ufw greift hier nicht)
  - `INPUT` (Traffic, den der docker-proxy direkt annimmt, z.B. IPv6)
- `supabase-firewall.service`: systemd-Unit, läuft beim Boot und bei jedem Docker-Neustart
- `install.sh`: installiert beides nach `/usr/local/sbin` bzw. `/etc/systemd/system`

Installation (einmalig, braucht sudo):

```bash
sudo bash infra/firewall/install.sh
```

### Warum danach alles wie gewohnt funktioniert

Die Regeln gelten nur für Pakete, die über das externe Interface `venet0` hereinkommen. Unverändert laufen:

- nginx → `localhost:54321` (api.401dev.de) und `localhost:54341` (mosque-api.401dev.de)
- `deploy.sh` (nutzt `docker exec … psql`), `supabase` CLI, Edge Functions, pg_cron (interne Docker-Netze)
- Andere Container (awqatsalah 8082, lyrica 9877, 8080, Portainer) – andere Ports, nicht betroffen

Zugriff auf Studio/DB von außen ab jetzt nur noch per SSH-Tunnel:

```bash
ssh -L 54323:localhost:54323 -L 54322:localhost:54322 edidev@178.254.1.229
# dann http://localhost:54323 im eigenen Browser
```

### Prüfen

```bash
sudo iptables -L DOCKER-USER -v -n     # Paketzähler der DROP-Regel steigt, wenn Bots es versuchen
docker logs --since 10m supabase_db_staccato 2>&1 | grep -c 85.11.167.7   # muss 0 sein
docker inspect -f '{{.RestartCount}} {{.State.StartedAt}}' supabase_db_staccato
```

Hinweis: Ein Test vom Server selbst gegen `178.254.1.229:54322` zeigt den Port weiterhin als offen, weil dieser
Traffic über `lo` läuft. Der Test muss von einem anderen Rechner kommen, z.B. `nc -zv 178.254.1.229 54322`.

## Offene Punkte / Empfehlungen

1. **DSGVO Art. 33**: Prüfen, ob eine Meldung an die Aufsichtsbehörde nötig ist. Ein Lesezugriff war möglich,
   ist aber nicht belegt. Keine Bankdaten Dritter betroffen; potenziell betroffen sind Namen, E-Mails sowie
   wenige Telefonnummern, Geburtsdaten und Adressen. Frist: 72 h ab Kenntnis (2026-10-27 21:10 UTC → **2026-10-30 21:10 UTC**).
   Die Entscheidung dokumentieren, auch wenn nicht gemeldet wird.
2. **Portainer** (`8000`, `9443`) ist ebenfalls öffentlich erreichbar. Wenn es nicht von außen gebraucht wird,
   gleich behandeln (Docker-Vollzugriff = Root auf dem Host).
3. Der Postgres-Segfault bei `REVOKE … FROM CURRENT_USER` ist ein Bug im Supabase-Postgres-Image. Nach dem Fix
   wird er nicht mehr ausgelöst. Beim nächsten Supabase-CLI-Update im Blick behalten.
4. Bei neuen lokalen Supabase-Projekten Ports im Bereich 54320–54349 wählen, dann sind sie automatisch
   abgedeckt. Sonst `PORTS` in `supabase-firewall.sh` erweitern.

---

# Nachtrag: Sicherheits-Audit 2026-10-27

Nach dem Firewall-Fix wurde der Server systematisch geprüft. Gefunden und behoben bzw. offen:

## Behoben

| # | Lücke | Fix |
|---|-------|-----|
| A | **Vite-Dev-Server öffentlich** (Ports 5173–5177, seit 160–172 Tagen vergessen). Lieferte `backup_prod_20260521_151245.sql` (komplette Prod-DB), `prod_auth_export.sql` (Logins + Passwort-Hashes) und über `/@fs/` beliebige Dateien aus (Vite 5.2.0, bekannte CVEs) | Prozesse gestoppt; Dumps nach `~/backups/staccato-prod/` (chmod 600) verschoben; `vite.config.js` bindet an `127.0.0.1` |
| B | **Öffentliche Registrierung → superadmin**: GoTrue-Signup ist aktiv, `handle_new_user` übernahm `rolle` aus `user_metadata` | `handle_new_user` setzt immer `schueler` (Migration `20261027000000_security_haertung.sql`) |
| C | **Rollen-Eskalation über eigenes Profil**: Policy `profiles: update` erlaubte jedem Nutzer `rolle`, `schule_id`, `letzte_schule_id` am eigenen Profil zu ändern → superadmin bzw. Zugriff auf fremde Schulen | Trigger `profil_schutz` |
| D | **Admin-RPCs ohne Prüfung**: `create_user` (jede Rolle, jede Schule, auch ohne Login), `demo_schule_loeschen`, `dashboard_stats`, `stunden_generieren`, `create_unterricht`, `anwesenheit_erfassen`, `paket_stunde_verbrauchen`, `naechste_rechnungsnummer` (Lücken in der Rechnungsnummernfolge, GoBD) | Rollen- und Schulprüfung per `RAISE` |
| E | **NULL-Bypass**: Prüfungen wie `IF meine_rolle() NOT IN (...)` greifen nicht, wenn der Aufrufer nicht eingeloggt ist (`NULL NOT IN (...)` ist NULL, nicht true). Betraf `admin_set_password`, `admin_set_email`, `delete_auth_user`, `mitgliedschaft_*`, `schule_anlegen`, `alle_schulen_stats`, `nutzer_schulen`, `einladung_versenden` | Prüfungen mit `IS DISTINCT FROM` bzw. Helfern, die nie NULL liefern |
| F | Admins konnten Passwort/E-Mail **jedes** Nutzers ändern, auch des Superadmins und in fremden Schulen (Demo-Anfragen erzeugen Admin-Konten für Fremde!) | Helfer `darf_nutzer_verwalten()` |

Neue Helfer: `ist_intern()` (cron/service_role/GoTrue, kein Nutzer-JWT), `ist_admin_von_schule(uuid)`,
`darf_nutzer_verwalten(uuid)`.

Getestet auf Prod in einer zurückgerollten Transaktion mit simulierten Rollen anon, schueler, lehrer, admin,
superadmin, service_role und cron. Alle erlaubten Abläufe (Profil bearbeiten, Schulwechsel, Mitglieder anlegen,
Stunden generieren, Rechnungsnummer, Demo-Bereinigung, Einladung, Session-Beitritt) funktionieren weiter.

### Postgres-Bug: Segfault bei "permission denied for function"

Im Image `public.ecr.aws/supabase/postgres:17.6.1.106` stürzt das Backend ab, sobald eine Rolle eine Funktion
ohne EXECUTE-Recht aufruft (reproduziert in einem Wegwerf-Container). Tabellen-Rechtefehler und `RAISE` sind
unproblematisch. Folgen:

- **Niemals `REVOKE EXECUTE` auf Funktionen in `public`/`graphql_public`**, sonst kann jeder per
  `POST /rest/v1/rpc/<fn>` die DB neu starten lassen. Zugriff stattdessen in der Funktion per `RAISE` prüfen.
- Derselbe Bug ist sehr wahrscheinlich die Ursache der Bot-Segfaults (`REVOKE pg_execute_server_program`).
- Beim Test der ersten Migrationsversion (mit REVOKE) stürzte die Prod-DB einmal ab (2026-10-27 21:33:44 UTC,
  ca. 1 s Recovery, keine Daten betroffen, Transaktion zurückgerollt).
- Beim nächsten Supabase-CLI-Update prüfen, ob ein neueres Image den Fehler behebt.

## Offen

| # | Lücke | Risiko | Fix |
|---|-------|--------|-----|
| G | **JWT-Secret ist der öffentliche Supabase-Default** (staccato + mosque-signage). Mit dem öffentlich bekannten Demo-`service_role`-Key hat jeder vollen Zugriff über `https://api.401dev.de` (getestet: HTTP 200) | **kritisch** | Neues Secret in `config.toml`, Supabase neu starten, Frontend mit neuem anon-Key bauen. Nutzer müssen sich ggf. neu einloggen |
| H | Öffentliche Registrierung aktiv (`enable_signup = true`), wird von der App nicht genutzt (Magic Link mit `shouldCreateUser: false`, Nutzer entstehen per `create_user`/Edge Functions mit Admin-API) | mittel (nach B nur noch Schüler-Konten in der Default-Schule) | `enable_signup = false` in `[auth]` und `[auth.email]`, zusammen mit G |
| I | SSH: `PermitRootLogin yes`, Passwort-Login an, kein fail2ban | hoch | Nur Key-Login, Root-Login aus, fail2ban |
| J | Öffentlich: Portainer `9443`/`8000` (= Root über Docker), `8080`, `9876` (basic-pitch), `9877` (lyrica), `8082` (zusätzlich zu nginx) | hoch (Portainer) | Firewall-Regel analog `infra/firewall/` |
| K | `localhost+2-key.pem` (mkcert-Dev-Zertifikat) liegt in Git | niedrig | Aus Repo entfernen, `.gitignore` |
| L | Durch A und G waren Passwort-Hashes abgreifbar | DSGVO | In die Art.-33-Entscheidung einbeziehen, ggf. Passwort-Reset erzwingen |
