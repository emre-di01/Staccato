import { useEffect, useState } from 'react'
import { Copy, RefreshCw } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { usePushAbo } from '../../hooks/usePushAbo'
import { Seite, Abschnitt, Gruppe, Trenner, Segment, SchalterZeile, Knopf } from '../../ui'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL ?? ''
const EMAIL_STANDARD = { event_invite: true, new_piece: true, new_message: true, lesson_reminder: false }

export default function NeuEinstellungen() {
  const { profil, ladeProfil, T, lang, setLang, toast, confirm } = useApp()
  const push = usePushAbo(profil)
  const [email, setEmail] = useState({ ...EMAIL_STANDARD, ...(profil?.email_benachrichtigungen ?? {}) })
  const [token, setToken] = useState(null)

  useEffect(() => {
    if (!profil?.id) return
    supabase.from('profiles').select('kalender_token').eq('id', profil.id).single()
      .then(({ data }) => setToken(data?.kalender_token ?? null))
  }, [profil?.id])

  // E-Mail-Einstellungen sofort speichern (kein extra „Speichern“-Knopf)
  async function emailUmschalten(key) {
    const neu = { ...email, [key]: !email[key] }
    setEmail(neu)
    const { error } = await supabase.from('profiles')
      .update({ email_benachrichtigungen: { ...(profil?.email_benachrichtigungen ?? {}), ...neu, push: push.pushPrefs } })
      .eq('id', profil.id)
    if (error) { setEmail(email); toast(error.message, 'error'); return }
    ladeProfil(profil.id)
  }

  async function pushArtUmschalten(key) {
    await push.pushPrefToggle(key)
    ladeProfil(profil.id)
  }

  const kalenderUrl = token ? `${SUPABASE_URL}/functions/v1/kalender?token=${token}` : ''

  async function linkKopieren() {
    try {
      await navigator.clipboard.writeText(kalenderUrl)
      toast(T('n_link_kopiert'), 'success')
    } catch { toast(T('n_fehler'), 'error') }
  }

  async function neuerLink() {
    const ok = await confirm(T('ical_reset_confirm'), { confirmLabel: T('ical_reset') })
    if (!ok) return
    const neu = crypto.randomUUID()
    const { error } = await supabase.from('profiles').update({ kalender_token: neu }).eq('id', profil.id)
    if (error) { toast(error.message, 'error'); return }
    setToken(neu)
  }

  const EMAIL_ARTEN = [
    ['new_message', 'notif_new_message', 'notif_new_message_desc'],
    ['event_invite', 'notif_event_invite', 'notif_event_invite_desc'],
    ['new_piece', 'notif_new_piece', 'notif_new_piece_desc'],
    ['lesson_reminder', 'notif_lesson_reminder', 'notif_lesson_reminder_desc'],
  ]
  const PUSH_ARTEN = [
    ['new_message', 'notif_new_message'],
    ['event_invite', 'notif_event_invite'],
    ['broadcast', 'n_push_broadcast'],
    ['kurs', 'n_push_kurs'],
  ]

  return (
    <Seite titel={T('settings')} zurueck={{ to: '/schueler/ich', label: T('n_tab_ich') }}>
      <Abschnitt titel={T('language')} style={{ marginTop: 24 }}>
        <Segment label={T('language')} wert={lang} onChange={setLang} style={{ margin: '0 20px' }}
          optionen={[['de', 'Deutsch'], ['en', 'English'], ['tr', 'Türkçe']]} />
      </Abschnitt>

      <Abschnitt titel={T('n_benachrichtigungen_handy')}>
        <p style={{ margin: '-4px 20px 12px', fontSize: 16, color: 'var(--text-2)', lineHeight: 1.5 }}>
          {push.unterstuetzt ? T('n_push_erklaerung') : T('n_push_nicht_moeglich')}
        </p>
        {push.unterstuetzt && (
          <Gruppe>
            <SchalterZeile titel={T('n_push_auf_diesem_geraet')} an={push.pushEnabled} onChange={push.pushToggle} disabled={push.pushLaden} />
            {push.pushEnabled && PUSH_ARTEN.map(([key, label]) => (
              <div key={key}>
                <Trenner />
                <SchalterZeile titel={T(label)} an={!!push.pushPrefs[key]} onChange={() => pushArtUmschalten(key)} />
              </div>
            ))}
          </Gruppe>
        )}
      </Abschnitt>

      <Abschnitt titel={T('n_benachrichtigungen_email')}>
        <Gruppe>
          {EMAIL_ARTEN.map(([key, label, desc], i) => (
            <div key={key}>
              {i > 0 && <Trenner />}
              <SchalterZeile titel={T(label)} untertitel={T(desc)} an={!!email[key]} onChange={() => emailUmschalten(key)} />
            </div>
          ))}
        </Gruppe>
      </Abschnitt>

      <Abschnitt titel={T('n_kalender')}>
        <p style={{ margin: '-4px 20px 12px', fontSize: 16, color: 'var(--text-2)', lineHeight: 1.5 }}>{T('n_kalender_erklaerung')}</p>
        <div style={{ margin: '0 20px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          <Knopf voll icon={Copy} onClick={linkKopieren} disabled={!kalenderUrl}>{T('ical_copy')}</Knopf>
          <Knopf voll variante="sekundaer" icon={RefreshCw} onClick={neuerLink} disabled={!token}>{T('ical_reset')}</Knopf>
        </div>
      </Abschnitt>
    </Seite>
  )
}
