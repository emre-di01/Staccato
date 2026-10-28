import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { UI_CSS } from '../../ui'
import { AppZeichen } from '../auth/Rahmen'

// ─── Rahmen für Impressum, Datenschutz, Lizenzen (öffentlich, ohne App-Hülle) ──
// Rechtstexte bleiben deutsch; nur Bedienelemente sind übersetzt.
export default function RechtsRahmen({ titel, unter, children }) {
  const { T } = useApp()
  const navigate = useNavigate()
  const zurueck = () => (window.history.length > 1 ? navigate(-1) : navigate('/'))
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)' }}>
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '12px 16px 0', minHeight: 56, display: 'flex', alignItems: 'center' }}>
        <button onClick={zurueck} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 44, padding: '0 10px 0 0', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 17, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
          <ChevronLeft aria-hidden="true" size={24} />{T('back')}
        </button>
      </div>
      <main className="n-seite" style={{ maxWidth: 760, margin: '0 auto', padding: '16px 20px 32px', boxSizing: 'border-box' }}>
        <AppZeichen />
        <h1 style={{ margin: '24px 0 0', fontSize: 34, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>{titel}</h1>
        {unter && <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.5, color: 'var(--text-2)' }}>{unter}</p>}
        <div style={{ marginTop: 32 }}>{children}</div>
      </main>
      <footer style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '0 24px', padding: '8px 20px calc(24px + env(safe-area-inset-bottom, 0px))', borderTop: '1px solid var(--n-sep, var(--border))' }}>
        <a href="/impressum" style={fussLink}>{T('nau_impressum')}</a>
        <a href="/datenschutz" style={fussLink}>{T('nau_datenschutz')}</a>
        <a href="/lizenzen" style={fussLink}>{T('nre_lizenzen')}</a>
      </footer>
      <style>{UI_CSS}</style>
    </div>
  )
}

const fussLink = { fontSize: 15, color: 'var(--text-2)', textDecoration: 'none', padding: '12px 0' }

// Gemeinsame Textstile der Rechtsseiten
export const sek  = { marginBottom: 32 }
export const h2   = { fontSize: 20, fontWeight: 700, color: 'var(--text)', margin: '0 0 10px', letterSpacing: '-0.01em' }
export const p    = { fontSize: 17, color: 'var(--text-2)', lineHeight: 1.6, margin: 0 }
export const ul   = { fontSize: 17, color: 'var(--text-2)', lineHeight: 1.6, paddingLeft: 22, margin: '10px 0 0' }
export const link = { color: 'var(--primary)', textDecoration: 'underline', textUnderlineOffset: 2, overflowWrap: 'anywhere' }
