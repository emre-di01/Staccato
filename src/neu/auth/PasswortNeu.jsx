import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Knopf, Feld, Laden, eingabeStil } from '../../ui'
import AuthRahmen, { Meldung, passwortGueltig } from './Rahmen'

// Neues Passwort setzen (Ziel des Links aus der „Passwort vergessen“-E-Mail)
export default function NeuPasswortZuruecksetzen() {
  const { T } = useApp()
  const [passwort,   setPasswort]   = useState('')
  const [bestaetigt, setBestaetigt] = useState('')
  const [fehler,     setFehler]     = useState('')
  const [erfolg,     setErfolg]     = useState(false)
  const [senden,     setSenden]     = useState(false)
  const [bereit,     setBereit]     = useState(false)

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setBereit(true)
    })
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (session) setBereit(true)
      if (event === 'USER_UPDATED') {
        setErfolg(true)
        setSenden(false)
      }
    })
    return () => subscription.unsubscribe()
  }, [])

  async function speichern(e) {
    e.preventDefault()
    if (passwort !== bestaetigt) { setFehler(T('password_mismatch')); return }
    if (!passwortGueltig(passwort)) { setFehler(T('password_min_error')); return }
    setSenden(true)
    setFehler('')
    try {
      const { error } = await supabase.auth.updateUser({ password: passwort })
      if (error) setFehler(error.message)
      else setErfolg(true)
    } catch (e) {
      setFehler(e.message ?? T('unknown_error'))
    } finally {
      setSenden(false)
    }
  }

  return (
    <AuthRahmen titel={T('password_reset_title')} unter={erfolg ? null : T('password_reset_sub')}>
      {erfolg ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
          <Meldung>{T('password_changed')}</Meldung>
          <Knopf voll onClick={() => { window.location.href = '/' }}>{T('nau_weiter_zur_app')}</Knopf>
        </div>
      ) : !bereit ? (
        <>
          <Laden hoehe={52} />
          <p style={{ margin: '12px 0 0', fontSize: 17, color: 'var(--text-2)' }}>{T('link_checking')}</p>
        </>
      ) : (
        <form onSubmit={speichern} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Feld label={T('new_password')} hinweis={T('password_min_chars')}>
            <input type="password" autoComplete="new-password" value={passwort} onChange={e => setPasswort(e.target.value)} required style={eingabeStil} autoFocus />
          </Feld>
          <Feld label={T('confirm_password')}>
            <input type="password" autoComplete="new-password" value={bestaetigt} onChange={e => setBestaetigt(e.target.value)} required style={eingabeStil} />
          </Feld>
          {fehler && <Meldung art="fehler">{fehler}</Meldung>}
          <Knopf type="submit" voll disabled={senden} style={{ marginTop: 8 }}>{senden ? T('loading') : T('password_save')}</Knopf>
        </form>
      )}
    </AuthRahmen>
  )
}
