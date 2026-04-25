import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { startseiteNach } from '../components/ProtectedRoute'
import { THEMES, THEME_KEYS } from '../themes/themes'

export default function LoginPage() {
  const { session, rolle, laden, T, theme, darkMode, changeTheme, toggleDark, lang, setLang } = useApp()
  const [email,    setEmail]    = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler,   setFehler]   = useState('')
  const [senden,   setSenden]   = useState(false)

  if (!laden && session) return <Navigate to={startseiteNach(rolle)} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setSenden(true)
    setFehler('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })
    if (error) setFehler(T('login_error'))
    setSenden(false)
  }

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', background: 'var(--bg)',
      fontFamily: "'Outfit', 'DM Sans', sans-serif",
    }}>
      {/* Left – Branding */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'var(--primary)', color: 'var(--primary-fg)',
        padding: 48, position: 'relative', overflow: 'hidden',
      }} className="login-left">
        {/* Dekorative Noten im Hintergrund */}
        <div style={{ position: 'absolute', inset: 0, opacity: 0.05, fontSize: 120, display: 'flex', flexWrap: 'wrap', gap: 40, padding: 40, lineHeight: 1 }}>
          {'♩♪♫♬♩♪♫♬♩♪♫♬♩♪♫♬'.split('').map((n, i) => <span key={i}>{n}</span>)}
        </div>
        <div style={{ position: 'relative', textAlign: 'center' }}>
          <div style={{ fontSize: 64, marginBottom: 16 }}>♩</div>
          <div style={{ fontSize: 42, fontWeight: 800, letterSpacing: '-1px', marginBottom: 8 }}>Staccato</div>
          <div style={{ fontSize: 16, opacity: 0.7 }}>{T('app_tagline')}</div>
        </div>
      </div>

      {/* Right – Login Form */}
      <div style={{
        width: 420, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        padding: 48, background: 'var(--surface)',
      }} className="login-right">

        {/* Sprache */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 32, alignSelf: 'flex-end' }}>
          {['de','en','tr'].map(l => (
            <button key={l} onClick={() => setLang(l)}
              style={{ padding: '4px 10px', borderRadius: 8, border: '1px solid var(--border)', background: lang===l ? 'var(--accent)' : 'transparent', color: lang===l ? 'var(--accent-fg)' : 'var(--text-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', fontWeight: lang===l ? 700 : 400 }}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>

        <div style={{ width: '100%', maxWidth: 340 }}>
          <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.5px' }}>
            {T('login_title')}
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 32 }}>{T('login_sub')}</p>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={lbl}>{T('email')}</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)} required
                placeholder="name@beispiel.de" style={inp} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <label style={lbl}>{T('password')}</label>
              <input type="password" value={passwort} onChange={e => setPasswort(e.target.value)} required
                placeholder="••••••••" style={inp} />
            </div>
            {fehler && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{fehler}</p>}
            <button type="submit" disabled={senden} style={{
              marginTop: 8, padding: '13px', borderRadius: 'var(--radius)',
              border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)',
              fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
              opacity: senden ? 0.7 : 1, transition: 'opacity 0.15s',
            }}>
              {senden ? T('loading') : T('login_btn')}
            </button>
          </form>

          <p style={{ marginTop: 24, fontSize: 12, color: 'var(--text-3)', textAlign: 'center' }}>
            {T('no_access')}
          </p>

          {/* Theme-Auswahl */}
          <div style={{ marginTop: 32, paddingTop: 24, borderTop: '1px solid var(--border)' }}>
            <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 10 }}>{T('theme')}</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {THEME_KEYS.map(key => (
                <button key={key} onClick={() => changeTheme(key)} title={THEMES[key].name.de}
                  style={{ width: 32, height: 32, borderRadius: 8, border: `2px solid ${theme===key ? 'var(--accent)' : 'var(--border)'}`, background: 'var(--bg-2)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  {THEMES[key].icon}
                </button>
              ))}
              <button onClick={toggleDark} title={darkMode ? 'Hell' : 'Dunkel'}
                style={{ width: 32, height: 32, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-2)', fontSize: 16, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                {darkMode ? '☀️' : '🌙'}
              </button>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }
        @media (max-width: 640px) {
          .login-left { display: none !important; }
          .login-right { width: 100% !important; }
        }
      `}</style>
    </div>
  )
}

const lbl = { fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }
const inp = {
  padding: '11px 14px', borderRadius: 'var(--radius)',
  border: '1.5px solid var(--border)', fontSize: 14,
  outline: 'none', fontFamily: 'inherit',
  background: 'var(--bg)', color: 'var(--text)',
  width: '100%', transition: 'border-color 0.15s',
}
