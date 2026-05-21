import { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { motion, AnimatePresence, LayoutGroup, useReducedMotion } from 'framer-motion'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { version } from '../../../package.json'
import { ToastContainer } from '../Toast'
import { ConfirmModal } from '../ConfirmModal'
import { getNavConfig, flattenNav } from './navConfig'
import JoinSessionModal from './JoinSessionModal'
import ChangelogModal from './ChangelogModal'
import OfflineBanner from './OfflineBanner'

// ─── Nav Item ────────────────────────────────────────────────
function NavItem2026({ item, expanded, ungelesen, onClick }) {
  const badge = item.nachrichten && ungelesen > 0 ? Math.min(ungelesen, 9) : 0
  return (
    <NavLink
      to={item.to}
      end={item.to?.split('/').length === 2}
      onClick={onClick}
      style={{ textDecoration: 'none', display: 'block' }}
      title={!expanded ? item.label : undefined}
    >
      {({ isActive }) => (
        <div style={{ position: 'relative', marginBottom: 2 }}>
          {isActive && (
            <motion.div
              layoutId="nav-pill-2026"
              style={{ position: 'absolute', inset: 0, borderRadius: 10, background: 'color-mix(in srgb, var(--primary) 13%, var(--bg-2))' }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            />
          )}
          <div style={{
            position: 'relative', zIndex: 1,
            display: 'flex', alignItems: 'center',
            gap: expanded ? 10 : 0,
            padding: expanded ? '9px 12px' : '9px 0',
            justifyContent: expanded ? 'flex-start' : 'center',
            color: isActive ? 'var(--primary)' : 'var(--text-2)',
            minHeight: 44,
            transition: 'color 0.15s',
          }}>
            <span style={{ fontSize: 17, flexShrink: 0, position: 'relative', lineHeight: 1 }}>
              {item.icon}
              {badge > 0 && (
                <span style={{ position: 'absolute', top: -4, right: -7, minWidth: 14, height: 14, borderRadius: 7, background: 'var(--danger)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '0 3px' }}>
                  {badge}
                </span>
              )}
            </span>
            <AnimatePresence>
              {expanded && (
                <motion.span
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0, transition: { duration: 0.18, delay: 0.05 } }}
                  exit={{ opacity: 0, transition: { duration: 0.08 } }}
                  style={{ fontSize: 14, fontWeight: isActive ? 600 : 450, whiteSpace: 'nowrap', overflow: 'hidden', flex: 1, lineHeight: 1.2 }}
                >
                  {item.label}
                </motion.span>
              )}
            </AnimatePresence>
          </div>
        </div>
      )}
    </NavLink>
  )
}

// ─── Nav Group ───────────────────────────────────────────────
function NavGroup2026({ gruppe, items, expanded, ungelesen, onClick }) {
  const location = useLocation()
  const hasActive = items.some(i => location.pathname === i.to || location.pathname.startsWith(i.to + '/'))
  const [open, setOpen] = useState(hasActive)
  useEffect(() => { if (hasActive) setOpen(true) }, [location.pathname])

  return (
    <div style={{ marginBottom: 2 }}>
      <AnimatePresence>
        {expanded && (
          <motion.button
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, transition: { duration: 0.08 } }}
            onClick={() => setOpen(o => !o)}
            style={{ display: 'flex', alignItems: 'center', gap: 6, width: '100%', padding: '8px 12px 4px', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', fontSize: 10, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' }}
          >
            <span style={{ flex: 1, textAlign: 'left' }}>{gruppe}</span>
            <motion.span animate={{ rotate: open ? 0 : -90 }} transition={{ duration: 0.2 }} style={{ fontSize: 8, display: 'inline-block' }}>▾</motion.span>
          </motion.button>
        )}
      </AnimatePresence>
      <div>
        {(open || !expanded) && items.map(item => (
          <NavItem2026 key={item.to} item={item} expanded={expanded} ungelesen={ungelesen} onClick={onClick} />
        ))}
      </div>
    </div>
  )
}

// ─── Bottom Nav Item (mobile) ─────────────────────────────────
function BottomNavItem({ item, ungelesen }) {
  const badge = item.nachrichten && ungelesen > 0 ? Math.min(ungelesen, 9) : 0
  return (
    <NavLink to={item.to} end={item.to?.split('/').length === 2} style={{ textDecoration: 'none', flex: 1 }}>
      {({ isActive }) => (
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, padding: '6px 4px', borderRadius: 12, position: 'relative', color: isActive ? 'var(--primary)' : 'var(--text-3)', minHeight: 52, justifyContent: 'center' }}>
          {isActive && (
            <motion.div layoutId="bottom-pill-2026"
              style={{ position: 'absolute', inset: '0 2px', borderRadius: 10, background: 'color-mix(in srgb, var(--primary) 12%, var(--bg-2))' }}
              transition={{ type: 'spring', stiffness: 380, damping: 32 }}
            />
          )}
          <span style={{ position: 'relative', zIndex: 1, fontSize: 22, lineHeight: 1 }}>
            {item.icon}
            {badge > 0 && <span style={{ position: 'absolute', top: -3, right: -6, width: 14, height: 14, borderRadius: 7, background: 'var(--danger)', color: '#fff', fontSize: 9, fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{badge}</span>}
          </span>
          <span style={{ position: 'relative', zIndex: 1, fontSize: 10, fontWeight: isActive ? 700 : 500, lineHeight: 1 }}>{item.label}</span>
        </div>
      )}
    </NavLink>
  )
}

// ─── Main Layout ──────────────────────────────────────────────
export default function AppLayout2026() {
  const { profil, rolle, schule, abo, T, toasts, removeToast, confirmState, resolveConfirm, schulenListe, darkMode, großeSchrift, toast } = useApp()
  const prefersReducedMotion = useReducedMotion()
  const logoUrl = darkMode && schule?.logo_url_dark ? schule.logo_url_dark : schule?.logo_url
  const navigate  = useNavigate()
  const location  = useLocation()

  // Sidebar collapse state: pinned = always expanded; otherwise hover-expand
  const [pinned,   setPinned]   = useState(() => localStorage.getItem('staccato_sidebar_pinned') !== 'false')
  const [hovered,  setHovered]  = useState(false)
  const expanded = pinned || hovered

  const [sidebarOffen,      setSidebarOffen]      = useState(false)
  const [joinSessionOffen,  setJoinSessionOffen]  = useState(false)
  const [changelogOffen,    setChangelogOffen]    = useState(false)
  const [installPrompt,     setInstallPrompt]     = useState(null)
  const [keyboardOffen,     setKeyboardOffen]     = useState(false)
  const [ungelesen,         setUngelesen]         = useState([])

  const swipeStartX  = useRef(null)
  const swipeStartY  = useRef(null)
  const lastLogoTap = useRef(0)

  function handleLogoTap() {
    const now = Date.now()
    if (now - lastLogoTap.current < 400) {
      lastLogoTap.current = 0
      const is2026 = localStorage.getItem('staccato_ui_modus') === '2026'
      toast(is2026 ? '⬅ Classic UI wird geladen…' : '✨ Neues 2026 UI wird geladen…', 'success')
      setTimeout(() => {
        if (is2026) localStorage.removeItem('staccato_ui_modus')
        else localStorage.setItem('staccato_ui_modus', '2026')
        location.reload()
      }, 800)
    } else {
      lastLogoTap.current = now
    }
  }

  const navConfig   = getNavConfig(rolle, T, abo)
  const navItems    = flattenNav(navConfig)

  function togglePin() {
    const next = !pinned
    setPinned(next)
    localStorage.setItem('staccato_sidebar_pinned', String(next))
    if (!next) setHovered(false)
  }

  // ── Nachrichten unread badge ──
  const ladeUngelesen = useCallback(async () => {
    if (!profil) return
    const [{ data }, { data: geloescht }] = await Promise.all([
      supabase.from('nachrichten').select('id, gelesen:nachricht_gelesen(nachricht_id)').neq('gesendet_von', profil.id).order('gesendet_am', { ascending: false }).limit(20),
      supabase.from('nachricht_geloescht').select('nachricht_id').eq('user_id', profil.id),
    ])
    const geloeschtIds = new Set((geloescht ?? []).map(r => r.nachricht_id))
    setUngelesen((data ?? []).filter(n => !n.gelesen?.length && !geloeschtIds.has(n.id)))
  }, [profil?.id])

  useEffect(() => { ladeUngelesen() }, [ladeUngelesen])

  useEffect(() => {
    if (!profil) return
    const ch = supabase.channel('nav_ungelesen_2026')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nachrichten' },     ladeUngelesen)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nachricht_gelesen' }, ladeUngelesen)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [ladeUngelesen, profil?.id])

  useEffect(() => {
    window.addEventListener('staccato:nachricht_gelesen', ladeUngelesen)
    return () => window.removeEventListener('staccato:nachricht_gelesen', ladeUngelesen)
  }, [ladeUngelesen])

  // ── PWA install prompt ──
  useEffect(() => {
    const handle = e => { e.preventDefault(); if (!localStorage.getItem('staccato_install_dismissed')) setInstallPrompt(e) }
    window.addEventListener('beforeinstallprompt', handle)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    let t
    if (isIOS && !standalone && !localStorage.getItem('staccato_install_dismissed')) t = setTimeout(() => setInstallPrompt('ios'), 4000)
    return () => { window.removeEventListener('beforeinstallprompt', handle); clearTimeout(t) }
  }, [])

  // ── Virtual keyboard detection ──
  useEffect(() => {
    if (!window.visualViewport) return
    const h = () => setKeyboardOffen(window.innerHeight - window.visualViewport.height > 150)
    window.visualViewport.addEventListener('resize', h)
    return () => window.visualViewport.removeEventListener('resize', h)
  }, [])

  // ── Join session event ──
  useEffect(() => {
    const open = () => setJoinSessionOffen(true)
    window.addEventListener('staccato:open-join-session', open)
    return () => window.removeEventListener('staccato:open-join-session', open)
  }, [])

  // ── Ripple effect on all buttons ──
  useEffect(() => {
    function isDark(rgb) {
      const m = rgb.match(/\d+/g)
      return m && m.length >= 3 && 0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2] < 128
    }
    function onMouseDown(e) {
      const btn = e.target.closest('button:not(:disabled)')
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 2.5
      const color = isDark(getComputedStyle(btn).backgroundColor) ? 'rgba(255,255,255,0.22)' : 'rgba(0,0,0,0.09)'
      const r = document.createElement('span')
      r.style.cssText = `position:absolute;width:${size}px;height:${size}px;border-radius:50%;background:${color};left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px;animation:ripple2026 0.55s ease-out forwards;pointer-events:none;z-index:0;`
      const p = btn.style.position, o = btn.style.overflow
      btn.style.position = 'relative'; btn.style.overflow = 'hidden'
      btn.appendChild(r)
      setTimeout(() => { r.remove(); btn.style.position = p; btn.style.overflow = o }, 600)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [])

  const sessionBtn = rolle === 'schueler' || rolle === 'vorstand'

  // ── Sidebar JSX (shared between desktop + mobile) ──
  function SidebarContent({ isMobile = false }) {
    return (
      <>
        {/* Header */}
        <div style={{
          padding: (isMobile || expanded) ? '20px 16px 14px' : '20px 0 14px',
          borderBottom: '1px solid color-mix(in srgb, var(--border) 45%, transparent)',
          display: 'flex', alignItems: 'center',
          justifyContent: (isMobile || expanded) ? 'space-between' : 'center',
          gap: 8, flexShrink: 0,
        }}>
          {(isMobile || expanded) ? (
            <div onClick={handleLogoTap} style={{ display: 'flex', alignItems: 'center', gap: 10, minWidth: 0, cursor: 'default', userSelect: 'none' }}>
              {logoUrl
                ? <img src={logoUrl} alt={schule?.name ?? 'Logo'} style={{ maxHeight: 36, maxWidth: 130, objectFit: 'contain' }} />
                : <div style={{ fontSize: 20, fontWeight: 800, background: 'linear-gradient(135deg, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', letterSpacing: '-0.5px', whiteSpace: 'nowrap' }}>♩ Staccato</div>
              }
            </div>
          ) : (
            <div onClick={handleLogoTap} style={{ fontSize: 22, lineHeight: 1, background: 'linear-gradient(135deg, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text', cursor: 'default', userSelect: 'none' }}>♩</div>
          )}

          {isMobile ? (
            <button onClick={() => setSidebarOffen(false)} aria-label="Menü schließen" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)', padding: 10, margin: -10, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          ) : (
            <motion.button
              onClick={togglePin}
              animate={{ rotate: pinned ? 0 : 180 }}
              transition={{ type: 'spring', stiffness: 300, damping: 26 }}
              title={pinned ? 'Einklappen' : 'Anpinnen'}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', padding: 6, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, opacity: 0.6 }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 11L5 7l4-4" />
              </svg>
            </motion.button>
          )}
        </div>

        {/* Profile mini */}
        <AnimatePresence>
          {(isMobile || expanded) && profil && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0, transition: { duration: 0.12 } }}
              style={{ overflow: 'hidden', flexShrink: 0 }}
            >
              <div style={{ padding: '10px 16px 6px' }}>
                <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{profil.voller_name}</div>
                <div style={{ fontSize: 10, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: 1 }}>{T(rolle)}</div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Nav */}
        <nav style={{ flex: 1, overflowY: 'auto', overflowX: 'hidden', padding: (isMobile || expanded) ? '8px 10px' : '8px 6px' }}>
          <LayoutGroup id={isMobile ? 'mobile-nav' : 'desktop-nav'}>
            {navConfig.map(entry =>
              entry.gruppe
                ? <NavGroup2026 key={entry.gruppe} gruppe={entry.gruppe} items={entry.items} expanded={isMobile || expanded} ungelesen={ungelesen.length} onClick={isMobile ? () => setSidebarOffen(false) : () => {}} />
                : <NavItem2026  key={entry.to}    item={entry}          expanded={isMobile || expanded} ungelesen={ungelesen.length} onClick={isMobile ? () => setSidebarOffen(false) : () => {}} />
            )}
          </LayoutGroup>
        </nav>

        {/* Bottom actions */}
        <div style={{
          borderTop: '1px solid color-mix(in srgb, var(--border) 40%, transparent)',
          padding: (isMobile || expanded) ? '10px 10px' : '10px 6px',
          display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0,
        }}>
          {sessionBtn && (
            <button
              onClick={() => { setJoinSessionOffen(true); if (isMobile) setSidebarOffen(false) }}
              title={(!isMobile && !expanded) ? 'Session beitreten' : undefined}
              style={{ display: 'flex', alignItems: 'center', justifyContent: (isMobile || expanded) ? 'flex-start' : 'center', gap: (isMobile || expanded) ? 10 : 0, padding: (isMobile || expanded) ? '10px 12px' : '10px', borderRadius: 10, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 4, width: '100%', overflow: 'hidden' }}
            >
              <span style={{ fontSize: 16, flexShrink: 0 }}>🎬</span>
              {(isMobile || expanded) && <span style={{ whiteSpace: 'nowrap' }}>Session beitreten</span>}
            </button>
          )}

          {schulenListe.length > 1 && rolle !== 'superadmin' && (
            <NavLink to="/schulen" onClick={() => isMobile && setSidebarOffen(false)}
              title={(!isMobile && !expanded) ? (schule?.name ?? T('school_switcher')) : undefined}
              style={({ isActive }) => ({ display: 'flex', alignItems: 'center', justifyContent: (isMobile || expanded) ? 'flex-start' : 'center', gap: (isMobile || expanded) ? 10 : 0, padding: (isMobile || expanded) ? '9px 12px' : '9px', borderRadius: 10, textDecoration: 'none', color: isActive ? 'var(--primary)' : 'var(--text-3)', fontSize: 13 })}>
              <span style={{ fontSize: 16 }}>🏫</span>
              {(isMobile || expanded) && <span style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{schule?.name ?? T('school_switcher')} ▾</span>}
            </NavLink>
          )}

          {[
            { to: '/profil',         icon: '👤', label: T('profile_title') },
            { to: '/einstellungen',  icon: '⚙️', label: T('settings') },
          ].map(({ to, icon, label }) => (
            <NavLink key={to} to={to} onClick={() => isMobile && setSidebarOffen(false)}
              title={(!isMobile && !expanded) ? label : undefined}
              style={({ isActive }) => ({ display: 'flex', alignItems: 'center', justifyContent: (isMobile || expanded) ? 'flex-start' : 'center', gap: (isMobile || expanded) ? 10 : 0, padding: (isMobile || expanded) ? '9px 12px' : '9px', borderRadius: 10, textDecoration: 'none', color: isActive ? 'var(--primary)' : 'var(--text-3)', fontSize: 13 })}>
              <span style={{ fontSize: 16 }}>{icon}</span>
              {(isMobile || expanded) && <span style={{ whiteSpace: 'nowrap' }}>{label}</span>}
            </NavLink>
          ))}

          <button
            onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/login' })}
            title={(!isMobile && !expanded) ? T('logout') : undefined}
            style={{ display: 'flex', alignItems: 'center', justifyContent: (isMobile || expanded) ? 'flex-start' : 'center', gap: (isMobile || expanded) ? 10 : 0, padding: (isMobile || expanded) ? '9px 12px' : '9px', borderRadius: 10, background: 'none', border: 'none', color: 'var(--text-3)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', width: '100%' }}
          >
            <span style={{ fontSize: 16 }}>👋</span>
            {(isMobile || expanded) && <span style={{ whiteSpace: 'nowrap' }}>{T('logout')}</span>}
          </button>

          {(isMobile || expanded) && (
            <button onClick={() => setChangelogOffen(true)} style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', opacity: 0.35, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%', padding: '6px 0', marginTop: 2 }}>
              v{version}
            </button>
          )}
        </div>
      </>
    )
  }

  const sidebarGlass = {
    background: 'color-mix(in srgb, var(--surface) 88%, transparent)',
    backdropFilter: 'blur(24px) saturate(160%)',
    WebkitBackdropFilter: 'blur(24px) saturate(160%)',
    borderRight: '1px solid color-mix(in srgb, var(--border) 50%, transparent)',
  }

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)', fontFamily: "'Outfit', 'DM Sans', sans-serif" }} className="app-2026">
      <a href="#main-content" style={{ position: 'absolute', top: -100, left: 16, zIndex: 99999, padding: '10px 18px', background: 'var(--primary)', color: 'var(--primary-fg)', borderRadius: 'var(--radius)', fontWeight: 700, fontSize: 14, textDecoration: 'none', transition: 'top 0.15s' }} className="skip-link-2026">Zum Hauptinhalt springen</a>

      {/* ── Desktop Sidebar ── */}
      <motion.aside
        animate={{ width: expanded ? 240 : 68 }}
        transition={{ type: 'spring', stiffness: 420, damping: 42, restDelta: 1 }}
        onHoverStart={() => !pinned && setHovered(true)}
        onHoverEnd={()   => !pinned && setHovered(false)}
        style={{ minWidth: 0, flexShrink: 0, display: 'flex', flexDirection: 'column', position: 'sticky', top: 0, height: '100vh', overflowX: 'hidden', overflowY: 'auto', zIndex: 20, ...sidebarGlass }}
        className="desktop-sidebar-2026"
        aria-label="Hauptnavigation"
      >
        <SidebarContent />
      </motion.aside>

      {/* ── Mobile Overlay Sidebar ── */}
      <AnimatePresence>
        {sidebarOffen && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0, transition: { duration: 0.18 } }}
              onClick={() => setSidebarOffen(false)}
              style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.48)', zIndex: 100, backdropFilter: 'blur(4px)', WebkitBackdropFilter: 'blur(4px)' }}
            />
            <motion.aside
              key="sidebar"
              initial={{ x: '-100%' }}
              animate={{ x: 0 }}
              exit={{ x: '-100%', transition: { type: 'spring', stiffness: 320, damping: 36 } }}
              transition={{ type: 'spring', stiffness: 300, damping: 32 }}
              drag="x"
              dragConstraints={{ left: 0, right: 0 }}
              dragElastic={{ left: 0.4, right: 0 }}
              onDragEnd={(_, info) => { if (info.offset.x < -60) setSidebarOffen(false) }}
              style={{ position: 'fixed', top: 0, left: 0, bottom: 0, width: 'min(280px, calc(100vw - 48px))', display: 'flex', flexDirection: 'column', zIndex: 101, overflowY: 'auto', overflowX: 'hidden', ...sidebarGlass, borderRight: '1px solid var(--border)', touchAction: 'pan-y' }}
              aria-label="Hauptmenü"
            >
              <SidebarContent isMobile />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* ── Main area ── */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile Header */}
        <header style={{
          display: 'none', alignItems: 'center', justifyContent: 'space-between',
          padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px',
          ...sidebarGlass, borderRight: 'none',
          borderBottom: '1px solid color-mix(in srgb, var(--border) 50%, transparent)',
          position: 'sticky', top: 0, zIndex: 50,
        }} className="mobile-header-2026">
          <button onClick={() => setSidebarOffen(true)} aria-label="Menü öffnen" style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text)', padding: '10px 12px', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-10px 0' }}>☰</button>
          <div onClick={handleLogoTap} style={{ userSelect: 'none' }}>
            {logoUrl
              ? <img src={logoUrl} alt={schule?.name ?? 'Logo'} style={{ maxHeight: 30, maxWidth: 100, objectFit: 'contain' }} />
              : <div style={{ fontSize: 17, fontWeight: 800, background: 'linear-gradient(135deg, var(--primary), var(--accent))', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent', backgroundClip: 'text' }}>♩ Staccato</div>
            }
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <NavLink to="/einstellungen" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, color: 'var(--text-2)', textDecoration: 'none', minWidth: 44, minHeight: 44 }}>⚙️</NavLink>
            <button onClick={() => window.location.reload()} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 19, cursor: 'pointer', color: 'var(--text-2)', background: 'none', border: 'none', minWidth: 44, minHeight: 44 }}>↻</button>
          </div>
        </header>

        <OfflineBanner />

        {schule?.ist_demo && (() => {
          const tage = schule.demo_expires_at ? Math.ceil((new Date(schule.demo_expires_at) - new Date()) / (1000 * 60 * 60 * 24)) : null
          return (
            <div style={{ background: 'color-mix(in srgb, var(--primary) 12%, transparent)', borderBottom: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)', padding: '8px 20px', textAlign: 'center', fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>
              🧪 Demo-Umgebung{tage > 0 ? ` · ${tage} Tag${tage !== 1 ? 'e' : ''} verbleibend` : tage === 0 || tage < 0 ? ' · Abgelaufen' : ''}
            </div>
          )
        })()}

        {/* Page content */}
        <main
          id="main-content"
          style={{ flex: 1, overflowY: 'auto', scrollBehavior: 'smooth' }}
          className="main-content-2026"
          onTouchStart={e => {
            swipeStartX.current = e.touches[0].clientX
            swipeStartY.current = e.touches[0].clientY
          }}
          onTouchEnd={e => {
            if (swipeStartX.current === null) return
            const dx = e.changedTouches[0].clientX - swipeStartX.current
            const dy = Math.abs(e.changedTouches[0].clientY - swipeStartY.current)
            // Nur horizontale Swipes (nicht vertikales Scrollen)
            if (dy < 40) {
              if (dx > 60 && swipeStartX.current < 44) {
                // Swipe rechts vom linken Rand → Sidebar öffnen
                setSidebarOffen(true)
              } else if (dx < -60 && swipeStartX.current > 20) {
                // Swipe links (nicht vom Rand) → History zurück
                navigate(-1)
              }
            }
            swipeStartX.current = null
            swipeStartY.current = null
          }}
        >
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={prefersReducedMotion ? false : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? false : { opacity: 0, transition: { duration: 0.12 } }}
              transition={{ duration: 0.22, ease: [0.4, 0, 0.2, 1] }}
              style={{ padding: '32px 40px', minHeight: '100%' }}
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>

        {/* Mobile Bottom Nav */}
        <nav aria-label="Schnellnavigation" style={{
          display: 'none', alignItems: 'center',
          padding: '4px 8px',
          paddingBottom: 'calc(4px + env(safe-area-inset-bottom, 0px))',
          ...sidebarGlass, borderRight: 'none',
          borderTop: '1px solid color-mix(in srgb, var(--border) 50%, transparent)',
          position: 'sticky', bottom: 0, zIndex: 10,
          transform: keyboardOffen ? 'translateY(100%)' : 'none',
          transition: 'transform 0.2s ease',
        }} className="mobile-bottom-nav-2026">
          <LayoutGroup id="bottom-nav">
            {navItems.slice(0, 5).map(item => (
              <BottomNavItem key={item.to} item={item} ungelesen={ungelesen.length} />
            ))}
          </LayoutGroup>
        </nav>
      </div>

      {/* PWA Install Banner */}
      <AnimatePresence>
        {installPrompt && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 20 }}
            style={{ position: 'fixed', bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 10px)', left: 12, right: 12, zIndex: 450, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)', padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12 }}
            className="mobile-only-2026"
          >
            <span style={{ fontSize: 26, flexShrink: 0 }}>📲</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>App installieren</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {installPrompt === 'ios' ? '⬆️ Teilen → „Zum Homescreen"' : 'Als App auf deinem Gerät speichern'}
              </div>
            </div>
            {installPrompt !== 'ios' && (
              <button onClick={async () => {
                installPrompt.prompt()
                const { outcome } = await installPrompt.userChoice
                if (outcome === 'accepted') localStorage.setItem('staccato_install_dismissed', '1')
                setInstallPrompt(null)
              }} style={{ background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>Installieren</button>
            )}
            <button onClick={() => { localStorage.setItem('staccato_install_dismissed', '1'); setInstallPrompt(null) }} style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-3)', padding: 12, lineHeight: 1, flexShrink: 0, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
          </motion.div>
        )}
      </AnimatePresence>

      {joinSessionOffen && <JoinSessionModal onClose={() => setJoinSessionOffen(false)} />}
      {changelogOffen   && <ChangelogModal   onClose={() => setChangelogOffen(false)} />}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
      {confirmState && (
        <ConfirmModal
          message={confirmState.message}
          sub={confirmState.sub}
          confirmLabel={confirmState.confirmLabel}
          cancelLabel={confirmState.cancelLabel}
          dangerous={confirmState.dangerous ?? true}
          onConfirm={() => resolveConfirm(true)}
          onCancel={() => resolveConfirm(false)}
        />
      )}

      <style>{`
        /* ── 2026 Base ── */
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html { height: -webkit-fill-available; }
        body {
          background: var(--bg);
          color: var(--text);
          min-height: 100dvh;
          overscroll-behavior: none;
          -webkit-tap-highlight-color: transparent;
          -webkit-font-smoothing: antialiased;
        }

        /* ── 2026 CSS Variable Overrides ── */
        .app-2026 {
          --radius: 11px;
          --radius-lg: 18px;
          --shadow: 0 2px 8px rgba(0,0,0,0.06);
          --shadow-lg: 0 12px 40px rgba(0,0,0,0.13), 0 3px 10px rgba(0,0,0,0.06);
          font-family: 'Outfit', 'DM Sans', system-ui, -apple-system, sans-serif;
        }

        /* Richer gradient mesh behind everything */
        .app-2026 {
          background:
            radial-gradient(ellipse 70% 55% at 10% -8%, color-mix(in srgb, var(--primary) 12%, transparent), transparent),
            radial-gradient(ellipse 55% 45% at 90% 110%, color-mix(in srgb, var(--accent) 10%, transparent), transparent),
            radial-gradient(ellipse 40% 35% at 60% 40%, color-mix(in srgb, var(--primary) 4%, transparent), transparent),
            var(--bg);
        }

        /* ── Font enforcement ── */
        .app-2026 h1, .app-2026 h2, .app-2026 h3,
        .app-2026 button, .app-2026 input, .app-2026 select, .app-2026 textarea {
          font-family: 'Outfit', 'DM Sans', system-ui, -apple-system, sans-serif;
        }

        /* ── Focus / Inputs ── */
        .app-2026 input, .app-2026 textarea, .app-2026 select {
          transition: border-color 0.15s, box-shadow 0.15s, background 0.15s;
          touch-action: manipulation;
          border-radius: var(--radius) !important;
        }
        .app-2026 input:focus, .app-2026 textarea:focus, .app-2026 select:focus {
          outline: none !important;
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 18%, transparent) !important;
        }
        button:focus-visible, a:focus-visible, input:focus-visible, select:focus-visible, textarea:focus-visible {
          outline: 2px solid var(--primary) !important;
          outline-offset: 2px !important;
        }
        button { transition: all 0.15s ease; touch-action: manipulation; -webkit-tap-highlight-color: transparent; }
        button:active:not(:disabled) { transform: scale(0.96) !important; }

        /* ── Table styling ── */
        .app-2026 table { border-collapse: separate !important; border-spacing: 0 !important; }
        .app-2026 thead th {
          background: color-mix(in srgb, var(--primary) 6%, var(--surface)) !important;
          font-size: 11px !important;
          font-weight: 700 !important;
          letter-spacing: 0.07em !important;
          text-transform: uppercase !important;
          color: var(--text-3) !important;
        }
        .app-2026 thead th:first-child { border-radius: var(--radius) 0 0 0 !important; }
        .app-2026 thead th:last-child  { border-radius: 0 var(--radius) 0 0 !important; }
        .app-2026 tbody tr { transition: background 0.12s !important; }
        @media (hover: hover) {
          .app-2026 tbody tr:hover td { background: color-mix(in srgb, var(--primary) 4%, transparent) !important; }
        }

        /* ── Section headings ── */
        .section-heading-2026 {
          font-size: 11px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.07em;
          color: var(--text-3);
          margin-bottom: 12px;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .section-heading-2026::after {
          content: '';
          flex: 1;
          height: 1px;
          background: var(--border);
          opacity: 0.5;
        }

        /* ── Scrollbar ── */
        @media (hover: hover) {
          ::-webkit-scrollbar { width: 4px; height: 4px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: var(--text-3); }
        }

        /* ── Responsive layout ── */
        @media (max-width: 768px) {
          .desktop-sidebar-2026 { display: none !important; }
          .mobile-header-2026   { display: flex !important; }
          .mobile-bottom-nav-2026 { display: flex !important; }
          .main-content-2026 { padding: 16px !important; padding-bottom: calc(88px + env(safe-area-inset-bottom, 0px)) !important; }
          .main-content-2026 > div { padding: 0 !important; }
        }
        @media (min-width: 769px) {
          .mobile-only-2026 { display: none !important; }
        }

        /* ── Skip link ── */
        .skip-link-2026:focus { top: 12px !important; }

        /* ── Sidebar tooltip ── */
        .desktop-sidebar-2026 [title]:not([title=""]) { position: relative; }

        /* ── Theme transition ── */
        html[data-transitioning] *, html[data-transitioning] *::before, html[data-transitioning] *::after {
          transition: background-color 0.35s ease, color 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease !important;
        }

        /* ── Animations ── */
        @keyframes ripple2026 {
          from { transform: scale(0); opacity: 1; }
          to   { transform: scale(1); opacity: 0; }
        }
        @keyframes fadeSlideUp2026 {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes shimmer2026 {
          from { background-position: 200% center; }
          to   { background-position: -200% center; }
        }

        /* ── Stagger utility ── */
        .stagger-2026 > * {
          animation: fadeSlideUp2026 0.28s cubic-bezier(0.4,0,0.2,1) both;
        }
        .stagger-2026 > *:nth-child(1)  { animation-delay: 0ms }
        .stagger-2026 > *:nth-child(2)  { animation-delay: 55ms }
        .stagger-2026 > *:nth-child(3)  { animation-delay: 110ms }
        .stagger-2026 > *:nth-child(4)  { animation-delay: 165ms }
        .stagger-2026 > *:nth-child(5)  { animation-delay: 220ms }
        .stagger-2026 > *:nth-child(6)  { animation-delay: 275ms }
        .stagger-2026 > *:nth-child(7)  { animation-delay: 330ms }
        .stagger-2026 > *:nth-child(8)  { animation-delay: 385ms }

        /* ── Glass card utility ── */
        .glass-card-2026 {
          background: color-mix(in srgb, var(--surface) 82%, transparent);
          backdrop-filter: blur(12px) saturate(140%);
          -webkit-backdrop-filter: blur(12px) saturate(140%);
          border: 1px solid color-mix(in srgb, var(--border) 55%, transparent);
          border-radius: var(--radius-lg);
        }

        /* ── Hover lift utility ── */
        .lift-2026 {
          transition: transform 0.22s ease, box-shadow 0.22s ease !important;
          will-change: transform;
        }
        @media (hover: hover) {
          .lift-2026:hover { transform: translateY(-3px) !important; box-shadow: 0 12px 32px rgba(0,0,0,0.13) !important; }
        }
        .lift-2026:active { transform: translateY(-1px) !important; }

        /* ── Gradient text utility ── */
        .grad-text-2026 {
          background: linear-gradient(135deg, var(--primary), var(--accent));
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
        }

        /* ── Shimmer loading ── */
        .shimmer-2026 {
          background: linear-gradient(90deg, var(--bg-2) 25%, var(--bg-3) 50%, var(--bg-2) 75%);
          background-size: 400% 100%;
          animation: shimmer2026 1.6s ease infinite;
          border-radius: var(--radius);
        }

        /* ── Modal bottom sheet mobile ── */
        @media (max-width: 640px) {
          .modal-overlay { align-items: flex-end !important; padding: 0 !important; }
          .modal-inner { border-radius: 20px 20px 0 0 !important; max-width: 100% !important; padding: 20px 16px 32px !important; max-height: 92dvh !important; border-left: none !important; border-right: none !important; border-bottom: none !important; }
          .kurs-modal-inner { border-radius: 20px 20px 0 0 !important; max-width: 100% !important; padding: 20px 16px 32px !important; max-height: 92dvh !important; border-left: none !important; border-right: none !important; border-bottom: none !important; }
        }

        /* ── Badge pulse ── */
        @keyframes badgePulse { 0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--danger) 65%,transparent)} 70%{box-shadow:0 0 0 6px transparent} 100%{box-shadow:0 0 0 0 transparent} }
        .nav-badge-2026 { animation: badgePulse 2.2s ease infinite; }

        /* ── Reduced motion ── */
        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after { animation-duration: 0.01ms !important; animation-iteration-count: 1 !important; transition-duration: 0.01ms !important; }
        }
      `}</style>
    </div>
  )
}
