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

### Frontend
Copy `.env.example` to `.env` and fill in:
```
VITE_SUPABASE_URL=http://YOUR-SERVER-IP:54321
VITE_SUPABASE_ANON_KEY=your-anon-key
```

The app throws immediately at startup if these are missing (`src/lib/supabase.js`).

### Supabase / Edge Functions
`supabase/.env` (gitignored) holds SMTP credentials and app URL — these are injected into the edge runtime container via `[edge_runtime.secrets]` in `config.toml`:
```
SMTP_HOST=smtp.example.com
SMTP_PORT=465
SMTP_USER=user@example.com
SMTP_PASS=password
SMTP_FROM=noreply@example.com
APP_URL=http://YOUR-SERVER-IP:5173
```

Start Supabase so the `.env` is exported to the container environment:
```bash
set -a && source supabase/.env && set +a && supabase start
```

`config.toml` already has `[edge_runtime.secrets]` wired to read these via `env()` substitution.

## Architecture

**Staccato** is a music school management SPA built with React 18 + Vite + Supabase (auth, database, realtime, storage). No CSS framework — all styling is done via inline styles using CSS custom properties. Current version: **1.4.1** (see `package.json` and `src/changelog.js`).

### Role-based routing

Six roles: `superadmin`, `admin`, `lehrer` (teacher), `schueler` (student), `eltern` (parent), `vorstand` (board member). Each role has its own route subtree. After login, users are redirected to their role's home page via `startseiteNach(rolle)` in `src/components/ProtectedRoute.jsx`. `superadmin` shares the `/admin` subtree with `admin`. `vorstand` is an extended student: same course/schedule/events access as `schueler`, plus access to the Vorstandsmodul.

**Full route tree** (defined in `src/App.jsx`):

| Path | Component | Roles |
|------|-----------|-------|
| `/admin` | `AdminDashboard` | admin, superadmin |
| `/admin/mitglieder` | `Mitgliederverwaltung` | admin, superadmin |
| `/admin/kurse` | `Kursverwaltung` | admin, superadmin |
| `/admin/raeume` | `Raumverwaltung` | admin, superadmin |
| `/admin/stundenplan` | `Stundenplan` | admin, superadmin |
| `/admin/repertoire` | `Repertoire` | admin, superadmin |
| `/admin/repertoire/:stueckId` | `StueckDetail` | admin, superadmin |
| `/admin/events` | `Events` (admin) | admin, superadmin |
| `/admin/events/:id/repertoire` | `EventRepertoire` | admin, superadmin |
| `/admin/events/:kursId/repertoire/:stueckId` | `StueckDetail` | admin, superadmin |
| `/admin/instrumente` | `Instrumente` | admin, superadmin |
| `/admin/abrechnung` | *Platzhalter* | admin, superadmin |
| `/admin/interessenten` | `Interessenten` | admin, superadmin |
| `/admin/nachrichten` | *Platzhalter* | admin, superadmin |
| `/lehrer` | `LehrerDashboard` | lehrer, admin, superadmin |
| `/lehrer/kurse` | `LehrerKurse` | lehrer, admin, superadmin |
| `/lehrer/kurse/:id` | `KursDetail` | lehrer, admin, superadmin |
| `/lehrer/kurse/:id/repertoire` | `KursRepertoire` | lehrer, admin, superadmin |
| `/lehrer/kurse/:kursId/repertoire/:stueckId` | `StueckDetail` | lehrer, admin, superadmin |
| `/lehrer/kurse/:id/unterrichtsmodus` | `Unterrichtsmodus` | lehrer, admin, superadmin |
| `/lehrer/schueler` | `LehrerSchueler` | lehrer, admin, superadmin |
| `/lehrer/anwesenheit` | `Stundenplan` | lehrer, admin, superadmin |
| `/lehrer/repertoire` | `Repertoire` | lehrer, admin, superadmin |
| `/lehrer/events` | `Events` (lehrer) | lehrer, admin, superadmin |
| `/lehrer/nachrichten` | *Platzhalter* | lehrer, admin, superadmin |
| `/schueler` | `SchuelerDashboard` | schueler |
| `/schueler/stundenplan` | `Stundenplan` | schueler |
| `/schueler/kurse` | `SchuelerKurse` | schueler |
| `/schueler/kurse/:id` | `SchuelerKursDetail` | schueler |
| `/schueler/kurse/:id/anwesenheit` | `SchuelerAnwesenheit` | schueler |
| `/schueler/events` | `Events` (schueler) | schueler |
| `/schueler/repertoire` | `Repertoire` | schueler |
| `/schueler/nachrichten` | *Platzhalter* | schueler |
| `/vorstand` | `VorstandDashboard` | vorstand, admin, superadmin |
| `/vorstand/ziele` | `VorstandZiele` | vorstand, admin, superadmin |
| `/vorstand/protokolle` | `VorstandProtokolle` | vorstand, admin, superadmin |
| `/vorstand/stundenplan` | `Stundenplan` | vorstand, admin, superadmin |
| `/vorstand/kurse` | `SchuelerKurse` | vorstand, admin, superadmin |
| `/vorstand/events` | `Events` (schueler) | vorstand, admin, superadmin |
| `/vorstand/repertoire` | `Repertoire` | vorstand, admin, superadmin |
| `/eltern` | *Platzhalter* | eltern |
| `/eltern/stundenplan` | `Stundenplan` | eltern |
| `/eltern/dateien` | *Platzhalter* | eltern |
| `/eltern/events` | *Platzhalter* | eltern |
| `/eltern/nachrichten` | *Platzhalter* | eltern |
| `/session/:code` | `SchuelerSession` | public (no auth) |
| `/profil` | `ProfilSeite` | all roles |
| `/impressum` | `Impressum` | public |
| `/datenschutz` | `Datenschutz` | public |

**Placeholder routes**: Abrechnung, Nachrichten, Dateien, and the entire `eltern` subtree (except Stundenplan and Profil) render a `P(label, icon)` placeholder component — these features are in the schema but the UI is not yet implemented.

### Navigation menu items per role

Defined in `src/components/layout/AppLayout.jsx` (`getNavItems`):

- **admin / superadmin**: Dashboard, Mitglieder, Kurse, Stundenplan, Räume, Instrumente, Repertoire, Events, Abrechnung, Interessenten, Nachrichten, Kurs-Ansicht (`/lehrer/kurse`), Ziele, Protokolle
- **lehrer**: Dashboard, Meine Kurse, Stundenplan, Meine Schüler, Repertoire, Events, Nachrichten
- **schueler**: Dashboard, Stundenplan, Meine Kurse, Repertoire, Events, Nachrichten
- **vorstand**: Dashboard, Ziele, Protokolle, Stundenplan, Meine Kurse, Repertoire, Events
- **eltern**: Dashboard, Stundenplan, Dateien, Veranstaltungen, Nachrichten

### Global state — `useApp()`

All pages consume `AppContext` via the `useApp()` hook (`src/context/AppContext.jsx`). It provides:
- `session`, `profil`, `rolle`, `laden` — auth state
- `schule`, `setSchule` — current school object (`id`, `name`, `logo_url`, `website`, `email`, `telefon`, `adresse`, `zeitzone`); loaded on login alongside `profil`; `setSchule` can be called to update in-memory state without a re-fetch
- `T(key)` — translation function (see i18n below)
- `theme`, `darkMode`, `changeTheme()`, `toggleDark()` — theme state
- `lang`, `setLang()`, `zeitzone` — locale and school timezone
- `abmelden()`, `ladeProfil()` — auth actions

### AppLayout (`src/components/layout/AppLayout.jsx`)

Wraps all authenticated pages. Contains:
- **Desktop sidebar**: sticky, 240px, logo, nav links, "Session beitreten" button (schueler + vorstand), settings, reload, logout, version badge
- **Mobile header**: hamburger → full-width overlay sidebar; bottom nav (first 5 items); ↻ Reload button
- **SettingsPanel**: language switcher (de/en/tr), dark/light mode toggle, 5 theme selector
- **JoinSessionModal**: input for 6-char session code → navigates to `/session/:code`
- **Changelog modal**: scrollable version history from `CHANGELOG` in `src/changelog.js`

### Versioning / "Was ist neu?"

Version is stored in three places (must be kept in sync):
1. `package.json` → `"version"` — read by AppLayout for the sidebar badge (`v{version}`)
2. `src/changelog.js` → `CURRENT_VERSION` — compared to `localStorage.staccato_seen_version`
3. `src/changelog.js` → `CHANGELOG` array — newest entry first; each entry has `version`, `date`, `features: [{icon, de, en, tr}]`

`WhatsNewModal` (`src/components/WhatsNewModal.jsx`) shows after login whenever `CURRENT_VERSION` differs from localStorage. It displays `CHANGELOG[0]` (newest entry). Users dismiss it, which writes the version to localStorage.

**When bumping a version**: update all three locations and add a new entry to the top of `CHANGELOG`.

### Supabase integration

- `src/lib/supabase.js` exports a single `supabase` client used everywhere
- Auth: email/password via `supabase.auth`; password-reset flow redirects to `/passwort-zuruecksetzen`
- Database: direct table queries from each page component — no abstraction layer
- Realtime: Supabase channels are used in the live teaching session (`Unterrichtsmodus`/`SchuelerSession`) for participant joins and emoji reactions
- Storage: bucket `stueck-dateien` holds PDFs and audio for repertoire pieces; signed URLs (1h expiry) are created per request

### What the app does — feature overview

Staccato is a full music school management platform. Features by area:

- **Admin Dashboard** (`src/pages/admin/Dashboard.jsx`): Two tabs.
  - *Übersicht*: KPI cards (students, teachers, active courses, lessons today, attendance rate, monthly revenue, open prospects) via `dashboard_stats` RPC + Vorstandsmodul KPIs. Also shows upcoming events and teacher's own course list.
  - *Einstellungen*: `SchulEinstellungen` component — edit school name, logo URL (with live preview), website, email, phone, address. Saves to `schulen` table and updates the global `schule` context via `setSchule`.

- **Member management** (`Mitgliederverwaltung`): Create/edit/delete members of all roles. Admin can set passwords directly for members (via `supabase.auth.admin`), upload typed documents (Aufnahmeformular, Vertrag, SEPA, Einverständnis) stored in the `mitglied-dateien` bucket, view current course assignments.

- **Course management** (`Kursverwaltung`): Create/edit courses (`unterricht`) with type (einzel/gruppe/chor/ensemble), weekly schedule, room, instrument, billing model (einzeln/paket/pauschale), and teacher assignment. The detail view (`KursDetail`) has four tabs: Stunden (individual lessons with notes + homework), Anwesenheit (attendance matrix), Schüler (student list), and Repertoire (pieces linked to this course). Individual lessons can be deleted (cascades to `anwesenheit` and `stunden_lehrer`).

- **Room management** (`Raumverwaltung`): CRUD for rooms with capacity and equipment. Rooms are referenced in courses, lessons, events, and the Interessenten pipeline.

- **Instrument management** (`Instrumente`): CRUD for instruments with emoji, multilingual name (de/en/tr), and active/inactive status. Per-school — only shows instruments of the current school in course creation.

- **Schedule** (`Stundenplan`): Shared by admin, teacher, parent, schueler, vorstand (each via their own route, all render the same component). Two views: week grid (7–22 Uhr, 60px/h, timezone-aware) and list view. Colour-coded by course type. Events also appear inline. Teachers can mark lessons done/cancelled directly from the schedule.

- **Repertoire**: Global piece library (`Repertoire.jsx`) plus per-course and per-event repertoire (`KursRepertoire`, `EventRepertoire`). Pieces have: title, composer, key, tempo, YouTube link, lyrics (**Markdown** format, rendered via `marked`), chords (ChordPro format), and files (`stueck_dateien` with types `noten`/`liedtext`/`audio` and optional `stimme` voice part: soprano/alto/tenor/bass). Piece status: `aktuell`, `geplant`, `abgeschlossen`, `archiviert`.

- **Piece detail** (`StueckDetail`, `src/pages/lehrer/StueckDetail.jsx`):
  - ChordPro chords with live transposition (±semitone, SHARP/FLAT arrays)
  - PDFs inline via signed URL iframe; audio playback; YouTube embed
  - Per-voice file filtering (stimme: sopran/alt/tenor/bass)
  - **Liedtext rendered as Markdown** (`dangerouslySetInnerHTML` + `marked.parse`) in detail view, fullscreen, Unterrichtsmodus, and SchuelerSession
  - Editor has **preview toggle** (Bearbeiten ↔ Vorschau) and a `MarkdownTooltip` cheatsheet (## Refrain, ### Strophe, **fett**, *kursiv*, ---, > blockquote)
  - **PDF export**: opens a confirmation modal showing the school logo (from `schule.logo_url`); logo is embedded in print layout. If no logo: note pointing to Schuleinstellungen.

- **Events** (`Events`): Types: konzert, vorspiel, pruefung, veranstaltung, vorstandssitzung, sonstiges. Admin creates events, manages participant list (invites by profile), participants RSVP (yes/no). Events have optional end time, location, room, and public flag. Each event has its own repertoire (`EventRepertoire`). Vorstand users see all events of their school.

- **Vorstandsmodul** (`src/pages/vorstand/`): Board-member module accessible to `vorstand`, `admin`, `superadmin`.
  - `Dashboard.jsx` — KPIs (open tasks, goals, protocols, next session) + student tiles (courses, upcoming lessons).
  - `Ziele.jsx` — Annual/quarterly goals with collapsible tasks. Status cycles offen → in_bearbeitung → erledigt. Responsible person dropdown shows all vorstand/admin/superadmin of the same school.
  - `Protokolle.jsx` — Meeting protocols with attendee chips, decisions field, file attachments (bucket `vorstand-dateien`), and optional link to a `vorstandssitzung` event.
  - Admin dashboard also shows Vorstandsmodul KPIs (open/in-progress/done tasks, goal progress, protocol count).

- **Prospects** (`Interessenten`): Pipeline for new sign-ups with statuses `interessent` → `probe`. Stores desired instrument, preferred teacher, trial-lesson date/room, and notes.

- **Attendance**: Teachers mark per-lesson attendance (anwesend/abwesend/entschuldigt/zu_spaet) for each student. Attendance can be re-edited after recording (lessons with status `stattgefunden` show an edit button). Students see their own attendance history with rate. Auto-recorded when a live session ends.

- **Profile** (`ProfilSeite`): Any user can edit their name, phone, address, birthday, change password. Members see/download their documents (uploaded by admin).

- **Impressum / Datenschutz**: Public static pages, no auth required.

- **Not yet implemented** (placeholder routes, schema exists): Abrechnung (billing/invoices), Nachrichten (messaging), Dateien (parent file view), Eltern Dashboard.

### Supabase tables

**Core:**
- `profiles` — all users; columns: `id`, `voller_name`, `rolle`, `schule_id`, `sprache`, `telefon`, `adresse`, `geburtsdatum`, `aktiv`
- `schulen` — one row per school; columns: `id`, `name`, `adresse`, `telefon`, `email`, `website`, `logo_url`, `farbe`, `sprachen[]`, `aktiv`, `erstellt_am`, `zeitzone`
  - RLS: SELECT open to all; UPDATE/INSERT/DELETE via "schulen: sadmin" (superadmin only) + "schulen: admin update" (admin/superadmin for their own school)

**Courses & Lessons:**
- `unterricht` — courses; type enum: einzel/gruppe/chor/ensemble; billing enum: einzeln/paket/pauschale
- `unterricht_lehrer` — teacher↔course join
- `stunden` — individual lessons (datum, beginn, ende, status: geplant/stattgefunden/ausgefallen/verschoben, notizen, hausaufgaben)
- `stunden_lehrer` — lesson↔teacher join (for co-teachers)
- `anwesenheit` — per-student attendance; status: anwesend/abwesend/entschuldigt/zu_spaet
- `instrumente` — per-school instruments with emoji and multilingual names

**Repertoire:**
- `stuecke` — pieces; columns: titel, komponist, tonart, tempo, youtube_url, liedtext (Markdown), notizen (ChordPro akkorde)
- `unterricht_stuecke` — course↔piece join (has `status` and `reihenfolge` for ordering)
- `stueck_dateien` — files per piece; typ: noten/liedtext/audio; stimme: sopran/alt/tenor/bass (nullable)

**Events:**
- `events` — typ: konzert/vorspiel/pruefung/veranstaltung/vorstandssitzung/sonstiges
- `event_teilnehmer` — RSVP: status angenommen/abgelehnt/ausstehend
- `unterricht_sessions` / `session_teilnehmer` / `session_reaktionen` — live teaching session data

**Misc:**
- `raeume` — rooms with capacity and equipment
- `interessenten` — prospect pipeline
- `mitglied_dateien` — per-member documents (Aufnahmeformular, Vertrag, SEPA, Einverständnis)
- `nachrichten` — messages (schema ready; UI not yet implemented); typ: direkt/broadcast
- `rechnungen` — invoices (schema ready; UI not yet implemented)

**Vorstand:**
- `vorstand_ziele`, `vorstand_aufgaben`, `vorstand_protokolle`, `vorstand_protokoll_dateien`

**Storage buckets:** `stueck-dateien` (piece PDFs/audio), `mitglied-dateien` (member documents), `vorstand-dateien` (protocol attachments)

**RPC functions:** `dashboard_stats(p_schule_id)` — returns a single JSONB with all admin KPI values

**Helper functions (SECURITY DEFINER):**
- `meine_rolle()` — returns calling user's role; avoids RLS recursion in policies
- `meine_schule_id()` — returns calling user's `schule_id`; used in RLS policies
- `meine_schule()` — alias for `meine_schule_id()`; used in some older policies

### Live Teaching Session

Teacher opens `Unterrichtsmodus` (`/lehrer/kurse/:id/unterrichtsmodus`), which generates a 6-character uppercase code and QR code. Students join at `/session/:code` (`SchuelerSession.jsx`). Communication is bidirectional via Supabase realtime channels: teacher pushes the active piece/view (liedtext, akkorde, noten, audio, youtube), students send emoji reactions (👍👎✋❤️😕). Attendance is auto-recorded when the teacher ends the session. Liedtext is rendered as Markdown (`marked.parse`) in both the teacher view and the student session.

### Theming

`src/themes/themes.js` defines 5 themes (`klassik`, `modern`, `bold`, `kreativ`, `fresh`), each with light and dark variants. `applyTheme()` writes CSS custom properties (`--bg`, `--primary`, `--surface`, `--border`, `--text`, `--text-2`, `--text-3`, `--accent`, `--danger`, `--success`, `--radius`, `--radius-lg`, `--shadow-lg`, etc.) directly onto `document.documentElement`. All components style themselves using these variables. Theme and dark mode persist in `localStorage`.

### i18n

`src/i18n/translations.js` contains flat key→string maps for `de`, `en`, `tr`. The `t(lang, key)` function falls back to `de` then to the raw key. In components, use `const { T } = useApp()` and call `T('key')`. When adding UI text, add all three languages to `translations.js`.

### Page structure pattern

Pages are self-contained: they fetch their own data on mount, manage local state, and render inline-styled JSX. There is no shared data-fetching layer or component library. Reusable UI logic (ChordPro renderer, PdfInline viewer, transposition logic, MarkdownTooltip) is co-located in the files that need it — not extracted into shared utilities.
