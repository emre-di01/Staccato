export default function Hinweis({ text, style }) {
  if (!text) return null
  return (
    <div style={{
      fontSize: 12,
      color: 'var(--text-3)',
      background: 'var(--bg-2)',
      borderRadius: 'var(--radius)',
      padding: '7px 11px',
      lineHeight: 1.5,
      display: 'flex',
      gap: 6,
      alignItems: 'flex-start',
      ...style,
    }}>
      <span style={{ flexShrink: 0, fontSize: 13 }}>💡</span>
      <span>{text}</span>
    </div>
  )
}
