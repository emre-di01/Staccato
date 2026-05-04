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

**Staccato** is a music school management SPA built with React 18 + Vite + Supabase (auth, database, realtime, storage). No CSS framework — all styling is done via inline styles using CSS custom properties. Current version: **1.6.0** (see `package.json` and `src/changelog.js`).

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
| `/admin/nachrichten` | `Nachrichten` | admin, superadmin |
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
| `/lehrer/nachrichten` | `Nachrichten` | lehrer, admin, superadmin |
| `/schueler` | `SchuelerDashboard` | schueler |
| `/schueler/stundenplan` | `Stundenplan` | schueler |
| `/schueler/kurse` | `SchuelerKurse` | schueler |
| `/schueler/kurse/:id` | `SchuelerKursDetail` | schueler |
| `/schueler/kurse/:id/anwesenheit` | `SchuelerAnwesenheit` | schueler |
| `/schueler/events` | `Events` (schueler) | schueler |
| `/schueler/repertoire` | `Repertoire` | schueler |
| `/schueler/nachrichten` | `Nachrichten` | schueler |
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
| `/eltern/nachrichten` | `Nachrichten` | eltern |
| `/session/:code` | `SchuelerSession` | public (no auth) |
| `/profil` | `ProfilSeite` | all roles |
| `/impressum` | `Impressum` | public |
| `/datenschutz` | `Datenschutz` | public |

**Placeholder routes**: Abrechnung, Dateien, and the `eltern` Dashboard render a `P(label, icon)` placeholder component — these features are in the schema but the UI is not yet implemented.

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
  - **MD/Plain-Toggle**: Pill-Button (MD | Plain) in der Liedtext-Toolbar, im Vollbild und in Unterrichtsmodus/SchuelerSession. Wahl wird in `localStorage` (`staccato_liedtext_md`) gespeichert (Default: `true` = Markdown). MD → `dangerouslySetInnerHTML + marked.parse`; Plain → `<pre whiteSpace:pre-wrap>`.
  - Editor hat **Vorschau-Toggle** (Bearbeiten ↔ Vorschau) und einen `MarkdownTooltip`-Cheatsheet (## Refrain, ### Strophe, **fett**, *kursiv*, ---, > blockquote)
  - **PDF export**: öffnet Bestätigungs-Modal mit Logo-Vorschau; Logo aus `schule.logo_url` wird ins Drucklayout eingebettet. PDF exportiert immer als Markdown (unabhängig vom Toggle).

- **Events** (`Events`): Types: konzert, vorspiel, pruefung, veranstaltung, vorstandssitzung, sonstiges. Admin creates events, manages participant list (invites by profile), participants RSVP (yes/no). Events have optional end time, location, room, and public flag. Each event has its own repertoire (`EventRepertoire`). Vorstand users see all events of their school.

- **Vorstandsmodul** (`src/pages/vorstand/`): Board-member module accessible to `vorstand`, `admin`, `superadmin`.
  - `Dashboard.jsx` — KPIs (open tasks, goals, protocols, next session) + student tiles (courses, upcoming lessons).
  - `Ziele.jsx` — Annual/quarterly goals with collapsible tasks. Status cycles offen → in_bearbeitung → erledigt. Responsible person dropdown shows all vorstand/admin/superadmin of the same school.
  - `Protokolle.jsx` — Meeting protocols with attendee chips, decisions field, file attachments (bucket `vorstand-dateien`), and optional link to a `vorstandssitzung` event.
  - Admin dashboard also shows Vorstandsmodul KPIs (open/in-progress/done tasks, goal progress, protocol count).

- **Prospects** (`Interessenten`): Pipeline for new sign-ups with statuses `interessent` → `probe`. Stores desired instrument, preferred teacher, trial-lesson date/room, and notes.

- **Attendance**: Teachers mark per-lesson attendance (anwesend/abwesend/entschuldigt/zu_spaet) for each student. Attendance can be re-edited after recording (lessons with status `stattgefunden` show an edit button). Students see their own attendance history with rate. Auto-recorded when a live session ends.

- **Profile** (`ProfilSeite`): Any user can edit their name, phone, address, birthday, change password. Members see/download their documents (uploaded by admin).

- **Nachrichten** (`src/pages/Nachrichten.jsx`): Messaging for all roles. Three message types: `direkt` (direct 1:1), `broadcast` (school-wide), `kurs` (course group). The same component serves admin, lehrer, schueler, and eltern routes. Features: unread badge in the sidebar nav, compose modal (select type → recipient/course → subject + body), message list with sender avatar/role chip, read-receipt tracking via `nachricht_gelesen`. Mobile-optimised: stack navigation (list → detail → compose), bottom-sheet compose. Desktop: persistent popup (bottom-right, hover). Admins and teachers can send all types; students and parents receive only.

- **Impressum / Datenschutz**: Public static pages, no auth required.

- **Not yet implemented** (placeholder routes, schema exists): Abrechnung (billing/invoices), Dateien (parent file view), Eltern Dashboard.

### Supabase tables

**Core:**
- `profiles` — all users; columns: `id`, `voller_name`, `rolle`, `schule_id`, `sprache`, `telefon`, `adresse`, `geburtsdatum`, `aktiv`, `notizen`, `avatar_url`, `email_benachrichtigungen` (jsonb), `kalender_token` (uuid, unique), `erstellt_am`, `aktualisiert_am`
- `schulen` — one row per school; columns: `id`, `name`, `adresse`, `telefon`, `email`, `website`, `logo_url`, `farbe`, `sprachen[]`, `aktiv`, `erstellt_am`, `zeitzone` (default `'Europe/Berlin'`)
  - RLS: SELECT open to all authenticated; UPDATE via `schulen: sadmin` (superadmin, all ops) + `schulen: admin update` (admin/superadmin for own school)
- `eltern_schueler` — parent↔student join (`eltern_id`, `schueler_id`)

**Courses & Lessons:**
- `unterricht` — courses; `typ` enum: `einzel/gruppe/chor/ensemble`; `abrechnungs_typ`: `einzeln/paket/pauschale`; has `wochentag`, `uhrzeit_von/bis` (time without timezone — stored as local school time), `raum_id`, `instrument_id`, `farbe`
- `unterricht_lehrer` — teacher↔course join (`lehrer_id`, `unterricht_id`, `rolle`)
- `unterricht_schueler` — student↔course join (`schueler_id`, `unterricht_id`, `status`)
- `stunden` — individual lessons; `beginn`/`ende` as `timestamptz` (UTC); `status` enum `termin_status`: `geplant/stattgefunden/abgesagt/verschoben`; `notizen`, `hausaufgaben`, `raum_id` (optional override)
- `stunden_lehrer` — lesson↔teacher join (for co-teachers)
- `anwesenheit` — per-student attendance; `status`: `anwesend/abwesend/entschuldigt/zu_spaet`
- `instrumente` — per-school instruments with emoji and multilingual names (`name_de`, `name_en`, `name_tr`)
- `lehrer_instrumente` — teacher↔instrument join
- `pakete` — lesson packages per student/course

**Repertoire:**
- `stuecke` — pieces; `titel`, `komponist`, `tonart`, `tempo`, `youtube_url`, `liedtext` (Markdown), `notizen` (ChordPro akkorde), `erstellt_von`
- `unterricht_stuecke` — course↔piece join (`status`, `reihenfolge`)
- `event_stuecke` — event↔piece join
- `stueck_dateien` — files per piece; `typ`: `noten/liedtext/audio`; `stimme`: `sopran/alt/tenor/bass` (nullable)

**Events:**
- `events` — `typ` enum `event_typ`: `konzert/vorspiel/pruefung/veranstaltung/vorstandssitzung/sonstiges`; `oeffentlich` bool; `beginn`/`ende` as `timestamptz`
- `event_teilnehmer` — RSVP; column `zusage` of type `zusage_status` enum: `offen/zugesagt/abgesagt`
- `unterricht_sessions` / `session_teilnehmer` / `session_reaktionen` — live teaching session data

**Misc:**
- `raeume` — rooms with capacity and equipment
- `interessenten` — prospect pipeline
- `mitglied_dateien` — per-member documents (Aufnahmeformular, Vertrag, SEPA, Einverständnis)
- `dateien` — generic file attachments (schueler_id, typ, bucket_pfad)
- `nachrichten` — messages; `typ` (`nachricht_typ` enum): `direkt/broadcast/kurs`; `kurs_id` uuid (nullable, FK → `unterricht`, for `kurs`-type messages); `gesendet_von`, `empfaenger_id` (nullable for broadcast/kurs), `betreff`, `inhalt`, `schule_id`
- `nachricht_gelesen` — read receipts for messages (`nachricht_id`, `user_id`, `gelesen_am`)
- `rechnungen` — invoices (schema ready; UI not yet implemented)
- `push_subscriptions` — Web Push subscription endpoints per user
- `kalender_tokens` — legacy token table (token management now via `kalender_token` column in `profiles`)

**Vorstand:**
- `vorstand_ziele` — annual/quarterly goals; `status`: `offen/in_bearbeitung/erledigt`
- `vorstand_aufgaben` — tasks linked to goals; `status`: `offen/in_bearbeitung/erledigt`
- `vorstand_protokolle` — meeting protocols with `teilnehmer_ids[]`, `beschluesse`, `inhalt`, optional `event_id`
- `vorstand_protokoll_dateien` — file attachments for protocols

**View:**
- `mitglieder_mit_email` — joins `profiles` with `auth.users` to expose `email`; used by `Mitgliederverwaltung`; defined in `seed.sql` (not in migrations — must stay in seed); `security_invoker = false` so `auth.users` is readable

**Storage buckets:**
| Bucket | Public | Zweck |
|--------|--------|-------|
| `avatare` | ✓ | Profile pictures |
| `stueck-dateien` | ✗ | Piece PDFs and audio |
| `kurs-dateien` | ✗ | Course files |
| `schueler-dateien` | ✗ | Student files |
| `mitglied-dateien` | ✗ | Member documents (Aufnahmeformular etc.) |
| `vorstand-dateien` | ✗ | Board meeting protocol attachments |

**Enum types:**
| Enum | Values |
|------|--------|
| `user_rolle` | `superadmin, admin, lehrer, schueler, eltern, vorstand` |
| `unterricht_typ` | `einzel, gruppe, chor, ensemble` |
| `abrechnungs_typ` | `einzeln, paket, pauschale` |
| `termin_status` | `geplant, stattgefunden, abgesagt, verschoben` |
| `event_typ` | `konzert, vorspiel, pruefung, veranstaltung, sonstiges, vorstandssitzung` |
| `zusage_status` | `offen, zugesagt, abgesagt` |
| `sprache` | `de, en, tr` |
| `nachricht_typ` | `direkt, broadcast, kurs` |

**Database functions (all SECURITY DEFINER unless noted):**
| Function | Returns | Purpose |
|----------|---------|---------|
| `meine_rolle()` | `user_rolle` | Calling user's role — used in RLS to avoid recursion |
| `meine_schule_id()` | `uuid` | Calling user's `schule_id` — used in RLS policies |
| `meine_schule()` | `uuid` | Alias for `meine_schule_id()` — older policies |
| `create_user(email, passwort, name, rolle, schule_id)` | `uuid` | Creates auth.users row + profile in one transaction |
| `delete_auth_user(user_id)` | `void` | Deletes from auth.users (cascades to profile) |
| `admin_set_password(user_id, passwort)` | `void` | Sets password without confirmation email |
| `admin_set_email(user_id, email)` | `void` | Sets email without confirmation email |
| `dashboard_stats(schule_id)` | `jsonb` | All admin KPI values in one call |
| `stunden_generieren(unterricht_id, von, bis)` | `integer` | Generates weekly lesson rows for a course; uses school `zeitzone` via `AT TIME ZONE` so times are stored correctly as UTC |
| `create_unterricht(...)` | `uuid` | Creates course + generates initial lessons |
| `anwesenheit_erfassen(schueler[], stunde_id)` | `void` | Bulk-records attendance |
| `mein_stundenplan(von, bis)` | `TABLE` | Personal schedule RPC |
| `raum_belegung(raum_id, von, bis)` | `TABLE` | Room occupancy check |
| `ist_lehrer_von_schueler(schueler_id)` | `boolean` | RLS helper |
| `ist_lehrer_von_unterricht(unterricht_id)` | `boolean` | RLS helper |
| `ist_elternteil_von(schueler_id)` | `boolean` | RLS helper |
| `paket_stunde_verbrauchen(schueler_id, unterricht_id)` | `boolean` | Deducts one from package |
| `get_or_create_kalender_token(user_id)` | `text` | Gets or generates iCal token |
| `session_starten(unterricht_id, stunde_id)` | `TABLE` | Starts live teaching session |
| `session_beitreten(join_code)` | `uuid` | Student joins session by code |
| `session_beenden(session_id)` | `void` | Ends session, auto-records attendance |
| `session_praesentation_wechseln(session_id, ...)` | `void` | Changes active view in session |
| `handle_new_user()` | `trigger` | Trigger: creates profile on auth.users insert |

### Migrations

Migration files in `supabase/migrations/` — applied in filename order by `supabase db reset`:

| File | Inhalt |
|------|--------|
| `20240101000000_schema.sql` | Complete initial schema |
| `20260428000000_email_benachrichtigungen.sql` | `email_benachrichtigungen` column on profiles |
| `20260428000001_admin_set_email.sql` | `admin_set_email()` function |
| `20260428000002_fix_stunden_colehrer_rls.sql` | Fix stunden RLS for co-teachers |
| `20260428000003_vorstand_enums.sql` | Adds `vorstand` to `user_rolle`, `vorstandssitzung` to `event_typ` — **separate file** because PostgreSQL cannot use a new enum value in the same transaction it was added |
| `20260428000004_vorstand_schema.sql` | Vorstand tables, `meine_schule_id()`, RLS policies, storage policies |
| `20260503000000_schulen_admin_update_und_zeitzone.sql` | `zeitzone` column on schulen, `schulen: admin update` policy |
| `20260503000001_ical_kalender.sql` | `kalender_token` column on profiles, RLS policies for public event RSVPs |
| `20260504000000_fix_stunden_generieren_zeitzone.sql` | Fixes `stunden_generieren` to use school timezone via `AT TIME ZONE` — previously stored times as UTC causing a 2h display offset |
| `20260505000000_nachrichten_kurs_enum.sql` | Adds `kurs` to `nachricht_typ` enum — **separate file** because PostgreSQL cannot use a new enum value in the same transaction it was added |
| `20260505000001_nachrichten_kurs_schema.sql` | Adds `kurs_id` column + index to `nachrichten`; updates RLS read policy to include course participants (via `unterricht_schueler` + `unterricht_lehrer`) |

**Important — `seed.sql`:** The view `mitglieder_mit_email` is defined in `seed.sql`, not in any migration. It must stay there because views that join `auth.users` cannot use the standard migration flow reliably. `seed.sql` is idempotent (all storage policies use `DO $$ BEGIN...EXCEPTION WHEN duplicate_object THEN NULL; END $$`).

### Live Teaching Session

Teacher opens `Unterrichtsmodus` (`/lehrer/kurse/:id/unterrichtsmodus`), which generates a 6-character uppercase code and QR code. Students join at `/session/:code` (`SchuelerSession.jsx`). Communication is bidirectional via Supabase realtime channels: teacher pushes the active piece/view (liedtext, akkorde, noten, audio, youtube), students send emoji reactions (👍👎✋❤️😕). Attendance is auto-recorded when the teacher ends the session. Liedtext is rendered as Markdown (`marked.parse`) in both the teacher view and the student session.

### Theming

`src/themes/themes.js` defines 5 themes (`klassik`, `modern`, `bold`, `kreativ`, `fresh`), each with light and dark variants. `applyTheme()` writes CSS custom properties (`--bg`, `--primary`, `--surface`, `--border`, `--text`, `--text-2`, `--text-3`, `--accent`, `--danger`, `--success`, `--radius`, `--radius-lg`, `--shadow-lg`, etc.) directly onto `document.documentElement`. All components style themselves using these variables. Theme and dark mode persist in `localStorage`.

### i18n

`src/i18n/translations.js` contains flat key→string maps for `de`, `en`, `tr`. The `t(lang, key)` function falls back to `de` then to the raw key. In components, use `const { T } = useApp()` and call `T('key')`. When adding UI text, add all three languages to `translations.js`.

### Page structure pattern

Pages are self-contained: they fetch their own data on mount, manage local state, and render inline-styled JSX. There is no shared data-fetching layer or component library. Reusable UI logic (ChordPro renderer, PdfInline viewer, transposition logic, MarkdownTooltip) is co-located in the files that need it — not extracted into shared utilities.
