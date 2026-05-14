import { Navigate, Outlet } from 'react-router-dom'
import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'

export default function ProtectedRoute({ erlaubteRollen = [] }) {
  const { session, rolle, laden } = useApp()
  const [mfaNötig, setMfaNötig]   = useState(false)
  const [mfaCode,  setMfaCode]    = useState('')
  const [mfaLaden, setMfaLaden]   = useState(false)
  const [mfaFehler, setMfaFehler] = useState('')

  useEffect(() => {
    if (!session) { setMfaNötig(false); return }
    supabase.auth.mfa.getAuthenticatorAssuranceLevel().then(({ data }) => {
      setMfaNötig(data?.nextLevel === 'aal2' && data?.currentLevel !== 'aal2')
    })
  }, [session])

  async function mfaVerifizieren(e) {
    e.preventDefault()
    setMfaLaden(true); setMfaFehler('')
    const { data: factors } = await supabase.auth.mfa.listFactors()
    const faktor = factors?.totp?.find(f => f.status === 'verified')
    if (!faktor) { setMfaFehler('Kein aktiver 2FA-Faktor gefunden.'); setMfaLaden(false); return }
    const { data: challenge, error: ce } = await supabase.auth.mfa.challenge({ factorId: faktor.id })
    if (ce) { setMfaFehler(ce.message); setMfaLaden(false); return }
    const { error } = await supabase.auth.mfa.verify({ factorId: faktor.id, challengeId: challenge.id, code: mfaCode })
    if (error) { setMfaFehler('Ungültiger Code – bitte erneut versuchen.'); setMfaLaden(false); return }
    setMfaNötig(false)
    setMfaLaden(false)
  }

  if (laden) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🎵</div>
        <div style={{ color:'var(--text-3)', fontSize:14 }}>Staccato lädt…</div>
      </div>
    </div>
  )

  if (!session) {
    const p = window.location.pathname
    if (p && p !== '/' && p !== '/login') sessionStorage.setItem('staccato_nach_login', p)
    return <Navigate to="/login" replace />
  }

  if (mfaNötig) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div style={{ width:'100%', maxWidth:360, padding:'32px 24px', background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', boxShadow:'var(--shadow-lg)' }}>
        <div style={{ textAlign:'center', marginBottom:24 }}>
          <div style={{ fontSize:36, marginBottom:8 }}>🛡️</div>
          <div style={{ fontWeight:800, fontSize:20, color:'var(--text)' }}>Zwei-Faktor-Authentifizierung</div>
          <div style={{ fontSize:14, color:'var(--text-3)', marginTop:6 }}>Gib den Code aus deiner Authenticator-App ein.</div>
        </div>
        <form onSubmit={mfaVerifizieren} style={{ display:'flex', flexDirection:'column', gap:16 }}>
          <input
            style={{ padding:'12px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:24, textAlign:'center', letterSpacing:'0.3em', outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%' }}
            value={mfaCode}
            onChange={e => setMfaCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
            placeholder="000 000"
            inputMode="numeric"
            autoComplete="one-time-code"
            autoFocus
          />
          {mfaFehler && <div style={{ padding:'10px 14px', borderRadius:'var(--radius)', background:'#fee2e2', color:'#b91c1c', fontSize:13, fontWeight:600 }}>{mfaFehler}</div>}
          <button type="submit" disabled={mfaLaden || mfaCode.length !== 6}
            style={{ padding:'12px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
            {mfaLaden ? 'Prüfe …' : 'Bestätigen'}
          </button>
        </form>
      </div>
    </div>
  )

  if (erlaubteRollen.length > 0 && !erlaubteRollen.includes(rolle)) {
    return <Navigate to={startseiteNach(rolle)} replace />
  }

  return <Outlet />
}

export function startseiteNach(rolle) {
  switch (rolle) {
    case 'superadmin': return '/superadmin'
    case 'admin':      return '/admin'
    case 'lehrer':     return '/lehrer'
    case 'schueler':   return '/schueler'
    case 'eltern':     return '/eltern'
    case 'vorstand':   return '/vorstand'
    default:           return '/login'
  }
}
