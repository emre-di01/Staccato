import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate, useParams } from 'react-router-dom'
import { QueryClientProvider } from '@tanstack/react-query'
import { queryClient } from './lib/queryClient'
import { AppProvider, useApp } from './context/AppContext'
import PageErrorBoundary from './components/PageErrorBoundary'
import ProtectedRoute, { startseiteNach } from './components/ProtectedRoute'
import AppLayout from './components/layout/AppLayout'
import AppShell from './neu/AppShell'
import { DESIGN_ROLLEN } from './neu/rolle'
import ConsentBanner from './components/ConsentBanner'
import WhatsNewModal from './components/WhatsNewModal'

const LoginPage            = lazy(() => import('./pages/LoginPage'))
const PasswortZuruecksetzen = lazy(() => import('./pages/PasswortZuruecksetzen'))
const AdminDashboard       = lazy(() => import('./pages/admin/Dashboard'))
const Mitgliederverwaltung = lazy(() => import('./pages/admin/Mitgliederverwaltung'))
const Kursverwaltung       = lazy(() => import('./pages/admin/Kursverwaltung'))
const Raumverwaltung       = lazy(() => import('./pages/admin/Raumverwaltung'))
const Instrumente          = lazy(() => import('./pages/admin/Instrumente'))
const Inventar             = lazy(() => import('./pages/admin/Inventar'))
const AdminEvents          = lazy(() => import('./pages/admin/Events'))
const Interessenten        = lazy(() => import('./pages/admin/Interessenten'))
const Rechnungen           = lazy(() => import('./pages/admin/Rechnungen'))
const AdminEinstellungen   = lazy(() => import('./pages/admin/Einstellungen'))
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
const SchuelerDateien      = lazy(() => import('./pages/schueler/Dateien'))
const SchuelerFAQ          = lazy(() => import('./pages/schueler/FAQ'))
const VorstandFAQ          = lazy(() => import('./pages/vorstand/FAQ'))
const Tools                = lazy(() => import('./pages/Tools'))
const VorstandDashboard    = lazy(() => import('./pages/vorstand/Dashboard'))
const VorstandZiele        = lazy(() => import('./pages/vorstand/Ziele'))
const VorstandProtokolle   = lazy(() => import('./pages/vorstand/Protokolle'))
const ProfilSeite          = lazy(() => import('./pages/ProfilSeite'))
const Einstellungen        = lazy(() => import('./pages/Einstellungen'))
const MeineDateien         = lazy(() => import('./pages/MeineDateien'))
const Stundenplan          = lazy(() => import('./pages/Stundenplan'))
const Platzhalter          = lazy(() => import('./pages/Platzhalter'))
const SchuelerSession      = lazy(() => import('./pages/SchuelerSession'))
const BeamerDisplay        = lazy(() => import('./pages/BeamerDisplay'))
const Repertoire           = lazy(() => import('./pages/Repertoire'))
const Nachrichten          = lazy(() => import('./pages/Nachrichten'))
const Impressum            = lazy(() => import('./pages/Impressum'))
const Datenschutz          = lazy(() => import('./pages/Datenschutz'))
const Lizenzen             = lazy(() => import('./pages/Lizenzen'))
const SchulWaehler         = lazy(() => import('./pages/SchulWaehler'))
const Einladung            = lazy(() => import('./pages/Einladung'))
const SuperadminDashboard  = lazy(() => import('./pages/superadmin/Dashboard'))
const SuperadminDemos      = lazy(() => import('./pages/superadmin/Demos'))
// Neues Design (Opt-in, Phase 2: Schüler)
const NeuStart             = lazy(() => import('./neu/seiten/Start'))
const NeuTermine           = lazy(() => import('./neu/seiten/Termine'))
const NeuLieder            = lazy(() => import('./neu/seiten/Lieder'))
const NeuLied              = lazy(() => import('./neu/seiten/Lied'))
const NeuIch               = lazy(() => import('./neu/seiten/Ich'))
const NeuNachrichten       = lazy(() => import('./neu/seiten/Nachrichten'))
const NeuKurse             = lazy(() => import('./neu/seiten/Kurse'))
const NeuKurs              = lazy(() => import('./neu/seiten/Kurs'))
const NeuDokumente         = lazy(() => import('./neu/seiten/Dokumente'))
const NeuMeineDateien      = lazy(() => import('./neu/seiten/MeineDateien'))
const NeuProfil            = lazy(() => import('./neu/seiten/Profil'))
const NeuEinstellungen     = lazy(() => import('./neu/seiten/Einstellungen'))
const NeuHilfe             = lazy(() => import('./neu/seiten/Hilfe'))
// Neues Design, Phase 3: Lehrer
const NeuLehrerStart       = lazy(() => import('./neu/lehrer/Start'))
const NeuLehrerKurse       = lazy(() => import('./neu/lehrer/Kurse'))
const NeuLehrerKurs        = lazy(() => import('./neu/lehrer/Kurs'))
const NeuStundeAbschliessen = lazy(() => import('./neu/lehrer/StundeAbschliessen'))
const NeuLehrerTermine     = lazy(() => import('./neu/lehrer/Termine'))
const NeuLehrerLieder      = lazy(() => import('./neu/lehrer/Lieder'))
const NeuLehrerSchueler    = lazy(() => import('./neu/lehrer/Schueler'))
const NeuLehrerLive        = lazy(() => import('./neu/lehrer/Live'))
const NeuLiederListe       = lazy(() => import('./neu/seiten/LiederListe'))
const NeuSession           = lazy(() => import('./neu/seiten/Session'))
const NeuWerkzeuge         = lazy(() => import('./neu/seiten/Werkzeuge'))
const NeuKursVerwalten     = lazy(() => import('./neu/lehrer/KursVerwalten'))
const NeuLiedBearbeiten    = lazy(() => import('./neu/lehrer/LiedBearbeiten'))
const NeuLehrerWoche       = lazy(() => import('./neu/lehrer/Woche'))
// Neues Design, Phase 4: Admin/Superadmin (Opt-in)
const NeuAdminStart        = lazy(() => import('./neu/admin/Start'))
const NeuAdminBereich      = lazy(() => import('./neu/admin/Bereich'))
const NeuAdminMitglieder   = lazy(() => import('./neu/admin/Mitglieder'))
const NeuAdminInteressenten = lazy(() => import('./neu/admin/Interessenten'))

function RollenWeiterleitung() {
  const { session, rolle, laden } = useApp()
  if (laden) return null
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={startseiteNach(rolle)} replace />
}

// Neues Design: Standard für NEU_ROLLEN, Opt-in für OPTIN_ROLLEN (Admin/Superadmin)
function useNeuesDesignAktiv() {
  const { neuesDesign, rolle } = useApp()
  return neuesDesign && DESIGN_ROLLEN.includes(rolle)
}

function LayoutWahl() {
  return useNeuesDesignAktiv() ? <AppShell /> : <AppLayout />
}

function DesignWahl({ alt, neu }) {
  return useNeuesDesignAktiv() ? neu : alt
}

// Live-Sitzung (öffentlich): neues Design auch für Gäste; klassisch nur, wer es eingeschaltet hat
function SessionWahl() {
  const { rolle, neuesDesign } = useApp()
  return rolle && !(neuesDesign && DESIGN_ROLLEN.includes(rolle)) ? <SchuelerSession /> : <NeuSession />
}

function KursUmleitung() {
  const { id } = useParams()
  return <Navigate to={`/schueler/kurse/${id}`} replace />
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
        <Route element={<LayoutWahl />}>
          <Route path="/admin"                  element={<DesignWahl alt={<AdminDashboard />} neu={<NeuAdminStart />} />} />
          <Route path="/admin/unterricht"       element={<DesignWahl alt={<Navigate to="/admin/kurse" replace />} neu={<NeuAdminBereich bereich="unterricht" />} />} />
          <Route path="/admin/verwaltung"       element={<DesignWahl alt={<Navigate to="/admin" replace />} neu={<NeuAdminBereich bereich="verwaltung" />} />} />
          <Route path="/admin/ich"              element={<DesignWahl alt={<Navigate to="/einstellungen" replace />} neu={<NeuIch />} />} />
          <Route path="/admin/mitglieder"       element={<DesignWahl alt={<Mitgliederverwaltung />} neu={<NeuAdminMitglieder />} />} />
          <Route path="/admin/kurse"            element={<DesignWahl alt={<Kursverwaltung />} neu={<NeuLehrerKurse />} />} />
          <Route path="/admin/raeume"           element={<Raumverwaltung />} />
          <Route path="/admin/stundenplan"      element={<DesignWahl alt={<Stundenplan />} neu={<NeuLehrerTermine />} />} />
          <Route path="/admin/woche"            element={<DesignWahl alt={<Navigate to="/admin/stundenplan" replace />} neu={<NeuLehrerWoche />} />} />
          <Route path="/admin/stunde/:id"       element={<DesignWahl alt={<Navigate to="/admin/stundenplan" replace />} neu={<NeuStundeAbschliessen />} />} />
          <Route path="/admin/profil"            element={<DesignWahl alt={<ProfilSeite />} neu={<NeuProfil />} />} />
          <Route path="/admin/repertoire"       element={<DesignWahl alt={<Repertoire />} neu={<NeuLehrerLieder />} />} />
          <Route path="/admin/repertoire/:stueckId" element={<DesignWahl alt={<StueckDetail />} neu={<NeuLied />} />} />
          <Route path="/admin/repertoire/:stueckId/bearbeiten" element={<DesignWahl alt={<StueckDetail />} neu={<NeuLiedBearbeiten />} />} />
          <Route path="/admin/events"                                          element={<AdminEvents />} />
          <Route path="/admin/events/:id/repertoire"                         element={<DesignWahl alt={<EventRepertoire />} neu={<NeuLiederListe art="event" />} />} />
          <Route path="/admin/events/:kursId/repertoire/:stueckId"           element={<DesignWahl alt={<StueckDetail />} neu={<NeuLied />} />} />
          <Route path="/admin/kurse/:id"                                   element={<DesignWahl alt={<KursDetail />} neu={<NeuLehrerKurs />} />} />
          <Route path="/admin/kurse/:id/verwalten"                       element={<DesignWahl alt={<KursDetail />} neu={<NeuKursVerwalten />} />} />
          <Route path="/admin/kurse/:id/unterrichtsmodus"                element={<DesignWahl alt={<Unterrichtsmodus />} neu={<NeuLehrerLive />} />} />
          <Route path="/admin/kurse/:id/repertoire"                      element={<DesignWahl alt={<KursRepertoire />} neu={<NeuLiederListe art="kurs" />} />} />
          <Route path="/admin/kurse/:kursId/repertoire/:stueckId"        element={<DesignWahl alt={<StueckDetail />} neu={<NeuLied />} />} />
          <Route path="/admin/instrumente"      element={<Instrumente />} />
          <Route path="/admin/inventar"         element={<Inventar />} />
          <Route path="/admin/interessenten"    element={<DesignWahl alt={<Interessenten />} neu={<NeuAdminInteressenten />} />} />
          <Route path="/admin/rechnungen"       element={<Rechnungen />} />
          <Route path="/admin/nachrichten"      element={<DesignWahl alt={<Nachrichten />} neu={<NeuNachrichten />} />} />
          <Route path="/admin/tools"            element={<DesignWahl alt={<Tools />} neu={<NeuWerkzeuge />} />} />
          <Route path="/admin/einstellungen"    element={<AdminEinstellungen />} />
        </Route>
      </Route>

      {/* ── Lehrer ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['lehrer', 'admin', 'superadmin']} />}>
        <Route element={<LayoutWahl />}>
          <Route path="/lehrer"                 element={<DesignWahl alt={<LehrerDashboard />} neu={<NeuLehrerStart />} />} />
          <Route path="/lehrer/kurse"           element={<DesignWahl alt={<LehrerKurse />} neu={<NeuLehrerKurse />} />} />
          <Route path="/lehrer/kurse/alt"       element={<DesignWahl alt={<LehrerKurse />} neu={<Navigate to="/lehrer/kurse" replace />} />} />
          <Route path="/lehrer/kurse/:id"       element={<DesignWahl alt={<KursDetail />} neu={<NeuLehrerKurs />} />} />
          <Route path="/lehrer/kurse/:id/verwalten" element={<DesignWahl alt={<KursDetail />} neu={<NeuKursVerwalten />} />} />
          <Route path="/lehrer/stunde/:id"      element={<DesignWahl alt={<Navigate to="/lehrer" replace />} neu={<NeuStundeAbschliessen />} />} />
          <Route path="/lehrer/kurse/:id/repertoire" element={<DesignWahl alt={<KursRepertoire />} neu={<NeuLiederListe art="kurs" />} />} />
          <Route path="/lehrer/kurse/:kursId/repertoire/:stueckId" element={<DesignWahl alt={<StueckDetail />} neu={<NeuLied />} />} />
          <Route path="/lehrer/kurse/:id/unterrichtsmodus" element={<DesignWahl alt={<Unterrichtsmodus />} neu={<NeuLehrerLive />} />} />
          <Route path="/lehrer/schueler"        element={<DesignWahl alt={<LehrerSchueler />} neu={<NeuLehrerSchueler />} />} />
          <Route path="/lehrer/anwesenheit"     element={<DesignWahl alt={<Stundenplan />} neu={<NeuLehrerTermine />} />} />
          <Route path="/lehrer/stundenplan"     element={<DesignWahl alt={<Stundenplan />} neu={<NeuLehrerWoche />} />} />
          <Route path="/lehrer/repertoire"      element={<DesignWahl alt={<Repertoire />} neu={<NeuLehrerLieder />} />} />
          <Route path="/lehrer/repertoire/:stueckId" element={<DesignWahl alt={<StueckDetail />} neu={<NeuLied />} />} />
          <Route path="/lehrer/repertoire/:stueckId/bearbeiten" element={<DesignWahl alt={<StueckDetail />} neu={<NeuLiedBearbeiten />} />} />
          <Route path="/lehrer/events"                                         element={<DesignWahl alt={<LehrerEvents />} neu={<Navigate to="/lehrer/anwesenheit" replace />} />} />
          <Route path="/lehrer/events/:id/repertoire"                        element={<DesignWahl alt={<EventRepertoire />} neu={<NeuLiederListe art="event" />} />} />
          <Route path="/lehrer/events/:kursId/repertoire/:stueckId"          element={<DesignWahl alt={<StueckDetail />} neu={<NeuLied />} />} />
          <Route path="/lehrer/nachrichten"     element={<DesignWahl alt={<Nachrichten />} neu={<NeuNachrichten />} />} />
          <Route path="/lehrer/tools"           element={<DesignWahl alt={<Tools />} neu={<NeuWerkzeuge />} />} />
          <Route path="/lehrer/ich"             element={<DesignWahl alt={<Navigate to="/einstellungen" replace />} neu={<NeuIch />} />} />
          <Route path="/lehrer/profil"          element={<DesignWahl alt={<ProfilSeite />} neu={<NeuProfil />} />} />
        </Route>
      </Route>

      {/* ── Schüler ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['schueler']} />}>
        <Route element={<LayoutWahl />}>
          <Route path="/schueler"                     element={<DesignWahl alt={<SchuelerDashboard />} neu={<NeuStart />} />} />
          <Route path="/schueler/stundenplan"         element={<DesignWahl alt={<Stundenplan />} neu={<NeuTermine />} />} />
          <Route path="/schueler/ich"                 element={<DesignWahl alt={<Navigate to="/einstellungen" replace />} neu={<NeuIch />} />} />
          <Route path="/schueler/kurse"               element={<DesignWahl alt={<SchuelerKurse />} neu={<NeuKurse />} />} />
          <Route path="/schueler/kurse/:id"           element={<DesignWahl alt={<SchuelerKursDetail />} neu={<NeuKurs />} />} />
          <Route path="/schueler/kurse/:id/anwesenheit" element={<DesignWahl alt={<SchuelerAnwesenheit />} neu={<KursUmleitung />} />} />
          <Route path="/schueler/dateien"             element={<DesignWahl alt={<SchuelerDateien />} neu={<NeuDokumente />} />} />
          <Route path="/schueler/events"                                       element={<DesignWahl alt={<SchuelerEvents />} neu={<NeuTermine />} />} />
          <Route path="/schueler/events/:id/repertoire"                      element={<DesignWahl alt={<EventRepertoire />} neu={<NeuLiederListe art="event" />} />} />
          <Route path="/schueler/events/:kursId/repertoire/:stueckId"        element={<DesignWahl alt={<StueckDetail />} neu={<NeuLied />} />} />
          <Route path="/schueler/repertoire"         element={<DesignWahl alt={<Repertoire />} neu={<NeuLieder />} />} />
          <Route path="/schueler/repertoire/:stueckId" element={<DesignWahl alt={<StueckDetail />} neu={<NeuLied />} />} />
          <Route path="/schueler/nachrichten"         element={<DesignWahl alt={<Nachrichten />} neu={<NeuNachrichten />} />} />
          <Route path="/schueler/tools"              element={<DesignWahl alt={<Tools />} neu={<NeuWerkzeuge />} />} />
          <Route path="/schueler/faq"                element={<DesignWahl alt={<SchuelerFAQ />} neu={<NeuHilfe />} />} />
          <Route path="/schueler/profil"              element={<DesignWahl alt={<ProfilSeite />} neu={<NeuProfil />} />} />
        </Route>
      </Route>

      {/* ── Vorstand ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['vorstand', 'admin', 'superadmin']} />}>
        <Route element={<LayoutWahl />}>
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
          <Route path="/vorstand/inventar"              element={<Inventar />} />
          <Route path="/vorstand/tools"                 element={<Tools />} />
          <Route path="/vorstand/faq"                   element={<VorstandFAQ />} />
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
          <Route path="/eltern/tools"           element={<Tools />} />
        </Route>
      </Route>

      {/* ── Superadmin ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['superadmin']} />}>
        <Route element={<LayoutWahl />}>
          <Route path="/superadmin" element={<SuperadminDashboard />} />
          <Route path="/superadmin/demos" element={<SuperadminDemos />} />
        </Route>
      </Route>

      {/* ── Schul-Wähler (multi-tenant) ── */}
      <Route element={<ProtectedRoute erlaubteRollen={['admin','superadmin','lehrer','schueler','eltern','vorstand']} />}>
        <Route path="/schulen" element={<SchulWaehler />} />
      </Route>

      {/* Session beitreten */}
      <Route path="/session/:code" element={<SessionWahl />} />

      {/* Beamer-Anzeige */}
      <Route path="/beamer" element={<BeamerDisplay />} />

      {/* Einladungslink */}
      <Route path="/einladung/:token" element={<Einladung />} />

      {/* Öffentliche Seiten */}
      <Route path="/impressum"   element={<Impressum />} />
      <Route path="/datenschutz" element={<Datenschutz />} />
      <Route path="/lizenzen"    element={<Lizenzen />} />

      {/* Profil & Einstellungen - für alle Rollen */}
      <Route element={<ProtectedRoute erlaubteRollen={['admin','superadmin','lehrer','schueler','eltern','vorstand']} />}>
        <Route element={<LayoutWahl />}>
          <Route path="/profil"         element={<DesignWahl alt={<ProfilSeite />} neu={<NeuProfil />} />} />
          <Route path="/einstellungen"  element={<DesignWahl alt={<Einstellungen />} neu={<NeuEinstellungen />} />} />
          <Route path="/meine-dateien"  element={<DesignWahl alt={<MeineDateien />} neu={<NeuMeineDateien />} />} />
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
