import { motion } from 'framer-motion'

/**
 * Animated page header with title, subtitle, and right-side action slot.
 * props: title, sub, icon, actions, back (fn)
 */
export default function PageHeader2026({ title, sub, icon, actions, back }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24, ease: [0.4, 0, 0.2, 1] }}
      style={{ marginBottom: 28, display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16 }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
        {back && (
          <button
            onClick={back}
            style={{ background: 'var(--bg-2)', border: '1px solid var(--border)', borderRadius: 10, padding: '8px 10px', cursor: 'pointer', fontSize: 16, lineHeight: 1, color: 'var(--text-2)', fontFamily: 'inherit', display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}
          >
            ←
          </button>
        )}
        {icon && (
          <div style={{ width: 44, height: 44, borderRadius: 12, background: 'color-mix(in srgb, var(--primary) 12%, var(--bg-2))', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22, flexShrink: 0, border: '1px solid color-mix(in srgb, var(--primary) 20%, transparent)' }}>
            {icon}
          </div>
        )}
        <div style={{ minWidth: 0 }}>
          <h1 style={{ fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.4px', lineHeight: 1.15, margin: 0 }}>
            {title}
          </h1>
          {sub && (
            <p style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 3, margin: '3px 0 0' }}>{sub}</p>
          )}
        </div>
      </div>

      {actions && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {actions}
        </div>
      )}
    </motion.div>
  )
}
