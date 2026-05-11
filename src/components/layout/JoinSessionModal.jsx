import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

export default function JoinSessionModal({ onClose }) {
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState('')
  const navigate = useNavigate()

  function beitreten() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 4) { setFehler('Bitte gültigen Code eingeben.'); return }
    navigate(`/session/${trimmed}`)
    onClose()
  }

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 300, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '28px 32px', width: '100%', maxWidth: 360, boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>🎬 Session beitreten</h3>
          <button onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-3)', padding: 10, margin: -10, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-3)' }}>Gib den 6-stelligen Code ein, den dir dein Lehrer gegeben hat.</p>
        <input
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setFehler('') }}
          onKeyDown={e => e.key === 'Enter' && beitreten()}
          placeholder="ABC123"
          maxLength={6}
          autoFocus
          style={{ width: '100%', boxSizing: 'border-box', padding: '14px 16px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', fontSize: 28, fontFamily: 'monospace', fontWeight: 900, letterSpacing: '0.25em', textAlign: 'center', outline: 'none', background: 'var(--bg)', color: 'var(--text)', marginBottom: fehler ? 8 : 16 }}
        />
        {fehler && <div style={{ fontSize: 12, color: 'var(--danger)', marginBottom: 12, fontWeight: 600 }}>{fehler}</div>}
        <button onClick={beitreten}
          style={{ width: '100%', padding: '12px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
          Beitreten →
        </button>
      </div>
    </div>
  )
}
