import { motion } from 'framer-motion'

/**
 * Modern button variants: primary | secondary | ghost | danger
 * props: variant, size, icon, loading, disabled, onClick, children, style
 */
export default function Button2026({
  children,
  variant = 'primary',
  size = 'md',
  icon,
  loading = false,
  disabled = false,
  onClick,
  style = {},
  type = 'button',
  ...rest
}) {
  const sizes = {
    sm: { padding: '6px 12px',  fontSize: 12, gap: 6,  iconSize: 14 },
    md: { padding: '10px 18px', fontSize: 14, gap: 8,  iconSize: 16 },
    lg: { padding: '13px 24px', fontSize: 15, gap: 10, iconSize: 18 },
  }
  const s = sizes[size] ?? sizes.md

  const variants = {
    primary: {
      background: 'var(--primary)',
      color: 'var(--primary-fg)',
      border: 'none',
    },
    secondary: {
      background: 'var(--bg-2)',
      color: 'var(--text)',
      border: '1px solid var(--border)',
    },
    ghost: {
      background: 'transparent',
      color: 'var(--text-2)',
      border: '1px solid transparent',
    },
    danger: {
      background: 'color-mix(in srgb, var(--danger) 10%, transparent)',
      color: 'var(--danger)',
      border: '1px solid color-mix(in srgb, var(--danger) 30%, transparent)',
    },
  }

  const v = variants[variant] ?? variants.primary

  return (
    <motion.button
      type={type}
      onClick={!disabled && !loading ? onClick : undefined}
      disabled={disabled || loading}
      whileHover={!disabled && !loading ? { scale: 1.02 } : undefined}
      whileTap={!disabled && !loading ? { scale: 0.96 } : undefined}
      transition={{ type: 'spring', stiffness: 400, damping: 28 }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: s.gap,
        padding: s.padding,
        fontSize: s.fontSize,
        fontWeight: 600,
        borderRadius: 'var(--radius)',
        cursor: disabled || loading ? 'not-allowed' : 'pointer',
        fontFamily: 'inherit',
        opacity: disabled ? 0.5 : 1,
        transition: 'all 0.15s ease',
        whiteSpace: 'nowrap',
        position: 'relative',
        overflow: 'hidden',
        ...v,
        ...style,
      }}
      {...rest}
    >
      {loading ? (
        <span style={{ width: s.iconSize, height: s.iconSize, borderRadius: '50%', border: '2px solid currentColor', borderTopColor: 'transparent', display: 'inline-block', animation: 'spin2026 0.7s linear infinite' }} />
      ) : icon ? (
        <span style={{ fontSize: s.iconSize, lineHeight: 1, flexShrink: 0 }}>{icon}</span>
      ) : null}
      {children}

      <style>{`@keyframes spin2026 { to { transform: rotate(360deg); } }`}</style>
    </motion.button>
  )
}
