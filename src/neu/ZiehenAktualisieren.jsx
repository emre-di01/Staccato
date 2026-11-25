import { useRef, useState } from 'react'
import { RotateCw } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { datenNeuLaden, versionBereit, versionSuchen, useZiehen, ZIEH_SCHWELLE } from '../lib/aktualisieren'

// Handy: am Seitenanfang nach unten ziehen lädt die Daten neu (als PWA gibt es keinen Neu-laden-Knopf)
export default function ZiehenAktualisieren({ aktiv }) {
  const { T, toast, session, ladeProfil } = useApp()
  const [zug, setZug] = useState(0)
  const [laedt, setLaedt] = useState(false)
  const laeuft = useRef(false)
  const uid = session?.user?.id

  async function los(erreicht) {
    setZug(0)
    if (!erreicht || laeuft.current) return
    laeuft.current = true
    setLaedt(true)
    try {
      versionSuchen()
      const ok = await datenNeuLaden()
      if (!ok) { toast(T('n_keine_verbindung'), 'error'); return }
      // Neue Version gleich übernehmen, außer es könnte gerade etwas eingetippt sein
      if (versionBereit() && !document.querySelector('#n-inhalt input, #n-inhalt textarea')) { window.location.reload(); return }
      if (uid) await ladeProfil(uid)
    } finally {
      laeuft.current = false
      setLaedt(false)
    }
  }

  useZiehen(aktiv && !laedt, setZug, los)

  const y = laedt ? ZIEH_SCHWELLE : zug
  return (
    <>
      <div role="status" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clipPath: 'inset(50%)' }}>{laedt ? T('n_aktualisiert_gerade') : ''}</div>
      {y > 0 && (
        <div aria-hidden="true" style={{
          position: 'fixed', top: 'env(safe-area-inset-top, 0px)', left: '50%', zIndex: 900, width: 44, height: 44, marginLeft: -22, borderRadius: 22,
          display: 'flex', alignItems: 'center', justifyContent: 'center', pointerEvents: 'none',
          background: 'var(--bg)', color: 'var(--primary)', border: '1px solid var(--n-sep)', boxShadow: 'var(--shadow-lg)',
          transform: `translateY(${y - 48}px)`, opacity: Math.min(1, y / ZIEH_SCHWELLE),
        }}>
          <RotateCw size={22} style={laedt ? { animation: 'nDreh .8s linear infinite' } : { transform: `rotate(${y * 3}deg)` }} />
        </div>
      )}
      <style>{'@keyframes nDreh { to { transform: rotate(360deg) } }'}</style>
    </>
  )
}
