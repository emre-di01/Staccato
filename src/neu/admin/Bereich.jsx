import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile } from '../../ui'
import { adminBereiche } from './navigation'

const FARBEN = ['var(--primary)', '#2563EB', '#15803D', '#5B3A6E', '#B91C1C', 'var(--text-2)']

function Liste({ eintraege }) {
  const { T } = useApp()
  return (
    <Gruppe>
      {eintraege.map((e, i) => (
        <div key={e.to}>
          {i > 0 && <Trenner />}
          <Zeile icon={e.icon} iconFarbe={FARBEN[i % FARBEN.length]} titel={T(e.label)} untertitel={e.hinweis ? T(e.hinweis) : null} to={e.to} />
        </div>
      ))}
    </Gruppe>
  )
}

// Übersichtsseite eines Admin-Bereichs (Reiter „Unterricht“ bzw. „Verwaltung“)
export default function AdminBereich({ bereich }) {
  const { T, abo } = useApp()
  const b = adminBereiche(abo)

  if (bereich === 'unterricht') {
    return (
      <Seite titel={T('na_tab_unterricht')}>
        <div style={{ marginTop: 20 }}><Liste eintraege={b.unterricht} /></div>
      </Seite>
    )
  }

  return (
    <Seite titel={T('na_tab_verwaltung')}>
      <Abschnitt titel={T('na_schulbetrieb')} style={{ marginTop: 24 }}>
        <Liste eintraege={b.verwaltung.slice(0, -2)} />
      </Abschnitt>
      <Abschnitt titel={T('na_geld_und_schule')}>
        <Liste eintraege={b.verwaltung.slice(-2)} />
      </Abschnitt>
      {b.vorstand.length > 0 && (
        <Abschnitt titel={T('na_vorstand')}>
          <Liste eintraege={b.vorstand} />
        </Abschnitt>
      )}
    </Seite>
  )
}
