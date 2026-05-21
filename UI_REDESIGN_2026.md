# UI Redesign 2026 — Statusdokument

Branch: `ui-redesign-2026`  
Stand: 2026-05-20  
Ziel: Paralleles, modernes UI (Linear/Vercel-Style) als optionale Alternative zum bestehenden Design.

---

## Was bisher implementiert wurde

### Phase 1 — Design-System & Tokens ✅

**`src/design/animations.js`**

Zentrale Framer Motion Varianten. Jede neue Page/Component greift hier rein statt eigene Keyframes zu definieren:

- `spring / springFast` — Spring-Configs für konsistente Physik überall
- `pageVariants` — `initial/animate/exit` für Page Transitions
- `staggerContainer / staggerItem` — Gestaffelte Listen (Kinder erscheinen mit 55ms Versatz)
- `fadeIn / scaleIn / slideUp` — Einzel-Animationen

---

### Phase 2 — AppLayout & Sidebar ✅

**`src/components/layout/AppLayout2026.jsx`**

Das Herzstück des neuen Designs. Fällt als direkter Ersatz für `AppLayout` ins Routing. Gesamte Logik (Nachrichten-Badge, Ripple-Effekt, Install-Prompt, Keyboard-Detection, Swipe-Back) ist identisch übernommen — nur die JSX-Schicht ist komplett neu.

**Sidebar-Verhalten:**
- 68 px collapsed (nur Emoji-Icons, `title`-Tooltip on hover)
- 240 px expanded (Icons + Labels mit AnimatePresence Fade-In)
- Hover expandiert temporär (wenn nicht gepinnt)
- Pin-Button `‹` oben rechts sperrt Zustand → `localStorage('staccato_sidebar_pinned')`
- Spring-Animation: `stiffness 280, damping 30`

**Nav-Indikator:**
- `motion.div` mit `layoutId="nav-pill-2026"` hinter jedem aktiven Item
- Framer Motion `LayoutGroup` sorgt automatisch für Spring-Slide zwischen Items
- Kein manuelles Messen oder `getBoundingClientRect` nötig

**Glassmorphism:**
- Sidebar, Mobile Header, Mobile Bottom Nav: `backdrop-filter: blur(24px) saturate(160%)`
- Hintergrund: `color-mix(in srgb, var(--surface) 88%, transparent)`
- Damit das Glas sichtbar wird: `.app-2026` hat subtile Radial-Gradient-Mesh im Hintergrund

**Page Transitions:**
- `AnimatePresence mode="wait"` um `<Outlet />`
- `key={location.pathname}` — wechselt bei jeder Route-Änderung
- `opacity 0→1, y 16→0` beim Rein, `opacity 0, y -8` beim Raus
- Respektiert `useReducedMotion()` — keine Animation bei `prefers-reduced-motion`

**Mobile:**
- Overlay-Sidebar: `motion.aside` mit Spring-Slide-In von links, Backdrop mit `blur(4px)`
- AnimatePresence für smooth Mount/Unmount
- Bottom Nav mit `layoutId="bottom-pill-2026"` für gleitenden Aktiv-Indikator

**Gradient-Logo:**
- Wenn kein Logo-Bild vorhanden: `♩ Staccato` mit CSS Gradient-Text (primary → accent)

**CSS Utilities (global injiziert):**
- `.app-2026` — Gradient-Mesh Hintergrund
- `.glass-card-2026` — Glassmorphism-Karte
- `.lift-2026` — Hover: translateY(-3px) + Shadow
- `.grad-text-2026` — Gradient-Text (primary → accent)
- `.shimmer-2026` — Lade-Skeleton-Animation
- `.stagger-2026 > *` — Gestaffelte Kinder-Animation
- `.nav-badge-2026` — Pulsierender Nachrichten-Badge

---

### Phase 3 — Shared Components ✅

**`src/components/ui/Card2026.jsx`**  
Karte mit optionalem Hover-Lift (wenn `onClick`) und Glassmorphism (`glass`-Prop).

**`src/components/ui/Button2026.jsx`**  
Varianten: `primary | secondary | ghost | danger`. Größen: `sm | md | lg`. Icon-Slot, Loading-Spinner, Framer Motion `whileHover/whileTap`.

**`src/components/ui/PageHeader2026.jsx`**  
Animierter Seitenkopf: Icon-Badge, Titel, Untertitel, Back-Button, rechter Action-Slot. Eigene Entry-Animation.

**`src/components/ui/StatsCard2026.jsx`**  
KPI-Card mit Hover-Lift, farbigem Accent-Blob (radial gradient), Stagger-Variante für Dashboard-Grids.

---

### App.jsx Integration ✅

```js
const Layout = localStorage.getItem('staccato_ui_modus') === '2026'
  ? AppLayout2026
  : AppLayout
```

Alle `<AppLayout />` Route-Wrapper → `<Layout />`. Ein localStorage-Flag entscheidet beim App-Start. Reload nötig beim Wechsel (kein Hot-Switch — bewusst so, da Layout-Komponenten nicht mid-Session tauschen).

---

## Aktueller Stand (Phasen)

| Phase | Status | Beschreibung |
|-------|--------|-------------|
| 1 — Design-System | ✅ Fertig | animations.js, Tokens |
| 2 — AppLayout | ✅ Fertig | Sidebar, Nav, Transitions, Mobile |
| 3 — Shared Components | ✅ Fertig | Card, Button, PageHeader, StatsCard |
| 4 — Admin Dashboard | ⏳ Offen | Bento-Grid, KPI-Cards, Stagger-Listen |
| 5 — Alle weiteren Pages | ⏳ Offen | ~50 Pages migrieren |

---

## Was als nächstes kommt

### Phase 4 — Admin Dashboard

Das Dashboard (`src/pages/admin/Dashboard.jsx`) als erste vollständig neu gestaltete Page:

- `PageHeader2026` mit Schul-Name und Rolle
- KPI-Section: CSS Grid `repeat(auto-fill, minmax(180px, 1fr))` mit `StatsCard2026`, gewrappt in `motion.div variants={staggerContainer}`
- Upcoming Events als horizontaler Scroll-Container mit `Card2026`
- Kurs-Liste als gestaffelte Liste mit `motion.li variants={staggerItem}`
- Tab-Switcher (Übersicht / Einstellungen) mit Framer Motion `layoutId` Indikator

### Phase 5 — Alle Pages

Priorisierung nach Häufigkeit der Nutzung:

1. Mitgliederverwaltung (Admin — täglich genutzt)
2. Kursverwaltung + KursDetail
3. Stundenplan
4. Nachrichten
5. Einstellungen (hier auch UI-Modus-Toggle einbauen, s. unten)
6. Lehrer-Dashboard + LehrerKurse
7. Schüler-Dashboard + SchuelerKurse
8. Repertoire + StueckDetail
9. Events
10. Vorstandsmodul (Ziele, Protokolle)
11. Alle restlichen Pages

---

## Offene Punkte & Ideen

### Hohe Priorität

**UI-Modus Toggle in Einstellungen**  
Aktuell nur über Browser-Konsole schaltbar. In `src/pages/Einstellungen.jsx` einen Toggle einbauen — ähnlich wie Dark Mode. Sollte in `profiles.ui_modus` (neue DB-Spalte) persistiert werden damit der Modus geräteübergreifend gilt. Alternativ nur localStorage (kein DB-Round-Trip, sofort).

**Einheitliche Input-Komponente**  
`Button2026` und `Card2026` existieren, aber Inputs sind noch ungefähr 50x im alten Inline-Style definiert. Eine `Input2026.jsx`-Komponente mit:
- Floating Label Animation (label bewegt sich nach oben beim Focus)
- Gradient Border im Focus-State
- Error-State mit shake-Animation
- Select, Textarea als Varianten

**`Modal2026.jsx`**  
Die bestehende `Modal.jsx` funktioniert noch (MutationObserver-Hack in AppLayout injiziert `modalIn` Animation), aber ein echter Framer Motion Modal wäre sauberer:
- `AnimatePresence` + `motion.div` für Backdrop + Content
- `scaleIn` Variante für Content
- Kein MutationObserver-Hack mehr nötig

### Mittlere Priorität

**Bento-Grid Layout für Dashboards**  
Das Admin-Dashboard könnte statt gleichmäßigem Grid ein asymmetrisches Bento-Layout haben:
- Großer KPI-Hero (Schülerzahl, Umsatz) links
- Kleinere KPIs rechts in 2×2
- Kalender/Events unten volle Breite

**Animated Count-Up für KPI-Zahlen**  
Wenn KPI-Zahlen geladen werden: von 0 hochzählen mit Spring-Easing. Kann mit `useMotionValue` und `useTransform` aus Framer Motion umgesetzt werden. Sehr wirkungsvoller Effekt.

**Command Palette / Spotlight Search**  
`⌘K` öffnet eine Suche über alle Seiten, Kurse, Mitglieder. Linear-typisch. Technisch: Fuzzy-Search über vorhandene Daten mit `fuse.js`. Navigation via Keyboard-Shortcuts.

**Keyboard Shortcuts**  
Global registrieren (z.B. in AppLayout2026):
- `⌘K` — Command Palette
- `⌘/` — Changelog / "Was ist neu?"
- `⌘,` — Einstellungen

**Animated Sidebar Active Indicator Farbe**  
Aktuell: `color-mix(in srgb, var(--primary) 13%, var(--bg-2))` — einheitlich für alle Themes. Könnte per Theme unterschiedlich sein: z.B. bei `kreativ` ein lila Gradient, bei `klassik` ein Sepia-Ton.

**Scroll-triggered Animations**  
Für lange Pages (Mitgliederverwaltung, Stundenplan): Elemente die in den Viewport scrollen, erscheinen mit `fadeSlideUp`. Geht mit Framer Motion `whileInView` prop — einfachste Implementierung:
```jsx
<motion.div whileInView={{ opacity: 1, y: 0 }} initial={{ opacity: 0, y: 12 }} viewport={{ once: true }}>
```

### Niedrige Priorität / Ideen für später

**Drag & Drop für Stundenplan**  
Framer Motion hat `drag`-Support. Lektionen könnten per Drag auf andere Zeiten/Räume verschoben werden. Technisch aufwändig, sehr cool.

**Presence Avatars**  
Im Live-Session-Modus (`Unterrichtsmodus`): Teilnehmer-Avatare animiert einblenden wenn jemand beitritt (wie Figma Cursors). Framer Motion AnimatePresence + Spring.

**Dark Mode Sidebar Gradient**  
Im Dark Mode: Sidebar-Hintergrund mit einem sehr subtilen, dunklen Gradient von oben nach unten (von leicht lila/blau zu transparent). Gibt Tiefe ohne aufdringlich zu sein.

**Notification Toast Upgrade**  
Aktuelle `ToastContainer` Komponente in `src/components/Toast.jsx` nutzt eigene Animationen. Mit Framer Motion und `layoutId` könnten Toasts elegant gestapelt und beim Dismiss herausfliegen.

**Micro-Interaction: Speichern-Button**  
Wenn ein Formular gespeichert wird: Button morpht kurz zu einem Checkmark. Mit Framer Motion: Text-Opacity 0, Checkmark-Scale 0→1, nach 1.5s zurück. Sehr polished.

**Skeleton Screens**  
Statt Ladekreis: Skeleton-Karten mit `.shimmer-2026` für alle Pages während Daten geladen werden. Verhindert Layout-Shift.

---

## Designentscheidungen & Begründungen

**Warum Framer Motion statt CSS-only?**  
Spring-Physik ist mit reinem CSS nicht erreichbar. Die `layoutId`-basierte Pill-Navigation würde mit CSS `transition` das manuelle Messen und Positionieren per JS erfordern (wie es die alte `DesktopNav` in `NavComponents.jsx` macht). Framer Motion erledigt das deklarativ.

**Warum Icon-Rail-Sidebar statt fixer 240px?**  
Gibt Screens unter 1200px mehr Platz für den Content. Besonders relevant für Stundenplan und Tabellen die viel horizontalen Raum brauchen. Der Pin-Button gibt Power-Usern die Kontrolle.

**Warum kein CSS Framework (Tailwind etc.)?**  
Das gesamte Projekt nutzt Inline-Styles + CSS Custom Properties. Ein Framework jetzt einzuführen würde zu einem Stil-Mix führen. Die bestehenden CSS Vars (`--primary`, `--radius`, etc.) funktionieren als Design Tokens — das reicht.

**Warum `localStorage` für den UI-Modus und kein DB-Feld?**  
Schnellere Iteration während Entwicklung. Kein Migration-Aufwand. Wenn das 2026-Design produktionsreif ist und alle Pages migriert sind, kann die Entscheidung getroffen werden: entweder alle auf 2026 umstellen (dann kein Toggle mehr nötig) oder als echte User-Präferenz in `profiles.ui_modus` persistieren.

**Warum behält jede Page ihre eigene Datenfetching-Logik?**  
So ist das gesamte Projekt strukturiert — kein geteilter Datenlayer. Die 2026-Migration betrifft nur die JSX-Schicht (Styling + Animationen), nicht die Datenfetching-Logik. Das ist bewusst.

**Warum `AnimatePresence mode="wait"` und nicht `mode="sync"`?**  
`wait` lässt die ausgehende Seite vollständig verschwinden bevor die neue erscheint. Vermeidet dass zwei Pages gleichzeitig sichtbar sind — wirkt sauberer und verhindert Layout-Overflow während der Transition.

---

## Wie man das Design testet

```js
// Einschalten
localStorage.setItem('staccato_ui_modus', '2026'); location.reload()

// Ausschalten
localStorage.removeItem('staccato_ui_modus'); location.reload()

// Sidebar immer ausgeklappt
localStorage.setItem('staccato_sidebar_pinned', 'true'); location.reload()

// Sidebar immer Icon-only
localStorage.setItem('staccato_sidebar_pinned', 'false'); location.reload()
```

Dev-Server läuft auf Port 5174 (5173 war belegt).

---

## Bekannte Einschränkungen (aktuell)

- **Noch keine vollständige Page-Migration**: Pages sehen mit dem neuen Layout bereits besser aus (Glassmorphism-Sidebar, Page Transitions), aber die Page-Inhalte selbst nutzen noch die alten Inline-Styles. Das ist der Hauptaufwand für Phase 5.
- **Kein UI-Toggle in der App**: Nur über Browser-Konsole schaltbar.
- **`liquid`-Theme + Glassmorphism-Sidebar**: Das `liquid`-Theme hat selbst schon einen Glassmorphism-Hintergrund. Die Kombination mit der 2026-Sidebar funktioniert, aber die Gradient-Mesh-Hintergrundfarben könnten kollidieren.
- **Framer Motion Bundle-Größe**: ~45 KB gzip. Akzeptabel, aber zu beachten.
