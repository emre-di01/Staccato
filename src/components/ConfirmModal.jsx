// `neu`: Optik der neuen Oberfläche (große Schrift, Knöpfe untereinander in voller Breite)
export function ConfirmModal({ message, sub, confirmLabel = 'Löschen', cancelLabel = 'Abbrechen', dangerous = true, onConfirm, onCancel, neu }) {
  if (neu) return (
    <div role="alertdialog" aria-modal="true" aria-label={message}
      style={{ position: 'fixed', inset: 0, background: 'var(--n-overlay)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 9500, padding: 20 }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}>
      <div style={{ background: 'var(--bg)', color: 'var(--text)', borderRadius: 24, padding: 24, maxWidth: 400, width: '100%', boxShadow: 'var(--shadow-lg)', animation: 'confirmIn 0.18s cubic-bezier(.21,1.02,.73,1)' }}>
        <style>{`@keyframes confirmIn { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }`}</style>
        <p style={{ margin: 0, fontSize: 19, fontWeight: 700, lineHeight: 1.4 }}>{message}</p>
        {sub && <p style={{ margin: '8px 0 0', fontSize: 16, color: 'var(--text-2)', lineHeight: 1.5 }}>{sub}</p>}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 22 }}>
          <button onClick={onConfirm} autoFocus style={{ height: 52, borderRadius: 14, border: 'none', background: dangerous ? 'var(--danger)' : 'var(--primary)', color: dangerous ? '#fff' : 'var(--primary-fg)', fontFamily: 'inherit', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>{confirmLabel}</button>
          <button onClick={onCancel} style={{ height: 52, borderRadius: 14, border: 'none', background: 'var(--n-fill)', color: 'var(--text)', fontFamily: 'inherit', fontSize: 17, fontWeight: 600, cursor: 'pointer' }}>{cancelLabel}</button>
        </div>
      </div>
    </div>
  )

  return (
    <div
      style={{
        position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.45)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 9500, padding: 20,
      }}
      onClick={e => { if (e.target === e.currentTarget) onCancel() }}
    >
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        padding: '28px 24px', maxWidth: 360, width: '100%',
        boxShadow: 'var(--shadow-lg)',
        animation: 'confirmIn 0.18s cubic-bezier(.21,1.02,.73,1)',
      }}>
        <style>{`@keyframes confirmIn { from{opacity:0;transform:scale(0.94)} to{opacity:1;transform:scale(1)} }`}</style>
        <p style={{ margin: '0 0 6px', fontSize: 15, fontWeight: 600, color: 'var(--text)', lineHeight: 1.5 }}>
          {message}
        </p>
        {sub && <p style={{ margin: '0 0 20px', fontSize: 13, color: 'var(--text-3)', lineHeight: 1.5 }}>{sub}</p>}
        {!sub && <div style={{ height: 20 }} />}
        <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
          <button
            onClick={onCancel}
            style={{
              padding: '9px 18px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)',
              background: 'transparent', color: 'var(--text-2)', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {cancelLabel}
          </button>
          <button
            onClick={onConfirm}
            style={{
              padding: '9px 18px', borderRadius: 'var(--radius)', border: 'none',
              background: dangerous ? 'var(--danger)' : 'var(--primary)',
              color: '#fff', fontSize: 14, fontWeight: 600,
              cursor: 'pointer', fontFamily: 'inherit',
            }}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}
