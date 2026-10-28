import { Printer } from 'lucide-react'
import { createPortal } from 'react-dom'
import { useApp } from '../context/AppContext'
import { Blatt, Knopf } from '../ui'
import Modal from './Modal'

// Dialog-Hülle für Komponenten, die in beiden Oberflächen vorkommen:
// im neuen Design ein Blatt (Eingaben über .n-dialog angeglichen), sonst das klassische Modal
export default function Dialog({ titel, onClose, maxWidth, maxHeight, children }) {
  const { neuesDesign } = useApp()
  if (neuesDesign) return <Blatt titel={titel} onClose={onClose}><div className="n-dialog">{children}</div></Blatt>
  return <Modal titel={titel} onClose={onClose} maxWidth={maxWidth} maxHeight={maxHeight}>{children}</Modal>
}

// Dokument-Dialoge (Zertifikat, Kursanmeldung, Aufnahmeantrag): Vorschau + „Als PDF speichern“.
// Neu: Blatt mit großem Druck-Knopf unten. Klassisch: Fenster mit Knöpfen in der Kopfzeile.
export function DokumentDialog({ titel, titelAlt, onDrucken, onClose, maxWidth = 600, children }) {
  const { neuesDesign, T } = useApp()
  if (neuesDesign) return (
    <Blatt titel={titel} onClose={onClose}>
      <div className="n-dialog" style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {children}
        <Knopf voll icon={Printer} onClick={onDrucken}>{T('nb_als_pdf')}</Knopf>
      </div>
    </Blatt>
  )
  return createPortal(
    <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.65)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth, maxHeight:'92vh', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'16px 20px', borderBottom:'1px solid var(--border)', flexShrink:0 }}>
          <span style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{titelAlt}</span>
          <div style={{ display:'flex', gap:10 }}>
            <button onClick={onDrucken} style={{ padding:'8px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              🖨 Als PDF speichern
            </button>
            <button onClick={onClose} aria-label="Schließen" className="modal-schliessen" style={{ padding:'8px 12px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'transparent', color:'var(--text)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>✕</button>
          </div>
        </div>
        <div style={{ overflowY:'auto', padding:'20px 24px', display:'flex', flexDirection:'column', gap:20 }}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  )
}
