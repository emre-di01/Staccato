import { useRef, useLayoutEffect, useState } from 'react'

export function haptic(ms = 8) {
  navigator.vibrate?.(ms)
}

export function fireConfetti() {
  const canvas = document.createElement('canvas')
  canvas.width  = window.innerWidth
  canvas.height = window.innerHeight
  canvas.style.cssText = 'position:fixed;inset:0;pointer-events:none;z-index:9999;'
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  const colors = ['#6366f1','#22c55e','#f59e0b','#ef4444','#3b82f6','#ec4899','#f97316','#8b5cf6']
  const particles = Array.from({ length: 70 }, () => ({
    x:    canvas.width  / 2 + (Math.random() - 0.5) * 300,
    y:    canvas.height * 0.65,
    vx:   (Math.random() - 0.5) * 14,
    vy:   -(Math.random() * 12 + 5),
    color: colors[Math.floor(Math.random() * colors.length)],
    w:    Math.random() * 7 + 4,
    h:    Math.random() * 4 + 3,
    rot:  Math.random() * 360,
    rotV: (Math.random() - 0.5) * 10,
  }))
  let frame = 0
  const MAX = 80
  ;(function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    for (const p of particles) {
      p.x  += p.vx; p.y += p.vy
      p.vy += 0.45; p.vx *= 0.99
      p.rot += p.rotV
      ctx.save()
      ctx.globalAlpha = Math.max(0, 1 - frame / MAX)
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot * Math.PI / 180)
      ctx.fillStyle = p.color
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (++frame < MAX) requestAnimationFrame(tick)
    else canvas.remove()
  })()
}

export function EmptyState({ icon = '📭', message }) {
  return (
    <div style={{ textAlign: 'center', padding: '56px 24px', color: 'var(--text-3)' }}>
      <div style={{
        fontSize: 44, display: 'inline-block', lineHeight: 1,
        animation: 'emptyBob 2.4s ease-in-out infinite',
      }}>
        {icon}
      </div>
      <div style={{ marginTop: 14, fontSize: 14, fontWeight: 500, lineHeight: 1.5 }}>{message}</div>
    </div>
  )
}

export function SlidingTabs({ tabs, active, onChange, style }) {
  const containerRef = useRef(null)
  const tabRefs = useRef({})
  const [indicator, setIndicator] = useState(null)

  useLayoutEffect(() => {
    const el = tabRefs.current[active]
    if (!el || !containerRef.current) return
    const cr = containerRef.current.getBoundingClientRect()
    const tr = el.getBoundingClientRect()
    setIndicator(prev => ({
      left: tr.left - cr.left,
      width: tr.width,
      animate: prev !== null,
    }))
  }, [active])

  return (
    <div ref={containerRef} style={{
      display: 'flex', position: 'relative',
      background: 'var(--bg-2)', padding: 4, borderRadius: 10,
      width: 'fit-content', flexShrink: 0, ...style,
    }}>
      {indicator && (
        <div style={{
          position: 'absolute',
          top: 4, height: 'calc(100% - 8px)',
          left: indicator.left, width: indicator.width,
          background: 'var(--surface)', borderRadius: 7, boxShadow: 'var(--shadow)',
          transition: indicator.animate
            ? 'left 0.22s cubic-bezier(0.4,0,0.2,1), width 0.22s cubic-bezier(0.4,0,0.2,1)'
            : 'none',
          zIndex: 0, pointerEvents: 'none',
        }} />
      )}
      {tabs.map(tab => (
        <button
          key={tab.key}
          ref={el => { tabRefs.current[tab.key] = el }}
          onClick={() => { onChange(tab.key); haptic() }}
          style={{
            padding: '7px 16px', minHeight: 36,
            border: 'none', background: 'transparent',
            fontSize: 13, fontWeight: active === tab.key ? 700 : 500,
            cursor: 'pointer', fontFamily: 'inherit',
            color: active === tab.key ? 'var(--text)' : 'var(--text-3)',
            borderRadius: 7, position: 'relative', zIndex: 1,
            transition: 'color 0.18s', whiteSpace: 'nowrap',
          }}
        >
          {tab.label}
        </button>
      ))}
    </div>
  )
}
