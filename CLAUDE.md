# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start dev server on port 5173 (all interfaces)
npm run build     # Production build → dist/
npm run preview   # Preview production build
```

No linting or test commands are configured.

## Environment Setup

Copy `.env.example` to `.env` and fill in:
```
VITE_SUPABASE_URL=http://YOUR-SERVER-IP:54321
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The app throws immediately at startup if these are missing (`src/lib/supabase.js`).

## Architecture

**Staccato** is a music school management SPA built with React 18 + Vite + Supabase (auth, database, realtime, storage). No CSS framework — all styling is done via inline styles using CSS custom properties.

### Role-based routing

Six roles: `superadmin`, `admin`, `lehrer` (teacher), `schueler` (student), `eltern` (parent), `vorstand` (board member). Each role has its own route subtree (`/admin/*`, `/lehrer/*`, `/schueler/*`, `/eltern/*`, `/vorstand/*`). After login, users are redirected to their role's home page via `startseiteNach(rolle)` in `src/components/ProtectedRoute.jsx`. `superadmin` shares the `/admin` subtree with `admin`. `vorstand` is an extended student: same course/schedule/events access as `schueler`, plus access to the Vorstandsmodul (`/vorstand/ziele`, `/vorstand/protokolle`). Admin and superadmin also have read access to all Vorstand pages.

### Global state — `useApp()`

All pages consume `AppContext` via the `useApp()` hook (`src/context/AppContext.jsx`). It provides:
- `session`, `profil`, `rolle`, `laden` — auth state
- `T(key)` — translation function (see i18n below)
- `theme`, `darkMode`, `changeTheme()`, `toggleDark()` — theme state
- `lang`, `setLang()`, `zeitzone` — locale and school timezone

### Supabase integration

- `src/lib/supabase.js` exports a single `supabase` client used everywhere
- Auth: email/password via `supabase.auth`; password-reset flow redirects to `/passwort-zuruecksetzen`
- Database: direct table queries from each page component — no abstraction layer
- Realtime: Supabase channels are used in the live teaching session (`Unterrichtsmodus`/`SchuelerSession`) for participant joins and emoji reactions
- Storage: bucket `stueck-dateien` holds PDFs and audio for repertoire pieces; signed URLs (1h expiry) are created per request

### What the app does — feature overview

Staccato is a full music school management platform. Features by area:

- **Admin Dashboard**: KPI overview cards (students, teachers, active courses, lessons today, attendance rate, monthly revenue, open prospects) via a Supabase RPC function `dashboard_stats`.
- **Member management** (`Mitgliederverwaltung`): Create/edit/delete members of all roles. Admin can set passwords directly for members (via `supabase.auth.admin`), upload typed documents (Aufnahmeformular, Vertrag, SEPA, Einverständnis) stored in the `mitglied-dateien` bucket, view current course assignments.
- **Course management** (`Kursverwaltung`): Create/edit courses (`unterricht`) with type (einzel/gruppe/chor/ensemble), weekly schedule, room, instrument, billing model (einzeln/paket/pauschale), and teacher assignment. The detail view (`KursDetail`) has four tabs: Stunden (individual lessons with notes + homework), Anwesenheit (attendance matrix), Schüler (student list), and Repertoire (pieces linked to this course).
- **Room management** (`Raumverwaltung`): CRUD for rooms with capacity and equipment. Rooms are referenced in courses, lessons, events, and the Interessenten pipeline.
- **Schedule** (`Stundenplan`): Shared by admin, teacher, parent. Two views: week grid (7–22 Uhr, 60px/h, timezone-aware) and list view. Colour-coded by course type. Events also appear inline. Teachers can mark lessons done/cancelled directly from the schedule.
- **Repertoire**: Global piece library (`Repertoire.jsx`) plus per-course and per-event repertoire (`KursRepertoire`, `EventRepertoire`). Pieces have: title, composer, key, tempo, YouTube link, lyrics (plain text), chords (ChordPro format), and files (`stueck_dateien` with types `noten`/`liedtext`/`audio` and optional `stimme` voice part: soprano/alto/tenor/bass). Piece status: `aktuell`, `geplant`, `abgeschlossen`, `archiviert`.
- **Piece detail** (`StueckDetail`): Renders ChordPro chords with live transposition (semitone up/down using SHARP/FLAT arrays). Renders PDFs inline via signed URL iframe. Plays audio. Shows YouTube embed. Per-voice file filtering.
- **Events** (`Events`): Types: konzert, vorspiel, pruefung, veranstaltung, vorstandssitzung, sonstiges. Admin creates events, manages participant list (invites by profile), participants RSVP (yes/no). Events have optional end time, location, room, and public flag. Each event has its own repertoire (`EventRepertoire`). Vorstand users see all events of their school.
- **Vorstandsmodul** (`src/pages/vorstand/`): Board-member module accessible to `vorstand`, `admin`, `superadmin`.
  - `Dashboard.jsx` — KPIs (open tasks, goals, protocols, next session) + student tiles (courses, upcoming lessons).
  - `Ziele.jsx` — Annual/quarterly goals with collapsible tasks. Status cycles offen → in_bearbeitung → erledigt. Responsible person dropdown shows all vorstand/admin/superadmin of the same school.
  - `Protokolle.jsx` — Meeting protocols with attendee chips, decisions field, file attachments (bucket `vorstand-dateien`), and optional link to a `vorstandssitzung` event.
  - Admin dashboard also shows Vorstandsmodul KPIs (open/in-progress/done tasks, goal progress, protocol count).
- **Prospects** (`Interessenten`): Pipeline for new sign-ups with statuses `interessent` → `probe`. Stores desired instrument, preferred teacher, trial-lesson date/room, and notes.
- **Attendance**: Teachers mark per-lesson attendance (anwesend/abwesend/entschuldigt/zu_spaet) for each student. Students see their own attendance history with rate. Auto-recorded when a live session ends.
- **Profile** (`ProfilSeite`): Any user can edit their name, phone, address, birthday, change password. Members see/download their documents (uploaded by admin).
- **Impressum / Datenschutz**: Public static pages, no auth required.

### Supabase tables

`profiles`, `schulen`, `unterricht` (courses), `unterricht_lehrer` (teacher↔course), `stunden` (individual lessons), `stunden_lehrer`, `anwesenheit`, `instrumente`, `raeume`, `stuecke` (pieces), `unterricht_stuecke` (course↔piece join, has `status`), `stueck_dateien`, `events`, `event_teilnehmer` (RSVP), `session_teilnehmer`, `session_reaktionen`, `interessenten`, `mitglied_dateien`, `vorstand_ziele`, `vorstand_aufgaben`, `vorstand_protokolle`, `vorstand_protokoll_dateien`

Storage buckets: `stueck-dateien` (piece PDFs/audio), `mitglied-dateien` (member documents), `vorstand-dateien` (protocol attachments)

RPC functions: `dashboard_stats`

Helper functions: `meine_rolle()` SECURITY DEFINER — returns the calling user's role without triggering RLS recursion. `meine_schule_id()` SECURITY DEFINER — returns the calling user's school ID, used in RLS policies that need to compare against the same school without a self-referencing profiles query.

### Live Teaching Session

Teacher opens `Unterrichtsmodus` (`/lehrer/kurse/:id/unterrichtsmodus`), which generates a 6-character uppercase code and QR code. Students join at `/session/:code` (`SchuelerSession.jsx`). Communication is bidirectional via Supabase realtime channels: teacher pushes the active piece/view, students send emoji reactions (👍👎✋❤️😕). Attendance is auto-recorded when the teacher ends the session.

### Theming

`src/themes/themes.js` defines 5 themes (`klassik`, `modern`, `bold`, `kreativ`, `fresh`), each with light and dark variants. `applyTheme()` writes CSS custom properties (`--bg`, `--primary`, `--surface`, etc.) directly onto `document.documentElement`. All components style themselves using these variables. Theme and dark mode persist in `localStorage`.

### i18n

`src/i18n/translations.js` contains flat key→string maps for `de`, `en`, `tr`. The `t(lang, key)` function falls back to `de` then to the raw key. In components, use `const { T } = useApp()` and call `T('key')`. When adding UI text, add all three languages to `translations.js`.

### Page structure pattern

Pages are self-contained: they fetch their own data on mount, manage local state, and render inline-styled JSX. There is no shared data-fetching layer or component library. Reusable UI logic (ChordPro renderer, PdfInline viewer, transposition logic) is co-located in the files that need it — not extracted into shared utilities.
