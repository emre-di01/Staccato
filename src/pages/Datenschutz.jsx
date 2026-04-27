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
      <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 32 }}>Stand: [DATUM]</p>

      <section style={sek}>
        <h2 style={h2}>1. Verantwortlicher</h2>
        <p style={p}>Verantwortlicher im Sinne der Datenschutz-Grundverordnung (DSGVO) ist:<br /><br />
        <strong>[NAME DER MUSIKSCHULE]</strong><br />
        [Straße und Hausnummer]<br />
        [PLZ] [Stadt]<br />
        E-Mail: <a href="mailto:[EMAIL]" style={link}>[EMAIL]</a><br />
        Telefon: [TELEFON]</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>2. Welche Daten wir verarbeiten</h2>
        <p style={p}>Im Rahmen des Betriebs unserer Musikschul-Verwaltungssoftware verarbeiten wir folgende personenbezogene Daten:</p>
        <ul style={ul}>
          <li><strong>Stammdaten:</strong> Name, E-Mail-Adresse, Telefonnummer, Geburtsdatum, Adresse</li>
          <li><strong>Nutzungsdaten:</strong> Anwesenheiten, Kurszuordnungen, Repertoire-Fortschritt</li>
          <li><strong>Technische Daten:</strong> Login-Zeitpunkte, Sitzungsinformationen</li>
          <li><strong>Einstellungen:</strong> Sprachpräferenz, Design-Einstellungen (lokal im Browser gespeichert)</li>
        </ul>
      </section>

      <section style={sek}>
        <h2 style={h2}>3. Zweck und Rechtsgrundlage</h2>
        <p style={p}>Die Verarbeitung der Daten erfolgt zur:</p>
        <ul style={ul}>
          <li>Verwaltung von Schüler- und Lehrerdaten (Art. 6 Abs. 1 lit. b DSGVO – Vertragserfüllung)</li>
          <li>Erfassung von Anwesenheiten und Unterrichtsplanung (Art. 6 Abs. 1 lit. b DSGVO)</li>
          <li>Kommunikation zwischen Lehrern, Schülern und Eltern (Art. 6 Abs. 1 lit. b DSGVO)</li>
          <li>Bereitstellung des Schülerportals und der Unterrichtsmaterialien (Art. 6 Abs. 1 lit. b DSGVO)</li>
        </ul>
      </section>

      <section style={sek}>
        <h2 style={h2}>4. Speicherung und Hosting</h2>
        <p style={p}>Alle Daten werden auf einem eigenen Server gespeichert, der sich in [SERVERSTANDORT, z.B. Deutschland] befindet. Es findet keine Übertragung an Dritte oder in Drittländer statt. Der Server wird betrieben von:<br /><br />
        [NAME DES HOSTERS / „Eigener Server"]<br />
        [Adresse des Hosters]</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>5. Cookies und lokale Speicherung</h2>
        <p style={p}>Diese Anwendung verwendet ausschließlich technisch notwendige Cookies und lokale Browserspeicherung (localStorage):</p>
        <ul style={ul}>
          <li><strong>Sitzungs-Cookie (Supabase Auth):</strong> Für die sichere Anmeldung und Authentifizierung. Wird beim Abmelden gelöscht. Rechtsgrundlage: Art. 6 Abs. 1 lit. b DSGVO</li>
          <li><strong>Design-Einstellungen:</strong> Theme, Dark Mode und Sprache werden lokal im Browser gespeichert (kein Server-Zugriff). Rechtsgrundlage: Art. 6 Abs. 1 lit. f DSGVO (berechtigtes Interesse)</li>
        </ul>
        <p style={{ ...p, marginTop: 10 }}>Es werden keine Tracking-, Analyse- oder Werbe-Cookies eingesetzt.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>6. Weitergabe an Dritte</h2>
        <p style={p}>Eine Weitergabe Ihrer Daten an Dritte findet grundsätzlich nicht statt, außer wenn wir dazu gesetzlich verpflichtet sind oder Sie ausdrücklich eingewilligt haben.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>7. Speicherdauer</h2>
        <p style={p}>Personenbezogene Daten werden gelöscht, sobald sie für den Zweck ihrer Erhebung nicht mehr benötigt werden, spätestens jedoch nach Beendigung des Vertragsverhältnisses und Ablauf gesetzlicher Aufbewahrungsfristen (i. d. R. 10 Jahre für steuerrelevante Unterlagen).</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>8. Ihre Rechte</h2>
        <p style={p}>Sie haben gegenüber uns folgende Rechte hinsichtlich Ihrer personenbezogenen Daten:</p>
        <ul style={ul}>
          <li><strong>Auskunft</strong> (Art. 15 DSGVO): Sie können jederzeit Auskunft über Ihre gespeicherten Daten verlangen.</li>
          <li><strong>Berichtigung</strong> (Art. 16 DSGVO): Sie können die Korrektur unrichtiger Daten verlangen.</li>
          <li><strong>Löschung</strong> (Art. 17 DSGVO): Sie können die Löschung Ihrer Daten verlangen, sofern keine gesetzliche Aufbewahrungspflicht besteht.</li>
          <li><strong>Einschränkung</strong> (Art. 18 DSGVO): Sie können die Einschränkung der Verarbeitung verlangen.</li>
          <li><strong>Datenübertragbarkeit</strong> (Art. 20 DSGVO): Sie können Ihre Daten in einem gängigen Format herausverlangen.</li>
          <li><strong>Widerspruch</strong> (Art. 21 DSGVO): Sie können der Verarbeitung widersprechen.</li>
        </ul>
        <p style={{ ...p, marginTop: 10 }}>Zur Ausübung Ihrer Rechte wenden Sie sich an: <a href="mailto:[EMAIL]" style={link}>[EMAIL]</a></p>
      </section>

      <section style={sek}>
        <h2 style={h2}>9. Beschwerderecht</h2>
        <p style={p}>Sie haben das Recht, sich bei der zuständigen Datenschutz-Aufsichtsbehörde zu beschweren. Die zuständige Behörde in [BUNDESLAND] ist:<br /><br />
        [NAME DER AUFSICHTSBEHÖRDE]<br />
        [Adresse der Aufsichtsbehörde]<br />
        <a href="[WEBSITE AUFSICHTSBEHÖRDE]" style={link}>[WEBSITE AUFSICHTSBEHÖRDE]</a></p>
      </section>

      <section style={sek}>
        <h2 style={h2}>10. Datensicherheit</h2>
        <p style={p}>Wir setzen technische und organisatorische Sicherheitsmaßnahmen ein, um Ihre Daten gegen Manipulation, Verlust oder unberechtigten Zugriff zu schützen. Dazu gehören verschlüsselte Übertragung (HTTPS/TLS), Passwortverschlüsselung (bcrypt) sowie rollenbasierte Zugriffskontrollen.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>11. Minderjährige</h2>
        <p style={p}>Sofern Schülerinnen und Schüler unter 16 Jahren in unserem System erfasst werden, erfolgt dies auf Grundlage der Einwilligung der Erziehungsberechtigten. Die Erziehungsberechtigten können jederzeit Auskunft, Berichtigung oder Löschung der Daten ihrer Kinder verlangen.</p>
      </section>
    </div>
  )
}

const sek  = { marginBottom: 32 }
const h2   = { fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }
const p    = { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }
const ul   = { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.8, paddingLeft: 20, margin: '10px 0 0' }
const link = { color: 'var(--primary)', textDecoration: 'none' }
