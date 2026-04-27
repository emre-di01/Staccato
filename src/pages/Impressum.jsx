import { useNavigate } from 'react-router-dom'

export default function Impressum() {
  const navigate = useNavigate()
  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '40px 24px' }}>
      <button onClick={() => navigate(-1)}
        style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 24px', display:'block' }}>
        ← Zurück
      </button>

      <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Impressum</h1>
      <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 32 }}>Angaben gemäß § 5 TMG</p>

      <section style={sek}>
        <h2 style={h2}>Anbieter</h2>
        <p style={p}><strong>[NAME DER MUSIKSCHULE]</strong><br />
        [Straße und Hausnummer]<br />
        [PLZ] [Stadt]<br />
        Deutschland</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>Kontakt</h2>
        <p style={p}>
          Telefon: <a href="tel:[TELEFON]" style={link}>[TELEFON]</a><br />
          E-Mail: <a href="mailto:[EMAIL]" style={link}>[EMAIL]</a><br />
          Website: <a href="[WEBSITE]" style={link}>[WEBSITE]</a>
        </p>
      </section>

      <section style={sek}>
        <h2 style={h2}>Verantwortlich für den Inhalt (§ 55 Abs. 2 RStV)</h2>
        <p style={p}>[NAME DES VERANTWORTLICHEN]<br />
        [Anschrift wie oben]</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>Umsatzsteuer-ID</h2>
        <p style={p}>Umsatzsteuer-Identifikationsnummer gemäß §27a Umsatzsteuergesetz:<br />
        [UST-ID ODER „Nicht umsatzsteuerpflichtig"]</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>Haftung für Inhalte</h2>
        <p style={p}>Als Diensteanbieter sind wir gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG sind wir als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>Streitschlichtung</h2>
        <p style={p}>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr" style={link}>https://ec.europa.eu/consumers/odr</a>. Unsere E-Mail-Adresse finden Sie oben im Impressum. Wir sind nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </section>
    </div>
  )
}

const sek  = { marginBottom: 32 }
const h2   = { fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }
const p    = { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }
const link = { color: 'var(--primary)', textDecoration: 'none' }
