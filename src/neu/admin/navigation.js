// Navigation der neuen Admin-Oberfläche: eine Quelle für Seitenleiste (Computer),
// Reiter (Handy) und die Bereichsseiten „Unterricht“ und „Verwaltung“.
import {
  House, Music, Users, LayoutGrid, CircleUser, BookOpen, CalendarDays, ListMusic, UserPlus,
  CalendarHeart, DoorOpen, Guitar, Package, Receipt, School, Target, FileText, Building2, Inbox,
} from 'lucide-react'

const GEMEINSAM = ['/einstellungen', '/profil', '/meine-dateien']

// Einträge je Bereich; `hinweis` erscheint auf den Bereichsseiten am Handy
export function adminBereiche(abo) {
  return {
    unterricht: [
      { to: '/admin/kurse',       icon: BookOpen,     label: 'courses',      hinweis: 'na_kurse_hinweis' },
      { to: '/admin/stundenplan', icon: CalendarDays, label: 'n_tab_termine', hinweis: 'na_termine_hinweis', auch: ['/admin/woche', '/admin/stunde'] },
      { to: '/admin/repertoire',  icon: ListMusic,    label: 'n_tab_lieder', hinweis: 'na_lieder_hinweis' },
    ],
    mitglieder: [
      { to: '/admin/mitglieder',    icon: Users,    label: 'members' },
      { to: '/admin/interessenten', icon: UserPlus, label: 'prospects' },
    ],
    verwaltung: [
      { to: '/admin/events',        icon: CalendarHeart, label: 'events',      hinweis: 'na_events_hinweis' },
      { to: '/admin/raeume',        icon: DoorOpen,      label: 'rooms',       hinweis: 'na_raeume_hinweis' },
      { to: '/admin/instrumente',   icon: Guitar,        label: 'instruments', hinweis: 'na_instrumente_hinweis' },
      ...(abo?.hatInventar !== false ? [{ to: '/admin/inventar', icon: Package, label: 'inventar', hinweis: 'na_inventar_hinweis' }] : []),
      { to: '/admin/rechnungen',    icon: Receipt,       label: 'na_finanzen', hinweis: 'na_finanzen_hinweis' },
      { to: '/admin/einstellungen', icon: School,        label: 'na_schule',   hinweis: 'na_schule_hinweis' },
    ],
    vorstand: abo?.hatVorstand !== false ? [
      { to: '/vorstand/ziele',      icon: Target,   label: 'vorstand_ziele' },
      { to: '/vorstand/protokolle', icon: FileText, label: 'vorstand_protokolle' },
    ] : [],
  }
}

export const SUPERADMIN_EINTRAEGE = [
  { to: '/superadmin',       icon: Building2, label: 'all_schools' },
  { to: '/superadmin/demos', icon: Inbox,     label: 'na_demo_anfragen' },
]

// Reiter am Handy (5 Bereiche)
export function adminReiter(abo) {
  const b = adminBereiche(abo)
  const pfade = liste => liste.map(e => e.to)
  return [
    { to: '/admin',            icon: House,      label: 'n_tab_start',       auch: [] },
    { to: '/admin/unterricht', icon: Music,      label: 'na_tab_unterricht', auch: [...pfade(b.unterricht), '/admin/woche', '/admin/stunde'] },
    { to: '/admin/mitglieder', icon: Users,      label: 'na_tab_mitglieder', auch: pfade(b.mitglieder) },
    { to: '/admin/verwaltung', icon: LayoutGrid, label: 'na_tab_verwaltung', auch: [...pfade(b.verwaltung), '/vorstand'] },
    { to: '/admin/ich',        icon: CircleUser, label: 'n_tab_ich',         auch: ['/admin/profil', '/admin/nachrichten', '/admin/tools', '/superadmin', '/schulen', ...GEMEINSAM] },
  ]
}
