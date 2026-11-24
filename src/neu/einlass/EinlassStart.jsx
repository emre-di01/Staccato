// Startseite: am Veranstaltungstag direkt zum Scannen (nur für Admins und freigegebene Personen)
import { Link } from 'react-router-dom'
import { ScanLine } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { useScanEvents } from '../tickets'

export default function EinlassStart() {
  const { T } = useApp()
  const { data = [] } = useScanEvents()
  return data.filter(e => e.scanbar).slice(0, 2).map(e => (
    <section key={e.id} aria-label={`${T('ei_titel')}: ${e.titel}`} style={{ margin: '16px 20px 0', padding: 22, borderRadius: 24, background: 'var(--n-fill)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div>
        <div style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-2)' }}>{T('ei_titel')}</div>
        <div style={{ fontSize: 22, fontWeight: 800, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{e.titel}</div>
      </div>
      <Link to={`/einlass?event=${e.id}`} style={{ height: 60, borderRadius: 16, background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 19, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, textDecoration: 'none' }}>
        <ScanLine aria-hidden="true" size={24} />{T('ei_scannen')}
      </Link>
    </section>
  ))
}
