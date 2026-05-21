// Framer Motion variants & spring configs for the 2026 design system

export const spring     = { type: 'spring', stiffness: 360, damping: 30 }
export const springFast = { type: 'spring', stiffness: 480, damping: 36 }
export const easeOut    = [0.4, 0, 0.2, 1]

export const pageVariants = {
  initial: { opacity: 0, y: 14 },
  animate: { opacity: 1, y: 0,  transition: { duration: 0.26, ease: easeOut } },
  exit:    { opacity: 0, y: -8, transition: { duration: 0.16, ease: [0.4, 0, 1, 1] } },
}

export const staggerContainer = {
  animate: { transition: { staggerChildren: 0.055, delayChildren: 0.04 } },
}

export const staggerItem = {
  initial: { opacity: 0, y: 10 },
  animate: { opacity: 1, y: 0, transition: spring },
}

export const fadeIn = {
  initial: { opacity: 0 },
  animate: { opacity: 1, transition: { duration: 0.2 } },
  exit:    { opacity: 0, transition: { duration: 0.14 } },
}

export const scaleIn = {
  initial: { opacity: 0, scale: 0.93 },
  animate: { opacity: 1, scale: 1, transition: springFast },
  exit:    { opacity: 0, scale: 0.96, transition: { duration: 0.14 } },
}

export const slideUp = {
  initial: { opacity: 0, y: 20 },
  animate: { opacity: 1, y: 0, transition: spring },
  exit:    { opacity: 0, y: 10, transition: { duration: 0.14 } },
}

export const sidebarSpring = { type: 'spring', stiffness: 280, damping: 30 }
