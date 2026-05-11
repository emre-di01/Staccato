import { useState, useEffect, useRef, useLayoutEffect } from 'react'
import { NavLink, useLocation } from 'react-router-dom'

export function NavItem({ item, mobile = false, setSidebarOffen, ungelesen = 0, pillMode = false }) {
  return (
    <div style={{ position: 'relative', zIndex: pillMode ? 1 : 'auto', ...(mobile ? { flex: 1, display: 'flex' } : {}) }}>
      <NavLink
        to={item.to}
        end={item.to.split('/').length === 2}
        onClick={() => setSidebarOffen(false)}
        className={mobile ? 'mobile-nav-link' : undefined}
        style={({ isActive }) => mobile ? {
          display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
          padding: '8px 4px', borderRadius: 10, textDecoration: 'none', flex: 1,
          background: isActive ? 'var(--bg-2)' : 'transparent',
          color: isActive ? 'var(--primary)' : 'var(--text-3)',
          fontSize: 10, fontWeight: isActive ? 700 : 500,
          transition: 'all 0.15s', position: 'relative',
        } : {
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '11px 16px', minHeight: 44, borderRadius: 'var(--radius)',
          textDecoration: 'none', fontSize: 14, fontWeight: 500,
          color: isActive ? 'var(--primary-fg)' : 'var(--text-2)',
          background: isActive && !pillMode ? 'var(--primary)' : 'transparent',
          transition: 'color 0.15s',
          marginBottom: 2,
        }}
      >
        <span style={{ position: 'relative', display: 'inline-flex', lineHeight: 1 }}>
          <span style={{ fontSize: mobile ? 20 : 16 }}>{item.icon}</span>
          {item.nachrichten && ungelesen > 0 && (
            <span style={{ position: 'absolute', top: -4, right: -7, minWidth: 14, height: 14, borderRadius: 7, background: 'var(--danger)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', lineHeight: 1, padding: '0 3px', zIndex: 1 }}>
              {ungelesen > 9 ? '9+' : ungelesen}
            </span>
          )}
        </span>
        {!mobile && <span style={{ flex: 1 }}>{item.label}</span>}
        {mobile && <span>{item.label}</span>}
      </NavLink>
    </div>
  )
}

export function NavGroup({ gruppe, items, setSidebarOffen, ungelesen = 0, pillMode = false }) {
  const location = useLocation()
  const hatAktive = items.some(item => location.pathname === item.to || location.pathname.startsWith(item.to + '/'))
  const [offen, setOffen] = useState(hatAktive)

  useEffect(() => { if (hatAktive) setOffen(true) }, [location.pathname])

  return (
    <div style={{ marginBottom: 2 }}>
      <button onClick={() => setOffen(o => !o)} style={{
        display: 'flex', alignItems: 'center', gap: 6, width: '100%',
        padding: '10px 16px 6px 12px', minHeight: 44, background: 'none', border: 'none',
        cursor: 'pointer', fontFamily: 'inherit',
        fontSize: 11, fontWeight: 700, color: 'var(--text-3)',
        textTransform: 'uppercase', letterSpacing: '0.07em',
        marginTop: 4,
      }}>
        <span style={{ flex: 1, textAlign: 'left' }}>{gruppe}</span>
        <span style={{ fontSize: 9, opacity: 0.7 }}>{offen ? '▾' : '▸'}</span>
      </button>
      {offen && (
        <div>
          {items.map(item => <NavItem key={item.to} item={item} setSidebarOffen={setSidebarOffen} ungelesen={ungelesen} pillMode={pillMode} />)}
        </div>
      )}
    </div>
  )
}

export function DesktopNav({ navConfig, setSidebarOffen, ungelesen }) {
  const location = useLocation()
  const navRef = useRef(null)
  const [pill, setPill] = useState(null)

  useLayoutEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const active = nav.querySelector('a[aria-current="page"]')
    if (!active) { setPill(null); return }
    const navRect = nav.getBoundingClientRect()
    const activeRect = active.getBoundingClientRect()
    setPill(prev => ({
      top: activeRect.top - navRect.top,
      height: activeRect.height,
      animate: prev !== null,
    }))
  }, [location.pathname])

  return (
    <nav ref={navRef} style={{ flex: 1, position: 'relative' }}>
      {pill && (
        <div style={{
          position: 'absolute', left: 0, right: 0,
          top: pill.top, height: pill.height,
          background: 'var(--primary)', borderRadius: 'var(--radius)',
          transition: pill.animate ? 'top 0.28s cubic-bezier(0.4,0,0.2,1)' : 'none',
          zIndex: 0, pointerEvents: 'none',
        }} />
      )}
      {navConfig.map(entry => entry.gruppe
        ? <NavGroup key={entry.gruppe} {...entry} setSidebarOffen={setSidebarOffen} ungelesen={ungelesen} pillMode />
        : <NavItem  key={entry.to} item={entry} setSidebarOffen={setSidebarOffen} ungelesen={ungelesen} pillMode />
      )}
    </nav>
  )
}
