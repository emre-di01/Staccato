import { useNavigate } from 'react-router-dom'

export default function Datenschutz() {
  const navigate = useNavigate()
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <button onClick={() => navigate(-1)}
        style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 24px', display:'block' }}>
        ← Zurück
      </button>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Datenschutzerklärung</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 32 }}>Stand: Mai 2026</p>

      <section style={sek}>
        <h2 style={h2}>1. Verantwortlicher</h2>
        <p style={p}>
          Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:<br /><br />
          <strong>Emre Dingil</strong><br />
          Adolf-Leweke-Str. 14<br />
          60435 Frankfurt am Main<br />
          E-Mail: <a href="mailto:staccato@401dev.de" style={link}>staccato@401dev.de</a>
        </p>
      </section>

      <section style={sek}>
        <h2 style={h2}>2. Art der Plattform</h2>
        <p style={p}>Staccato ist eine Musikschul-Verwaltungssoftware, die als privates Hobby-Projekt entwickelt und betrieben wird. Die Plattform wird einzelnen Musikschulen zur Verwaltung ihrer Schüler, Kurse und Lehrpläne bereitgestellt. Die jeweilige Musikschule ist datenschutzrechtlich eigenverantwortlicher Verantwortlicher für die von ihr eingegebenen Daten ihrer Mitglieder.</p>
        <p style={{ ...p, marginTop: 10 }}>Staccato ist verfügbar als Web-App (<strong>app.staccato-music.de</strong>) sowie als native Android-App im <strong>Google Play Store</strong>. Beide Varianten greifen auf dieselbe Server-Infrastruktur zu und unterliegen denselben Datenschutzbestimmungen.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>3. Welche Daten verarbeitet werden</h2>
        <p style={p}>Im Rahmen des Betriebs der Plattform werden folgende personenbezogene Daten verarbeitet:</p>
        <ul style={ul}>
          <li><strong>Stammdaten:</strong> Name, E-Mail-Adresse, Telefonnummer, Geburtsdatum, Adresse</li>
          <li><strong>Nutzungsdaten:</strong> Anwesenheiten, Kurszuordnungen, Repertoire-Fortschritt, Unterrichtsprotokolle</li>
          <li><strong>Technische Daten:</strong> Login-Zeitpunkte, Sitzungsinformationen (Session-Token), Push-Notification-Token (gerätegebundener Bezeichner für Benachrichtigungen via Web Push oder Firebase Cloud Messaging, nur bei aktivierten Push-Benachrichtigungen)</li>
          <li><strong>Einstellungen:</strong> Sprachpräferenz, Design (lokal im Gerätespeicher, kein Server-Zugriff)</li>
          <li><strong>Dateien:</strong> Hochgeladene Dokumente (z. B. Aufnahmeformulare, Noten, Audiodateien)</li>
        </ul>
      </section>

      <section style={sek}>
        <h2 style={h2}>4. Zweck und Rechtsgrundlage</h2>
        <p style={p}>Die Verarbeitung der Daten erfolgt ausschließlich zum Zweck des Betriebs der Musikschul-Verwaltungsplattform:</p>
        <ul style={ul}>
          <li>Verwaltung von Schüler-, Lehrer- und Mitgliedsdaten (Art. 6 Abs. 1 lit. b DSGVO)</li>
          <li>Anwesenheitserfassung und Unterrichtsplanung (Art. 6 Abs. 1 lit. b DSGVO)</li>
          <li>Kommunikation zwischen Lehrern, Schülern und Eltern (Art. 6 Abs. 1 lit. b DSGVO)</li>
          <li>Bereitstellung von Unterrichtsmaterialien und Repertoire (Art. 6 Abs. 1 lit. b DSGVO)</li>
          <li>Vereinsverwaltung (Ziele, Protokolle, Inventar) für Vorstandsmitglieder (Art. 6 Abs. 1 lit. b DSGVO)</li>
        </ul>
      </section>

      <section style={sek}>
        <h2 style={h2}>5. Hosting und Speicherung</h2>
        <p style={p}>
          Alle Daten werden auf einem eigenen Server gespeichert, der sich in Deutschland befindet. Die Datenbankinfrastruktur basiert auf <strong>Supabase (selbst gehostet)</strong>. Es findet keine Übertragung personenbezogener Daten in Drittländer außerhalb der EU statt.<br /><br />
          Dateien (Noten, Audiodateien, Dokumente) werden verschlüsselt in einem internen Objekt-Storage abgelegt und sind ausschließlich über zeitlich begrenzte, signierte URLs zugänglich.
        </p>
      </section>

      <section style={sek}>
        <h2 style={h2}>6. Lokale Speicherung / Cookies</h2>
        <p style={p}>Die Web-App (<strong>app.staccato-music.de</strong>) speichert ausschließlich technisch notwendige Daten lokal auf dem Gerät — es werden keine Tracking-Cookies gesetzt:</p>
        <ul style={ul}>
          <li><strong>Sitzungsdaten (Supabase Auth):</strong> Für sichere Anmeldung und Authentifizierung. Werden beim Abmelden gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO</li>
          <li><strong>Design-Einstellungen:</strong> Theme, Dark Mode und Sprache (kein Server-Zugriff). Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO</li>
          <li><strong>Versionsinformation:</strong> Gesehene Changelog-Version (kein Server-Zugriff). Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO</li>
          <li><strong>Push-Notification-Token:</strong> Gerätegebundener Token für den Empfang von Push-Benachrichtigungen (Web Push via OneSignal im Browser; Firebase Cloud Messaging in der Android-App). Wird auf dem Server gespeichert, solange Push-Benachrichtigungen aktiviert sind. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO</li>
        </ul>
        <p style={{ ...p, marginTop: 16 }}>Auf der <strong>Marketingwebsite (staccato-music.de)</strong> wird Google Analytics eingesetzt — ausschließlich nach Ihrer ausdrücklichen Einwilligung (Cookie-Banner). Google Analytics setzt Cookies (<code>_ga</code>, <code>_ga_*</code>) zur Analyse des Nutzungsverhaltens. IP-Adressen werden anonymisiert. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO. Sie können Ihre Einwilligung jederzeit widerrufen, indem Sie den Browser-Speicher (localStorage) löschen.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>7. Drittdienste</h2>
        <p style={p}><strong>Google Analytics 4</strong> (nur auf staccato-music.de, nach Einwilligung): Google Ireland Ltd., Gordon House, Barrow Street, Dublin 4, Irland. IP-Adressen werden anonymisiert. Rechtsgrundlage: Art. 6 Abs. 1 lit. a DSGVO. Weitere Informationen: <a href="https://policies.google.com/privacy" style={link} target="_blank" rel="noreferrer">policies.google.com/privacy</a></p>
        <p style={{ ...p, marginTop: 12 }}><strong>Firebase Cloud Messaging (FCM)</strong> (nur Android-App, nur bei aktivierten Push-Benachrichtigungen): Google Ireland Ltd. FCM wird genutzt, um Push-Benachrichtigungen an Android-Geräte zu übermitteln. Dabei wird ein gerätegebundenes FCM-Token erzeugt und auf unserem Server gespeichert. Das Token enthält keine personenbezogenen Daten, ermöglicht jedoch die gezielte Zustellung von Benachrichtigungen an ein bestimmtes Gerät. Das Token wird gelöscht, sobald Push-Benachrichtigungen in den Einstellungen deaktiviert oder das Konto gelöscht wird. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO. Weitere Informationen: <a href="https://firebase.google.com/support/privacy" style={link} target="_blank" rel="noreferrer">firebase.google.com/support/privacy</a></p>
        <p style={{ ...p, marginTop: 12 }}><strong>OneSignal</strong> (nur Web-App, nur bei aktivierten Push-Benachrichtigungen): OneSignal, Inc., 2850 S Delaware St, Suite 201, San Mateo, CA 94403, USA. OneSignal wird für die Zustellung von Web-Push-Benachrichtigungen im Browser verwendet. Dabei wird ein Subscription-Token gespeichert. OneSignal verarbeitet Daten auf Basis eines Auftragsverarbeitungsvertrags (Art. 28 DSGVO) und des EU-US Data Privacy Frameworks. Weitere Informationen: <a href="https://onesignal.com/privacy_policy" style={link} target="_blank" rel="noreferrer">onesignal.com/privacy_policy</a></p>
        <p style={{ ...p, marginTop: 12 }}>Im Bereich der Web-App und der Android-App findet darüber hinaus keine Weitergabe personenbezogener Daten an Dritte statt.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>8. Speicherdauer</h2>
        <p style={p}>Personenbezogene Daten werden gelöscht, sobald sie für den Zweck ihrer Erhebung nicht mehr benötigt werden — in der Regel nach Beendigung der Mitgliedschaft in der jeweiligen Musikschule. Steuerrelevante Unterlagen werden gemäß gesetzlicher Aufbewahrungsfristen aufbewahrt (i. d. R. 10 Jahre).</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>9. Selbstauskunft, Datenexport und Kontolöschung</h2>
        <p style={p}>
          Sie können jederzeit eine Kopie aller über Sie gespeicherten personenbezogenen Daten herunterladen
          sowie Ihr Konto und alle zugehörigen Daten sofort und unwiderruflich selbst löschen (Art. 15, 17, 20 DSGVO).
          Die Löschung umfasst Stammdaten, Nutzungsdaten, hochgeladene Dateien und Push-Notification-Tokens.
        </p>
        <p style={{ ...p, marginTop: 10 }}>
          <strong>Daten exportieren:</strong> Profil → „Meine Daten (DSGVO Art. 15)" → „Daten herunterladen" — sofortiger Download als JSON-Datei.<br />
          <strong>Konto löschen:</strong> Profil → „Konto löschen" → Bestätigung mit „LÖSCHEN" — sofortige, unwiderrufliche Löschung.<br />
          <strong>Per E-Mail:</strong> <a href="mailto:staccato@401dev.de?subject=Kontolöschung%20beantragen" style={link}>staccato@401dev.de</a>
        </p>
        <p style={{ ...p, marginTop: 10 }}>Gesetzliche Aufbewahrungspflichten (z.&nbsp;B. steuerrelevante Unterlagen) bleiben davon unberührt.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>10. Ihre weiteren Rechte</h2>
        <p style={p}>Sie haben gegenüber dem Verantwortlichen folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:</p>
        <ul style={ul}>
          <li><strong>Auskunft</strong> (Art. 15 DSGVO): Jederzeit Auskunft über Ihre gespeicherten Daten</li>
          <li><strong>Berichtigung</strong> (Art. 16 DSGVO): Korrektur unrichtiger Daten</li>
          <li><strong>Löschung</strong> (Art. 17 DSGVO): Löschung Ihrer Daten, sofern keine gesetzliche Aufbewahrungspflicht besteht</li>
          <li><strong>Einschränkung</strong> (Art. 18 DSGVO): Einschränkung der Verarbeitung</li>
          <li><strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO): Daten in einem gängigen Format erhalten</li>
          <li><strong>Widerspruch</strong> (Art. 21 DSGVO): Widerspruch gegen die Verarbeitung</li>
        </ul>
        <p style={{ ...p, marginTop: 10 }}>Zur Ausübung Ihrer Rechte wenden Sie sich an: <a href="mailto:staccato@401dev.de" style={link}>staccato@401dev.de</a></p>
      </section>

      <section style={sek}>
        <h2 style={h2}>11. Beschwerderecht</h2>
        <p style={p}>
          Sie haben das Recht, sich bei der zuständigen Datenschutz-Aufsichtsbehörde zu beschweren. Die zuständige Behörde für Hessen ist:<br /><br />
          <strong>Der Hessische Beauftragte für Datenschutz und Informationsfreiheit (HBDI)</strong><br />
          Gustav-Stresemann-Ring 1<br />
          65189 Wiesbaden<br />
          <a href="https://datenschutz.hessen.de" style={link}>https://datenschutz.hessen.de</a>
        </p>
      </section>

      <section style={sek}>
        <h2 style={h2}>12. Datensicherheit</h2>
        <p style={p}>Die Plattform setzt folgende technische und organisatorische Sicherheitsmaßnahmen ein:</p>
        <ul style={ul}>
          <li>Verschlüsselte Übertragung aller Daten via HTTPS/TLS</li>
          <li>Passwortverschlüsselung mit bcrypt</li>
          <li>Rollenbasierte Zugriffskontrollen (Row Level Security auf Datenbankebene)</li>
          <li>Signierte, zeitlich begrenzte URLs für Dateizugriffe (1 Stunde Gültigkeit)</li>
          <li>Keine öffentlichen Datenbankzugriffe ohne Authentifizierung</li>
        </ul>
      </section>

      <section style={sek}>
        <h2 style={h2}>13. Minderjährige</h2>
        <p style={p}>Sofern Schülerinnen und Schüler unter 16 Jahren in der Plattform erfasst werden, erfolgt dies auf Grundlage der Einwilligung der Erziehungsberechtigten durch die jeweilige Musikschule. Erziehungsberechtigte können jederzeit Auskunft, Berichtigung oder Löschung der Daten ihrer Kinder verlangen.</p>
      </section>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-3)' }}>
        <a href="/impressum" style={link}>Impressum</a>
        <a href="/lizenzen" style={link}>Open-Source-Lizenzen</a>
      </div>
    </div>
  )
}

const sek  = { marginBottom: 32 }
const h2   = { fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }
const p    = { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }
const ul   = { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8, paddingLeft: 20, margin: '10px 0 0' }
const link = { color: 'var(--primary)', textDecoration: 'none' }
