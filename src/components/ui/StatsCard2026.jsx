import { motion } from 'framer-motion'
import { staggerItem } from '../../design/animations'

/**
 * KPI / stats card for dashboards.
 * props: icon, label, value, sub, color, onClick
 */
export default function StatsCard2026({ icon, label, value, sub, color, onClick }) {
  return (
    <motion.div
      variants={staggerItem}
      onClick={onClick}
      whileHover={onClick ? { y: -4, boxShadow: '0 16px 40px rgba(0,0,0,0.13)' } : { y: -2 }}
      whileTap={onClick ? { scale: 0.97 } : undefined}
      transition={{ type: 'spring', stiffness: 380, damping: 26 }}
      style={{
        background: 'var(--surface)',
        border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
        borderRadius: 'var(--radius-lg)',
        padding: '20px 22px',
        cursor: onClick ? 'pointer' : 'default',
        position: 'relative',
        overflow: 'hidden',
        boxShadow: '0 2px 8px rgba(0,0,0,0.04)',
      }}
    >
      {/* Subtle accent gradient in top-right */}
      <div style={{
        position: 'absolute', top: -20, right: -20,
        width: 80, height: 80, borderRadius: '50%',
        background: color
          ? `color-mix(in srgb, ${color} 15%, transparent)`
          : 'color-mix(in srgb, var(--primary) 10%, transparent)',
        filter: 'blur(20px)',
        pointerEvents: 'none',
      }} />

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 14 }}>
        <div style={{
          width: 38, height: 38, borderRadius: 10,
          background: color
            ? `color-mix(in srgb, ${color} 14%, var(--bg-2))`
            : 'color-mix(in srgb, var(--primary) 12%, var(--bg-2))',
          border: `1px solid ${color ? `color-mix(in srgb, ${color} 25%, transparent)` : 'color-mix(in srgb, var(--primary) 20%, transparent)'}`,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 18, flexShrink: 0,
        }}>
          {icon}
        </div>
      </div>

      <div style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', lineHeight: 1, letterSpacing: '-0.5px', marginBottom: 4 }}>
        {value ?? '—'}
      </div>
      <div style={{ fontSize: 13, fontWeight: 500, color: 'var(--text-2)', lineHeight: 1.3 }}>{label}</div>
      {sub && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
    </motion.div>
  )
}
