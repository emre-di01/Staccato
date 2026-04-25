import { BrowserRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom'
import { AppProvider, useApp } from './context/AppContext'
import ProtectedRoute, { startseiteNach } from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import LoginPage from './pages/LoginPage'
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
import Stundenplan from './pages/Stundenplan'
import Platzhalter from './pages/Platzhalter'

function RollenWeiterleitung() {
  const { session, rolle, laden } = useApp()
  if (laden) return null
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={startseiteNach(rolle)} replace />
}

function AppRoutes() {
  const { T } = useApp()
  const location = useLocation()
  const P = (titel, icon) => <Platzhalter titel={titel} icon={icon} />

  return (
    <Routes location={location} key={location.pathname}>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/" element={<RollenWeiterleitung />} />

      {/* ── Admin / Superadmin ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['admin','superadmin']} />}>
        <Route element={<AppLayout />}>
          <Route path="/admin"                  element={<AdminDashboard />} />
          <Route path="/admin/mitglieder"       element={<Mitgliederverwaltung />} />
          <Route path="/admin/kurse"            element={<Kursverwaltung />} />
          <Route path="/admin/stundenplan"      element={<Stundenplan />} />
          <Route path="/admin/raeume"           element={<Raumverwaltung />} />
          <Route path="/admin/repertoire"       element={P('Repertoire', '🎼')} />
          <Route path="/admin/events"           element={P('Veranstaltungen', '🎭')} />
          <Route path="/admin/abrechnung"       element={P('Abrechnung', '💰')} />
          <Route path="/admin/interessenten"    element={P('Interessenten', '📋')} />
          <Route path="/admin/nachrichten"      element={P('Nachrichten', '💬')} />
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
          <Route path="/lehrer/kurse/:id/unterrichtsmodus" element={P('Unterrichtsmodus', '🎬')} />
          <Route path="/lehrer/schueler"        element={P('Meine Schüler', '👥')} />
          <Route path="/lehrer/anwesenheit"     element={<Stundenplan />} />
          <Route path="/lehrer/repertoire"      element={P('Repertoire', '🎼')} />
          <Route path="/lehrer/events"          element={P('Veranstaltungen', '🎭')} />
          <Route path="/lehrer/nachrichten"     element={P('Nachrichten', '💬')} />
        </Route>
      </Route>

      {/* ── Schüler ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['schueler']} />}>
        <Route element={<AppLayout />}>
          <Route path="/schueler"                     element={<SchuelerDashboard />} />
          <Route path="/schueler/stundenplan"         element={<SchuelerKurse />} />
          <Route path="/schueler/kurse/:id"           element={<SchuelerKursDetail />} />
          <Route path="/schueler/dateien"             element={P('Dateien', '📁')} />
          <Route path="/schueler/events"              element={P('Veranstaltungen', '🎭')} />
          <Route path="/schueler/nachrichten"         element={P('Nachrichten', '💬')} />
        </Route>
      </Route>

      {/* ── Eltern ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['eltern']} />}>
        <Route element={<AppLayout />}>
          <Route path="/eltern"                 element={P('Dashboard', '📊')} />
          <Route path="/eltern/stundenplan"     element={<Stundenplan />} />
          <Route path="/eltern/dateien"         element={P('Dateien', '📁')} />
          <Route path="/eltern/events"          element={P('Veranstaltungen', '🎭')} />
          <Route path="/eltern/nachrichten"     element={P('Nachrichten', '💬')} />
        </Route>
      </Route>

      {/* Session beitreten (ohne Login) */}
      <Route path="/session/:code" element={P('Session beitreten', '🎬')} />

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <AppProvider>
        <AppRoutes />
      </AppProvider>
    </BrowserRouter>
  )
}
