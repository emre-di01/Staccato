// Termin-Karten der neuen Oberfläche (Termine-Seite, Kursdetail)
import { useApp } from '../context/AppContext'
import { Knopf } from '../ui'
import { uhrzeit, wochentagKurz, tagDesMonats, tagKey } from './zeit'

export function Karte({ beginn, akzent, titel, unter, status, statusFarbe, children }) {
  const { lang, zeitzone } = useApp()
  const heute = tagKey(beginn, zeitzone) === tagKey(new Date().toISOString(), zeitzone)
  return (
    <article style={{ borderRadius: 18, background: 'var(--n-fill)', padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
        <div aria-hidden="true" style={{ width: 56, flexShrink: 0, textAlign: 'center', borderRadius: 12, background: 'var(--bg)', padding: '6px 0' }}>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: '0.04em', color: heute ? 'var(--primary)' : (akzent ?? 'var(--text-2)') }}>{wochentagKurz(beginn, zeitzone, lang)}</div>
          <div style={{ fontSize: 24, fontWeight: 800, lineHeight: 1.1 }}>{tagDesMonats(beginn, zeitzone)}</div>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 17, fontWeight: 700, overflowWrap: 'anywhere' }}>{titel}</div>
          <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{unter}</div>
          {status && <div style={{ marginTop: 4, fontSize: 15, fontWeight: 600, color: statusFarbe }}>{status}</div>}
        </div>
      </div>
      {children}
    </article>
  )
}

// `titel` überschreibt den Kursnamen (im Kursdetail steht stattdessen die Uhrzeit oben)
export function StundeKarte({ s, titel, onUmschalten, sendet }) {
  const { T, lang, zeitzone } = useApp()
  const abgesagt = s.status === 'abgesagt'
  const entschuldigt = s.meine?.status === 'entschuldigt'
  const andererStatus = s.meine && !entschuldigt   // bereits erfasst (anwesend o. ä.) → nicht mehr änderbar
  const zeit = `${uhrzeit(s.beginn, zeitzone, lang)} – ${uhrzeit(s.ende, zeitzone, lang)}`
  return (
    <Karte beginn={s.beginn} titel={titel ?? s.unterricht?.name} unter={[zeit, s.raum].filter(Boolean).join(' · ')}
      status={abgesagt ? T('n_faellt_aus') : entschuldigt ? T('n_du_bist_entschuldigt') : T('n_du_bist_dabei')}
      statusFarbe={abgesagt ? 'var(--danger)' : entschuldigt ? 'var(--text-2)' : 'var(--success)'}>
      {!abgesagt && !andererStatus && new Date(s.beginn) > Date.now() && (
        <div style={{ display: 'flex' }}>
          <Knopf klein variante="rahmen" onClick={onUmschalten} disabled={sendet}>{entschuldigt ? T('n_doch_dabei') : T('n_ich_kann_nicht')}</Knopf>
        </div>
      )}
    </Karte>
  )
}

export function EventKarte({ ev, onAntwort, sendet }) {
  const { T, lang, zeitzone } = useApp()
  const zeit = ev.ende ? `${uhrzeit(ev.beginn, zeitzone, lang)} – ${uhrzeit(ev.ende, zeitzone, lang)}` : uhrzeit(ev.beginn, zeitzone, lang)
  const ort = ev.ort || ev.raeume?.name
  const status = ev.zusage === 'zugesagt' ? T('n_zugesagt') : ev.zusage === 'abgesagt' ? T('n_abgesagt') : ev.eingeladen ? T('n_bitte_zusagen') : null
  const farbe = ev.zusage === 'zugesagt' ? 'var(--success)' : ev.zusage === 'abgesagt' ? 'var(--text-2)' : 'var(--primary)'
  const offen = !ev.zusage || ev.zusage === 'offen'
  return (
    <Karte beginn={ev.beginn} akzent="#2563EB" titel={ev.titel}
      unter={[T(`n_evt_${ev.typ}`), zeit, ort].filter(Boolean).join(' · ')} status={status} statusFarbe={farbe}>
      {offen ? (
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
          <Knopf style={{ flex: '1 1 140px', height: 48 }} onClick={() => onAntwort('zugesagt')} disabled={sendet}>{T('n_ich_bin_dabei')}</Knopf>
          <Knopf style={{ flex: '1 1 140px', height: 48 }} variante="rahmen" onClick={() => onAntwort('abgesagt')} disabled={sendet}>{T('n_ich_kann_nicht')}</Knopf>
        </div>
      ) : (
        <div style={{ display: 'flex' }}>
          <Knopf klein variante="rahmen" disabled={sendet} onClick={() => onAntwort(ev.zusage === 'zugesagt' ? 'abgesagt' : 'zugesagt')}>
            {ev.zusage === 'zugesagt' ? T('n_doch_absagen') : T('n_doch_zusagen')}
          </Knopf>
        </div>
      )}
    </Karte>
  )
}
