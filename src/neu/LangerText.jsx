// Beschreibungstext mit Absätzen; längere Texte sind eingeklappt, bis „Mehr lesen“ gedrückt wird
import { useState } from 'react'
import { useApp } from '../context/AppContext'

// grobe Schätzung, reicht für die Entscheidung „einklappen oder nicht“
const ZEICHEN_JE_ZEILE = 45
export const istLang = (text, zeilen) => text.split('\n').reduce((n, z) => n + Math.max(1, Math.ceil(z.length / ZEICHEN_JE_ZEILE)), 0) > zeilen + 1

export default function LangerText({ text, zeilen = 4, style }) {
  const { T } = useApp()
  const [offen, setOffen] = useState(false)
  const inhalt = text?.trim()
  if (!inhalt) return null
  const lang = istLang(inhalt, zeilen)
  const zu = lang && !offen && { display: '-webkit-box', WebkitBoxOrient: 'vertical', WebkitLineClamp: zeilen, overflow: 'hidden' }
  return (
    <div style={style}>
      <div style={{ fontSize: 17, lineHeight: 1.5, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere', ...zu }}>{inhalt}</div>
      {lang && (
        <button type="button" aria-expanded={offen} onClick={() => setOffen(!offen)}
          style={{ minHeight: 44, padding: 0, border: 'none', background: 'none', fontFamily: 'inherit', fontSize: 17, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
          {T(offen ? 'n_weniger_lesen' : 'n_mehr_lesen')}
        </button>
      )}
    </div>
  )
}
