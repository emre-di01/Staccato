import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AppProvider, useApp } from './context/AppContext'
import PageErrorBoundary from './components/PageErrorBoundary'
import ProtectedRoute, { startseiteNach } from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import ConsentBanner from './components/ConsentBanner'
import WhatsNewModal from './components/WhatsNewModal'

const LoginPage            = lazy(() => import('./pages/LoginPage'))
const PasswortZuruecksetzen = lazy(() => import('./pages/PasswortZuruecksetzen'))
const AdminDashboard       = lazy(() => import('./pages/admin/Dashboard'))
const Mitgliederverwaltung = lazy(() => import('./pages/admin/Mitgliederverwaltung'))
const Kursverwaltung       = lazy(() => import('./pages/admin/Kursverwaltung'))
const Raumverwaltung       = lazy(() => import('./pages/admin/Raumverwaltung'))
const Instrumente          = lazy(() => import('./pages/admin/Instrumente'))
const AdminEvents          = lazy(() => import('./pages/admin/Events'))
const Interessenten        = lazy(() => import('./pages/admin/Interessenten'))
const LehrerDashboard      = lazy(() => import('./pages/lehrer/Dashboard'))
const LehrerKurse          = lazy(() => import('./pages/lehrer/Kurse'))
const KursDetail           = lazy(() => import('./pages/lehrer/KursDetail'))
const KursRepertoire       = lazy(() => import('./pages/lehrer/KursRepertoire'))
const StueckDetail         = lazy(() => import('./pages/lehrer/StueckDetail'))
const LehrerEvents         = lazy(() => import('./pages/lehrer/Events'))
const EventRepertoire      = lazy(() => import('./pages/lehrer/EventRepertoire'))
const Unterrichtsmodus     = lazy(() => import('./pages/lehrer/Unterrichtsmodus'))
const LehrerSchueler       = lazy(() => import('./pages/lehrer/LehrerSchueler'))
const SchuelerDashboard    = lazy(() => import('./pages/schueler/Dashboard'))
const SchuelerKurse        = lazy(() => import('./pages/schueler/Kurse'))
const SchuelerKursDetail   = lazy(() => import('./pages/schueler/KursDetail'))
const SchuelerAnwesenheit  = lazy(() => import('./pages/schueler/Anwesenheit'))
const SchuelerEvents       = lazy(() => import('./pages/schueler/Events'))
const VorstandDashboard    = lazy(() => import('./pages/vorstand/Dashboard'))
const VorstandZiele        = lazy(() => import('./pages/vorstand/Ziele'))
const VorstandProtokolle   = lazy(() => import('./pages/vorstand/Protokolle'))
const ProfilSeite          = lazy(() => import('./pages/ProfilSeite'))
const Stundenplan          = lazy(() => import('./pages/Stundenplan'))
const Platzhalter          = lazy(() => import('./pages/Platzhalter'))
const SchuelerSession      = lazy(() => import('./pages/SchuelerSession'))
const Repertoire           = lazy(() => import('./pages/Repertoire'))
const Nachrichten          = lazy(() => import('./pages/Nachrichten'))
const Impressum            = lazy(() => import('./pages/Impressum'))
const Datenschutz          = lazy(() => import('./pages/Datenschutz'))

function RollenWeiterleitung() {
  const { session, rolle, laden } = useApp()
  if (laden) return null
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={startseiteNach(rolle)} replace />
}

function AppRoutes() {
  const { T } = useApp()
  const P = (titel, icon) => <Platzhalter titel={titel} icon={icon} />

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/passwort-zuruecksetzen" element={<PasswortZuruecksetzen />} />
      <Route path="/" element={<RollenWeiterleitung />} />

      {/* ── Admin / Superadmin ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['admin','superadmin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin"                  element={<AdminDashboard />} />
          <Route path="/admin/mitglieder"       element={<Mitgliederverwaltung />} />
          <Route path="/admin/kurse"            element={<Kursverwaltung />} />
          <Route path="/admin/raeume"           element={<Raumverwaltung />} />
          <Route path="/admin/stundenplan"      element={<Stundenplan />} />
          <Route path="/admin/profil"            element={<ProfilSeite />} />
          <Route path="/admin/repertoire"       element={<Repertoire />} />
          <Route path="/admin/repertoire/:stueckId" element={<StueckDetail />} />
          <Route path="/admin/events"                                          element={<AdminEvents />} />
          <Route path="/admin/events/:id/repertoire"                         element={<EventRepertoire />} />
          <Route path="/admin/events/:kursId/repertoire/:stueckId"           element={<StueckDetail />} />
          <Route path="/admin/instrumente"      element={<Instrumente />} />
          <Route path="/admin/interessenten"    element={<Interessenten />} />
          <Route path="/admin/nachrichten"      element={<Nachrichten />} />
        </Route>
      </Route>

      {/* ── Lehrer ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['lehrer', 'admin', 'superadmin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/lehrer"                 element={<LehrerDashboard />} />
          <Route path="/lehrer/kurse"           element={<LehrerKurse />} />
          <Route path="/lehrer/kurse/:id"       element={<KursDetail />} />
          <Route path="/lehrer/kurse/:id/repertoire" element={<KursRepertoire />} />
          <Route path="/lehrer/kurse/:kursId/repertoire/:stueckId" element={<StueckDetail />} />
          <Route path="/lehrer/kurse/:id/unterrichtsmodus" element={<Unterrichtsmodus />} />
          <Route path="/lehrer/schueler"        element={<LehrerSchueler />} />
          <Route path="/lehrer/anwesenheit"     element={<Stundenplan />} />
          <Route path="/lehrer/repertoire"      element={<Repertoire />} />
          <Route path="/lehrer/repertoire/:stueckId" element={<StueckDetail />} />
          <Route path="/lehrer/events"                                         element={<LehrerEvents />} />
          <Route path="/lehrer/events/:id/repertoire"                        element={<EventRepertoire />} />
          <Route path="/lehrer/events/:kursId/repertoire/:stueckId"          element={<StueckDetail />} />
          <Route path="/lehrer/nachrichten"     element={<Nachrichten />} />
          <Route path="/lehrer/profil"          element={<ProfilSeite />} />
        </Route>
      </Route>

      {/* ── Schüler ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['schueler']} />}>
        <Route element={<AppLayout />}>
          <Route path="/schueler"                     element={<SchuelerDashboard />} />
          <Route path="/schueler/stundenplan"         element={<Stundenplan />} />
          <Route path="/schueler/kurse"               element={<SchuelerKurse />} />
          <Route path="/schueler/kurse/:id"           element={<SchuelerKursDetail />} />
          <Route path="/schueler/kurse/:id/anwesenheit" element={<SchuelerAnwesenheit />} />
          <Route path="/schueler/dateien"             element={P('Dateien', '📁')} />
          <Route path="/schueler/events"                                       element={<SchuelerEvents />} />
          <Route path="/schueler/events/:id/repertoire"                      element={<EventRepertoire />} />
          <Route path="/schueler/events/:kursId/repertoire/:stueckId"        element={<StueckDetail />} />
          <Route path="/schueler/repertoire"         element={<Repertoire />} />
          <Route path="/schueler/repertoire/:stueckId" element={<StueckDetail />} />
          <Route path="/schueler/nachrichten"         element={<Nachrichten />} />
          <Route path="/schueler/profil"              element={<ProfilSeite />} />
        </Route>
      </Route>

      {/* ── Vorstand ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['vorstand', 'admin', 'superadmin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/vorstand"                       element={<VorstandDashboard />} />
          <Route path="/vorstand/ziele"                 element={<VorstandZiele />} />
          <Route path="/vorstand/protokolle"            element={<VorstandProtokolle />} />
          <Route path="/vorstand/stundenplan"           element={<Stundenplan />} />
          <Route path="/vorstand/kurse"                 element={<SchuelerKurse />} />
          <Route path="/vorstand/kurse/:id"             element={<SchuelerKursDetail />} />
          <Route path="/vorstand/events"                element={<SchuelerEvents />} />
          <Route path="/vorstand/events/:id/repertoire" element={<EventRepertoire />} />
          <Route path="/vorstand/events/:kursId/repertoire/:stueckId" element={<StueckDetail />} />
          <Route path="/vorstand/repertoire"            element={<Repertoire />} />
          <Route path="/vorstand/repertoire/:stueckId"  element={<StueckDetail />} />
          <Route path="/vorstand/profil"                element={<ProfilSeite />} />
        </Route>
      </Route>

      {/* ── Eltern ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['eltern']} />}>
        <Route element={<AppLayout />}>
          <Route path="/eltern"                 element={P('Dashboard', '📊')} />
          <Route path="/eltern/stundenplan"     element={<Stundenplan />} />
          <Route path="/eltern/dateien"         element={P('Dateien', '📁')} />
          <Route path="/eltern/events"          element={P('Veranstaltungen', '🎭')} />
          <Route path="/eltern/nachrichten"     element={<Nachrichten />} />
          <Route path="/eltern/profil"          element={<ProfilSeite />} />
        </Route>
      </Route>

      {/* Session beitreten */}
      <Route path="/session/:code" element={<SchuelerSession />} />

      {/* Öffentliche Seiten */}
      <Route path="/impressum"   element={<Impressum />} />
      <Route path="/datenschutz" element={<Datenschutz />} />

      {/* Profil - für alle Rollen */}
      <Route element={<ProtectedRoute erlaubteRollen={['admin','superadmin','lehrer','schueler','eltern','vorstand']} />}>
        <Route element={<AppLayout />}>
          <Route path="/profil" element={<ProfilSeite />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppProvider>
          <ConsentBanner />
          <WhatsNewModal />
          <PageErrorBoundary>
            <Suspense fallback={null}>
              <AppRoutes />
            </Suspense>
          </PageErrorBoundary>
        </AppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
