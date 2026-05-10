import { useNavigate } from 'react-router-dom'

export default function Impressum() {
  const navigate = useNavigate()
  const darkMode = localStorage.getItem('staccato_dark') === 'true'
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
        <p style={p}>
          <strong>Emre Dingil</strong><br />
          Adolf-Leweke-Str. 14<br />
          60435 Frankfurt am Main<br />
          Deutschland
        </p>
      </section>

      <section style={sek}>
        <h2 style={h2}>Kontakt</h2>
        <p style={p}>
          E-Mail: <a href="mailto:staccato@401dev.de" style={link}>staccato@401dev.de</a><br />
          Website: <a href="https://401dev.de" style={link}>https://401dev.de</a>
        </p>
      </section>

      <section style={sek}>
        <h2 style={h2}>Verantwortlich für den Inhalt (§ 55 Abs. 2 RStV)</h2>
        <p style={p}>
          Emre Dingil<br />
          Adolf-Leweke-Str. 14<br />
          60435 Frankfurt am Main
        </p>
      </section>

      <section style={sek}>
        <h2 style={h2}>Umsatzsteuer</h2>
        <p style={p}>Diese Plattform wird als privates, nicht-kommerzielles Hobby-Projekt betrieben. Es besteht keine Umsatzsteuerpflicht.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>Haftung für Inhalte</h2>
        <p style={p}>Als Diensteanbieter bin ich gemäß § 7 Abs. 1 TMG für eigene Inhalte auf diesen Seiten nach den allgemeinen Gesetzen verantwortlich. Nach §§ 8 bis 10 TMG bin ich als Diensteanbieter jedoch nicht verpflichtet, übermittelte oder gespeicherte fremde Informationen zu überwachen oder nach Umständen zu forschen, die auf eine rechtswidrige Tätigkeit hinweisen. Verpflichtungen zur Entfernung oder Sperrung der Nutzung von Informationen nach den allgemeinen Gesetzen bleiben hiervon unberührt.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>Haftung für Links</h2>
        <p style={p}>Mein Angebot enthält Links zu externen Websites Dritter, auf deren Inhalte ich keinen Einfluss habe. Deshalb kann ich für diese fremden Inhalte auch keine Gewähr übernehmen. Für die Inhalte der verlinkten Seiten ist stets der jeweilige Anbieter oder Betreiber der Seiten verantwortlich.</p>
      </section>

      <section style={sek}>
        <h2 style={h2}>Streitschlichtung</h2>
        <p style={p}>Die Europäische Kommission stellt eine Plattform zur Online-Streitbeilegung (OS) bereit: <a href="https://ec.europa.eu/consumers/odr" style={link}>https://ec.europa.eu/consumers/odr</a>. Ich bin nicht bereit oder verpflichtet, an Streitbeilegungsverfahren vor einer Verbraucherschlichtungsstelle teilzunehmen.</p>
      </section>

      <div style={{ marginTop: 48, paddingTop: 24, borderTop: '1px solid var(--border)', display: 'flex', gap: 20, fontSize: 13, color: 'var(--text-3)' }}>
        <a href="/datenschutz" style={link}>Datenschutzerklärung</a>
        <a href="/lizenzen" style={link}>Open-Source-Lizenzen</a>
      </div>

    </div>
  )
}

const sek  = { marginBottom: 32 }
const h2   = { fontSize: 17, fontWeight: 700, color: 'var(--text)', marginBottom: 10, paddingBottom: 6, borderBottom: '1px solid var(--border)' }
const p    = { fontSize: 14, color: 'var(--text-2)', lineHeight: 1.7, margin: 0 }
const link = { color: 'var(--primary)', textDecoration: 'none' }
