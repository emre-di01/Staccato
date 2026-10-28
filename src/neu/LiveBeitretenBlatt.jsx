import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { Blatt, Knopf, eingabeStil } from '../ui'

// Live-Unterricht per Code beitreten (Start und Ich)
export default function LiveBeitretenBlatt({ onClose }) {
  const { T } = useApp()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState(false)

  function beitreten(e) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (c.length < 4) { setFehler(true); return }
    onClose()
    navigate(`/session/${c}`)
  }

  return (
    <Blatt titel={T('n_live_beitreten')} onClose={onClose}>
      <form onSubmit={beitreten} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <p style={{ margin: 0, fontSize: 17, color: 'var(--text-2)', lineHeight: 1.5 }}>{T('nj_code_hinweis')}</p>
        <input value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setFehler(false) }}
          aria-label={T('session_code_label')} aria-invalid={fehler} placeholder="ABC123" maxLength={6} autoFocus
          autoComplete="off" autoCapitalize="characters" spellCheck={false}
          style={{ ...eingabeStil, minHeight: 64, fontSize: 30, fontWeight: 800, letterSpacing: '0.25em', textAlign: 'center', fontFamily: 'ui-monospace, monospace' }} />
        {fehler && <div role="alert" style={{ fontSize: 16, fontWeight: 600, color: 'var(--danger)' }}>{T('nj_code_ungueltig')}</div>}
        <Knopf type="submit" voll>{T('nj_beitreten')}</Knopf>
      </form>
    </Blatt>
  )
}
