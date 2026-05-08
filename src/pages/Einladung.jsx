import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { startseiteNach } from '../components/ProtectedRoute'

const ROLLEN_LABEL = { admin: 'Admin', lehrer: 'Lehrer', schueler: 'Schüler', eltern: 'Elternteil', vorstand: 'Vorstand' }

export default function Einladung() {
  const { token } = useParams()
  const navigate  = useNavigate()
  const { session, rolle, ladeProfil, T } = useApp()

  const [einladung,    setEinladung]    = useState(null)
  const [laden,        setLaden]        = useState(true)
  const [fehler,       setFehler]       = useState('')
  const [vollerName,   setVollerName]   = useState('')
  const [passwort,     setPasswort]     = useState('')
  const [passwort2,    setPasswort2]    = useState('')
  const [senden,       setSenden]       = useState(false)
  const [ansicht,      setAnsicht]      = useState('register') // 'register' | 'login'
  const [loginEmail,   setLoginEmail]   = useState('')
  const [loginPw,      setLoginPw]      = useState('')
  const [erfolg,       setErfolg]       = useState(false)

  useEffect(() => {
    async function load() {
      const { data } = await supabase.rpc('einladung_details', { p_token: token })
      setEinladung(data)
      setLaden(false)
    }
    load()
  }, [token])

  async function handleBeitreten() {
    if (!session) return
    setSenden(true)
    setFehler('')
    try {
      const { data, error } = await supabase.rpc('einladung_annehmen', { p_token: token })
      if (error) throw error
      await ladeProfil(session.user.id)
      setErfolg(true)
      setTimeout(() => navigate(startseiteNach(rolle), { replace: true }), 1500)
    } catch (e) {
      setFehler(e.message)
    } finally {
      setSenden(false)
    }
  }

  async function handleRegistrieren(e) {
    e.preventDefault()
    if (!vollerName.trim()) { setFehler(T('name_required')); return }
    if (passwort.length < 6) { setFehler(T('password_min_error')); return }
    if (passwort !== passwort2) { setFehler(T('password_mismatch')); return }
    setSenden(true)
    setFehler('')
    try {
      const res = await supabase.functions.invoke('accept-invitation', {
        body: { token, voller_name: vollerName, passwort },
      })
      if (res.error) throw new Error(res.error.message)
      const body = res.data
      if (body.error) throw new Error(body.message ?? body.error)

      // Einloggen mit den frisch erstellten Zugangsdaten
      const { error: loginErr } = await supabase.auth.signInWithPassword({
        email: einladung.email, password: passwort,
      })
      if (loginErr) throw loginErr
      setErfolg(true)
    } catch (e) {
      setFehler(e.message)
    } finally {
      setSenden(false)
    }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setSenden(true)
    setFehler('')
    try {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPw })
      if (error) throw error
      // Nach Login handleBeitreten aufrufen
      const { data, error: annErr } = await supabase.rpc('einladung_annehmen', { p_token: token })
      if (annErr) throw annErr
      setErfolg(true)
    } catch (e) {
      setFehler(e.message)
    } finally {
      setSenden(false)
    }
  }

  if (laden) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)' }}>
      <div style={{ color: 'var(--text-3)' }}>Lade Einladung …</div>
    </div>
  )

  if (!einladung) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔗</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{T('invitation_not_found')}</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>{T('invitation_not_found_sub')}</p>
      </div>
    </div>
  )

  if (einladung.status === 'angenommen') return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>✅</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{T('invitation_accepted_already')}</h1>
        <button onClick={() => navigate('/login')} style={btnStyle}>Zum Login</button>
      </div>
    </div>
  )

  const abgelaufen = new Date(einladung.ablauf_am) < new Date()

  if (abgelaufen) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>⏰</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>{T('invitation_expired')}</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Bitte beim Administrator eine neue Einladung anfordern.</p>
      </div>
    </div>
  )

  if (erfolg) return (
    <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg)', padding: 24 }}>
      <div style={{ textAlign: 'center', maxWidth: 360 }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎉</div>
        <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 8 }}>Willkommen bei {einladung.schule_name}!</h1>
        <p style={{ color: 'var(--text-3)', fontSize: 14 }}>Du wirst weitergeleitet …</p>
      </div>
    </div>
  )

  return (
    <div style={{
      minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center',
      background: 'var(--bg)', padding: 24, fontFamily: "'Outfit','DM Sans',sans-serif",
    }}>
      <div style={{ width: '100%', maxWidth: 420 }}>
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 32 }}>
          {einladung.logo_url ? (
            <img src={einladung.logo_url} alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', marginBottom: 16 }} />
          ) : (
            <div style={{ fontSize: 48, marginBottom: 8 }}>🎵</div>
          )}
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', margin: '0 0 6px', letterSpacing: '-0.5px' }}>
            {T('school_invitation_title')}
          </h1>
          <p style={{ color: 'var(--text-3)', fontSize: 14, margin: 0 }}>
            Du wurdest als <strong style={{ color: 'var(--text)' }}>{ROLLEN_LABEL[einladung.rolle] ?? einladung.rolle}</strong> zu{' '}
            <strong style={{ color: 'var(--text)' }}>{einladung.schule_name}</strong> eingeladen.
          </p>
        </div>

        {/* Eingeladene E-Mail */}
        <div style={{ background: 'color-mix(in srgb, var(--primary) 8%, var(--surface))', border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)', borderRadius: 'var(--radius)', padding: '12px 16px', marginBottom: 24, fontSize: 13, color: 'var(--text-2)' }}>
          📧 Einladung für: <strong style={{ color: 'var(--text)' }}>{einladung.email}</strong>
        </div>

        {/* Bereits eingeloggt als passende Person */}
        {session && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24 }}>
            <p style={{ color: 'var(--text-2)', fontSize: 14, margin: '0 0 16px' }}>
              Du bist bereits eingeloggt. Klicke auf „Beitreten" um die Einladung anzunehmen.
            </p>
            {fehler && <p style={{ color: 'var(--danger)', fontSize: 13, margin: '0 0 12px' }}>{fehler}</p>}
            <button onClick={handleBeitreten} disabled={senden} style={btnStyle}>
              {senden ? 'Beitreten …' : `✓ ${T('join_school')}`}
            </button>
          </div>
        )}

        {/* Nicht eingeloggt */}
        {!session && (
          <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
            {/* Tabs */}
            <div style={{ display: 'flex', borderBottom: '1px solid var(--border)' }}>
              {[['register', 'Neu registrieren'], ['login', 'Ich habe ein Konto']].map(([key, label]) => (
                <button key={key} onClick={() => { setAnsicht(key); setFehler('') }}
                  style={{
                    flex: 1, padding: '14px', border: 'none', cursor: 'pointer',
                    background: 'transparent', fontFamily: 'inherit', fontSize: 13, fontWeight: 600,
                    color: ansicht === key ? 'var(--primary)' : 'var(--text-3)',
                    borderBottom: `2px solid ${ansicht === key ? 'var(--primary)' : 'transparent'}`,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>

            <div style={{ padding: 24 }}>
              {ansicht === 'register' ? (
                <form onSubmit={handleRegistrieren} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={lbl}>Dein vollständiger Name *</label>
                    <input style={inp} value={vollerName} onChange={e => setVollerName(e.target.value)}
                      placeholder="Vor- und Nachname" autoFocus />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={lbl}>Passwort wählen *</label>
                    <input type="password" style={inp} value={passwort}
                      onChange={e => setPasswort(e.target.value)} placeholder="Mindestens 6 Zeichen" />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={lbl}>Passwort bestätigen *</label>
                    <input type="password" style={inp} value={passwort2}
                      onChange={e => setPasswort2(e.target.value)} placeholder="Nochmal eingeben" />
                  </div>
                  {fehler && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{fehler}</p>}
                  <button type="submit" disabled={senden} style={btnStyle}>
                    {senden ? 'Erstelle Konto …' : `🎉 Konto erstellen & beitreten`}
                  </button>
                </form>
              ) : (
                <form onSubmit={handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={lbl}>E-Mail</label>
                    <input type="email" style={inp} value={loginEmail}
                      onChange={e => setLoginEmail(e.target.value)} placeholder={einladung.email} autoFocus />
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                    <label style={lbl}>Passwort</label>
                    <input type="password" style={inp} value={loginPw}
                      onChange={e => setLoginPw(e.target.value)} placeholder="••••••••" />
                  </div>
                  {fehler && <p style={{ color: 'var(--danger)', fontSize: 13, margin: 0 }}>{fehler}</p>}
                  <button type="submit" disabled={senden} style={btnStyle}>
                    {senden ? 'Anmelden …' : `→ Anmelden & beitreten`}
                  </button>
                </form>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

const lbl = { fontSize: 13, fontWeight: 600, color: 'var(--text-2)' }
const inp = {
  padding: '10px 14px', borderRadius: 'var(--radius)',
  border: '1.5px solid var(--border)', fontSize: 14,
  outline: 'none', fontFamily: 'inherit',
  background: 'var(--bg)', color: 'var(--text)', width: '100%',
}
const btnStyle = {
  padding: '13px', borderRadius: 'var(--radius)', border: 'none',
  background: 'var(--primary)', color: 'var(--primary-fg)',
  fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
  width: '100%', opacity: 1, transition: 'opacity 0.15s',
}
