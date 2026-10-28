import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { Link2Off, CircleCheck, Clock, PartyPopper, Mail } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Knopf, Feld, Segment, Laden, eingabeStil } from '../../ui'
import AuthRahmen, { Meldung, Zustand, passwortGueltig } from './Rahmen'

// Einladungslink: neues Konto anlegen oder mit bestehendem Konto der Schule beitreten
export default function NeuEinladung() {
  const { token } = useParams()
  const navigate  = useNavigate()
  const { session, ladeProfil, T } = useApp()

  const [einladung,  setEinladung]  = useState(null)
  const [laden,      setLaden]      = useState(true)
  const [fehler,     setFehler]     = useState('')
  const [senden,     setSenden]     = useState(false)
  const [erfolg,     setErfolg]     = useState(false)
  const [ansicht,    setAnsicht]    = useState('register') // 'register' | 'login'
  const [vollerName, setVollerName] = useState('')
  const [passwort,   setPasswort]   = useState('')
  const [passwort2,  setPasswort2]  = useState('')
  const [loginEmail, setLoginEmail] = useState('')
  const [loginPw,    setLoginPw]    = useState('')

  useEffect(() => {
    supabase.rpc('einladung_details', { p_token: token }).then(({ data }) => {
      setEinladung(data)
      if (data?.email) setLoginEmail(data.email)
      setLaden(false)
    })
  }, [token])

  // Nach dem Beitritt kurz begrüßen, dann über "/" zur passenden Startseite
  function fertig() {
    setErfolg(true)
    setTimeout(() => navigate('/', { replace: true }), 1500)
  }

  async function ausfuehren(fn) {
    setSenden(true)
    setFehler('')
    try {
      await fn()
      fertig()
    } catch (e) {
      setFehler(e.message)
    } finally {
      setSenden(false)
    }
  }

  const beitreten = () => ausfuehren(async () => {
    const { error } = await supabase.rpc('einladung_annehmen', { p_token: token })
    if (error) throw error
    await ladeProfil(session.user.id)
  })

  function registrieren(e) {
    e.preventDefault()
    if (!vollerName.trim()) { setFehler(T('name_required')); return }
    if (!passwortGueltig(passwort)) { setFehler(T('password_min_error')); return }
    if (passwort !== passwort2) { setFehler(T('password_mismatch')); return }
    ausfuehren(async () => {
      const res = await supabase.functions.invoke('accept-invitation', {
        body: { token, voller_name: vollerName, passwort },
      })
      if (res.error) throw new Error(res.error.message)
      if (res.data?.error) throw new Error(res.data.message ?? res.data.error)
      const { error } = await supabase.auth.signInWithPassword({ email: einladung.email, password: passwort })
      if (error) throw error
    })
  }

  function anmelden(e) {
    e.preventDefault()
    ausfuehren(async () => {
      const { error } = await supabase.auth.signInWithPassword({ email: loginEmail, password: loginPw })
      if (error) throw error
      const { error: annErr } = await supabase.rpc('einladung_annehmen', { p_token: token })
      if (annErr) throw annErr
    })
  }

  if (laden) return (
    <AuthRahmen titel={T('school_invitation_title')}>
      <Laden hoehe={200} />
    </AuthRahmen>
  )

  if (!einladung) return (
    <AuthRahmen zeichen={<span />}>
      <Zustand icon={Link2Off} farbe="var(--danger)" titel={T('invitation_not_found')} text={T('invitation_not_found_sub')} />
    </AuthRahmen>
  )

  if (erfolg) return (
    <AuthRahmen zeichen={<span />} fuss={false}>
      <Zustand icon={PartyPopper} titel={T('nau_willkommen_bei').replace('{schule}', einladung.schule_name)} text={T('nau_weiterleitung')} />
    </AuthRahmen>
  )

  if (einladung.status === 'angenommen') return (
    <AuthRahmen zeichen={<span />}>
      <Zustand icon={CircleCheck} farbe="var(--success)" titel={T('invitation_accepted_already')}>
        <Knopf voll onClick={() => navigate('/login')}>{T('nau_zur_anmeldung')}</Knopf>
      </Zustand>
    </AuthRahmen>
  )

  if (new Date(einladung.ablauf_am) < new Date()) return (
    <AuthRahmen zeichen={<span />}>
      <Zustand icon={Clock} farbe="var(--warning)" titel={T('invitation_expired')} text={T('nau_neue_einladung')} />
    </AuthRahmen>
  )

  const schulZeichen = einladung.logo_url
    ? <img src={einladung.logo_url} alt="" style={{ width: 64, height: 64, borderRadius: 16, objectFit: 'cover', background: 'var(--n-fill)' }} />
    : undefined

  return (
    <AuthRahmen
      zeichen={schulZeichen}
      titel={einladung.schule_name}
      unter={T('nau_eingeladen_als').replace('{rolle}', T(einladung.rolle)).replace('{schule}', einladung.schule_name)}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 14, background: 'var(--n-fill)', marginBottom: 24 }}>
        <Mail aria-hidden="true" size={20} color="var(--text-2)" style={{ flexShrink: 0 }} />
        <div style={{ minWidth: 0 }}>
          <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{T('nau_einladung_fuer')}</div>
          <div style={{ fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{einladung.email}</div>
        </div>
      </div>

      {session ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <p style={{ margin: 0, fontSize: 17, lineHeight: 1.45, color: 'var(--text-2)' }}>{T('nau_bereits_angemeldet')}</p>
          {fehler && <Meldung art="fehler">{fehler}</Meldung>}
          <Knopf voll disabled={senden} onClick={beitreten}>{senden ? T('loading') : T('join_school')}</Knopf>
        </div>
      ) : (
        <>
          <Segment
            label={T('school_invitation_title')}
            optionen={[['register', T('nau_neu_registrieren')], ['login', T('nau_habe_konto')]]}
            wert={ansicht}
            onChange={a => { setAnsicht(a); setFehler('') }}
            style={{ marginBottom: 24 }}
          />
          {ansicht === 'register' ? (
            <form onSubmit={registrieren} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Feld label={T('nau_voller_name')}>
                <input autoComplete="name" value={vollerName} onChange={e => setVollerName(e.target.value)} required style={eingabeStil} />
              </Feld>
              <Feld label={T('nau_passwort_waehlen')} hinweis={T('password_min_chars')}>
                <input type="password" autoComplete="new-password" value={passwort} onChange={e => setPasswort(e.target.value)} required style={eingabeStil} />
              </Feld>
              <Feld label={T('confirm_password')}>
                <input type="password" autoComplete="new-password" value={passwort2} onChange={e => setPasswort2(e.target.value)} required style={eingabeStil} />
              </Feld>
              {fehler && <Meldung art="fehler">{fehler}</Meldung>}
              <Knopf type="submit" voll disabled={senden} style={{ marginTop: 8 }}>{senden ? T('loading') : T('nau_konto_erstellen')}</Knopf>
            </form>
          ) : (
            <form onSubmit={anmelden} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <Feld label={T('email')}>
                <input type="email" autoComplete="email" value={loginEmail} onChange={e => setLoginEmail(e.target.value)} required style={eingabeStil} />
              </Feld>
              <Feld label={T('password')}>
                <input type="password" autoComplete="current-password" value={loginPw} onChange={e => setLoginPw(e.target.value)} required style={eingabeStil} />
              </Feld>
              {fehler && <Meldung art="fehler">{fehler}</Meldung>}
              <Knopf type="submit" voll disabled={senden} style={{ marginTop: 8 }}>{senden ? T('loading') : T('nau_anmelden_beitreten')}</Knopf>
            </form>
          )}
        </>
      )}
    </AuthRahmen>
  )
}
