import { useEffect } from 'react'
import { createPortal } from 'react-dom'

export default function Modal({ titel, onClose, children, maxWidth = 480, maxHeight = '90vh' }) {
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [])

  return createPortal(
    <div
      className="modal-overlay"
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        className="modal-inner"
        style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight, display:'flex', flexDirection:'column', overflow:'hidden' }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 28px 0', flexShrink:0 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>{titel}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 }}>✕</button>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:'20px 28px 28px', overscrollBehavior:'contain' }}>
          {children}
        </div>
      </div>
    </div>
  , document.body)
}
