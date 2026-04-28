# Staccato

Musikschul-Management-Plattform — von der Mitgliederverwaltung bis zum digitalen Unterrichtsraum.

## Features

- **Rollenbasierter Zugang** für Admins, Lehrer, Schüler und Eltern
- **Kursverwaltung** mit Stundenplanung, Anwesenheitserfassung und Hausaufgaben
- **Repertoire** mit Noten (PDF), Akkorden (ChordPro mit Transposition), Liedtexten, YouTube und Audio
- **Live-Unterrichtsmodus** — Lehrer startet eine Session per QR-Code/Code, Schüler folgen dem aktuellen Stück in Echtzeit und senden Reaktionen
- **Veranstaltungen** (Konzerte, Vorspiele, Prüfungen) mit RSVP-System
- **Interessenten-Pipeline** für Neuanmeldungen und Schnupperstunden
- **5 Themes** × Dark/Light Mode
- **Mehrsprachig**: Deutsch, Englisch, Türkisch

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
