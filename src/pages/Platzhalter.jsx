import { useApp } from '../context/AppContext'

export default function Platzhalter({ titel, icon = '🚧' }) {
  const { T } = useApp()
  return (
    <div>
      <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.5px' }}>
        {icon} {titel}
      </h1>
      <div style={{
        marginTop: 40, padding: 48, textAlign: 'center',
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        border: '2px dashed var(--border)',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🚧</div>
        <div style={{ color: 'var(--text-3)', fontSize: 14 }}>
          Wird noch gebaut…
        </div>
      </div>
    </div>
  )
}
