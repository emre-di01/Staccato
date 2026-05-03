import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { startseiteNach } from '../components/ProtectedRoute'
import { THEMES, THEME_KEYS } from '../themes/themes'
import { CHANGELOG } from '../changelog'

// Floating note definitions: [symbol, x%, duration, delay, size, opacity]
const NOTES = [
  ['♩',  8,  9, 0,   28, 0.18],
  ['♪', 18, 12, 2,   18, 0.14],
  ['♫', 30,  8, 5,   36, 0.16],
  ['♬', 45, 11, 1,   22, 0.20],
  ['𝄞', 58,  7, 3.5, 42, 0.12],
  ['♩', 68, 10, 0.5, 16, 0.15],
  ['♪', 78, 13, 4,   30, 0.13],
  ['♫', 88, 9,  2.5, 20, 0.17],
  ['♬', 52, 14, 7,   14, 0.12],
  ['𝄢', 22,  8, 6,   38, 0.10],
  ['♩', 92, 11, 1.5, 24, 0.14],
  ['♪', 38, 10, 8,   18, 0.16],
]

export default function LoginPage() {
  const { session, rolle, laden, T, theme, darkMode, changeTheme, toggleDark, lang, setLang } = useApp()
  const [email,      setEmail]      = useState('')
  const [passwort,   setPasswort]   = useState('')
  const [fehler,     setFehler]     = useState('')
  const [senden,     setSenden]     = useState(false)
  const [ansicht,    setAnsicht]    = useState('login') // 'login' | 'reset'
  const [resetEmail, setResetEmail] = useState('')
  const [resetOk,    setResetOk]    = useState(false)

  if (!laden && session) return <Navigate to={startseiteNach(rolle)} replace />

  async function handleSubmit(e) {
    e.preventDefault()
    setSenden(true)
    setFehler('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })
    if (error) setFehler(T('login_error'))
    setSenden(false)
  }

  async function handleReset(e) {
    e.preventDefault()
    setSenden(true)
    setFehler('')
    const { error } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin + '/passwort-zuruecksetzen',
    })
    if (error) setFehler(T('reset_email_error'))
    else setResetOk(true)
    setSenden(false)
  }

  return (
    <div className="login-wrapper" style={{
      minHeight: '100vh', display: 'flex', background: 'var(--bg)',
      fontFamily: "'Outfit', 'DM Sans', sans-serif",
    }}>

      {/* ── Mobile-only header ── */}
      <div className="login-mobile-header">
        {NOTES.slice(0, 6).map(([sym, x, dur, delay, size, op], i) => (
          <span key={i} className="float-note" style={{
            left: `${x}%`, fontSize: size,
            animationDuration: `${dur}s`, animationDelay: `${-delay}s`, opacity: op,
          }}>{sym}</span>
        ))}
        <div style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="logo-pulse" style={{ fontSize: 36 }}>♩</div>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.5px' }}>Staccato</div>
            <div style={{ fontSize: 12, opacity: 0.7 }}>{T('app_tagline')}</div>
          </div>
        </div>
      </div>

      {/* ── Left – Branding ── */}
      <div style={{
        flex: 1, display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        background: 'linear-gradient(150deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 65%, #000) 100%)',
        color: 'var(--primary-fg)',
        padding: 48, position: 'relative', overflow: 'hidden',
      }} className="login-left">

        {/* Floating animated notes */}
        {NOTES.map(([sym, x, dur, delay, size, op], i) => (
          <span key={i} className="float-note" style={{
            left: `${x}%`, fontSize: size,
            animationDuration: `${dur}s`, animationDelay: `${-delay}s`, opacity: op,
          }}>{sym}</span>
        ))}

        {/* Orb glows */}
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'rgba(255,255,255,0.06)', top: -100, right: -100,
          filter: 'blur(60px)', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: 'rgba(255,255,255,0.04)', bottom: -80, left: -60,
          filter: 'blur(50px)', pointerEvents: 'none',
        }} />

        <div style={{ position: 'relative', textAlign: 'center', width: '100%', maxWidth: 360 }}>
          <div className="logo-pulse" style={{ fontSize: 72, marginBottom: 12 }}>♩</div>
          <div style={{ fontSize: 44, fontWeight: 800, letterSpacing: '-1.5px', marginBottom: 6 }}>Staccato</div>
          <div style={{ fontSize: 15, opacity: 0.65, letterSpacing: '0.01em' }}>{T('app_tagline')}</div>

          {/* What's New card */}
          <div style={{
            marginTop: 40, textAlign: 'left',
            background: 'rgba(255,255,255,0.1)', borderRadius: 16,
            padding: '20px 20px 16px', backdropFilter: 'blur(12px)',
            border: '1px solid rgba(255,255,255,0.18)',
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
              <span style={{ fontSize: 16 }}>✨</span>
              <span style={{ fontSize: 12, fontWeight: 700, opacity: 0.9, textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {T('whats_new_login_label')} · v{CHANGELOG[0].version}
              </span>
            </div>
            <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
              {CHANGELOG[0].features.map((f, i) => (
                <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <span style={{ fontSize: 15, lineHeight: 1.45, flexShrink: 0 }}>{f.icon}</span>
                  <span style={{ fontSize: 13, opacity: 0.85, lineHeight: 1.5 }}>{f[lang] ?? f.de}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>

      {/* ── Right – Login Form ── */}
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
          {ansicht === 'login' ? (
            <>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <label style={lbl}>{T('password')}</label>
                    <button type="button" onClick={() => { setAnsicht('reset'); setFehler(''); setResetOk(false) }}
                      style={{ fontSize: 12, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                      {T('forgot_password')}
                    </button>
                  </div>
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
            </>
          ) : (
            <>
              <button type="button" onClick={() => { setAnsicht('login'); setFehler(''); setResetOk(false) }}
                style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, color: 'var(--text-3)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0, marginBottom: 24 }}>
                ← {T('back_to_login')}
              </button>
              <h1 style={{ fontSize: 26, fontWeight: 800, color: 'var(--text)', marginBottom: 8, letterSpacing: '-0.5px' }}>
                {T('reset_email_title')}
              </h1>
              <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 32 }}>{T('reset_email_sub')}</p>

              {resetOk ? (
                <div style={{ background: 'color-mix(in srgb, var(--success) 15%, transparent)', border: '1px solid var(--success)', borderRadius: 'var(--radius)', padding: '14px 16px', color: 'var(--success)', fontSize: 14 }}>
                  {T('reset_email_sent')}
                </div>
              ) : (
                <form onSubmit={handleReset} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={lbl}>{T('email')}</label>
                    <input type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} required
                      placeholder="name@beispiel.de" style={inp} autoFocus />
                  </div>
                  {fehler && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{fehler}</p>}
                  <button type="submit" disabled={senden} style={{
                    marginTop: 8, padding: '13px', borderRadius: 'var(--radius)',
                    border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)',
                    fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
                    opacity: senden ? 0.7 : 1, transition: 'opacity 0.15s',
                  }}>
                    {senden ? T('loading') : T('reset_email_btn')}
                  </button>
                </form>
              )}
            </>
          )}

          {/* What's New – nur auf Mobile sichtbar */}
          <div className="login-whats-new" style={{ marginTop: 28 }}>
            <div style={{ paddingTop: 24, borderTop: '1px solid var(--border)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
                <span style={{ fontSize: 14 }}>✨</span>
                <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  {T('whats_new_login_label')} · v{CHANGELOG[0].version}
                </span>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {CHANGELOG[0].features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                    <span style={{ fontSize: 15, lineHeight: 1.4, flexShrink: 0 }}>{f.icon}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{f[lang] ?? f.de}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

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

      {/* Footer */}
      <div style={{ position:'fixed', bottom:0, left:0, right:0, textAlign:'center', padding:'10px', fontSize:12, color:'var(--text-3)', display:'flex', justifyContent:'center', gap:16, zIndex:10 }}>
        <a href="/impressum"   style={{ color:'var(--text-3)', textDecoration:'none' }}>Impressum</a>
        <a href="/datenschutz" style={{ color:'var(--text-3)', textDecoration:'none' }}>Datenschutz</a>
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');
        * { box-sizing: border-box; }

        /* Floating notes */
        .float-note {
          position: absolute;
          bottom: -60px;
          animation: floatUp linear infinite;
          pointer-events: none;
          user-select: none;
          will-change: transform, opacity;
        }
        @keyframes floatUp {
          0%   { transform: translateY(0)   rotate(0deg);   opacity: inherit; }
          15%  { opacity: inherit; }
          85%  { opacity: inherit; }
          100% { transform: translateY(-110vh) rotate(20deg); opacity: 0; }
        }

        /* Logo pulse */
        .logo-pulse {
          display: inline-block;
          animation: logoPulse 3s ease-in-out infinite;
        }
        @keyframes logoPulse {
          0%, 100% { transform: scale(1);    }
          50%       { transform: scale(1.08); }
        }

        /* Mobile header */
        .login-mobile-header {
          display: none;
        }

        .login-whats-new { display: none; }

        @media (max-width: 640px) {
          .login-wrapper {
            flex-direction: column;
          }
          .login-left  { display: none !important; }
          .login-right {
            width: 100% !important;
            flex: 1;
            justify-content: flex-start !important;
            padding-top: 32px !important;
          }
          .login-whats-new { display: block; }
          .login-mobile-header {
            display: flex;
            align-items: center;
            justify-content: center;
            position: relative;
            overflow: hidden;
            background: linear-gradient(150deg, var(--primary) 0%, color-mix(in srgb, var(--primary) 65%, #000) 100%);
            color: var(--primary-fg);
            padding: 28px 24px;
            width: 100%;
            flex-shrink: 0;
          }
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
