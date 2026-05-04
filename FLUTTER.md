# FLUTTER.md — Staccato Flutter App

Implementierungsanleitung für die Flutter-Version von Staccato. Die App verbindet sich mit demselben Supabase-Backend wie die Web-App. Alle Tabellen, RLS-Policies und Storage-Buckets sind identisch — kein zusätzliches Backend nötig.

---

## Zielplattformen & Rollen

- **Plattformen**: iOS, Android
- **Rollen in der App**: `lehrer`, `schueler`, `vorstand`
- **Nicht in der App** (bleibt Web): `admin`, `superadmin`, `eltern` (deren Verwaltungsmasken sind Desktop-first)
- Benutzer mit Rolle `admin`/`superadmin` können sich einloggen — sie landen auf dem Lehrer-Dashboard (sie sind immer auch Lehrer). Reine Admins ohne Lehrfunktion erhalten einen Hinweis, die Web-App zu nutzen.

---

## Tech Stack

| Paket | Zweck |
|-------|-------|
| `supabase_flutter ^2` | Auth, DB, Realtime, Storage |
| `flutter_riverpod ^2` | State Management |
| `go_router ^14` | Deklaratives Routing |
| `flutter_markdown ^0.7` | Markdown-Liedtext rendern |
| `webview_flutter ^4` | PDF-Vorschau (signed URL) |
| `youtube_player_iframe ^4` | YouTube-Einbettung |
| `qr_flutter ^4` | QR-Code für Unterrichtsmodus (Lehrer) |
| `mobile_scanner ^5` | QR-Code scannen (Schüler, optional) |
| `url_launcher ^6` | Links öffnen |
| `cached_network_image ^3` | Schullogo, Bilder |
| `intl ^0.19` | Datumsformatierung, i18n |
| `shared_preferences ^2` | Theme, Dark Mode, Sprache persisten |
| `file_picker ^8` | Datei-Uploads (Vorstand-Protokolle) |

---

## pubspec.yaml

```yaml
name: staccato
description: Musikschul-Management App

environment:
  sdk: ">=3.3.0 <4.0.0"

dependencies:
  flutter:
    sdk: flutter
  flutter_localizations:
    sdk: flutter

  supabase_flutter: ^2.5.0
  flutter_riverpod: ^2.5.1
  riverpod_annotation: ^2.3.5
  go_router: ^14.2.0
  flutter_markdown: ^0.7.3
  webview_flutter: ^4.7.0
  youtube_player_iframe: ^4.1.1
  qr_flutter: ^4.1.0
  mobile_scanner: ^5.2.0
  url_launcher: ^6.3.0
  cached_network_image: ^3.3.1
  intl: ^0.19.0
  shared_preferences: ^2.3.0
  file_picker: ^8.1.2

dev_dependencies:
  flutter_test:
    sdk: flutter
  build_runner: ^2.4.9
  riverpod_generator: ^2.4.0
  custom_lint: ^0.6.4
  riverpod_lint: ^2.3.10
```

---

## Projektstruktur

```
lib/
├── main.dart                        # Supabase.initialize() + ProviderScope + runApp
├── app.dart                         # MaterialApp.router (GoRouter, Theme, Locale)
├── router.dart                      # Alle GoRouter-Routen + Redirect-Logik
├── theme.dart                       # ThemeData light/dark (5 Themes)
│
├── core/
│   ├── supabase_client.dart         # Supabase-Singleton-Referenz
│   ├── models/                      # Dart-Datenklassen (fromJson, toJson)
│   │   ├── profil.dart
│   │   ├── schule.dart
│   │   ├── unterricht.dart
│   │   ├── stunde.dart
│   │   ├── stueck.dart
│   │   ├── stueck_datei.dart
│   │   ├── event.dart
│   │   ├── anwesenheit.dart
│   │   ├── vorstand_ziel.dart
│   │   ├── vorstand_aufgabe.dart
│   │   └── vorstand_protokoll.dart
│   ├── providers/
│   │   ├── auth_provider.dart       # session, profil, schule, rolle
│   │   └── settings_provider.dart   # theme, darkMode, lang
│   └── widgets/
│       ├── staccato_app_bar.dart
│       ├── markdown_view.dart       # flutter_markdown Wrapper
│       ├── pdf_viewer_sheet.dart    # BottomSheet mit WebView
│       ├── youtube_view.dart
│       └── empty_state.dart
│
├── features/
│   ├── auth/
│   │   ├── login_screen.dart
│   │   └── password_reset_screen.dart
│   │
│   ├── lehrer/
│   │   ├── screens/
│   │   │   ├── lehrer_dashboard_screen.dart
│   │   │   ├── kurse_screen.dart
│   │   │   ├── kurs_detail_screen.dart
│   │   │   ├── stundenplan_screen.dart
│   │   │   ├── unterrichtsmodus_screen.dart
│   │   │   └── lehrer_schueler_screen.dart
│   │   └── providers/
│   │       ├── lehrer_kurse_provider.dart
│   │       └── unterrichtsmodus_provider.dart
│   │
│   ├── schueler/
│   │   ├── screens/
│   │   │   ├── schueler_dashboard_screen.dart
│   │   │   ├── stundenplan_screen.dart
│   │   │   ├── schueler_kurse_screen.dart
│   │   │   ├── schueler_kurs_detail_screen.dart
│   │   │   ├── anwesenheit_screen.dart
│   │   │   └── session_screen.dart  # /session/:code
│   │   └── providers/
│   │       └── schueler_provider.dart
│   │
│   ├── vorstand/
│   │   ├── screens/
│   │   │   ├── vorstand_dashboard_screen.dart
│   │   │   ├── ziele_screen.dart
│   │   │   ├── protokolle_screen.dart
│   │   │   └── protokoll_detail_screen.dart
│   │   └── providers/
│   │       └── vorstand_provider.dart
│   │
│   ├── repertoire/
│   │   ├── screens/
│   │   │   ├── repertoire_screen.dart
│   │   │   └── stueck_detail_screen.dart   # geteilt zwischen allen Rollen
│   │   └── providers/
│   │       └── repertoire_provider.dart
│   │
│   ├── events/
│   │   ├── screens/
│   │   │   ├── events_screen.dart
│   │   │   └── event_repertoire_screen.dart
│   │   └── providers/
│   │       └── events_provider.dart
│   │
│   └── profil/
│       └── profil_screen.dart
```

---

## Supabase Setup

### Initialisierung (`main.dart`)

```dart
void main() async {
  WidgetsFlutterBinding.ensureInitialized();
  await Supabase.initialize(
    url: const String.fromEnvironment('SUPABASE_URL'),
    anonKey: const String.fromEnvironment('SUPABASE_ANON_KEY'),
  );
  runApp(const ProviderScope(child: StaccatoApp()));
}
```

Build-Befehl mit Env-Variablen:
```bash
flutter run \
  --dart-define=SUPABASE_URL=https://api.401dev.de \
  --dart-define=SUPABASE_ANON_KEY=your-anon-key
```

### Client-Referenz (`core/supabase_client.dart`)

```dart
import 'package:supabase_flutter/supabase_flutter.dart';
final supabase = Supabase.instance.client;
```

---

## Datenmodelle (Dart)

Alle Modelle haben `fromJson(Map<String, dynamic>)` und `toJson()`. Wichtige Enums:

```dart
enum UserRolle { superadmin, admin, lehrer, schueler, eltern, vorstand }
enum UnterrichtTyp { einzel, gruppe, chor, ensemble }
enum AbrechnungsTyp { einzeln, paket, pauschale }
enum StueckStatus { aktuell, geplant, abgeschlossen, archiviert }
enum Wochentag { montag, dienstag, mittwoch, donnerstag, freitag, samstag, sonntag }
enum AnwesenheitStatus { anwesend, abwesend, entschuldigt, zu_spaet }
enum StundenStatus { geplant, stattgefunden, ausgefallen, verschoben }
enum EventTyp { konzert, vorspiel, pruefung, veranstaltung, vorstandssitzung, sonstiges }
enum AufgabeStatus { offen, in_bearbeitung, erledigt }
enum StueckDateiTyp { noten, liedtext, audio }
enum Stimme { sopran, alt, tenor, bass }
```

### Profil

```dart
class Profil {
  final String id;
  final String vollerName;
  final UserRolle rolle;
  final String schuleId;
  final String? sprache;
  final String? telefon;
  final String? adresse;
  final DateTime? geburtsdatum;
  final bool aktiv;
}
```

### Schule

```dart
class Schule {
  final String id;
  final String name;
  final String? adresse;
  final String? telefon;
  final String? email;
  final String? website;
  final String? logoUrl;
  final String zeitzone; // Default: 'Europe/Berlin'
}
```

### Unterricht (Kurs)

```dart
class Unterricht {
  final String id;
  final String name;
  final UnterrichtTyp typ;
  final String? instrumentId;
  final String? raumId;
  final Wochentag? wochentag;
  final String? uhrzeitVon;   // "HH:mm"
  final String? uhrzeitBis;
  final AbrechnungsTyp abrechnungsTyp;
  final double? preisProStunde;
  final bool aktiv;
  final String schuleId;
  // Joined: List<String> lehrerIds, String? instrumentName, String? raumName
}
```

### Stunde (Unterrichtsstunde)

```dart
class Stunde {
  final String id;
  final String unterrichtId;
  final DateTime beginn;
  final DateTime ende;
  final StundenStatus status;
  final String? notizen;
  final String? hausaufgaben;
}
```

### Stueck (Musikstück)

```dart
class Stueck {
  final String id;
  final String titel;
  final String? komponist;
  final String? tonart;
  final String? tempo;
  final String? youtubeUrl;
  final String? liedtext;   // Markdown
  final String? notizen;    // ChordPro-Akkorde
  final StueckStatus? statusImKurs; // null wenn aus globalem Repertoire
}
```

### StueckDatei

```dart
class StueckDatei {
  final String id;
  final String stueckId;
  final StueckDateiTyp typ;
  final Stimme? stimme;
  final String? dateiname;
  final String speicherPfad; // im Bucket 'stueck-dateien'
}
```

### VorstandZiel

```dart
class VorstandZiel {
  final String id;
  final String titel;
  final String? beschreibung;
  final String zeitraum;         // z.B. "2026-Q1"
  final AufgabeStatus status;
  final List<VorstandAufgabe> aufgaben;
}

class VorstandAufgabe {
  final String id;
  final String zielId;
  final String titel;
  final AufgabeStatus status;
  final String? verantwortlichId;
  final String? verantwortlichName; // joined
}
```

### VorstandProtokoll

```dart
class VorstandProtokoll {
  final String id;
  final DateTime datum;
  final String? titel;
  final List<String> teilnehmerIds;
  final String? beschluesse;
  final String? eventId;  // verknüpfte Vorstandssitzung
  // Joined: List<String> teilnehmerNamen, List<VorstandProtokollDatei> dateien
}
```

---

## Auth & Session (`core/providers/auth_provider.dart`)

```dart
// Riverpod-Provider für die aktuelle Auth-Session
@riverpod
Stream<AuthState> authState(AuthStateRef ref) {
  return supabase.auth.onAuthStateChange;
}

// Profil + Schule nach Login laden
@riverpod
Future<(Profil, Schule)> userProfile(UserProfileRef ref) async {
  final user = supabase.auth.currentUser;
  if (user == null) throw Exception('Not logged in');

  final profilData = await supabase
      .from('profiles')
      .select()
      .eq('id', user.id)
      .single();
  final profil = Profil.fromJson(profilData);

  final schuleData = await supabase
      .from('schulen')
      .select('id, name, adresse, telefon, email, website, logo_url, zeitzone')
      .eq('id', profil.schuleId)
      .single();
  final schule = Schule.fromJson(schuleData);

  return (profil, schule);
}
```

---

## Routing (`router.dart`)

Alle Routen prüfen den Auth-State und leiten zur Startseite der Rolle weiter. `redirect` in GoRouter:

```dart
GoRouter buildRouter(WidgetRef ref) {
  return GoRouter(
    initialLocation: '/login',
    redirect: (context, state) {
      final session = supabase.auth.currentSession;
      final isLoginRoute = state.matchedLocation == '/login' ||
          state.matchedLocation == '/passwort-zuruecksetzen';
      if (session == null && !isLoginRoute) return '/login';
      if (session != null && isLoginRoute) return _startseiteNachRolle(ref);
      return null;
    },
    routes: [ /* siehe unten */ ],
  );
}

String _startseiteNachRolle(WidgetRef ref) {
  final profil = ref.read(userProfileProvider).valueOrNull?.$1;
  return switch (profil?.rolle) {
    UserRolle.lehrer || UserRolle.admin || UserRolle.superadmin => '/lehrer',
    UserRolle.schueler => '/schueler',
    UserRolle.vorstand => '/vorstand',
    _ => '/login',
  };
}
```

### Vollständige Routen-Liste

```
/login
/passwort-zuruecksetzen
/session/:code                    # SchuelerSession (kein Auth nötig)
/profil

# Lehrer (auch admin/superadmin)
/lehrer                           # LehrerDashboard
/lehrer/kurse                     # Kursliste
/lehrer/kurse/:id                 # KursDetail (4 Tabs: Stunden, Anwesenheit, Schüler, Repertoire)
/lehrer/kurse/:id/repertoire/:stueckId   # StueckDetail
/lehrer/kurse/:id/unterrichtsmodus       # Live-Session starten
/lehrer/stundenplan               # Wochenansicht + Listenansicht
/lehrer/schueler                  # Alle eigenen Schüler
/lehrer/repertoire                # Globales Repertoire
/lehrer/repertoire/:stueckId      # StueckDetail
/lehrer/events                    # Events der Schule
/lehrer/events/:id/repertoire/:stueckId

# Schüler
/schueler                         # Dashboard
/schueler/stundenplan
/schueler/kurse
/schueler/kurse/:id               # KursDetail (Tabs: Stunden, Repertoire)
/schueler/kurse/:id/anwesenheit   # Eigene Anwesenheitshistorie
/schueler/kurse/:id/repertoire/:stueckId
/schueler/repertoire
/schueler/repertoire/:stueckId
/schueler/events
/schueler/events/:id/repertoire/:stueckId

# Vorstand
/vorstand                         # Dashboard (KPIs + eigene Kurse als Schüler)
/vorstand/ziele                   # Jahres-/Quartalsziele
/vorstand/protokolle              # Sitzungsprotokolle
/vorstand/protokolle/:id          # Protokoll-Detail
/vorstand/stundenplan
/vorstand/kurse
/vorstand/kurse/:id
/vorstand/kurse/:id/repertoire/:stueckId
/vorstand/repertoire
/vorstand/repertoire/:stueckId
/vorstand/events
/vorstand/events/:id/repertoire/:stueckId
```

---

## Navigation (Shell)

Jede Rolle hat eine eigene `ShellRoute` mit Bottom Navigation Bar (4–5 Tabs). Die Routen innerhalb einer Shell teilen sich den State der Shell (z.B. Scroll-Position nicht zurücksetzen).

### Lehrer-Shell — Tabs
1. 📊 Dashboard (`/lehrer`)
2. 🎵 Kurse (`/lehrer/kurse`)
3. 📅 Stundenplan (`/lehrer/stundenplan`)
4. 🎼 Repertoire (`/lehrer/repertoire`)
5. 🎭 Events (`/lehrer/events`)

### Schüler-Shell — Tabs
1. 📊 Dashboard (`/schueler`)
2. 📅 Stundenplan (`/schueler/stundenplan`)
3. 🎵 Kurse (`/schueler/kurse`)
4. 🎼 Repertoire (`/schueler/repertoire`)
5. 🎭 Events (`/schueler/events`)

### Vorstand-Shell — Tabs
1. 📊 Dashboard (`/vorstand`)
2. 🎯 Ziele (`/vorstand/ziele`)
3. 📝 Protokolle (`/vorstand/protokolle`)
4. 📅 Stundenplan (`/vorstand/stundenplan`)
5. 🎭 Events (`/vorstand/events`)

Zusätzlich in allen Shells: Profil-Icon in der AppBar (→ `/profil`).

---

## Screens — Detailbeschreibung

### Login (`/login`)

- E-Mail + Passwort, `supabase.auth.signInWithPassword()`
- "Passwort vergessen" → `/passwort-zuruecksetzen`
- Nach Login: GoRouter `redirect` leitet zur Rolle-Startseite
- Fehlerbehandlung: falsches Passwort, gesperrter Account

### Passwort zurücksetzen (`/passwort-zuruecksetzen`)

- E-Mail eingeben → `supabase.auth.resetPasswordForEmail(email, redirectTo: 'staccato://passwort-zuruecksetzen')`
- Deep-Link-Handler in App: `supabase.auth.onAuthStateChange` auf `EventType.passwordRecovery` → neues Passwort-Eingabefeld zeigen → `supabase.auth.updateUser(password: newPassword)`

---

### Lehrer-Dashboard (`/lehrer`)

**Abfragen:**
- Heutige Stunden: `stunden` JOIN `unterricht` WHERE `unterricht.schule_id = schule.id` AND `lehrer_id = profil.id` AND `stunden.beginn::date = today` (über `stunden_lehrer`)
- Nächste Stunde dieser Woche
- Schüleranzahl (aus eigenen Kursen)

**UI:**
- Begrüßungskarte mit Name + Datum
- Karte "Heute" → Liste der heutigen Stunden (Kursname, Uhrzeit, Status) — Tap → KursDetail
- Karte "Diese Woche" → Anzahl Stunden, nächste Stunde
- Schnellzugriff: Button "Live-Session starten" → `/lehrer/kurse` (dort Kurs auswählen)

---

### Kursliste Lehrer (`/lehrer/kurse`)

**Abfrage:**
```dart
supabase
  .from('unterricht')
  .select('*, unterricht_lehrer!inner(lehrer_id), instrumente(name_de), raeume(name)')
  .eq('unterricht_lehrer.lehrer_id', profil.id)
  .eq('schule_id', profil.schuleId)
  .eq('aktiv', true)
  .order('name')
```

**UI:**
- Liste der Kurse (Kursname, Typ-Badge, Wochentag + Uhrzeit, Instrument)
- Typ-Farbcodierung: einzel=blau, gruppe=grün, chor=lila, ensemble=orange
- Tap auf Kurs → `/lehrer/kurse/:id`
- FAB oder Button in AppBar → Unterrichtsmodus direkt starten (nach Kursauswahl)

---

### Kurs-Detail Lehrer (`/lehrer/kurse/:id`)

4 Tabs:

**Tab 1 — Stunden:**
- Abfrage: `stunden` WHERE `unterricht_id = id` ORDER BY `beginn DESC` LIMIT 20
- Jede Stunde: Datum, Uhrzeit, Status-Chip (geplant/stattgefunden/ausgefallen), Notizen, Hausaufgaben
- Swipe-to-reveal oder Long-Press: Status ändern (geplant → stattgefunden/ausgefallen)
- Tap auf Stunde → Inline-Bearbeitung von Notizen + Hausaufgaben

**Tab 2 — Anwesenheit:**
- Abfrage: letzte 8 Stunden + alle Schüler des Kurses
- Matrix: Zeilen = Schüler, Spalten = Stunden (Datum als Header)
- Zelle: Icon (✓/✗/E/⏰) für anwesend/abwesend/entschuldigt/zu_spät
- Tap auf Zelle → Status wechseln (für Stunden mit Status `stattgefunden` oder `geplant`)

**Tab 3 — Schüler:**
- Abfrage: `profiles` WHERE `id IN (SELECT schueler_id FROM unterricht_schueler WHERE unterricht_id = id)` — falls kein direktes Join existiert, alternativ über Anwesenheit oder Session-Teilnehmer
  - Hinweis: Schüler-Kurs-Zuordnung ist implizit über `anwesenheit` (die beim Beenden der Session angelegt wird) oder über `unterricht_schueler` falls vorhanden
- Liste: Name, Avatar-Initialen, letzte Anwesenheitsquote
- Tap → Schüler-Profil (nur Kontaktdaten, keine Edit-Funktion in Flutter)

**Tab 4 — Repertoire:**
- Route `/lehrer/kurse/:id` mit Tab-Index, oder eigenständige Sub-Route
- Abfrage: `unterricht_stuecke` JOIN `stuecke` WHERE `unterricht_id = id` ORDER BY `reihenfolge`
- Liste: Stücktitel, Komponist, Status-Chip
- Tap → `/lehrer/kurse/:id/repertoire/:stueckId`
- Button: "Live-Session starten" → `/lehrer/kurse/:id/unterrichtsmodus`

---

### Stundenplan (`/lehrer/stundenplan`, `/schueler/stundenplan`, `/vorstand/stundenplan`)

Derselbe Screen, unterschiedliche Datenabfragen je Rolle:
- **Lehrer**: eigene Stunden (über `stunden_lehrer`)
- **Schüler/Vorstand**: Stunden aus eigenen Kursen (über Kurszuordnung)

**Views:**
- Toggle: Wochenansicht | Listenansicht
- **Wochenansicht**: Vertikale Zeitachse 07:00–22:00, Stunden als farbige Karten. Woche vor/zurück per Swipe oder Pfeil-Buttons. Timezone-aware (aus `schule.zeitzone`).
- **Listenansicht**: Chronologische Liste der nächsten 14 Tage, nach Tag gruppiert

Farbcodierung nach `unterricht.typ`: einzel=blau, gruppe=grün, chor=lila, ensemble=orange

Für Lehrer: Long-Press auf Stunde → Bottom Sheet mit "Stattgefunden" / "Ausgefallen"

---

### Unterrichtsmodus (`/lehrer/kurse/:id/unterrichtsmodus`)

Der Kern der App — Live-Unterrichtssession.

**Session starten:**
1. 6-stelligen Code generieren (Zufalls-Großbuchstaben, z.B. `KXMPFZ`)
2. Row in `unterricht_sessions` INSERT: `{ unterricht_id, code, lehrer_id, schule_id, status: 'aktiv' }`
3. QR-Code anzeigen (URL: `https://app-url/session/CODE`)
4. Realtime-Channel abonnieren: `supabase.realtime.channel('session:CODE')`

**Realtime-Kanal:**
- Lehrer **sendet** aktive Ansicht: `channel.sendBroadcastMessage(event: 'view', payload: { 'stueck_id': id, 'ansicht': 'liedtext' | 'akkorde' | 'noten' | 'audio' | 'youtube' })`
- Lehrer **empfängt** Emoji-Reaktionen der Schüler
- Schüler in `session_teilnehmer` werden über DB-Realtime (`postgres_changes`) oder Broadcast `join` getrackt

**UI (Lehrer):**
- Linke Seite (oder oberer Bereich auf Tablet): Teilnehmerliste (Namen der beigetretenen Schüler)
- Hauptbereich: aktives Stück + Ansicht-Tabs (Liedtext / Akkorde / Noten / Audio / YouTube)
- Liedtext: `MarkdownView` Widget
- Akkorde (ChordPro): einfacher Text-Renderer (Akkord-Zeilen über Textzeilen) — siehe ChordPro-Abschnitt
- Emoji-Reaktionen: eingehende Emojis als Animation einblenden (👍👎✋❤️😕)
- Bottom Bar: Stück wechseln + "Session beenden" (→ Anwesenheit auto-erfassen)

**Session beenden:**
1. `unterricht_sessions` UPDATE `status = 'beendet'`
2. Für jeden `session_teilnehmer`: `anwesenheit` INSERT `{ stunde_id, schueler_id, status: 'anwesend' }` (falls noch kein Eintrag)
3. `stunden` UPDATE `status = 'stattgefunden'` für die zugehörige Stunde
4. Realtime-Channel schließen
5. Navigieren zurück zu `/lehrer/kurse/:id`

---

### Schüler-Session (`/session/:code`)

Diese Route braucht **keinen Auth** — Schüler können mit Code beitreten, auch ohne Account (Gastmodus mit Namenseingabe) oder eingeloggt.

**Beitreten:**
1. `unterricht_sessions` SELECT WHERE `code = :code AND status = 'aktiv'` — falls nicht gefunden: Fehlermeldung
2. Falls eingeloggt: profil.vollerName verwenden; sonst: Name-Eingabe-Dialog
3. `session_teilnehmer` INSERT `{ session_id, schueler_id (nullable), name_anzeige }`
4. Realtime-Channel `session:CODE` abonnieren

**UI (Schüler):**
- Empfängt `view`-Broadcasts vom Lehrer → zeigt entsprechenden Inhalt
- Liedtext: `MarkdownView` mit Schriftgröße-Slider
- Akkorde: ChordPro-Renderer mit Transpositions-Buttons (±1 Halbton)
- Noten: WebView mit signed URL des PDF
- Audio: Audio-Player (`just_audio` oder nativer Player)
- YouTube: `YoutubePlayerIframe`
- Emoji-Reaktionen senden: 5 Buttons (👍👎✋❤️😕) → `channel.sendBroadcastMessage(event: 'reaktion', payload: { 'emoji': '👍', 'name': ... })`
- Bei Session-Ende (Broadcast oder DB-Status-Änderung): "Unterricht beendet"-Screen

---

### Schüler-Dashboard (`/schueler`)

- Nächste Unterrichtsstunde (Datum, Uhrzeit, Kurs, Lehrer)
- Aktuelle Kurse (Liste mit Kursname, Typ)
- Anwesenheitsquote (letzte 30 Tage, aus `anwesenheit`)
- Upcoming Events (nächste 3 Events der Schule)

---

### Schüler-Kurs-Detail (`/schueler/kurse/:id`)

2 Tabs:
- **Stunden**: letzte + kommende Stunden des Kurses, Notizen + Hausaufgaben sichtbar
- **Repertoire**: Stücke des Kurses; Tap → StueckDetail

---

### Anwesenheitshistorie (`/schueler/kurse/:id/anwesenheit`)

- Abfrage: `anwesenheit` JOIN `stunden` WHERE `schueler_id = profil.id AND unterricht_id = id`
- Liste aller Stunden mit Anwesenheitsstatus
- Balken-Visualisierung: anwesend / abwesend / entschuldigt / zu_spät
- Gesamtquote in Prozent

---

### Repertoire (`/lehrer/repertoire`, `/schueler/repertoire`, `/vorstand/repertoire`)

Selber Screen, gefiltert auf `schule_id`.

**Abfrage:**
```dart
supabase
  .from('stuecke')
  .select('id, titel, komponist, tonart, tempo, liedtext')
  .eq('schule_id', profil.schuleId)
  .order('titel')
```

**UI:**
- Suchleiste (client-seitig filtern nach Titel + Komponist)
- Status-Filter-Chips: aktuell / geplant / abgeschlossen / archiviert
- Liste: Titel, Komponist (klein darunter), Status-Badge
- Tap → `/*/repertoire/:stueckId`

---

### Stück-Detail (`/*/repertoire/:stueckId`)

Tabs (nur anzeigen wenn Inhalt vorhanden):

**Tab: Liedtext**
- `MarkdownView(stueck.liedtext)` mit Schriftgröße ±
- Vollbild-Button → Fullscreen-Scaffold mit weißem Text auf schwarzem Hintergrund
- PDF-Export: `Printing`-Package oder `Share`-Sheet — Liedtext als HTML/PDF generieren mit Schullogo aus `schule.logoUrl`

**Tab: Akkorde (ChordPro)**
- ChordPro-Renderer (siehe unten)
- Transpositions-Buttons ± Halbton

**Tab: Dateien**
- Abfrage: `stueck_dateien` WHERE `stueck_id = id`
- Gruppiert nach Typ (Noten, Liedtext, Audio)
- Optional: Stimmen-Filter (Sopran/Alt/Tenor/Bass)
- Noten (PDF): Tap → `PdfViewerSheet` (BottomSheet mit WebView + signed URL)
- Audio: Audio-Player (inline)
- Download-Button (optional): `url_launcher` mit signed URL

**Tab: YouTube**
- Nur anzeigen wenn `stueck.youtubeUrl != null`
- `YoutubePlayerIframe` mit extrahierter Video-ID

---

### Vorstand-Dashboard (`/vorstand`)

**Abfragen:**
- Offene Aufgaben: `vorstand_aufgaben` WHERE `verantwortlich_id = profil.id AND status != 'erledigt'`
- Nächste Vorstandssitzung: `events` WHERE `typ = 'vorstandssitzung' AND beginn > now()` LIMIT 1
- Ziel-Fortschritt: Zählung nach Status über `vorstand_ziele` + `vorstand_aufgaben`
- Protokoll-Anzahl (letzte 3 Monate)
- Eigene Kurse als Schüler (wie Schüler-Dashboard)

**UI:**
- KPI-Karten: Offene Aufgaben, Ziele in Bearbeitung, Nächste Sitzung
- Fortschrittsbalken Ziele (erledigt / gesamt)
- Schnellzugriff: Ziele, Protokolle

---

### Ziele (`/vorstand/ziele`)

**Abfrage:**
```dart
supabase
  .from('vorstand_ziele')
  .select('*, vorstand_aufgaben(*, profiles(voller_name))')
  .eq('schule_id', profil.schuleId)
  .order('erstellt_am', ascending: false)
```

**UI:**
- Liste der Ziele als expandierbare Karten
- Karte: Zeitraum (z.B. "2026-Q2"), Titel, Status-Badge, Fortschrittsbalken (Aufgaben erledigt/gesamt)
- Aufgeklappte Karte: Liste der Aufgaben mit Checkbox + Verantwortlicher + Status-Chip
- Aufgaben-Status wechseln: Tap auf Chip → Bottom Sheet mit Auswahl (offen / in_bearbeitung / erledigt)
- UPDATE: `vorstand_aufgaben` SET `status = newStatus` WHERE `id = aufgabe.id`

---

### Protokolle (`/vorstand/protokolle`)

**Abfrage:**
```dart
supabase
  .from('vorstand_protokolle')
  .select('*, vorstand_protokoll_dateien(*)')
  .eq('schule_id', profil.schuleId)
  .order('datum', ascending: false)
```

**UI:**
- Chronologische Liste: Datum, Titel, Teilnehmer-Chips
- Tap → `/vorstand/protokolle/:id` (Protokoll-Detail)

**Protokoll-Detail (`/vorstand/protokolle/:id`):**
- Datum, Titel
- Teilnehmer: Avatar-Chips (Initialen)
- Beschlüsse: `MarkdownView`-Feld (oder Plain Text)
- Anhänge: Liste der `vorstand_protokoll_dateien` — Tap → WebView oder Download
- Verknüpfte Veranstaltung (falls `event_id` vorhanden): Link zu Event

**Neu erstellen / Bearbeiten** (nur für `vorstand`, `admin`, `superadmin`):
- FAB → Modal/Sheet mit Formular: Datum, Titel, Teilnehmer-Auswahl (Multi-Select aus Profilen mit Rolle vorstand/admin/superadmin der Schule), Beschlüsse-Textfeld, Datei-Upload (`file_picker`)
- INSERT/UPDATE in `vorstand_protokolle`
- Datei-Upload: `supabase.storage.from('vorstand-dateien').upload(path, file)`, dann INSERT in `vorstand_protokoll_dateien`

---

### Profil (`/profil`)

- Name, Telefon, Adresse, Geburtsdatum bearbeiten → UPDATE `profiles`
- Passwort ändern → `supabase.auth.updateUser(password: newPw)`
- Sprache wechseln (de/en/tr) → in `profiles.sprache` speichern + Provider aktualisieren
- Theme + Dark Mode (lokal in SharedPreferences)

---

## ChordPro-Renderer

ChordPro-Format: Akkorde in eckigen Klammern über dem Text, z.B. `[Am]Text [G]mehr Text`.

**Einfacher Dart-Renderer:**

```dart
// Parst eine ChordPro-Zeile und gibt InlineSpan-Liste zurück.
// Akkord-Zeile (nur [X]) → fett/farbig darstellen.
// Text-Zeile mit eingebetteten Akkorden → Akkord über Text positionieren (Stack).

List<Widget> parseChordPro(String text) {
  // Zeilen aufteilen
  final lines = text.split('\n');
  return lines.map((line) {
    if (line.trim().isEmpty) return const SizedBox(height: 12);
    // Prüfen ob Zeile nur Akkorde enthält
    final isChordLine = RegExp(r'^\s*(\[[A-Gm/#0-9]+\]\s*)+$').hasMatch(line);
    if (isChordLine) {
      return Text(
        line.replaceAll(RegExp(r'[\[\]]'), ''),
        style: const TextStyle(color: Colors.blue, fontWeight: FontWeight.bold, fontFamily: 'monospace'),
      );
    }
    // Text mit eingebetteten Akkorden
    return ChordTextLine(line: line);
  }).toList();
}
```

**Transposition:** SHARP-Array und FLAT-Array (`C, C#, D, D#, E, F, F#, G, G#, A, A#, B`) — Akkord aus Klammern extrahieren, Root-Note um ±n Halbtöne verschieben, Akkord ersetzen.

---

## Markdown-Rendering

```dart
// core/widgets/markdown_view.dart
import 'package:flutter_markdown/flutter_markdown.dart';

class MarkdownView extends StatelessWidget {
  final String data;
  final double fontSize;

  const MarkdownView({required this.data, this.fontSize = 15, super.key});

  @override
  Widget build(BuildContext context) {
    return MarkdownBody(
      data: data.isEmpty ? '*Kein Text vorhanden.*' : data,
      styleSheet: MarkdownStyleSheet.fromTheme(Theme.of(context)).copyWith(
        p: Theme.of(context).textTheme.bodyMedium?.copyWith(
          fontSize: fontSize,
          height: 1.9,
          fontFamily: 'Georgia',
        ),
        h2: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w800),
        h3: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700),
        horizontalRuleDecoration: const BoxDecoration(
          border: Border(top: BorderSide(color: Colors.grey, width: 1)),
        ),
      ),
    );
  }
}
```

---

## PDF-Viewer (signed URL)

```dart
// core/widgets/pdf_viewer_sheet.dart
// Signed URL von Supabase Storage holen, in WebView anzeigen.

Future<String> getSignedUrl(String pfad) async {
  final response = await supabase.storage
      .from('stueck-dateien')
      .createSignedUrl(pfad, 3600); // 1h
  return response;
}

// Dann im Sheet:
WebViewWidget(
  controller: WebViewController()
    ..loadRequest(Uri.parse(signedUrl))
    ..setJavaScriptMode(JavaScriptMode.unrestricted),
)
```

---

## Realtime — Live-Session

```dart
// Kanal abonnieren (Lehrer + Schüler)
final channel = supabase.realtime.channel('session:$code');

// Broadcasts empfangen
channel
  .onBroadcast(event: 'view', callback: (payload) {
    // payload: { 'stueck_id': '...', 'ansicht': 'liedtext' }
    ref.read(aktiveAnsichtProvider.notifier).update(payload);
  })
  .onBroadcast(event: 'reaktion', callback: (payload) {
    // Emoji-Animation einblenden
  })
  .subscribe();

// Broadcast senden (Lehrer)
await channel.sendBroadcastMessage(
  event: 'view',
  payload: {'stueck_id': stueckId, 'ansicht': ansicht},
);

// Kanal schließen
await supabase.realtime.removeChannel(channel);
```

---

## Theming (`theme.dart`)

5 Themes, je Light + Dark. In Flutter als `ThemeData` implementieren:

```dart
// Farbpaletten aus der Web-App (src/themes/themes.js) übernehmen
// Themes: klassik, modern, bold, kreativ, fresh

ThemeData buildTheme(String themeKey, Brightness brightness) {
  final colors = _themeColors[themeKey]![brightness]!;
  return ThemeData(
    brightness: brightness,
    colorSchemeSeed: colors.primary,
    scaffoldBackgroundColor: colors.bg,
    cardColor: colors.surface,
    appBarTheme: AppBarTheme(
      backgroundColor: colors.surface,
      foregroundColor: colors.text,
      elevation: 0,
      surfaceTintColor: Colors.transparent,
    ),
    // ...
  );
}
```

Theme + Dark Mode in `SharedPreferences` (`staccato_theme`, `staccato_dark`) persistieren — analog zur Web-App in `localStorage`.

---

## i18n

3 Sprachen: `de` (Standard), `en`, `tr`. Flutter-Lokalisierung über `AppLocalizations` (ARB-Dateien) oder einfacherer Ansatz:

```dart
// Analog zu src/i18n/translations.js
// Alle Keys aus translations.js in ARB-Dateien übertragen:
// lib/l10n/app_de.arb, app_en.arb, app_tr.arb

// Sprachauswahl aus profil.sprache setzen:
MaterialApp.router(
  locale: Locale(profil?.sprache ?? 'de'),
  supportedLocales: const [Locale('de'), Locale('en'), Locale('tr')],
  localizationsDelegates: const [
    AppLocalizations.delegate,
    GlobalMaterialLocalizations.delegate,
    GlobalWidgetsLocalizations.delegate,
    GlobalCupertinoLocalizations.delegate,
  ],
)
```

---

## Supabase RLS — wichtige Hinweise

Die RLS-Policies der Web-App gelten unverändert auch für die Flutter-App:

- **profiles**: Jeder sieht nur Profile der eigenen Schule; Lehrer sehen Schüler ihrer Kurse
- **unterricht**: Lehrer sehen nur ihre eigenen Kurse (`unterricht_lehrer`); Schüler sehen Kurse aus `anwesenheit`-Einträgen
- **stunden**: Lehrer sehen Stunden ihrer Kurse; Schüler sehen Stunden ihrer Kurse
- **stuecke**: Alle eingeloggten Nutzer der Schule können Repertoire lesen; nur lehrer/admin können schreiben
- **stueck_dateien**: Signed URLs für Storage — `supabase.storage.from('stueck-dateien').createSignedUrl(pfad, 3600)`
- **vorstand_ziele/aufgaben/protokolle**: nur vorstand/admin/superadmin derselben Schule
- **schulen**: UPDATE nur für admin/superadmin (mit Policy `schulen: admin update`)
- **session_teilnehmer/session_reaktionen**: öffentlich schreibbar (für Gast-Schüler ohne Auth)

---

## Deep Links (für Passwort-Reset + Session-Beitreten)

**iOS** (`ios/Runner/Info.plist`):
```xml
<key>CFBundleURLTypes</key>
<array>
  <dict>
    <key>CFBundleURLSchemes</key>
    <array><string>staccato</string></array>
  </dict>
</array>
```

**Android** (`android/app/src/main/AndroidManifest.xml`):
```xml
<intent-filter android:autoVerify="true">
  <action android:name="android.intent.action.VIEW"/>
  <category android:name="android.intent.category.DEFAULT"/>
  <category android:name="android.intent.category.BROWSABLE"/>
  <data android:scheme="staccato"/>
</intent-filter>
```

GoRouter `redirect` behandelt `staccato://passwort-zuruecksetzen` und `staccato://session/:code`.

---

## Nicht implementieren (bleibt Web)

- Admin-Mitgliederverwaltung (Erstellen/Bearbeiten/Löschen von Nutzern)
- Kursverwaltung (Kurse anlegen/bearbeiten)
- Raumverwaltung, Instrumentenverwaltung
- Schuleinstellungen
- Interessenten-Pipeline (Abrechnung/Rechnungen)
- Nachrichten-Modul (Schema vorhanden, aber noch nicht implementiert — auch nicht in Flutter)
- Eltern-Rolle (kein Flutter-Support geplant)

---

## Versionierung

Die Flutter-App hat ihre eigene Versionierung (`pubspec.yaml` → `version: 1.0.0+1`). Sie ist unabhängig von der Web-App-Version. Ein `CHANGELOG` nach gleichem Schema wie `src/changelog.js` ist optional (einfaches Array in einer Dart-Datei).

---

## Wichtige Startpunkte

1. `main.dart` → Supabase init + ProviderScope
2. `router.dart` → Auth-Redirect-Logik
3. `core/providers/auth_provider.dart` → Profil + Schule laden
4. `features/auth/login_screen.dart` → Erster Screen
5. `features/lehrer/screens/unterrichtsmodus_screen.dart` → Kernfeature, früh testen
6. `features/schueler/screens/session_screen.dart` → Gegenstück zum Unterrichtsmodus
