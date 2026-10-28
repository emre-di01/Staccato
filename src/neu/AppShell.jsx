import { useEffect } from 'react'
import { Link, Outlet, useLocation, matchPath } from 'react-router-dom'
import { House, CalendarDays, Music, CircleUser, Users, Landmark, Heart } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { ToastContainer } from '../components/Toast'
import { ConfirmModal } from '../components/ConfirmModal'
import OfflineBanner from '../components/layout/OfflineBanner'
import { GLOBAL_CSS } from '../components/layout/globalCss'
import { UI_CSS } from '../ui'
import { useUngelesen } from './daten'
import { adminReiter } from './admin/navigation'
import AdminSeitenleiste from './admin/Seitenleiste'

// Reiter der neuen Oberfläche je Rolle. `auch` = weitere Pfade, bei denen der Reiter aktiv ist.
const GEMEINSAM = ['/einstellungen', '/profil', '/meine-dateien']
const REITER = {
  schueler: [
    { to: '/schueler',             icon: House,        label: 'n_tab_start',   auch: [] },
    { to: '/schueler/stundenplan', icon: CalendarDays, label: 'n_tab_termine', auch: ['/schueler/events'] },
    { to: '/schueler/repertoire',  icon: Music,        label: 'n_tab_lieder',  auch: [] },
    { to: '/schueler/ich',         icon: CircleUser,   label: 'n_tab_ich',     auch: ['/schueler/profil', '/schueler/nachrichten', '/schueler/kurse', '/schueler/dateien', '/schueler/faq', ...GEMEINSAM] },
  ],
  lehrer: [
    { to: '/lehrer',             icon: House,        label: 'n_tab_start',   auch: [] },
    { to: '/lehrer/anwesenheit', icon: CalendarDays, label: 'n_tab_termine', auch: ['/lehrer/events', '/lehrer/stundenplan'] },
    { to: '/lehrer/kurse',       icon: Users,        label: 'nl_tab_kurse',  auch: ['/lehrer/stunde', '/lehrer/schueler'] },
    { to: '/lehrer/repertoire',  icon: Music,        label: 'n_tab_lieder',  auch: [] },
    { to: '/lehrer/ich',         icon: CircleUser,   label: 'n_tab_ich',     auch: ['/lehrer/profil', '/lehrer/nachrichten', '/lehrer/tools', ...GEMEINSAM] },
  ],
  vorstand: [
    { to: '/vorstand',             icon: House,        label: 'n_tab_start',   auch: [] },
    { to: '/vorstand/stundenplan', icon: CalendarDays, label: 'n_tab_termine', auch: ['/vorstand/events'] },
    { to: '/vorstand/repertoire',  icon: Music,        label: 'n_tab_lieder',  auch: [] },
    { to: '/vorstand/bereich',     icon: Landmark,     label: 'na_vorstand',   auch: ['/vorstand/ziele', '/vorstand/protokolle', '/vorstand/inventar'] },
    { to: '/vorstand/ich',         icon: CircleUser,   label: 'n_tab_ich',     auch: ['/vorstand/profil', '/vorstand/nachrichten', '/vorstand/kurse', '/vorstand/dateien', '/vorstand/faq', '/vorstand/tools', ...GEMEINSAM] },
  ],
  eltern: [
    { to: '/eltern',             icon: House,        label: 'n_tab_start',    auch: [] },
    { to: '/eltern/stundenplan', icon: CalendarDays, label: 'n_tab_termine',  auch: ['/eltern/events'] },
    { to: '/eltern/kinder',      icon: Heart,        label: 'ne_tab_kinder',  auch: [] },
    { to: '/eltern/ich',         icon: CircleUser,   label: 'n_tab_ich',      auch: ['/eltern/profil', '/eltern/nachrichten', '/eltern/dateien', '/eltern/tools', ...GEMEINSAM] },
  ],
}

// Seiten, die schon im neuen Design gebaut sind (bringen eigene Abstände mit)
const NEUE_SEITEN = [
  '/schueler', '/schueler/stundenplan', '/schueler/events', '/schueler/repertoire', '/schueler/repertoire/:stueckId', '/schueler/ich',
  '/schueler/nachrichten', '/schueler/kurse', '/schueler/kurse/:id', '/schueler/dateien', '/schueler/faq', '/schueler/profil',
  '/lehrer', '/lehrer/kurse', '/lehrer/kurse/:id', '/lehrer/stunde/:id', '/lehrer/ich', '/lehrer/profil',
  '/lehrer/anwesenheit', '/lehrer/repertoire', '/lehrer/schueler', '/lehrer/nachrichten', '/lehrer/tools', '/schueler/tools',
  '/lehrer/kurse/:id/repertoire', '/lehrer/events/:id/repertoire', '/schueler/events/:id/repertoire',
  '/lehrer/repertoire/:stueckId', '/lehrer/kurse/:kursId/repertoire/:stueckId', '/lehrer/events/:kursId/repertoire/:stueckId',
  '/schueler/events/:kursId/repertoire/:stueckId', '/lehrer/kurse/:id/unterrichtsmodus',
  '/lehrer/kurse/:id/verwalten', '/lehrer/repertoire/:stueckId/bearbeiten', '/lehrer/stundenplan',
  '/admin', '/admin/unterricht', '/admin/verwaltung', '/admin/ich', '/admin/profil', '/admin/tools', '/admin/mitglieder', '/admin/interessenten', '/admin/nachrichten',
  '/admin/events', '/admin/raeume', '/admin/instrumente', '/admin/inventar', '/admin/rechnungen', '/admin/einstellungen',
  '/vorstand/ziele', '/vorstand/protokolle', '/superadmin', '/superadmin/demos',
  '/vorstand', '/vorstand/bereich', '/vorstand/inventar', '/vorstand/stundenplan', '/vorstand/events', '/vorstand/repertoire', '/vorstand/repertoire/:stueckId',
  '/vorstand/events/:id/repertoire', '/vorstand/events/:kursId/repertoire/:stueckId', '/vorstand/kurse', '/vorstand/kurse/:id', '/vorstand/ich',
  '/vorstand/nachrichten', '/vorstand/dateien', '/vorstand/faq', '/vorstand/profil', '/vorstand/tools',
  '/eltern', '/eltern/stundenplan', '/eltern/kinder', '/eltern/kinder/:id', '/eltern/ich', '/eltern/nachrichten', '/eltern/dateien', '/eltern/profil', '/eltern/tools',
  '/admin/kurse', '/admin/kurse/:id', '/admin/kurse/:id/verwalten', '/admin/kurse/:id/repertoire', '/admin/kurse/:id/unterrichtsmodus',
  '/admin/stundenplan', '/admin/woche', '/admin/stunde/:id', '/admin/repertoire', '/admin/repertoire/:stueckId', '/admin/repertoire/:stueckId/bearbeiten',
  '/admin/kurse/:kursId/repertoire/:stueckId', '/admin/events/:id/repertoire', '/admin/events/:kursId/repertoire/:stueckId',
  ...GEMEINSAM,
]
const VOLLBILD = [
  '/schueler/repertoire/:stueckId', '/schueler/events/:kursId/repertoire/:stueckId',
  '/lehrer/repertoire/:stueckId', '/lehrer/kurse/:kursId/repertoire/:stueckId', '/lehrer/events/:kursId/repertoire/:stueckId',
  '/lehrer/kurse/:id/unterrichtsmodus',
  '/admin/repertoire/:stueckId', '/admin/kurse/:kursId/repertoire/:stueckId', '/admin/events/:kursId/repertoire/:stueckId',
  '/admin/kurse/:id/unterrichtsmodus',
  '/vorstand/repertoire/:stueckId', '/vorstand/events/:kursId/repertoire/:stueckId',
]

const passt = (muster, pfad) => muster.some(m => matchPath({ path: m, end: true }, pfad))

// Erster Reiter (Start) nur bei exaktem Pfad, sonst auch für Unterseiten
function istAktiv(reiter, pfad, erster) {
  if (erster) return pfad === reiter.to
  return [reiter.to, ...reiter.auch].some(p => pfad === p || pfad.startsWith(p + '/'))
}

export default function AppShell() {
  const { T, rolle, abo, toasts, removeToast, confirmState, resolveConfirm } = useApp()
  const istAdmin = rolle === 'admin' || rolle === 'superadmin'
  const reiter = istAdmin ? adminReiter(abo) : (REITER[rolle] ?? REITER.schueler)
  const { pathname } = useLocation()
  const { data: ungelesen = [] } = useUngelesen()
  const neueSeite = passt(NEUE_SEITEN, pathname)
  const vollbild  = passt(VOLLBILD, pathname)

  useEffect(() => { window.scrollTo(0, 0) }, [pathname])

  const badgeFuer = r => (r.label === 'n_tab_ich' ? ungelesen.length : 0)

  return (
    <div className="n-shell" style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)' }}>
      <a href="#n-inhalt" className="skip-link">{T('n_zum_inhalt')}</a>

      {/* Computer: Seitenleiste */}
      <aside className="n-seitenleiste" aria-label={T('n_hauptmenue')}>
        {istAdmin ? <AdminSeitenleiste ungelesen={ungelesen.length} /> : <>
        <div style={{ padding: '28px 20px 24px', fontSize: 24, fontWeight: 800, letterSpacing: '-0.02em' }}>Staccato</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, padding: '0 12px' }}>
          {reiter.map((r, i) => {
            const aktiv = istAktiv(r, pathname, i === 0)
            const Icon = r.icon
            const badge = badgeFuer(r)
            return (
              <Link key={r.to} to={r.to} aria-current={aktiv ? 'page' : undefined} style={{
                display: 'flex', alignItems: 'center', gap: 14, minHeight: 52, padding: '0 14px', borderRadius: 14, textDecoration: 'none',
                fontSize: 17, fontWeight: aktiv ? 700 : 500, color: aktiv ? 'var(--primary)' : 'var(--text)',
                background: aktiv ? 'var(--n-tint)' : 'transparent',
              }}>
                <Icon aria-hidden="true" size={24} strokeWidth={aktiv ? 2.1 : 1.8} />
                <span style={{ flex: 1 }}>{T(r.label)}</span>
                {badge > 0 && <span style={{ minWidth: 24, height: 24, padding: '0 7px', borderRadius: 12, background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge > 9 ? '9+' : badge}</span>}
              </Link>
            )
          })}
        </nav>
        </>}
      </aside>

      <main id="n-inhalt" className={`n-inhalt${vollbild ? ' n-vollbild' : ''}`}>
        <OfflineBanner />
        <div key={pathname} className="n-seite" style={neueSeite ? undefined : { maxWidth: 1000, margin: '0 auto', padding: '20px 16px' }}>
          <Outlet />
        </div>
      </main>

      {/* Handy: Reiterleiste */}
      {!vollbild && (
        <nav className="n-reiterleiste" aria-label={T('n_hauptmenue')}>
          {reiter.map((r, i) => {
            const aktiv = istAktiv(r, pathname, i === 0)
            const Icon = r.icon
            const badge = badgeFuer(r)
            return (
              <Link key={r.to} to={r.to} aria-current={aktiv ? 'page' : undefined} style={{
                flex: 1, minHeight: 56, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 3,
                textDecoration: 'none', fontSize: 13, fontWeight: aktiv ? 700 : 500, color: aktiv ? 'var(--primary)' : 'var(--text-2)', position: 'relative',
              }}>
                <Icon aria-hidden="true" size={26} strokeWidth={aktiv ? 2.1 : 1.8} />
                {T(r.label)}
                {badge > 0 && <span aria-label={`${badge} ${T('n_ungelesen')}`} style={{ position: 'absolute', top: 2, left: 'calc(50% + 8px)', minWidth: 20, height: 20, padding: '0 6px', borderRadius: 10, background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge > 9 ? '9+' : badge}</span>}
              </Link>
            )
          })}
        </nav>
      )}

      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          sub={confirmState.sub}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          dangerous={confirmState.dangerous ?? true}
          neu
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}

      <style>{GLOBAL_CSS}</style>
      <style>{UI_CSS + SHELL_CSS}</style>
    </div>
  )
}

const SHELL_CSS = `
  .n-seitenleiste { display: none; }
  .n-inhalt { padding-bottom: calc(96px + env(safe-area-inset-bottom, 0px)); padding-top: env(safe-area-inset-top, 0px); }
  .n-inhalt.n-vollbild { padding-bottom: 0; }
  .n-reiterleiste {
    position: fixed; left: 0; right: 0; bottom: 0; z-index: 100; display: flex; padding: 6px 8px;
    padding-bottom: calc(6px + env(safe-area-inset-bottom, 0px));
    background: var(--n-bar); backdrop-filter: blur(20px) saturate(160%); -webkit-backdrop-filter: blur(20px) saturate(160%);
    border-top: 1px solid var(--n-sep);
  }
  @media (min-width: 900px) {
    .n-seitenleiste { display: block; position: fixed; top: 0; bottom: 0; left: 0; width: 260px; border-right: 1px solid var(--n-sep); background: var(--bg); overflow-y: auto; }
    .n-inhalt { margin-left: 260px; padding-bottom: 40px; padding-top: 24px; }
    .n-inhalt.n-vollbild { padding-top: 0; }
    .n-reiterleiste { display: none; }
  }
`
