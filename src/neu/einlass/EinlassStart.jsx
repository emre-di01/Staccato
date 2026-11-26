// Startseite: Scannen und Kasse für Admins und freigegebene Personen
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Banknote, ScanLine, ScanSearch } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useScanEvents, useKassenEvents } from '../tickets'

export default function EinlassStart() {
  const { T } = useApp()
  const { data: scan = [] } = useScanEvents(true)
  const { data: kasse = [] } = useKassenEvents(true)
  // Auch ohne Verbindung und bei lange offener App verschwindet die Karte nach dem Ende der Veranstaltung
  const [jetzt, setJetzt] = useState(Date.now)
  useEffect(() => {
    const uhr = () => setJetzt(Date.now())
    const t = setInterval(uhr, 60000)
    document.addEventListener('visibilitychange', uhr)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', uhr) }
  }, [])
  const laeuft = e => !e.bis || jetzt <= Date.parse(e.bis)
  // Scannen am Veranstaltungstag, Helfer schon vorher zum Üben (Prüfmodus); Kasse, sobald sie offen ist – Kassenhelfer schon vorher, um Reservierungen zu kassieren
  const karten = new Map()
  for (const e of scan.filter(x => (x.scanbar || x.helfer) && laeuft(x))) karten.set(e.id, { id: e.id, titel: e.titel, scannen: true, ueben: !e.scanbar })
  for (const e of kasse.filter(x => (x.offen || x.helfer) && laeuft(x))) karten.set(e.id, { ...karten.get(e.id), id: e.id, titel: e.titel, kasse: true })
  return [...karten.values()].slice(0, 3).map(e => (
    <section key={e.id} aria-label={`${T('ei_titel')}: ${e.titel}`} style={{ margin: '16px 20px 0', padding: 22, borderRadius: 24, background: 'var(--n-fill)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)' }}>{T(e.scannen ? 'ei_titel' : 'ka_titel')}</div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{e.titel}</div>
      </div>
      {e.scannen && <Link to={`/einlass?event=${e.id}`} style={{ ...knopf, background: 'var(--primary)', color: 'var(--primary-fg)' }}>{e.ueben ? <ScanSearch aria-hidden="true" size={24} /> : <ScanLine aria-hidden="true" size={24} />}{T(e.ueben ? 'ei_ueben' : 'ei_scannen')}</Link>}
      {e.kasse && <Link to={`/kasse?event=${e.id}`} style={{ ...knopf, background: e.scannen ? 'var(--bg)' : 'var(--primary)', color: e.scannen ? 'var(--text)' : 'var(--primary-fg)' }}><Banknote aria-hidden="true" size={24} />{T('ka_oeffnen')}</Link>}
    </section>
  ))
}

const knopf = { height: 60, borderRadius: 16, fontSize: 19, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none' }
