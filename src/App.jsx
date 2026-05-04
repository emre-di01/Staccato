import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AppProvider, useApp } from './context/AppContext'
import PageErrorBoundary from './components/PageErrorBoundary'
import ProtectedRoute, { startseiteNach } from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
import PasswortZuruecksetzen from './pages/PasswortZuruecksetzen'
import AdminDashboard from './pages/admin/Dashboard'
import Mitgliederverwaltung from './pages/admin/Mitgliederverwaltung'
import Kursverwaltung from './pages/admin/Kursverwaltung'
import Raumverwaltung from './pages/admin/Raumverwaltung'
import LehrerDashboard from './pages/lehrer/Dashboard'
import LehrerKurse from './pages/lehrer/Kurse'
import KursDetail from './pages/lehrer/KursDetail'
import KursRepertoire from './pages/lehrer/KursRepertoire'
import StueckDetail from './pages/lehrer/StueckDetail'
import SchuelerDashboard from './pages/schueler/Dashboard'
import SchuelerKurse from './pages/schueler/Kurse'
import SchuelerKursDetail from './pages/schueler/KursDetail'
import SchuelerAnwesenheit from './pages/schueler/Anwesenheit'
import AdminEvents from './pages/admin/Events'
import Interessenten from './pages/admin/Interessenten'
import LehrerEvents from './pages/lehrer/Events'
import EventRepertoire from './pages/lehrer/EventRepertoire'
import SchuelerEvents from './pages/schueler/Events'
import ProfilSeite from './pages/ProfilSeite'
import Stundenplan from './pages/Stundenplan'
import Platzhalter from './pages/Platzhalter'
import Unterrichtsmodus from './pages/lehrer/Unterrichtsmodus'
import LehrerSchueler from './pages/lehrer/LehrerSchueler'
import SchuelerSession from './pages/SchuelerSession'
import Repertoire from './pages/Repertoire'
import Impressum from './pages/Impressum'
import Datenschutz from './pages/Datenschutz'
import ConsentBanner from './components/ConsentBanner'
import WhatsNewModal from './components/WhatsNewModal'
import Instrumente from './pages/admin/Instrumente'
import VorstandDashboard from './pages/vorstand/Dashboard'
import VorstandZiele from './pages/vorstand/Ziele'
import VorstandProtokolle from './pages/vorstand/Protokolle'
import Nachrichten from './pages/Nachrichten'

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
            <AppRoutes />
          </PageErrorBoundary>
        </AppProvider>
      </BrowserRouter>
    </QueryClientProvider>
  )
}
