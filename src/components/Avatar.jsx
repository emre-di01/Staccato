export default function Avatar({ name, avatarUrl, size = 40, style = {} }) {
  const initialen = name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase() ?? '?'
  const base = {
    width: size,
    height: size,
    borderRadius: '50%',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    ...style,
  }
  if (avatarUrl) {
    return (
      <div style={base}>
        <img src={avatarUrl} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      </div>
    )
  }
  return (
    <div style={{ ...base, background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: Math.round(size * 0.4), fontWeight: 800 }}>
      {initialen}
    </div>
  )
}
