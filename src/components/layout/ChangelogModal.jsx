import { CHANGELOG } from '../../changelog'
import { version } from '../../../package.json'

export default function ChangelogModal({ onClose }) {
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background: 'var(--surface)', borderRadius: 20, width: '100%', maxWidth: 480, maxHeight: '80vh', display: 'flex', flexDirection: 'column', boxShadow: '0 24px 60px rgba(0,0,0,0.25)', overflow: 'hidden' }}>
        <div style={{ padding: '24px 24px 16px', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexShrink: 0 }}>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>✨ Versionshistorie</div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 3 }}>Staccato v{version}</div>
          </div>
          <button onClick={onClose} aria-label="Schließen" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)', lineHeight: 1, padding: 10, margin: -10, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
        <div style={{ overflowY: 'auto', padding: '16px 24px 24px', display: 'flex', flexDirection: 'column', gap: 24 }}>
          {CHANGELOG.map(entry => (
            <div key={entry.version}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                <div style={{ fontSize: 13, fontWeight: 800, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 12%, transparent)', padding: '3px 10px', borderRadius: 99 }}>v{entry.version}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)' }}>{entry.date}</div>
              </div>
              <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: 8 }}>
                {entry.features.map((f, i) => (
                  <li key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 12px', borderRadius: 10, background: 'var(--bg-2)' }}>
                    <span style={{ fontSize: 16, lineHeight: 1.4, flexShrink: 0 }}>{f.icon}</span>
                    <span style={{ fontSize: 13, color: 'var(--text-2)', lineHeight: 1.5 }}>{f.de}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
