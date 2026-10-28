import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { DESIGN_ROLLEN } from './rolle'

// Hinweis in der alten Oberfläche: lädt zum Ausprobieren des neuen Designs ein
const LS_KEY = 'staccato_neu_hinweis_weg'

export default function NeuesDesignHinweis() {
  const { T, rolle, neuesDesign, setNeuesDesign } = useApp()
  const [weg, setWeg] = useState(() => { try { return localStorage.getItem(LS_KEY) === '1' } catch { return false } })
  if (!DESIGN_ROLLEN.includes(rolle) || neuesDesign || weg) return null

  function spaeter() {
    try { localStorage.setItem(LS_KEY, '1') } catch { /* privat */ }
    setWeg(true)
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap', padding: '16px 18px', marginBottom: 20, borderRadius: 'var(--radius-lg)', background: 'color-mix(in srgb, var(--primary) 10%, var(--surface))', border: '1.5px solid var(--primary)' }}>
      <div style={{ flex: '1 1 240px' }}>
        <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>✨ {T('n_hinweis_titel')}</div>
        <div style={{ fontSize: 15, color: 'var(--text-2)', marginTop: 4, lineHeight: 1.5 }}>{T('n_hinweis_text')}</div>
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button onClick={spaeter} style={{ minHeight: 44, padding: '0 16px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--surface)', color: 'var(--text-2)', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}>{T('n_spaeter')}</button>
        <button onClick={() => setNeuesDesign(true)} style={{ minHeight: 44, padding: '0 18px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontFamily: 'inherit', fontSize: 15, fontWeight: 700, cursor: 'pointer' }}>{T('n_ausprobieren')}</button>
      </div>
    </div>
  )
}
