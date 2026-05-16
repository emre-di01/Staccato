const shimmerStyle = {
  background: 'linear-gradient(90deg, var(--border) 25%, color-mix(in srgb, var(--border) 55%, var(--surface)) 50%, var(--border) 75%)',
  backgroundSize: '200% 100%',
  animation: 'skeletonShimmer 1.4s ease infinite',
}

export function Skeleton({ width = '100%', height = 14, radius = 6, style }) {
  return (
    <div style={{ width, height, borderRadius: radius, ...shimmerStyle, ...style }} />
  )
}

export function SkeletonCard({ lines = 2, style }) {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 10, ...style }}>
      <Skeleton height={18} width="55%" />
      {Array.from({ length: lines }, (_, i) => (
        <Skeleton key={i} height={12} width={i === lines - 1 ? '75%' : '100%'} />
      ))}
    </div>
  )
}

export function SkeletonStatCard() {
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', padding: '20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Skeleton height={12} width="50%" />
      <Skeleton height={32} width="40%" />
    </div>
  )
}

export function SkeletonList({ rows = 4 }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {Array.from({ length: rows }, (_, i) => (
        <SkeletonCard key={i} lines={1} />
      ))}
    </div>
  )
}

export function SkeletonStyle() {
  return (
    <style>{`
      @keyframes skeletonShimmer {
        0%   { background-position: 200% 0; }
        100% { background-position: -200% 0; }
      }
    `}</style>
  )
}
