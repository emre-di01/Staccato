import { useEffect, useRef } from 'react'

const ICON  = { success: '✓', error: '✕', info: 'ℹ', warning: '⚠' }
const COLOR = { success: '#22c55e', error: '#ef4444', info: 'var(--primary)', warning: '#f59e0b' }

function ToastItem({ toast, onRemove }) {
  const timerRef = useRef(null)

  useEffect(() => {
    timerRef.current = setTimeout(() => onRemove(toast.id), toast.duration ?? 3200)
    return () => clearTimeout(timerRef.current)
  }, [toast.id, toast.duration, onRemove])

  return (
    <div
      onClick={() => onRemove(toast.id)}
      style={{
        display: 'flex', alignItems: 'center', gap: 10,
        background: 'var(--surface)', border: `1.5px solid ${COLOR[toast.type ?? 'info']}22`,
        borderLeft: `4px solid ${COLOR[toast.type ?? 'info']}`,
        borderRadius: 'var(--radius)', padding: '11px 18px',
        boxShadow: '0 4px 20px rgba(0,0,0,0.13)',
        fontSize: 14, fontWeight: 500, color: 'var(--text)',
        cursor: 'pointer', maxWidth: 360, lineHeight: 1.4,
        animation: 'toastIn 0.22s cubic-bezier(.21,1.02,.73,1)',
        pointerEvents: 'auto',
      }}
    >
      <span style={{ color: COLOR[toast.type ?? 'info'], fontWeight: 700, fontSize: 15, flexShrink: 0 }}>
        {ICON[toast.type ?? 'info']}
      </span>
      <span>{toast.message}</span>
    </div>
  )
}

export function ToastContainer({ toasts, onRemove }) {
  if (!toasts.length) return null
  return (
    <>
      <style>{`
        @keyframes toastIn {
          from { opacity: 0; transform: translateY(10px) scale(0.96); }
          to   { opacity: 1; transform: translateY(0)    scale(1); }
        }
      `}</style>
      <div
        role="status"
        aria-live="polite"
        aria-atomic="false"
        style={{
          position: 'fixed', bottom: 28, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', flexDirection: 'column-reverse', gap: 8,
          zIndex: 10000, pointerEvents: 'none', alignItems: 'center',
          width: 'max-content', maxWidth: 'calc(100vw - 32px)',
        }}>
        {toasts.map(t => <ToastItem key={t.id} toast={t} onRemove={onRemove} />)}
      </div>
    </>
  )
}
