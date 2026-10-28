import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { QrCode } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Blatt, Knopf, eingabeStil } from '../ui'
import { useKameraScan, KameraVollbild } from './kamera'

// Code aus gescanntem QR lesen: Link …/session/ABC123 oder nur der Code
export function codeAusQr(text) {
  const t = String(text ?? '').trim()
  const link = t.match(/\/session\/([A-Za-z0-9]{4,8})(?:[/?#]|$)/)
  if (link) return link[1].toUpperCase()
  return /^[A-Za-z0-9]{4,8}$/.test(t) ? t.toUpperCase() : null
}

// Live-Unterricht per Code beitreten (Start und Ich)
export default function LiveBeitretenBlatt({ onClose }) {
  const { T } = useApp()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState(false)
  const [scannen, setScannen] = useState(false)
  const [scanFehler, setScanFehler] = useState(false)

  function oeffnen(c) {
    onClose()
    navigate(`/session/${c}`)
  }

  function beitreten(e) {
    e.preventDefault()
    const c = code.trim().toUpperCase()
    if (c.length < 4) { setFehler(true); return }
    oeffnen(c)
  }

  function gescannt(text) {
    const c = codeAusQr(text)
    if (c) { oeffnen(c); return }
    setScannen(false); setScanFehler(true)
  }

  if (scannen) return <QrScanner onErkannt={gescannt} onClose={() => setScannen(false)} />

  return (
    <Blatt titel={T('n_live_beitreten')} onClose={onClose}>
      <form onSubmit={beitreten} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Knopf type="button" voll variante="tint" icon={QrCode} onClick={() => { setScanFehler(false); setScannen(true) }}>{T('nj_qr_scannen')}</Knopf>
        {scanFehler && <div role="alert" style={{ fontSize: 16, fontWeight: 600, color: 'var(--danger)' }}>{T('nj_qr_ungueltig')}</div>}
        <p style={{ margin: 0, fontSize: 17, color: 'var(--text-2)', lineHeight: 1.5 }}>{T('nj_code_hinweis')}</p>
        <input value={code} onChange={e => { setCode(e.target.value.toUpperCase()); setFehler(false) }}
          aria-label={T('session_code_label')} aria-invalid={fehler} placeholder="ABC123" maxLength={6}
          autoComplete="off" autoCapitalize="characters" spellCheck={false}
          style={{ ...eingabeStil, minHeight: 64, fontSize: 30, fontWeight: 800, letterSpacing: '0.25em', textAlign: 'center', fontFamily: 'ui-monospace, monospace' }} />
        {fehler && <div role="alert" style={{ fontSize: 16, fontWeight: 600, color: 'var(--danger)' }}>{T('nj_code_ungueltig')}</div>}
        <Knopf type="submit" voll>{T('nj_beitreten')}</Knopf>
      </form>
    </Blatt>
  )
}

const QR_FORMATE = ['qr_code']

function QrScanner({ onErkannt, onClose }) {
  const { T } = useApp()
  const { videoRef, canvasRef, fehler } = useKameraScan(onErkannt, QR_FORMATE)
  return <KameraVollbild titel={T('nj_qr_scannen')} hinweis={T('nj_qr_hinweis')} rahmen={{ w: 240, h: 240 }} onClose={onClose}
    videoRef={videoRef} canvasRef={canvasRef} fehler={fehler} />
}
