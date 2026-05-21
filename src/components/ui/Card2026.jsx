import { motion } from 'framer-motion'

/**
 * Glass card with optional hover lift.
 * props: onClick, noPad, glass, className, style, children
 */
export default function Card2026({ children, onClick, noPad = false, glass = false, className = '', style = {}, ...rest }) {
  const base = {
    borderRadius: 'var(--radius-lg)',
    border: '1px solid color-mix(in srgb, var(--border) 60%, transparent)',
    background: glass
      ? 'color-mix(in srgb, var(--surface) 80%, transparent)'
      : 'var(--surface)',
    backdropFilter: glass ? 'blur(12px) saturate(140%)' : undefined,
    WebkitBackdropFilter: glass ? 'blur(12px) saturate(140%)' : undefined,
    boxShadow: '0 2px 12px rgba(0,0,0,0.05)',
    padding: noPad ? 0 : '20px 24px',
    overflow: 'hidden',
    ...style,
  }

  if (onClick) {
    return (
      <motion.div
        onClick={onClick}
        whileHover={{ y: -3, boxShadow: '0 12px 32px rgba(0,0,0,0.12)' }}
        whileTap={{ scale: 0.985 }}
        transition={{ type: 'spring', stiffness: 400, damping: 28 }}
        style={{ ...base, cursor: 'pointer' }}
        className={className}
        {...rest}
      >
        {children}
      </motion.div>
    )
  }

  return (
    <div style={base} className={className} {...rest}>
      {children}
    </div>
  )
}
