import { useApp } from '../context/AppContext'

// Reine Zahl wird zu „80 BPM“, Freitext wie „Andante / 80“ bleibt unverändert
export function liedAngaben(stueck, T) {
  const tempo = String(stueck.tempo ?? '').trim()
  return [
    [T('piece_key'), stueck.tonart],
    [T('piece_takt'), stueck.takt],
    [T('piece_tempo'), /^\d+$/.test(tempo) ? `${tempo} ${T('tools_bpm')}` : tempo],
  ].filter(([, wert]) => wert)
}

// Kurzform für Listen: „C-Dur · 4/4 · 80 BPM“
export function liedDetails(stueck, T) {
  return liedAngaben(stueck, T).map(([, wert]) => wert).join(' · ') || null
}

// Untertitel einer Liederliste: erste Zeile (z. B. Komponist), darunter Tonart/Takt/Tempo
export function liedUntertitel(erste, stueck, T) {
  const details = liedDetails(stueck, T)
  if (!details) return erste || null
  return <>{erste}<span style={{ display: 'block' }}>{details}</span></>
}

// Tonart, Takt und Tempo als Chips auf dem farbigen Liedgrund
export default function LiedAngaben({ stueck, style }) {
  const { T } = useApp()
  const angaben = liedAngaben(stueck, T)
  if (angaben.length === 0) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, ...style }}>
      {angaben.map(([label, wert]) => (
        <span key={label} style={{ minHeight: 32, padding: '4px 12px', borderRadius: 16, background: 'rgba(0,0,0,0.22)', color: '#FFFFFF', fontSize: 16, display: 'inline-flex', alignItems: 'baseline', gap: 6, overflowWrap: 'anywhere' }}>
          <span style={{ color: '#E8EEF2' }}>{label}</span>
          <strong style={{ fontWeight: 700 }}>{wert}</strong>
        </span>
      ))}
    </div>
  )
}
