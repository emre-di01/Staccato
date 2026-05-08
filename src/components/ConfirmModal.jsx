export function ConfirmModal({ message, sub, confirmLabel = 'Löschen', cancelLabel = 'Abbrechen', dangerous = true, onConfirm, onCancel }) {
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
