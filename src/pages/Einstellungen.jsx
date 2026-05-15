import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { THEMES, THEME_KEYS } from '../themes/themes'
import { ONBOARDING_LS_KEY } from '../components/OnboardingModal'
import { isNative, registerNativePush, unregisterNativePush, isNativePushRegistered } from '../lib/nativePush'

const SUPABASE_URL      = import.meta.env.VITE_SUPABASE_URL ?? ''
const VAPID_PUBLIC_KEY  = import.meta.env.VITE_VAPID_PUBLIC_KEY ?? ''

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4)
  const base64  = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw     = atob(base64)
  return Uint8Array.from([...raw].map(c => c.charCodeAt(0)))
}

export default function Einstellungen() {
  const { profil, ladeProfil, T, rolle, lang, setLang, theme, darkMode, changeTheme, toggleDark, großeSchrift, toggleGrosseSchrift } = useApp()
  const navigate = useNavigate()

  const DEFAULT_NOTIF = { event_invite: true, new_piece: true, new_message: true, lesson_reminder: false }
  const [notifPrefs,  setNotifPrefs]  = useState({ ...DEFAULT_NOTIF, ...(profil?.email_benachrichtigungen ?? {}) })
  const [notifLaden,  setNotifLaden]  = useState(false)
  const [notifErfolg, setNotifErfolg] = useState(false)

  const DEFAULT_PUSH_PREFS = { new_message: true, event_invite: true, broadcast: true, kurs: true }
  const [pushPrefs,   setPushPrefs]   = useState({ ...DEFAULT_PUSH_PREFS, ...(profil?.email_benachrichtigungen?.push ?? {}) })
  const [pushEnabled, setPushEnabled] = useState(false)
  const [pushLaden,   setPushLaden]   = useState(true)

  const [kalenderToken, setKalenderToken] = useState(null)
  const [kalTokenLaden, setKalTokenLaden] = useState(true)
  const [icalKopiert,   setIcalKopiert]   = useState(false)

  useEffect(() => {
    if (!profil?.id) return
    supabase.from('profiles').select('kalender_token').eq('id', profil.id).single()
      .then(({ data }) => { setKalenderToken(data?.kalender_token ?? null); setKalTokenLaden(false) })
  }, [profil?.id])

  useEffect(() => {
    if (!profil?.id) return
    async function checkPush() {
      try {
        if (isNative) {
          setPushEnabled(await isNativePushRegistered(profil.id, supabase))
          setPushLaden(false)
          return
        }
        if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
          setPushEnabled(false); setPushLaden(false); return
        }
        const reg = await navigator.serviceWorker.ready
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          const { data } = await supabase.from('push_subscriptions').select('id').eq('user_id', profil.id).eq('endpoint', sub.endpoint).maybeSingle()
          setPushEnabled(!!data)
        } else {
          setPushEnabled(false)
        }
      } catch { setPushEnabled(false) }
      finally  { setPushLaden(false) }
    }
    checkPush()
  }, [profil?.id])

  async function pushToggle() {
    if (pushLaden) return
    setPushLaden(true)
    try {
      if (isNative) {
        if (pushEnabled) {
          await unregisterNativePush(profil.id, supabase)
          setPushEnabled(false)
        } else {
          const ok = await registerNativePush(profil.id, supabase)
          setPushEnabled(ok)
        }
        setPushLaden(false)
        return
      }
      const reg = await navigator.serviceWorker.ready
      if (pushEnabled) {
        const sub = await reg.pushManager.getSubscription()
        if (sub) {
          await sub.unsubscribe()
          await supabase.from('push_subscriptions').delete().eq('user_id', profil.id).eq('endpoint', sub.endpoint)
        }
        setPushEnabled(false)
      } else {
        const permission = await Notification.requestPermission()
        if (permission !== 'granted') { setPushLaden(false); return }
        const sub = await reg.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
        })
        const key  = sub.getKey('p256dh')
        const auth = sub.getKey('auth')
        await supabase.from('push_subscriptions').upsert({
          user_id:  profil.id,
          endpoint: sub.endpoint,
          p256dh:   btoa(String.fromCharCode(...new Uint8Array(key))),
          auth_key: btoa(String.fromCharCode(...new Uint8Array(auth))),
          platform: 'web',
        }, { onConflict: 'endpoint' })
        setPushEnabled(true)
      }
    } catch (e) { console.error('Push toggle error:', e) }
    setPushLaden(false)
  }

  async function pushPrefToggle(key) {
    const newPrefs = { ...pushPrefs, [key]: !pushPrefs[key] }
    setPushPrefs(newPrefs)
    const prefs = profil?.email_benachrichtigungen ?? {}
    await supabase.from('profiles').update({ email_benachrichtigungen: { ...prefs, push: newPrefs } }).eq('id', profil.id)
  }

  const kalenderUrl = kalenderToken
    ? `${SUPABASE_URL}/functions/v1/kalender?token=${kalenderToken}`
    : ''

  async function icalKopieren() {
    if (!kalenderUrl) return
    await navigator.clipboard.writeText(kalenderUrl)
    setIcalKopiert(true)
    setTimeout(() => setIcalKopiert(false), 2000)
  }

  async function kalenderTokenNeu() {
    const neuToken = crypto.randomUUID()
    await supabase.from('profiles').update({ kalender_token: neuToken }).eq('id', profil.id)
    setKalenderToken(neuToken)
  }

  async function notifSpeichern() {
    setNotifLaden(true)
    await supabase.from('profiles').update({ email_benachrichtigungen: notifPrefs }).eq('id', profil.id)
    await ladeProfil(profil.id)
    setNotifErfolg(true)
    setTimeout(() => setNotifErfolg(false), 2000)
    setNotifLaden(false)
  }

  return (
    <div style={{ maxWidth: 600 }}>
      <h1 style={s.h1}>⚙️ {T('settings')}</h1>

      {/* Erscheinungsbild */}
      <div style={s.card}>
        <h2 style={s.h2}>🎨 {T('appearance') ?? 'Erscheinungsbild'}</h2>

        <div style={s.gruppe}>
          <div style={s.gruppeLabel}>{T('language')}</div>
          <div style={{ display: 'flex', gap: 8 }}>
            {['de', 'en', 'tr'].map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{ ...s.langBtn, ...(lang === l ? s.btnAktiv : {}) }}>
                {l === 'de' ? '🇩🇪 Deutsch' : l === 'en' ? '🇬🇧 English' : '🇹🇷 Türkçe'}
              </button>
            ))}
          </div>
        </div>

        <div style={s.gruppe}>
          <div style={s.gruppeLabel}>{darkMode ? T('dark_mode') : T('light_mode')}</div>
          <button onClick={toggleDark}
            style={{ ...s.toggleRow, border: `1.5px solid ${darkMode ? 'var(--primary)' : 'var(--border)'}`, background: darkMode ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : 'var(--bg)' }}>
            <span style={{ fontSize: 18 }}>{darkMode ? '🌙' : '☀️'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{darkMode ? T('dark_mode') : T('light_mode')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{darkMode ? (T('dark_mode_desc') ?? 'Dunkles Erscheinungsbild') : (T('light_mode_desc') ?? 'Helles Erscheinungsbild')}</div>
            </div>
            <div style={{ width: 42, height: 24, borderRadius: 99, background: darkMode ? 'var(--primary)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: darkMode ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left 0.2s' }} />
            </div>
          </button>
        </div>

        <div style={s.gruppe}>
          <div style={s.gruppeLabel}>{T('barrierefreiheit')}</div>
          <button onClick={toggleGrosseSchrift} aria-pressed={großeSchrift}
            style={{ ...s.toggleRow, border: `1.5px solid ${großeSchrift ? 'var(--primary)' : 'var(--border)'}`, background: großeSchrift ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : 'var(--bg)' }}>
            <span style={{ fontSize: 18 }}>{großeSchrift ? '🔡' : '🔠'}</span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{großeSchrift ? T('grosse_schrift') : T('normale_schrift')}</div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{großeSchrift ? 'Schrift um 15% vergrößert' : 'Alle Inhalte in normaler Größe'}</div>
            </div>
            <div style={{ width: 42, height: 24, borderRadius: 99, background: großeSchrift ? 'var(--primary)' : 'var(--border)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
              <div style={{ position: 'absolute', top: 3, left: großeSchrift ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left 0.2s' }} />
            </div>
          </button>
        </div>

        <div style={s.gruppe}>
          <div style={s.gruppeLabel}>{T('theme')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
            {THEME_KEYS.map(key => (
              <button key={key} onClick={() => changeTheme(key)}
                style={{ ...s.themeBtn, ...(theme === key ? s.btnAktiv : {}) }}>
                <span style={{ fontSize: 18 }}>{THEMES[key].icon}</span>
                <span>{THEMES[key].name.de}</span>
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* E-Mail-Benachrichtigungen */}
      <div style={s.card}>
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 20 }}>
          <div>
            <h2 style={{ ...s.h2, marginBottom: 4 }}>{T('email_notifications_title')}</h2>
            <p style={{ margin: 0, fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{T('email_notifications_desc') ?? 'Wähle für welche Ereignisse du eine E-Mail erhalten möchtest.'}</p>
          </div>
          <div style={{ flexShrink: 0, width: 40, height: 40, borderRadius: 'var(--radius)', background: 'color-mix(in srgb, var(--primary) 12%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20 }}>✉️</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {[
            { key: 'new_message',     icon: '💬', label: T('notif_new_message'),    desc: T('notif_new_message_desc') },
            { key: 'event_invite',    icon: '🎤', label: T('notif_event_invite'),   desc: T('notif_event_invite_desc') },
            { key: 'new_piece',       icon: '🎼', label: T('notif_new_piece'),      desc: T('notif_new_piece_desc') },
            { key: 'lesson_reminder', icon: '🗓️', label: T('notif_lesson_reminder') ?? 'Terminerinnerung', desc: T('notif_lesson_reminder_desc') ?? 'Erinnerung 1 Stunde vor dem Unterricht' },
          ].map(opt => (
            <label key={opt.key} onClick={() => setNotifPrefs(p => ({ ...p, [opt.key]: !p[opt.key] }))}
              style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', padding: '14px 16px', borderRadius: 'var(--radius)', border: `1.5px solid ${notifPrefs[opt.key] ? 'var(--primary)' : 'var(--border)'}`, background: notifPrefs[opt.key] ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : 'var(--bg)', transition: 'all 0.15s' }}>
              <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{opt.icon}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{opt.label}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{opt.desc}</div>
              </div>
              <div style={{ flexShrink: 0 }}>
                <div style={{ width: 42, height: 24, borderRadius: 99, background: notifPrefs[opt.key] ? 'var(--primary)' : 'var(--border)', position: 'relative', transition: 'background 0.2s' }}>
                  <div style={{ position: 'absolute', top: 3, left: notifPrefs[opt.key] ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left 0.2s' }} />
                </div>
              </div>
            </label>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
          {notifErfolg ? <div style={{ ...s.erfolg, margin: 0 }}>✓ {T('save')}</div> : <div />}
          <button onClick={notifSpeichern} disabled={notifLaden} style={s.btnPri}>
            {notifLaden ? T('loading') : `💾 ${T('save')}`}
          </button>
        </div>
      </div>

      {/* Push-Benachrichtigungen */}
      <div style={s.card}>
        <h2 style={s.h2}>{T('push_title')}</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{T('push_desc')}</p>

        <button onClick={pushToggle} disabled={pushLaden}
          style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', padding: '14px 16px', borderRadius: 'var(--radius)', border: `1.5px solid ${pushEnabled ? 'var(--primary)' : 'var(--danger)'}`, background: pushEnabled ? 'color-mix(in srgb, var(--primary) 8%, transparent)' : 'color-mix(in srgb, var(--danger) 8%, transparent)', cursor: pushLaden ? 'wait' : 'pointer', fontFamily: 'inherit', marginBottom: pushEnabled ? 12 : 0, transition: 'all 0.2s', opacity: pushLaden ? 0.6 : 1 }}>
          <span style={{ fontSize: 20, flexShrink: 0 }}>{pushEnabled ? '🔔' : '🔕'}</span>
          <div style={{ flex: 1, textAlign: 'left' }}>
            <div style={{ fontWeight: 700, fontSize: 14, color: pushEnabled ? 'var(--primary)' : 'var(--danger)' }}>
              {pushEnabled ? (T('push_active') ?? 'Push aktiviert') : (T('push_inactive') ?? 'Push deaktiviert')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              {pushEnabled ? (T('push_active_desc') ?? 'Tippen um zu deaktivieren') : (T('push_inactive_desc') ?? 'Tippen um zu aktivieren')}
            </div>
          </div>
          <div style={{ width: 42, height: 24, borderRadius: 99, background: pushEnabled ? 'var(--primary)' : 'var(--danger)', position: 'relative', transition: 'background 0.2s', flexShrink: 0 }}>
            <div style={{ position: 'absolute', top: 3, left: pushEnabled ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left 0.2s' }} />
          </div>
        </button>

        {pushEnabled && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {[
              { key: 'new_message',  icon: '💬', label: T('notif_new_message') ?? 'Neue Nachricht',       desc: T('notif_new_message_desc') ?? 'Wenn du eine neue direkte Nachricht erhältst' },
              { key: 'event_invite', icon: '🎤', label: T('notif_event_invite') ?? 'Event-Einladungen',    desc: T('notif_event_invite_desc') ?? 'Bei neuen Events und Einladungen' },
              { key: 'broadcast',    icon: '📢', label: T('msg_broadcast') ?? 'Schulweite Mitteilungen',   desc: T('push_broadcast_desc') ?? 'Ankündigungen für alle Mitglieder' },
              { key: 'kurs',         icon: '🎵', label: T('msg_kurs') ?? 'Kursnachrichten',                desc: T('push_kurs_desc') ?? 'Nachrichten in deinen Kursen' },
            ].map(opt => (
              <label key={opt.key} onClick={() => pushPrefToggle(opt.key)}
                style={{ display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', padding: '14px 16px', borderRadius: 'var(--radius)', border: `1.5px solid ${pushPrefs[opt.key] ? 'var(--primary)' : 'var(--border)'}`, background: pushPrefs[opt.key] ? 'color-mix(in srgb, var(--primary) 6%, transparent)' : 'var(--bg)', transition: 'all 0.15s' }}>
                <div style={{ width: 36, height: 36, borderRadius: 'var(--radius)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18, flexShrink: 0 }}>{opt.icon}</div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{opt.label}</div>
                  <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{opt.desc}</div>
                </div>
                <div style={{ flexShrink: 0 }}>
                  <div style={{ width: 42, height: 24, borderRadius: 99, background: pushPrefs[opt.key] ? 'var(--primary)' : 'var(--border)', position: 'relative', transition: 'background 0.2s' }}>
                    <div style={{ position: 'absolute', top: 3, left: pushPrefs[opt.key] ? 21 : 3, width: 18, height: 18, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 4px rgba(0,0,0,.2)', transition: 'left 0.2s' }} />
                  </div>
                </div>
              </label>
            ))}
          </div>
        )}
      </div>

      {/* Kalender-Abonnement */}
      <div style={s.card}>
        <h2 style={s.h2}>{T('ical_title')}</h2>
        <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{T('ical_desc')}</p>
        {kalTokenLaden ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{T('ical_loading')}</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Feld label={T('ical_url_label')}>
              <div style={{ display: 'flex', gap: 8 }}>
                <input readOnly value={kalenderUrl}
                  style={{ ...s.input, color: 'var(--text-3)', fontSize: 12, flex: 1 }}
                  onFocus={e => e.target.select()} />
                <button onClick={icalKopieren} style={{ ...s.btnPri, whiteSpace: 'nowrap', flexShrink: 0 }}>
                  {icalKopiert ? `✓ ${T('ical_copied')}` : T('ical_copy')}
                </button>
              </div>
            </Feld>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button onClick={kalenderTokenNeu}
                style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}>
                🔄 {T('ical_reset')}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Onboarding-Tour (nur Schüler) */}
      {rolle === 'schueler' && (
        <div style={s.card}>
          <h2 style={s.h2}>🗺️ {T('onb_restart')}</h2>
          <p style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>
            {T('onb_restart_desc')}
          </p>
          <button
            onClick={() => { localStorage.removeItem(ONBOARDING_LS_KEY); navigate('/schueler') }}
            style={{ padding: '10px 20px', borderRadius: 'var(--radius)', border: '1.5px solid var(--primary)', background: 'var(--bg)', color: 'var(--primary)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
            {T('onb_restart')}
          </button>
        </div>
      )}
    </div>
  )
}

function Feld({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>{label}</label>
      {children}
    </div>
  )
}

const s = {
  h1:        { margin: '0 0 24px', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' },
  h2:        { margin: '0 0 16px', fontSize: 16, fontWeight: 800, color: 'var(--text)' },
  card:      { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '20px 24px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: 16 },
  gruppe:    { marginBottom: 20 },
  gruppeLabel: { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 10 },
  langBtn:   { padding: '8px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  themeBtn:  { display: 'flex', alignItems: 'center', gap: 8, padding: '10px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text-2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  toggleRow: { display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer', padding: '14px 16px', borderRadius: 'var(--radius)', transition: 'all 0.15s', width: '100%', fontFamily: 'inherit' },
  btnAktiv:  { background: 'var(--primary)', color: 'var(--primary-fg)', borderColor: 'var(--primary)' },
  input:     { padding: '10px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', width: '100%' },
  btnPri:    { padding: '10px 20px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  erfolg:    { padding: '12px 16px', borderRadius: 'var(--radius)', background: '#d1fae5', color: '#065f46', fontWeight: 600, fontSize: 14, marginBottom: 16 },
}
