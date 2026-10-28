import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { UserX } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { startseiteNach } from '../../components/ProtectedRoute'
import { Knopf, Feld, TextLink, eingabeStil } from '../../ui'
import AuthRahmen, { Meldung, Zustand } from './Rahmen'

// Anmeldung im neuen Design. Ansichten: Passwort · Link per E-Mail · Passwort vergessen
export default function NeuLogin() {
  const { session, rolle, laden, T, schulenListe } = useApp()
  const [ansicht, setAnsicht] = useState('login') // 'login' | 'magic' | 'reset'
  const [email,    setEmail]    = useState('')
  const [passwort, setPasswort] = useState('')
  const [fehler,   setFehler]   = useState('')
  const [gesendet, setGesendet] = useState(false)
  const [senden,   setSenden]   = useState(false)

  if (!laden && session) {
    if (!rolle) {
      return (
        <AuthRahmen zeichen={<span />}>
          <Zustand icon={UserX} farbe="var(--danger)" titel={T('nau_profil_fehlt_titel')} text={T('nau_profil_fehlt_text')}>
            <Knopf variante="sekundaer" voll onClick={() => supabase.auth.signOut()}>{T('logout')}</Knopf>
          </Zustand>
        </AuthRahmen>
      )
    }
    const gespeichert = sessionStorage.getItem('staccato_nach_login')
    if (gespeichert) {
      sessionStorage.removeItem('staccato_nach_login')
      return <Navigate to={gespeichert} replace />
    }
    // Mehrere Schulen und noch keine gewählt → Schulwahl
    if (schulenListe.length > 1 && rolle !== 'superadmin' && !sessionStorage.getItem('staccato_schule_session')) {
      return <Navigate to="/schulen" replace />
    }
    return <Navigate to={startseiteNach(rolle)} replace />
  }

  function wechseln(neu) {
    setAnsicht(neu)
    setFehler('')
    setGesendet(false)
  }

  async function anmelden(e) {
    e.preventDefault()
    setSenden(true)
    setFehler('')
    const { error } = await supabase.auth.signInWithPassword({ email, password: passwort })
    if (error) setFehler(T('login_error'))
    setSenden(false)
  }

  async function linkSenden(e) {
    e.preventDefault()
    setSenden(true)
    setFehler('')
    const { error } = ansicht === 'magic'
      ? await supabase.auth.signInWithOtp({ email, options: { shouldCreateUser: false, emailRedirectTo: window.location.origin } })
      : await supabase.auth.resetPasswordForEmail(email, { redirectTo: window.location.origin + '/passwort-zuruecksetzen' })
    if (error) setFehler(T(ansicht === 'magic' ? 'magic_link_error' : 'reset_email_error'))
    else setGesendet(true)
    setSenden(false)
  }

  const emailFeld = (
    <Feld label={T('email')}>
      <input type="email" autoComplete="email" inputMode="email" value={email} onChange={e => setEmail(e.target.value)}
        required placeholder="name@beispiel.de" style={eingabeStil} autoFocus={ansicht !== 'login'} />
    </Feld>
  )

  if (ansicht === 'login') return (
    <AuthRahmen titel={T('nau_anmelden_titel')} unter={T('login_sub')}>
      <form onSubmit={anmelden} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {emailFeld}
        <Feld label={T('password')}>
          <input type="password" autoComplete="current-password" value={passwort} onChange={e => setPasswort(e.target.value)}
            required style={eingabeStil} />
        </Feld>
        {fehler && <Meldung art="fehler">{fehler}</Meldung>}
        <Knopf type="submit" voll disabled={senden} style={{ marginTop: 8 }}>{senden ? T('loading') : T('login_btn')}</Knopf>
      </form>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, marginTop: 20 }}>
        <TextLink onClick={() => wechseln('reset')}>{T('forgot_password')}</TextLink>
        <TextLink onClick={() => wechseln('magic')}>{T('nau_ohne_passwort')}</TextLink>
      </div>
      <p style={{ margin: '24px 0 0', fontSize: 15, lineHeight: 1.45, color: 'var(--text-2)', textAlign: 'center' }}>{T('no_access')}</p>
    </AuthRahmen>
  )

  const magic = ansicht === 'magic'
  return (
    <AuthRahmen
      zurueck={{ label: T('back_to_login'), onClick: () => wechseln('login') }}
      titel={T(magic ? 'nau_link_titel' : 'reset_email_title')}
      unter={T(magic ? 'magic_link_sub' : 'reset_email_sub')}
    >
      {gesendet ? (
        <Meldung>{T(magic ? 'magic_link_sent' : 'reset_email_sent')}</Meldung>
      ) : (
        <form onSubmit={linkSenden} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {emailFeld}
          {fehler && <Meldung art="fehler">{fehler}</Meldung>}
          <Knopf type="submit" voll disabled={senden} style={{ marginTop: 8 }}>{senden ? T('loading') : T(magic ? 'nau_link_senden' : 'reset_email_btn')}</Knopf>
        </form>
      )}
    </AuthRahmen>
  )
}
