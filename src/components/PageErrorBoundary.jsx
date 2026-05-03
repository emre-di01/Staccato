import { ErrorBoundary } from 'react-error-boundary'

function Fallback({ error, resetErrorBoundary }) {
  return (
    <div style={{
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      minHeight: '40vh', padding: 32, textAlign: 'center', gap: 16,
    }}>
      <div style={{ fontSize: 40 }}>⚠️</div>
      <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
        Seite konnte nicht geladen werden
      </div>
      <div style={{
        fontSize: 13, color: 'var(--text-3)', background: 'var(--bg-2)',
        borderRadius: 'var(--radius)', padding: '10px 16px', maxWidth: 500,
        fontFamily: 'monospace', wordBreak: 'break-all',
      }}>
        {error?.message ?? 'Unbekannter Fehler'}
      </div>
      <button
        onClick={resetErrorBoundary}
        style={{
          padding: '10px 24px', borderRadius: 'var(--radius)', border: 'none',
          background: 'var(--primary)', color: 'var(--primary-fg)',
          fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
        }}
      >
        ↻ Erneut versuchen
      </button>
    </div>
  )
}

export default function PageErrorBoundary({ children }) {
  return (
    <ErrorBoundary FallbackComponent={Fallback}>
      {children}
    </ErrorBoundary>
  )
}
