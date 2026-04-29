# Staccato

Musikschul-Management-Plattform — von der Mitgliederverwaltung bis zum digitalen Unterrichtsraum.

## Features

### Schulbetrieb
- **Rollenbasierter Zugang** für Admins, Lehrer, Schüler, Eltern und Vorstand
- **Kursverwaltung** mit Stundenplanung, Anwesenheitserfassung und Hausaufgaben
- **Stundenplan** — Wochenansicht und Listenansicht, farb-kodiert nach Kurstyp
- **Repertoire** mit Noten (PDF), Akkorden (ChordPro mit Transposition), Liedtexten, YouTube und Audio
- **Live-Unterrichtsmodus** — Lehrer startet eine Session per QR-Code/Code, Schüler folgen dem aktuellen Stück in Echtzeit und senden Reaktionen
- **Veranstaltungen** (Konzerte, Vorspiele, Prüfungen, Vorstandssitzungen) mit RSVP-System
- **Interessenten-Pipeline** für Neuanmeldungen und Schnupperstunden
- **Mitgliederverwaltung** mit Dokumenten-Upload (SEPA, Verträge, etc.)

### Vorstandsmodul
- **Ziele & Aufgaben** — Jahres-/Quartalsziele mit Aufgaben, Status-Tracking und Verantwortlichen
- **Protokolle** — Sitzungsprotokolle mit Teilnehmern, Beschlüssen, Dateianhängen und Verknüpfung zur Vorstandssitzung
- **Admin-KPIs** — Vorstandsmodul-Kennzahlen direkt auf dem Admin-Dashboard

### Allgemein
- **5 Themes** × Dark/Light Mode
- **Mehrsprachig**: Deutsch, Englisch, Türkisch

## Rollen

| Rolle | Zugang |
|-------|--------|
| `superadmin` | Vollzugriff |
| `admin` | Schulverwaltung + Vorstandsmodul (lesend) |
| `lehrer` | Kurse, Stundenplan, Repertoire, Events |
| `schueler` | Eigene Kurse, Stundenplan, Events, Repertoire |
| `eltern` | Stundenplan, Dateien, Events |
| `vorstand` | Vorstandsmodul + Schüler-Funktionen |

## Tech Stack

- React 18 + Vite
- Supabase (Auth, Datenbank, Realtime, Storage)
- React Router v6

## Setup

```bash
# 1. Abhängigkeiten installieren
npm install

# 2. Umgebungsvariablen konfigurieren
cp .env.example .env
# .env ausfüllen: VITE_SUPABASE_URL und VITE_SUPABASE_ANON_KEY

# 3. Entwicklungsserver starten
npm run dev
```

Der Dev-Server läuft auf `http://localhost:5173`.

## Befehle

```bash
npm run dev      # Entwicklungsserver
npm run build    # Produktions-Build → dist/
npm run preview  # Produktions-Build lokal vorschauen
```

## Datenbank-Migrationen

Alle Migrationen liegen in `supabase/migrations/`. Reihenfolge bei einem Neu-Setup:

```bash
# 1. Schema + alle Migrationen einspielen
supabase db reset

# Oder manuell auf dem Produktionsserver:
docker exec -i supabase_db_staccato psql -U postgres -d postgres \
  < supabase/migrations/20240101000000_schema.sql
docker exec -i supabase_db_staccato psql -U postgres -d postgres \
  < supabase/migrations/20260428000000_email_benachrichtigungen.sql
docker exec -i supabase_db_staccato psql -U postgres -d postgres \
  < supabase/migrations/20260428000001_admin_set_email.sql
docker exec -i supabase_db_staccato psql -U postgres -d postgres \
  < supabase/migrations/20260428000002_fix_stunden_colehrer_rls.sql
docker exec -i supabase_db_staccato psql -U postgres -d postgres \
  < supabase/migrations/20260428000003_vorstand.sql

# 2. Seed-Daten (Schule, Storage-Buckets, Admin-User) – nur bei Ersteinrichtung:
docker exec -i supabase_db_staccato psql -U postgres -d postgres \
  < supabase/seed.sql
```

> `supabase_vorstand_migration.sql` im Root ist veraltet und durch `20260428000003_vorstand.sql` ersetzt.
