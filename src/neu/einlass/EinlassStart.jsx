// Startseite: Scannen und Kasse für Admins und freigegebene Personen
import { Link } from 'react-router-dom'
import { Banknote, ScanLine } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useScanEvents, useKassenEvents } from '../tickets'

export default function EinlassStart() {
  const { T } = useApp()
  const { data: scan = [] } = useScanEvents()
  const { data: kasse = [] } = useKassenEvents()
  // Scannen am Veranstaltungstag; Kasse, sobald sie offen ist – Kassenhelfer schon vorher, um Reservierungen zu kassieren
  const karten = new Map()
  for (const e of scan.filter(x => x.scanbar)) karten.set(e.id, { id: e.id, titel: e.titel, scannen: true })
  for (const e of kasse.filter(x => x.offen || x.helfer)) karten.set(e.id, { ...karten.get(e.id), id: e.id, titel: e.titel, kasse: true })
  return [...karten.values()].slice(0, 3).map(e => (
    <section key={e.id} aria-label={`${T('ei_titel')}: ${e.titel}`} style={{ margin: '16px 20px 0', padding: 22, borderRadius: 24, background: 'var(--n-fill)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)' }}>{T(e.scannen ? 'ei_titel' : 'ka_titel')}</div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{e.titel}</div>
      </div>
      {e.scannen && <Link to={`/einlass?event=${e.id}`} style={{ ...knopf, background: 'var(--primary)', color: 'var(--primary-fg)' }}><ScanLine aria-hidden="true" size={24} />{T('ei_scannen')}</Link>}
      {e.kasse && <Link to={`/kasse?event=${e.id}`} style={{ ...knopf, background: e.scannen ? 'var(--bg)' : 'var(--primary)', color: e.scannen ? 'var(--text)' : 'var(--primary-fg)' }}><Banknote aria-hidden="true" size={24} />{T('ka_oeffnen')}</Link>}
    </section>
  ))
}

const knopf = { height: 60, borderRadius: 16, fontSize: 19, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none' }
