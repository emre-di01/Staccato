import { useEffect, useState } from 'react'
import { Blatt } from '../../ui'

const BREIT = '(min-width: 1180px)'

// true, wenn Liste und Detail nebeneinander passen (großer Bildschirm mit Seitenleiste)
export function useBreit() {
  const [breit, setBreit] = useState(() => window.matchMedia?.(BREIT).matches ?? false)
  useEffect(() => {
    const mq = window.matchMedia?.(BREIT)
    if (!mq) return
    const f = e => setBreit(e.matches)
    mq.addEventListener('change', f)
    return () => mq.removeEventListener('change', f)
  }, [])
  return breit
}

// Initialen-Kreis bzw. Profilbild
export function Avatar({ name, bild, groesse = 40, farbe }) {
  const initialen = (name ?? '?').split(' ').map(w => w[0]).filter(Boolean).slice(0, 2).join('').toUpperCase()
  const gross = groesse > 50
  return (
    <span aria-hidden="true" style={{ width: groesse, height: groesse, flexShrink: 0, borderRadius: groesse / 2, background: farbe ?? (gross ? 'var(--n-tint)' : 'var(--bg)'), color: farbe ? '#FFFFFF' : gross ? 'var(--n-tint-fg)' : 'var(--text-2)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: Math.round(groesse * 0.36), fontWeight: 700, overflow: 'hidden' }}>
      {bild ? <img src={bild} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : initialen}
    </span>
  )
}

// Liste links, Detail rechts (breit) – sonst Detail im Blatt
export function ListeDetail({ breit, liste, detail, detailLabel, blattTitel, onSchliessen, blattVerstecken }) {
  return (
    <>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 32, alignItems: 'flex-start', marginTop: 18 }}>
        <section style={{ flex: '1 1 380px', minWidth: 0 }}>{liste}</section>
        {breit && detail && (
          <section aria-label={detailLabel} style={{ flex: '1 1 400px', minWidth: 0, maxWidth: 480, marginRight: 20, padding: 24, borderRadius: 24, background: 'var(--n-fill)', position: 'sticky', top: 24 }}>
            {detail}
          </section>
        )}
      </div>
      {!breit && detail && !blattVerstecken && <Blatt titel={blattTitel} onClose={onSchliessen}>{detail}</Blatt>}
    </>
  )
}

// Bausteine für die Detailspalte (auf grauem Grund → weiße Gruppen)
export function DetailTitel({ children }) {
  return <h3 style={{ margin: '24px 0 8px', fontSize: 15, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-2)' }}>{children}</h3>
}

export function DetailGruppe({ children }) {
  return <div style={{ borderRadius: 18, background: 'var(--bg)', overflow: 'hidden' }}>{children}</div>
}

export function Info({ label, children }) {
  if (!children) return null
  return (
    <div style={{ padding: '12px 16px' }}>
      <div style={{ fontSize: 14, color: 'var(--text-2)' }}>{label}</div>
      <div style={{ fontSize: 17, overflowWrap: 'anywhere', whiteSpace: 'pre-wrap' }}>{children}</div>
    </div>
  )
}
