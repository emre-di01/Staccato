import { useState, useEffect } from 'react'
import { useApp } from '../context/AppContext'
import { CHANGELOG, CURRENT_VERSION } from '../changelog'

const LS_KEY = 'staccato_seen_version'

export default function WhatsNewModal() {
  const { session, T, lang } = useApp()
  const [open, setOpen] = useState(false)

  useEffect(() => {
    if (!session) return
    const seen = localStorage.getItem(LS_KEY)
    if (seen !== CURRENT_VERSION) setOpen(true)
  }, [session])

  function dismiss() {
    localStorage.setItem(LS_KEY, CURRENT_VERSION)
    setOpen(false)
  }

  if (!open) return null

  const entry = CHANGELOG[0]

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 9999,
      background: 'rgba(0,0,0,0.45)', backdropFilter: 'blur(3px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 16,
    }}>
      <div style={{
        background: 'var(--surface)', borderRadius: 20, padding: '32px 28px',
        width: '100%', maxWidth: 440, boxShadow: '0 24px 60px rgba(0,0,0,0.25)',
        fontFamily: "'Outfit','DM Sans',sans-serif",
        animation: 'wnSlide .25s ease',
      }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 6 }}>
          <div style={{
            width: 40, height: 40, borderRadius: 12,
            background: 'var(--primary)', display: 'flex', alignItems: 'center',
            justifyContent: 'center', fontSize: 20,
          }}>✨</div>
          <div>
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', lineHeight: 1.2 }}>
              {T('whats_new_title')}
            </div>
            <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
              Version {entry.version} · {entry.date}
            </div>
          </div>
        </div>

        {/* Feature list */}
        <ul style={{ listStyle: 'none', padding: 0, margin: '20px 0 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
          {entry.features.map((f, i) => (
            <li key={i} style={{
              display: 'flex', alignItems: 'flex-start', gap: 12,
              background: 'var(--bg-2)', borderRadius: 12, padding: '10px 14px',
            }}>
              <span style={{ fontSize: 20, lineHeight: 1.4, flexShrink: 0 }}>{f.icon}</span>
              <span style={{ fontSize: 14, color: 'var(--text-2)', lineHeight: 1.5 }}>
                {f[lang] ?? f.de}
              </span>
            </li>
          ))}
        </ul>

        {/* CTA */}
        <button onClick={dismiss} style={{
          marginTop: 24, width: '100%', padding: '13px',
          borderRadius: 'var(--radius)', border: 'none',
          background: 'var(--primary)', color: 'var(--primary-fg)',
          fontSize: 15, fontWeight: 700, cursor: 'pointer',
          fontFamily: 'inherit', transition: 'opacity .15s',
        }}>
          {T('whats_new_ok')}
        </button>
      </div>

      <style>{`
        @keyframes wnSlide {
          from { opacity: 0; transform: translateY(16px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
      `}</style>
    </div>
  )
}
