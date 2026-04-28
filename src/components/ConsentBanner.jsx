import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../context/AppContext'

const KEY = 'staccato_cookie_ok'

export default function CookieBanner() {
  const { T } = useApp()
  const [sichtbar, setSichtbar] = useState(false)

  useEffect(() => {
    if (!localStorage.getItem(KEY)) setSichtbar(true)
  }, [])

  function akzeptieren() {
    localStorage.setItem(KEY, '1')
    setSichtbar(false)
  }

  if (!sichtbar) return null

  return (
    <div style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
      background: 'var(--surface)', borderTop: '1px solid var(--border)',
      boxShadow: '0 -4px 24px rgba(0,0,0,0.12)',
      padding: '16px 24px',
      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      gap: 16, flexWrap: 'wrap',
    }}>
      <p style={{ margin: 0, fontSize: 13, color: 'var(--text-2)', lineHeight: 1.6, flex: 1, minWidth: 220 }}>
        🍪 {T('cookie_text')}{' '}
        <Link to="/datenschutz" style={{ color: 'var(--primary)', textDecoration: 'none', fontWeight: 600 }}>
          {T('privacy_policy')}
        </Link>
      </p>
      <button onClick={akzeptieren}
        style={{ padding: '9px 20px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
        {T('cookie_accept')}
      </button>
    </div>
  )
}
