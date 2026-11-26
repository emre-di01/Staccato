// Probe-Code: ein QR-Code ohne Ticket, damit Helfer vorher testen können, ob ihr Handy liest
import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { useApp } from '../../context/AppContext'
import { Blatt, Laden } from '../../ui'
import { PROBE_QR } from '../tickets'

export function ProbeQr({ groesse = 260 }) {
  const { T } = useApp()
  const [bild, setBild] = useState(null)
  useEffect(() => {
    let aktiv = true
    QRCode.toDataURL(PROBE_QR, { width: 640, margin: 1, color: { dark: '#111114', light: '#FFFFFF' } }).then(u => aktiv && setBild(u)).catch(() => {})
    return () => { aktiv = false }
  }, [])
  if (!bild) return <Laden hoehe={groesse} />
  return <img src={bild} alt={T('ei_probe_titel')} width={groesse} height={groesse} style={{ display: 'block', margin: '0 auto', borderRadius: 16, background: '#FFFFFF' }} />
}

export default function ProbeCode({ onClose }) {
  const { T } = useApp()
  return (
    <Blatt titel={T('ei_probe_titel')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
        <p style={{ margin: 0, fontSize: 17, lineHeight: 1.45, color: 'var(--text-2)' }}>{T('ei_probe_hinweis')}</p>
        <ProbeQr />
      </div>
    </Blatt>
  )
}
