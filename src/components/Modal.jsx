import { useEffect, useId, useRef } from 'react'
import { createPortal } from 'react-dom'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])'

export default function Modal({ titel, onClose, children, maxWidth = 480, maxHeight = '90vh' }) {
  const titleId  = useId()
  const modalRef = useRef(null)

  useEffect(() => {
    const scrollbarWidth = window.innerWidth - document.documentElement.clientWidth
    const prevOverflow = document.body.style.overflow
    const prevPadding = document.body.style.paddingRight
    document.body.style.overflow = 'hidden'
    document.body.style.paddingRight = scrollbarWidth + 'px'
    return () => {
      document.body.style.overflow = prevOverflow
      document.body.style.paddingRight = prevPadding
    }
  }, [])

  useEffect(() => {
    const el = modalRef.current
    if (!el) return
    const first = el.querySelector(FOCUSABLE)
    ;(first ?? el).focus()

    function handleKeyDown(e) {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab') return
      const nodes = [...el.querySelectorAll(FOCUSABLE)]
      if (!nodes.length) { e.preventDefault(); return }
      const first = nodes[0], last = nodes[nodes.length - 1]
      if (e.shiftKey) {
        if (document.activeElement === first) { e.preventDefault(); last.focus() }
      } else {
        if (document.activeElement === last) { e.preventDefault(); first.focus() }
      }
    }
    el.addEventListener('keydown', handleKeyDown)
    return () => el.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  return createPortal(
    <div
      className="modal-overlay"
      style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className="modal-inner"
        style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight, display:'flex', flexDirection:'column', overflow:'hidden', outline:'none' }}
      >
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 28px 0', flexShrink:0 }}>
          <h3 id={titleId} style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>{titel}</h3>
          <button onClick={onClose} aria-label="Schließen" style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 }}>✕</button>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:'20px 28px 28px', overscrollBehavior:'contain' }}>
          {children}
        </div>
      </div>
    </div>
  , document.body)
}
