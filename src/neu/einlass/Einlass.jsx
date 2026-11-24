// Einlass: ein großer Knopf, dann Kamera; Ergebnis bildschirmfüllend grün oder rot
import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Check, ScanLine, X } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Seite, Gruppe, Trenner, Zeile, Knopf, Leer, Laden, FehlerText } from '../../ui'
import { useBasis } from '../rolle'
import { useNeuLaden } from '../daten'
import { uhrzeit } from '../zeit'
import { useKameraScan, KameraVollbild } from '../kamera'
import { useScanEvents, ticketAusQr, ticketScannen, tagAusgeschrieben } from '../tickets'

const QR_FORMATE = ['qr_code']
const GRUEN_MS = 1800          // Grün verschwindet von selbst
const GLEICHER_CODE_MS = 4000  // dasselbe Ticket vor der Kamera nicht sofort nochmal melden

export default function Einlass() {
  const { T, lang } = useApp()
  const basis = useBasis()
  const navigate = useNavigate()
  const neuLaden = useNeuLaden()
  const [params] = useSearchParams()
  const { data: events = [], isLoading, isError } = useScanEvents()
  const [scannt, setScannt] = useState(false)
  const schliessen = useCallback(() => { setScannt(false); neuLaden('n-scan-events', 'na-ticket-bestellungen') }, [neuLaden])

  const heute = events.filter(e => e.scanbar)
  const ev = params.get('event') ? events.find(e => e.id === params.get('event')) : (heute.length === 1 ? heute[0] : null)
  const zurueck = params.get('event') ? { onClick: () => window.history.state?.idx > 0 ? navigate(-1) : navigate(basis), label: T('back') } : { to: basis, label: T('n_tab_start') }

  if (isLoading) return <Seite titel={T('ei_titel')} zurueck={zurueck}><div style={{ marginTop: 20 }}><Laden hoehe={240} /></div></Seite>
  if (isError) return <Seite titel={T('ei_titel')} zurueck={zurueck}><div style={{ margin: 20 }}><FehlerText>{T('tk_laden_fehler')}</FehlerText></div></Seite>
  if (!ev) return (
    <Seite titel={T('ei_titel')} zurueck={zurueck}>
      <div style={{ marginTop: 20 }}>
        {events.length === 0 ? <Leer text={T('ei_keine')} /> : (
          <Gruppe>{events.map((e, i) => <div key={e.id}>{i > 0 && <Trenner />}<Zeile icon={ScanLine} titel={e.titel} untertitel={tagAusgeschrieben(e.beginn, e.zeitzone, lang)} to={`/einlass?event=${e.id}`} /></div>)}</Gruppe>
        )}
      </div>
    </Seite>
  )

  return (
    <Seite titel={ev.titel} zurueck={zurueck}>
      <div style={{ margin: '6px 20px 0', fontSize: 18, color: 'var(--text-2)' }}>{tagAusgeschrieben(ev.beginn, ev.zeitzone, lang)}</div>
      <div style={{ margin: '24px 20px 0', padding: 28, borderRadius: 24, background: 'var(--n-fill)', textAlign: 'center' }}>
        <div style={{ fontSize: 52, fontWeight: 800, lineHeight: 1 }}>{ev.eingelassen}</div>
        <div style={{ marginTop: 8, fontSize: 18, color: 'var(--text-2)' }}>{T('ei_von_drin').replace('{n}', ev.gesamt)}</div>
        {ev.scanbar
          ? <Knopf voll icon={ScanLine} onClick={() => setScannt(true)} style={{ marginTop: 24, height: 64, fontSize: 20 }}>{T('ei_scannen')}</Knopf>
          : <p role="status" style={{ margin: '20px 0 0', fontSize: 18, fontWeight: 600 }}>{T('ei_zu_frueh').replace('{zeit}', tagAusgeschrieben(ev.ab, ev.zeitzone, lang))}</p>}
      </div>
      {scannt && <Scanner ev={ev} onClose={schliessen} />}
    </Seite>
  )
}

export function Scanner({ ev, onClose }) {
  const { T, lang } = useApp()
  const [ergebnis, setErgebnis] = useState(null)   // null = Kamera; { ergebnis, … } inkl. 'pruefe'
  const [stand, setStand] = useState({ eingelassen: ev.eingelassen, gesamt: ev.gesamt })
  const beschaeftigt = useRef(false)
  const letzter = useRef({ text: '', bis: 0 })
  const offen = useRef(null)                       // { code, scanId } für „Nochmal“

  const weiter = useCallback(() => {
    letzter.current.bis = Date.now() + GLEICHER_CODE_MS
    beschaeftigt.current = false
    setErgebnis(null)
  }, [])

  async function pruefen() {
    setErgebnis({ ergebnis: 'pruefe' })
    const { code, scanId } = offen.current
    const r = await ticketScannen(ev.id, code, scanId)
    if (r.gesamt != null) setStand({ eingelassen: r.eingelassen, gesamt: r.gesamt })
    zeigen(r)
  }

  function zeigen(r) {
    try { navigator.vibrate?.(r.ergebnis === 'ok' ? 80 : [180, 90, 180]) } catch { /* nicht überall erlaubt */ }
    setErgebnis(r)
  }

  function erkannt(text) {
    if (beschaeftigt.current || (text === letzter.current.text && Date.now() < letzter.current.bis)) return
    beschaeftigt.current = true
    letzter.current = { text, bis: 0 }
    const code = ticketAusQr(text)
    if (!code) { zeigen({ ergebnis: 'unbekannt' }); return }
    offen.current = { code, scanId: crypto.randomUUID() }
    pruefen()
  }

  const { videoRef, canvasRef, fehler } = useKameraScan(erkannt, QR_FORMATE, { dauerhaft: true })

  useEffect(() => {
    if (ergebnis?.ergebnis !== 'ok') return
    const t = setTimeout(weiter, GRUEN_MS)
    return () => clearTimeout(t)
  }, [ergebnis, weiter])

  return (
    <KameraVollbild titel={ev.titel} hinweis={T('ei_hinweis')} rahmen={{ w: 260, h: 260 }} onClose={onClose} videoRef={videoRef} canvasRef={canvasRef} fehler={fehler}
      zeigeKamera={!ergebnis}
      unten={<div style={{ padding: '14px 16px calc(14px + env(safe-area-inset-bottom, 0px))', textAlign: 'center', fontSize: 20, fontWeight: 800 }}>{T('ei_stand').replace('{a}', stand.eingelassen).replace('{n}', stand.gesamt)}</div>}>
      {ergebnis && <Ergebnis r={ergebnis} zeit={iso => iso ? uhrzeit(iso, ev.zeitzone ?? 'Europe/Berlin', lang) : ''} onWeiter={weiter} onNochmal={pruefen} />}
    </KameraVollbild>
  )
}

const TEXTE = {
  ok: 'ei_ok', schon_eingeloest: 'ei_schon', storniert: 'ei_storniert', falsche_veranstaltung: 'ei_falsch',
  unbekannt: 'ei_unbekannt', zu_frueh: 'ei_noch_zu_frueh', vorbei: 'ei_vorbei', verboten: 'ei_verboten', netz: 'ei_netz', demo: 'ei_demo',
}

function Ergebnis({ r, zeit, onWeiter, onNochmal }) {
  const { T } = useApp()
  if (r.ergebnis === 'pruefe') return <div role="status" style={{ ...flaeche, background: '#000', fontSize: 24, fontWeight: 700 }}>{T('ei_pruefe')}</div>
  const ok = r.ergebnis === 'ok'
  const netz = r.ergebnis === 'netz'
  const Icon = ok ? Check : X
  const zusatz = r.ergebnis === 'schon_eingeloest' ? T('ei_schon_um').replace('{zeit}', zeit(r.eingeloest_am))
    : r.ergebnis === 'falsche_veranstaltung' ? r.event_titel : netz ? T('ei_netz_hinweis') : null
  return (
    <div role={ok ? 'status' : 'alert'} onClick={ok ? onWeiter : undefined} style={{ ...flaeche, background: ok ? '#15803D' : netz ? '#92400E' : '#B91C1C' }}>
      <Icon aria-hidden="true" size={150} strokeWidth={3} />
      <div style={{ fontSize: 38, fontWeight: 800, lineHeight: 1.15 }}>{T(TEXTE[r.ergebnis] ?? 'ei_unbekannt')}</div>
      {zusatz && <div style={{ fontSize: 24, fontWeight: 600, overflowWrap: 'anywhere' }}>{zusatz}</div>}
      {!ok && (
        <div style={{ width: 'min(360px, 100%)', display: 'flex', flexDirection: 'column', gap: 12, marginTop: 20 }}>
          {netz && <button onClick={onNochmal} style={{ ...grosserKnopf, background: '#FFFFFF', color: '#111114' }}>{T('ei_nochmal')}</button>}
          <button onClick={onWeiter} style={netz ? { ...grosserKnopf, background: 'rgba(255,255,255,0.18)', color: '#FFFFFF' } : { ...grosserKnopf, background: '#FFFFFF', color: '#111114' }}>{T('ei_weiter')}</button>
        </div>
      )}
    </div>
  )
}

const flaeche = { flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center', gap: 14, padding: 24, color: '#FFFFFF' }
const grosserKnopf = { height: 64, borderRadius: 16, border: 'none', fontFamily: 'inherit', fontSize: 20, fontWeight: 800, cursor: 'pointer' }
