import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { CircleCheck, CircleAlert, Radio, ScanLine } from 'lucide-react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { Blatt, Knopf } from '../ui'
import { useKameraScan, KameraVollbild } from './kamera'
import { useNeuLaden } from './daten'
import { uhrzeit } from './zeit'

// ─── QR-Einchecken ────────────────────────────────────────────
// Zwei Arten von Codes, beide nur in der App auswertbar:
//  • Raum-Aufkleber: „staccato:raum:<token>“ (kein Link, die Handy-Kamera öffnet damit nichts)
//  • Live-Unterricht/Beamer: Beitritts-Link …/session/<code>?ci=<token>; ci wechselt alle 30 s.
//    Mit der Handy-Kamera gescannt wird nur beigetreten, eingecheckt wird nur über die App.
export const RAUM_PREFIX = 'staccato:raum:'

export function raumQrInhalt(token) {
  return RAUM_PREFIX + token
}

export function checkinAusQr(text) {
  const t = String(text ?? '').trim()
  if (t.toLowerCase().startsWith(RAUM_PREFIX)) {
    const token = t.slice(RAUM_PREFIX.length)
    return /^[A-Za-z0-9]{8,64}$/.test(token) ? { art: 'raum', token } : null
  }
  const link = t.match(/\/session\/([A-Za-z0-9]{4,8})(?:[/?#]|$)/)
  if (link) {
    const ci = t.match(/[?&]ci=([A-Za-z0-9]{8,64})/)
    return ci ? { art: 'stunde', token: ci[1], code: link[1].toUpperCase() } : { art: 'session', code: link[1].toUpperCase() }
  }
  return null
}

// Ruft einchecken() auf und lädt die Termine neu. Ergebnis: { ok, grund?, status?, kurs?, beginn?, schon? }
export function useEinchecken() {
  const neuLaden = useNeuLaden()
  return async function einchecken(art, token) {
    const { data, error } = await supabase.rpc('einchecken', { p_art: art, p_token: token })
    if (error) return { ok: false, grund: 'fehler' }
    if (data?.ok) neuLaden('n-stunden')
    return data ?? { ok: false, grund: 'fehler' }
  }
}

const QR_FORMATE = ['qr_code']

// Scanner → Prüfen → Ergebnis. Ein Beitritts-Link ohne ci führt direkt in den Live-Unterricht.
export default function EincheckenBlatt({ onClose }) {
  const { T } = useApp()
  const navigate = useNavigate()
  const einchecken = useEinchecken()
  const [phase, setPhase] = useState('scan')   // scan | pruefe | ergebnis
  const [ergebnis, setErgebnis] = useState(null)
  const [liveCode, setLiveCode] = useState(null)

  async function gescannt(text) {
    const qr = checkinAusQr(text)
    if (qr?.art === 'session') { onClose(); navigate(`/session/${qr.code}`); return }
    if (!qr) { setErgebnis({ ok: false, grund: 'ungueltig' }); setPhase('ergebnis'); return }
    setPhase('pruefe')
    setLiveCode(qr.code ?? null)
    setErgebnis(await einchecken(qr.art, qr.token))
    setPhase('ergebnis')
  }

  if (phase === 'scan') return <Scanner onErkannt={gescannt} onClose={onClose} />

  return (
    <Blatt titel={T('ci_einchecken')} onClose={onClose}>
      {phase === 'pruefe' ? (
        <div role="status" style={{ padding: '32px 0', textAlign: 'center', fontSize: 18, color: 'var(--text-2)' }}>{T('ci_pruefe')}</div>
      ) : (
        <Ergebnis ergebnis={ergebnis}>
          {ergebnis?.ok && liveCode && (
            <Knopf voll icon={Radio} onClick={() => { onClose(); navigate(`/session/${liveCode}`) }}>{T('ci_live_oeffnen')}</Knopf>
          )}
          {!ergebnis?.ok && <Knopf voll icon={ScanLine} onClick={() => { setErgebnis(null); setPhase('scan') }}>{T('ci_nochmal')}</Knopf>}
          <Knopf voll variante="sekundaer" onClick={onClose}>{T('ci_fertig')}</Knopf>
        </Ergebnis>
      )}
    </Blatt>
  )
}

function Scanner({ onErkannt, onClose }) {
  const { T } = useApp()
  const { videoRef, canvasRef, fehler } = useKameraScan(onErkannt, QR_FORMATE)
  return <KameraVollbild titel={T('ci_einchecken')} hinweis={T('ci_scan_hinweis')} rahmen={{ w: 240, h: 240 }} onClose={onClose}
    videoRef={videoRef} canvasRef={canvasRef} fehler={fehler} />
}

export function fehlerText(T, ergebnis) {
  const g = ergebnis?.grund
  const key = { ungueltig: 'ci_ungueltig', abgelaufen: 'ci_abgelaufen', keine_stunde: 'ci_keine_stunde', nicht_im_kurs: 'ci_nicht_im_kurs', schon_erfasst: 'ci_schon_erfasst' }[g] ?? 'ci_fehler'
  return T(key).replace('{kurs}', ergebnis?.kurs ?? '')
}

function Ergebnis({ ergebnis, children }) {
  const { T, lang, zeitzone } = useApp()
  const ok = !!ergebnis?.ok
  const Icon = ok ? CircleCheck : CircleAlert
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div role={ok ? 'status' : 'alert'} style={{ padding: '8px 0 12px', textAlign: 'center' }}>
        <span style={{ width: 72, height: 72, margin: '0 auto', borderRadius: 36, background: ok ? 'var(--success)' : 'var(--danger)', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon aria-hidden="true" size={38} strokeWidth={2.2} />
        </span>
        <div style={{ marginTop: 14, fontSize: 24, fontWeight: 800 }}>{ok ? T(ergebnis.schon ? 'ci_schon' : 'ci_erfolg') : T('ci_nicht_geklappt')}</div>
        {ok ? (
          <div style={{ marginTop: 6, fontSize: 17, lineHeight: 1.45, color: 'var(--text-2)' }}>
            {ergebnis.kurs}{ergebnis.beginn ? ` · ${uhrzeit(ergebnis.beginn, zeitzone, lang)}` : ''}
            {ergebnis.status === 'zu_spaet' && <div style={{ marginTop: 4, fontWeight: 600, color: 'var(--text)' }}>{T('ci_zu_spaet')}</div>}
          </div>
        ) : (
          <div style={{ marginTop: 6, fontSize: 17, lineHeight: 1.45, color: 'var(--text-2)' }}>{fehlerText(T, ergebnis)}</div>
        )}
      </div>
      {children}
    </div>
  )
}
