import { useState, useEffect, useCallback, useRef } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { startseiteNach } from '../ProtectedRoute'
import { supabase } from '../../lib/supabase'
import { version } from '../../../package.json'
import { ToastContainer } from '../Toast'
import { ConfirmModal } from '../ConfirmModal'
import { getNavConfig, flattenNav } from './navConfig'
import { NavItem, NavGroup, DesktopNav } from './NavComponents'
import JoinSessionModal from './JoinSessionModal'
import ChangelogModal from './ChangelogModal'
import OfflineBanner from './OfflineBanner'

export default function AppLayout() {
  const { profil, rolle, schule, abo, abmelden, T, toasts, removeToast, confirmState, resolveConfirm, schulenListe, darkMode, großeSchrift } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const swipeStartX = useRef(null)
  const histIdxRef = useRef(null)
  const currentHistIdx = window.history.state?.idx ?? 0
  const pageDir = histIdxRef.current !== null && currentHistIdx < histIdxRef.current ? 'back' : 'forward'
  histIdxRef.current = currentHistIdx

  const [sidebarOffen, setSidebarOffen]         = useState(false)
  const [joinSessionOffen, setJoinSessionOffen] = useState(false)
  const [changelogOffen, setChangelogOffen]     = useState(false)
  const [ungelesen, setUngelesen]               = useState([])
  const touchStartX                             = useRef(null)
  const [installPrompt, setInstallPrompt]       = useState(null)
  const [keyboardOffen, setKeyboardOffen]       = useState(false)

  const navConfig = getNavConfig(rolle, T, abo)
  const navItems  = flattenNav(navConfig)

  const ladeUngelesen = useCallback(async () => {
    if (!profil) return
    const [{ data }, { data: geloescht }] = await Promise.all([
      supabase
        .from('nachrichten')
        .select('id, betreff, gesendet_am, typ, sender:profiles!nachrichten_gesendet_von_fkey(voller_name), gelesen:nachricht_gelesen(nachricht_id)')
        .neq('gesendet_von', profil.id)
        .order('gesendet_am', { ascending: false })
        .limit(20),
      supabase
        .from('nachricht_geloescht')
        .select('nachricht_id')
        .eq('user_id', profil.id),
    ])
    const geloeschtIds = new Set((geloescht ?? []).map(r => r.nachricht_id))
    setUngelesen((data ?? []).filter(n => !n.gelesen?.length && !geloeschtIds.has(n.id)))
  }, [profil?.id])

  useEffect(() => { ladeUngelesen() }, [ladeUngelesen])

  useEffect(() => {
    if (!profil) return
    const ch = supabase.channel('nav_nachrichten')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nachrichten' }, ladeUngelesen)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'nachricht_gelesen' }, ladeUngelesen)
      .subscribe()
    return () => supabase.removeChannel(ch)
  }, [ladeUngelesen, profil?.id])

  useEffect(() => {
    window.addEventListener('staccato:nachricht_gelesen', ladeUngelesen)
    return () => window.removeEventListener('staccato:nachricht_gelesen', ladeUngelesen)
  }, [ladeUngelesen])

  useEffect(() => {
    const handleBefore = e => {
      e.preventDefault()
      if (!localStorage.getItem('staccato_install_dismissed')) setInstallPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handleBefore)
    const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !('MSStream' in window)
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone
    let t
    if (isIOS && !isStandalone && !localStorage.getItem('staccato_install_dismissed')) {
      t = setTimeout(() => setInstallPrompt('ios'), 4000)
    }
    return () => { window.removeEventListener('beforeinstallprompt', handleBefore); clearTimeout(t) }
  }, [])

  useEffect(() => {
    if (!window.visualViewport) return
    const handler = () => setKeyboardOffen(window.innerHeight - window.visualViewport.height > 150)
    window.visualViewport.addEventListener('resize', handler)
    return () => window.visualViewport.removeEventListener('resize', handler)
  }, [])

  useEffect(() => {
    const openJoin = () => setJoinSessionOffen(true)
    window.addEventListener('staccato:open-join-session', openJoin)
    return () => window.removeEventListener('staccato:open-join-session', openJoin)
  }, [])

  useEffect(() => {
    function isDark(rgb) {
      const m = rgb.match(/\d+/g)
      if (!m || m.length < 3) return false
      return 0.299 * +m[0] + 0.587 * +m[1] + 0.114 * +m[2] < 128
    }
    function handleRipple(e) {
      const btn = e.target.closest('button:not(:disabled)')
      if (!btn) return
      const rect = btn.getBoundingClientRect()
      const size = Math.max(rect.width, rect.height) * 2.5
      const color = isDark(getComputedStyle(btn).backgroundColor)
        ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.1)'
      const ripple = document.createElement('span')
      ripple.style.cssText = [
        'position:absolute', `width:${size}px`, `height:${size}px`,
        'border-radius:50%', `background:${color}`,
        `left:${e.clientX - rect.left - size / 2}px`,
        `top:${e.clientY - rect.top - size / 2}px`,
        'animation:ripple 0.55s ease-out forwards',
        'pointer-events:none', 'z-index:0',
      ].join(';')
      const prevPos = btn.style.position
      const prevOvf = btn.style.overflow
      btn.style.position = 'relative'
      btn.style.overflow  = 'hidden'
      btn.appendChild(ripple)
      setTimeout(() => {
        ripple.remove()
        btn.style.position = prevPos
        btn.style.overflow  = prevOvf
      }, 600)
    }
    document.addEventListener('mousedown', handleRipple)

    const obs = new MutationObserver(muts => {
      for (const mut of muts) {
        for (const node of mut.addedNodes) {
          if (node.nodeType !== 1) continue
          const cs = node.style
          if (
            cs.position === 'fixed' &&
            parseInt(cs.zIndex) >= 500 &&
            cs.alignItems === 'center' &&
            cs.justifyContent === 'center'
          ) {
            const content = node.firstElementChild
            if (content && !content.style.animation) {
              content.style.animation = 'modalIn 0.22s cubic-bezier(0.34,1.56,0.64,1) backwards'
            }
          }
        }
      }
    })
    obs.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })

    return () => {
      document.removeEventListener('mousedown', handleRipple)
      obs.disconnect()
    }
  }, [])

  useEffect(() => {
    const io = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.style.animationPlayState = 'running'
          io.unobserve(entry.target)
        }
      })
    }, { threshold: 0.08 })

    function scan(root) {
      root.querySelectorAll?.('.fade-in-scroll').forEach(el => {
        el.style.animationPlayState = 'paused'
        io.observe(el)
      })
    }

    scan(document)

    const mutObs = new MutationObserver(muts => {
      muts.forEach(mut => {
        mut.addedNodes.forEach(node => {
          if (node.nodeType !== 1) return
          scan(node)
          if (node.classList?.contains('fade-in-scroll')) {
            node.style.animationPlayState = 'paused'
            io.observe(node)
          }
        })
      })
    })
    mutObs.observe(document.getElementById('root') ?? document.body, { childList: true, subtree: true })

    return () => { io.disconnect(); mutObs.disconnect() }
  }, [])

  async function handleInstall() {
    if (!installPrompt || installPrompt === 'ios') return
    installPrompt.prompt()
    const { outcome } = await installPrompt.userChoice
    if (outcome === 'accepted') localStorage.setItem('staccato_install_dismissed', '1')
    setInstallPrompt(null)
  }
  function handleDismissInstall() {
    localStorage.setItem('staccato_install_dismissed', '1')
    setInstallPrompt(null)
  }

  const sessionBtn = (rolle === 'schueler' || rolle === 'vorstand')

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)', fontFamily: "'Outfit', 'DM Sans', sans-serif" }}>
      <a href="#main-content" className="skip-link">Zum Hauptinhalt springen</a>

      {/* Desktop Sidebar */}
      <aside aria-label="Hauptnavigation" style={{
        width: 240, minWidth: 240, background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '20px 12px',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }} className="desktop-sidebar">
        <div style={{ padding: '0 8px 20px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          {schule?.logo_url
            ? <img src={schule.logo_url} alt={schule.name ?? 'Logo'} style={{ maxHeight: 40, maxWidth: '100%', objectFit: 'contain', display: 'block' }} />
            : <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.5px' }}>♩ Staccato</div>
          }
          {profil && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{profil.voller_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{T(rolle)}</div>
            </div>
          )}
        </div>

        <DesktopNav navConfig={navConfig} setSidebarOffen={setSidebarOffen} ungelesen={ungelesen.length} />

        {sessionBtn && (
          <button onClick={() => setJoinSessionOffen(true)}
            style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 12, width: '100%' }}>
            🎬 Session beitreten
          </button>
        )}

        {schulenListe.length > 1 && rolle !== 'superadmin' && (
          <NavLink to="/schulen"
            style={({ isActive }) => ({ ...btnStyle, textDecoration: 'none', color: isActive ? 'var(--primary)' : 'var(--text-3)', marginBottom: 4 })}>
            🏫 {schule?.name ?? T('school_switcher')} ▾
          </NavLink>
        )}

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink to="/profil" style={({ isActive }) => ({ ...btnStyle, color: isActive ? 'var(--primary)' : 'var(--text-3)', textDecoration: 'none' })}>
            👤 {T('profile_title')}
          </NavLink>
          <NavLink to="/einstellungen" style={({ isActive }) => ({ ...btnStyle, color: isActive ? 'var(--primary)' : 'var(--text-3)', textDecoration: 'none' })}>
            ⚙️ {T('settings')}
          </NavLink>
          <NavLink to={`/${rolle === 'superadmin' ? 'admin' : rolle}/tools`} style={({ isActive }) => ({ ...btnStyle, color: isActive ? 'var(--primary)' : 'var(--text-3)', textDecoration: 'none' })}>
            🔧 {T('tools_nav')}
          </NavLink>
          <button onClick={() => window.location.reload()} style={{ ...btnStyle, fontSize: 14, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '10px 12px', borderRadius: 'var(--radius)', marginTop: 2, marginBottom: 2 }}>↻ Aktualisieren</button>
          <button onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/login' })} style={btnStyle}>👋 {T('logout')}</button>
          <button onClick={() => setChangelogOffen(true)} aria-label="Versionshistorie anzeigen" style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', marginTop: 8, opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%', padding: '8px 0' }}>
            v{version} ✨
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOffen && (
        <div style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, zIndex: 100, display: 'flex' }}
          onTouchStart={e => { touchStartX.current = e.touches[0].clientX }}
          onTouchMove={e => {
            if (touchStartX.current === null) return
            if (e.touches[0].clientX - touchStartX.current < -50) { setSidebarOffen(false); touchStartX.current = null }
          }}
          onTouchEnd={() => { touchStartX.current = null }}
        >
          <div style={{ position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setSidebarOffen(false)} />
          <aside aria-label="Hauptnavigation" style={{
            width: 'min(260px, calc(100vw - 48px))',
            background: 'var(--surface)', borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            position: 'relative', zIndex: 1,
            height: '100%', overflow: 'hidden',
          }}>
            <div style={{ padding: 'calc(20px + env(safe-area-inset-top, 0px)) 12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              {schule?.logo_url
                ? <img src={schule.logo_url} alt={schule.name ?? 'Logo'} style={{ maxHeight: 36, maxWidth: 140, objectFit: 'contain' }} />
                : <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>♩ Staccato</div>
              }
              <button onClick={() => setSidebarOffen(false)} aria-label="Menü schließen" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)', padding: 10, margin: -10, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            <nav aria-label="Hauptmenü" style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
              {navConfig.map(entry => entry.gruppe
                ? <NavGroup key={entry.gruppe} {...entry} setSidebarOffen={setSidebarOffen} ungelesen={ungelesen.length} />
                : <NavItem  key={entry.to}    item={entry} setSidebarOffen={setSidebarOffen} ungelesen={ungelesen.length} />
              )}
            </nav>
            <div style={{ flexShrink: 0, padding: '0 12px 12px' }}>
              {sessionBtn && (
                <button onClick={() => { setJoinSessionOffen(true); setSidebarOffen(false) }}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', marginBottom: 8, width: '100%' }}>
                  🎬 Session beitreten
                </button>
              )}
              {schulenListe.length > 1 && rolle !== 'superadmin' && (
                <NavLink to="/schulen" onClick={() => setSidebarOffen(false)}
                  style={({ isActive }) => ({ ...btnStyle, textDecoration: 'none', color: isActive ? 'var(--primary)' : 'var(--text-3)', marginBottom: 4 })}>
                  🏫 {schule?.name ?? T('school_switcher')} ▾
                </NavLink>
              )}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 8, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <NavLink to="/profil" onClick={() => setSidebarOffen(false)} style={({ isActive }) => ({ ...btnStyle, textDecoration: 'none', color: isActive ? 'var(--primary)' : 'var(--text-3)' })}>
                  👤 {T('profile_title')}
                </NavLink>
                <NavLink to="/einstellungen" onClick={() => setSidebarOffen(false)} style={({ isActive }) => ({ ...btnStyle, textDecoration: 'none', color: isActive ? 'var(--primary)' : 'var(--text-3)' })}>
                  ⚙️ {T('settings')}
                </NavLink>
                <NavLink to={`/${rolle === 'superadmin' ? 'admin' : rolle}/tools`} onClick={() => setSidebarOffen(false)} style={({ isActive }) => ({ ...btnStyle, textDecoration: 'none', color: isActive ? 'var(--primary)' : 'var(--text-3)' })}>
                  🔧 {T('tools_nav')}
                </NavLink>
                <button onClick={() => supabase.auth.signOut().then(() => { window.location.href = '/login' })} style={btnStyle}>👋 {T('logout')}</button>
                <button onClick={() => { setChangelogOffen(true); setSidebarOffen(false) }} aria-label="Versionshistorie anzeigen" style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', marginTop: 6, opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%', padding: '8px 0' }}>
                  v{version} ✨
                </button>
              </div>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile Header */}
        <header style={{
          display: 'none', alignItems: 'center', justifyContent: 'space-between',
          padding: 'calc(12px + env(safe-area-inset-top, 0px)) 16px 12px',
          background: 'var(--surface)',
          borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50,
        }} className="mobile-header">
          <div style={{ flex: 1 }}>
            <button onClick={() => setSidebarOffen(true)} aria-label="Menü öffnen" aria-expanded={sidebarOffen} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text)', padding: '11px 12px', minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '-11px 0' }}>☰</button>
          </div>
          {schule?.logo_url
            ? <img src={schule.logo_url} alt={schule.name ?? 'Logo'} style={{ maxHeight: 32, maxWidth: 120, objectFit: 'contain' }} />
            : <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>♩ Staccato</div>
          }
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 4 }}>
            <NavLink to="/einstellungen" aria-label={T('settings')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, color: 'var(--text-2)', textDecoration: 'none', minWidth: 44, minHeight: 44 }}>⚙️</NavLink>
            <button onClick={() => window.location.reload()} aria-label="Neu laden" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 20, cursor: 'pointer', color: 'var(--text-2)', background: 'none', border: 'none', minWidth: 44, minHeight: 44 }}>↻</button>
          </div>
        </header>

        <OfflineBanner />

        {schule?.ist_demo && (() => {
          const tage = schule.demo_expires_at
            ? Math.ceil((new Date(schule.demo_expires_at) - new Date()) / (1000 * 60 * 60 * 24))
            : null
          return (
            <div style={{
              background: 'color-mix(in srgb, var(--primary) 12%, transparent)',
              borderBottom: '1px solid color-mix(in srgb, var(--primary) 30%, transparent)',
              padding: '8px 20px', textAlign: 'center', fontSize: 13,
              color: 'var(--primary)', fontWeight: 600,
            }}>
              🧪 Demo-Umgebung
              {tage !== null && tage > 0 && ` · ${tage} Tag${tage !== 1 ? 'e' : ''} verbleibend`}
              {tage !== null && tage <= 0 && ' · Abgelaufen'}
            </div>
          )
        })()}

        <main
          id="main-content"
          style={{ flex: 1, padding: '32px 40px', overflowY: 'auto', scrollBehavior: 'smooth' }}
          className="main-content"
          onTouchStart={e => { swipeStartX.current = e.touches[0].clientX }}
          onTouchEnd={e => {
            if (swipeStartX.current === null) return
            const delta = e.changedTouches[0].clientX - swipeStartX.current
            if (delta > 72 && swipeStartX.current < 44) navigate(-1)
            swipeStartX.current = null
          }}
        >
          <div key={location.pathname} style={{ animation: `${pageDir === 'back' ? 'slideFromLeft' : 'slideFromRight'} 0.22s cubic-bezier(0.4,0,0.2,1) both` }}>
            <Outlet />
          </div>
        </main>

        {/* Mobile Bottom Nav */}
        <nav aria-label="Schnellnavigation" style={{
          display: 'none', alignItems: 'center',
          padding: '8px 12px',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          position: 'sticky', bottom: 0, zIndex: 10,
          ...(keyboardOffen && { transform: 'translateY(100%)' }),
          transition: 'transform 0.2s ease',
        }} className="mobile-bottom-nav">
          {navItems.slice(0, 5).map(item => <NavItem key={item.to} item={item} mobile setSidebarOffen={setSidebarOffen} ungelesen={ungelesen.length} />)}
        </nav>
      </div>

      {/* PWA Install Banner */}
      {installPrompt && (
        <div style={{
          position: 'fixed',
          bottom: 'calc(64px + env(safe-area-inset-bottom, 0px) + 10px)',
          left: 12, right: 12, zIndex: 450,
          background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
          border: '1px solid var(--border)', boxShadow: 'var(--shadow-lg)',
          padding: '12px 14px', display: 'flex', alignItems: 'center', gap: 12,
          animation: 'fadeSlideUp 0.22s ease',
        }} className="mobile-only">
          <span style={{ fontSize: 26, flexShrink: 0 }}>📲</span>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 2 }}>App installieren</div>
            <div style={{ fontSize: 11, color: 'var(--text-3)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
              {installPrompt === 'ios' ? '⬆️ Teilen → „Zum Homescreen"' : 'Als App auf deinem Gerät speichern'}
            </div>
          </div>
          {installPrompt !== 'ios' && (
            <button onClick={handleInstall} style={{ background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none', borderRadius: 'var(--radius)', padding: '8px 12px', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0 }}>
              Installieren
            </button>
          )}
          <button onClick={handleDismissInstall} aria-label="Schließen" style={{ background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-3)', padding: 12, lineHeight: 1, flexShrink: 0, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
        </div>
      )}

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
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { height: -webkit-fill-available; }

        .skip-link {
          position: absolute;
          top: -100px;
          left: 16px;
          z-index: 99999;
          padding: 10px 18px;
          background: var(--primary);
          color: var(--primary-fg);
          border-radius: var(--radius);
          font-weight: 700;
          font-size: 14px;
          text-decoration: none;
          transition: top 0.15s ease;
          white-space: nowrap;
        }
        .skip-link:focus { top: 12px; outline: 3px solid var(--primary); outline-offset: 2px; }
        body {
          background: var(--bg);
          color: var(--text);
          min-height: 100dvh;
          overscroll-behavior: none;
          -webkit-tap-highlight-color: transparent;
        }

        input, textarea, select {
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          touch-action: manipulation;
        }
        input:focus, textarea:focus, select:focus {
          outline: none !important;
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent) !important;
        }

        button {
          transition: all 0.15s ease;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        button:active:not(:disabled) { transform: scale(0.96) !important; }

        button:focus-visible,
        a:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible {
          outline: 2px solid var(--primary) !important;
          outline-offset: 2px !important;
          box-shadow: none !important;
        }

        @media (hover: hover) {
          ::-webkit-scrollbar { width: 5px; height: 5px; }
          ::-webkit-scrollbar-track { background: transparent; }
          ::-webkit-scrollbar-thumb { background: var(--border); border-radius: 4px; }
          ::-webkit-scrollbar-thumb:hover { background: var(--text-3); }
        }

        @keyframes fadeSlideUp {
          from { opacity: 0; transform: translateY(10px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes slideFromRight {
          from { opacity: 0; transform: translateX(20px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes slideFromLeft {
          from { opacity: 0; transform: translateX(-20px); }
          to   { opacity: 1; transform: none; }
        }
        @keyframes staggerIn {
          from { opacity: 0; transform: translateY(8px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        .stagger-item { animation: staggerIn 0.22s ease both; }
        .stagger-item:nth-child(1)  { animation-delay: 0ms; }
        .stagger-item:nth-child(2)  { animation-delay: 50ms; }
        .stagger-item:nth-child(3)  { animation-delay: 100ms; }
        .stagger-item:nth-child(4)  { animation-delay: 150ms; }
        .stagger-item:nth-child(5)  { animation-delay: 200ms; }
        .stagger-item:nth-child(6)  { animation-delay: 250ms; }
        .stagger-item:nth-child(7)  { animation-delay: 300ms; }
        .stagger-item:nth-child(8)  { animation-delay: 350ms; }
        .stagger-item:nth-child(9)  { animation-delay: 400ms; }
        .stagger-item:nth-child(10) { animation-delay: 450ms; }
        .stagger-item:nth-child(11) { animation-delay: 500ms; }
        .stagger-item:nth-child(12) { animation-delay: 550ms; }

        html[data-transitioning] *,
        html[data-transitioning] *::before,
        html[data-transitioning] *::after {
          transition: background-color 0.35s ease, color 0.35s ease,
                      border-color 0.35s ease, box-shadow 0.35s ease !important;
        }

        @keyframes emptyBob {
          0%, 100% { transform: translateY(0); }
          50%       { transform: translateY(-7px); }
        }
        @keyframes rsvpBounce {
          0%   { transform: scale(1); }
          35%  { transform: scale(1.18); }
          65%  { transform: scale(0.94); }
          100% { transform: scale(1); }
        }
        @keyframes ripple {
          from { transform: scale(0); opacity: 1; }
          to   { transform: scale(1); opacity: 0; }
        }
        @keyframes modalIn {
          from { opacity: 0; transform: scale(0.92) translateY(8px); }
          to   { opacity: 1; transform: none; }
        }

        /* ── Hover Lift ── */
        .hover-lift {
          transition: transform 0.22s ease, box-shadow 0.22s ease !important;
          will-change: transform;
        }
        @media (hover: hover) {
          .hover-lift:hover {
            transform: translateY(-3px) !important;
            box-shadow: 0 10px 28px rgba(0,0,0,0.13) !important;
          }
        }
        .hover-lift:active { transform: translateY(-1px) !important; }

        /* ── Primary Button Shine ── */
        .btn-shine {
          position: relative;
          overflow: hidden;
        }
        .btn-shine::after {
          content: '';
          position: absolute;
          top: 0; left: -100%;
          width: 60%; height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255,255,255,0.22), transparent);
          transform: skewX(-20deg);
          transition: left 0.45s ease;
          pointer-events: none;
        }
        @media (hover: hover) {
          .btn-shine:hover::after { left: 160%; }
        }

        /* ── Nav Badge Pulse ── */
        @keyframes badgePulse {
          0%   { box-shadow: 0 0 0 0 color-mix(in srgb, var(--danger) 65%, transparent); }
          70%  { box-shadow: 0 0 0 6px transparent; }
          100% { box-shadow: 0 0 0 0 transparent; }
        }
        .nav-badge { animation: badgePulse 2.2s ease infinite; }

        /* ── Scroll Fade-In ── */
        .fade-in-scroll {
          animation: fadeInScroll 0.45s cubic-bezier(0.4,0,0.2,1) both;
        }
        @keyframes fadeInScroll {
          from { opacity: 0; transform: translateY(14px); }
          to   { opacity: 1; transform: translateY(0); }
        }

        @media (max-width: 640px) {
          .modal-overlay {
            align-items: flex-end !important;
            padding: 0 !important;
          }
          .modal-inner {
            border-radius: 20px 20px 0 0 !important;
            max-width: 100% !important;
            padding: 20px 16px 32px !important;
            max-height: 92dvh !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
          }
          .kurs-modal-inner {
            border-radius: 20px 20px 0 0 !important;
            max-width: 100% !important;
            padding: 20px 16px 32px !important;
            max-height: 92dvh !important;
            border-left: none !important;
            border-right: none !important;
            border-bottom: none !important;
          }
        }

        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-header { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
          .main-content {
            padding: 16px !important;
            padding-bottom: calc(80px + env(safe-area-inset-bottom, 0px)) !important;
          }

          .mobile-nav-link[aria-current="page"]::before {
            content: '';
            position: absolute;
            top: 3px;
            left: 50%;
            transform: translateX(-50%);
            width: 20px;
            height: 3px;
            border-radius: 99px;
            background: var(--primary);
          }
        }

        @media (min-width: 769px) {
          .mobile-only { display: none !important; }
        }

        @media (prefers-reduced-motion: reduce) {
          *, *::before, *::after {
            animation-duration: 0.01ms !important;
            animation-iteration-count: 1 !important;
            transition-duration: 0.01ms !important;
            scroll-behavior: auto !important;
          }
        }
      `}</style>
    </div>
  )
}

const btnStyle = {
  display: 'flex', alignItems: 'center', gap: 8,
  padding: '9px 12px', borderRadius: 'var(--radius)',
  border: 'none', background: 'transparent',
  color: 'var(--text-3)', fontSize: 13, cursor: 'pointer',
  fontFamily: 'inherit', width: '100%', transition: 'all 0.15s',
}
