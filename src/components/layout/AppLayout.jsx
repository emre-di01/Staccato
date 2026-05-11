import { useState, useEffect, useCallback, useRef, useLayoutEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { startseiteNach } from '../ProtectedRoute'
import { THEMES, THEME_KEYS } from '../../themes/themes'
import { supabase } from '../../lib/supabase'
import { version } from '../../../package.json'
import { CHANGELOG } from '../../changelog'
import { ToastContainer } from '../Toast'
import { ConfirmModal } from '../ConfirmModal'

function OfflineBanner() {
  const [offline, setOffline] = useState(!navigator.onLine)
  useEffect(() => {
    const on  = () => setOffline(false)
    const off = () => setOffline(true)
    window.addEventListener('online',  on)
    window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])
  if (!offline) return null
  return (
    <div style={{ background:'#92400e', color:'#fef3c7', fontSize:13, fontWeight:600, textAlign:'center', padding:'8px 16px', flexShrink:0 }}>
      📵 Offline – Inhalte werden aus dem Cache geladen
    </div>
  )
}

// Nav-Konfiguration je Rolle — items können flach oder gruppiert sein
function getNavConfig(rolle, T) {
  if (rolle === 'superadmin') {
    return [
      { icon: '🏫', label: T('all_schools'), to: '/superadmin' },
      { icon: '📊', label: T('dashboard'),   to: '/admin' },
      { gruppe: 'Unterricht', items: [
        { icon: '🎵', label: 'Kurse',           to: '/admin/kurse' },
        { icon: '📅', label: T('schedule'),      to: '/admin/stundenplan' },
        { icon: '🎼', label: T('repertoire'),    to: '/admin/repertoire' },
        { icon: '🎭', label: T('events'),        to: '/admin/events' },
      ]},
      { gruppe: 'Verwaltung', items: [
        { icon: '👥', label: T('members'),       to: '/admin/mitglieder' },
        { icon: '🏫', label: T('rooms'),         to: '/admin/raeume' },
        { icon: '🎸', label: 'Instrumente',      to: '/admin/instrumente' },
        { icon: '📦', label: 'Inventar',         to: '/admin/inventar' },
        { icon: '📋', label: T('prospects'),     to: '/admin/interessenten' },
      ]},
      { gruppe: 'Kommunikation', items: [
        { icon: '💬', label: T('messages'),      to: '/admin/nachrichten', nachrichten: true },
      ]},
      { gruppe: 'Vorstand', items: [
        { icon: '🎯', label: T('vorstand_ziele'),      to: '/vorstand/ziele' },
        { icon: '📝', label: T('vorstand_protokolle'), to: '/vorstand/protokolle' },
      ]},
    ]
  }
  if (rolle === 'admin') {
    return [
      { icon: '📊', label: T('dashboard'), to: '/admin' },
      { gruppe: 'Unterricht', items: [
        { icon: '🎵', label: 'Kurse',           to: '/admin/kurse' },
        { icon: '📅', label: T('schedule'),      to: '/admin/stundenplan' },
        { icon: '🎼', label: T('repertoire'),    to: '/admin/repertoire' },
        { icon: '🎭', label: T('events'),        to: '/admin/events' },
      ]},
      { gruppe: 'Verwaltung', items: [
        { icon: '👥', label: T('members'),       to: '/admin/mitglieder' },
        { icon: '🏫', label: T('rooms'),         to: '/admin/raeume' },
        { icon: '🎸', label: 'Instrumente',      to: '/admin/instrumente' },
        { icon: '📦', label: 'Inventar',         to: '/admin/inventar' },
        { icon: '📋', label: T('prospects'),     to: '/admin/interessenten' },
      ]},
      { gruppe: 'Kommunikation', items: [
        { icon: '💬', label: T('messages'),      to: '/admin/nachrichten', nachrichten: true },
      ]},
      { gruppe: 'Vorstand', items: [
        { icon: '🎯', label: T('vorstand_ziele'),      to: '/vorstand/ziele' },
        { icon: '📝', label: T('vorstand_protokolle'), to: '/vorstand/protokolle' },
      ]},
    ]
  }
  if (rolle === 'vorstand') {
    return [
      { icon: '📊', label: T('dashboard'), to: '/vorstand' },
      { gruppe: 'Schüler-Bereich', items: [
        { icon: '📅', label: 'Stundenplan',   to: '/vorstand/stundenplan' },
        { icon: '🎵', label: 'Meine Kurse',   to: '/vorstand/kurse' },
        { icon: '🎼', label: T('repertoire'), to: '/vorstand/repertoire' },
        { icon: '🎭', label: T('events'),     to: '/vorstand/events' },
      ]},
      { gruppe: 'Vorstand', items: [
        { icon: '🎯', label: T('vorstand_ziele'),      to: '/vorstand/ziele' },
        { icon: '📝', label: T('vorstand_protokolle'), to: '/vorstand/protokolle' },
        { icon: '📦', label: 'Inventar',               to: '/vorstand/inventar' },
        { icon: '❓', label: T('faq_title'),            to: '/vorstand/faq' },
      ]},
    ]
  }
  const flat = {
    lehrer: [
      { icon: '📊', label: T('dashboard'),    to: '/lehrer' },
      { icon: '🎵', label: T('my_classes'),   to: '/lehrer/kurse' },
      { icon: '📅', label: 'Stundenplan',     to: '/lehrer/anwesenheit' },
      { icon: '👥', label: T('my_students'),  to: '/lehrer/schueler' },
      { icon: '🎼', label: T('repertoire'),   to: '/lehrer/repertoire' },
      { icon: '🎭', label: T('events'),       to: '/lehrer/events' },
      { icon: '💬', label: T('messages'),     to: '/lehrer/nachrichten', nachrichten: true },
    ],
    schueler: [
      { icon: '📊', label: T('dashboard'),   to: '/schueler' },
      { icon: '📅', label: 'Stundenplan',    to: '/schueler/stundenplan' },
      { icon: '🎵', label: 'Meine Kurse',    to: '/schueler/kurse' },
      { icon: '🎼', label: T('repertoire'),  to: '/schueler/repertoire' },
      { icon: '🎭', label: T('events'),      to: '/schueler/events' },
      { icon: '💬', label: T('messages'),    to: '/schueler/nachrichten', nachrichten: true },
      { icon: '❓', label: T('faq_title'),   to: '/schueler/faq' },
    ],
    eltern: [
      { icon: '📊', label: T('dashboard'),  to: '/eltern' },
      { icon: '📅', label: T('schedule'),   to: '/eltern/stundenplan' },
      { icon: '📁', label: T('files'),      to: '/eltern/dateien' },
      { icon: '🎭', label: T('events'),     to: '/eltern/events' },
      { icon: '💬', label: T('messages'),   to: '/eltern/nachrichten', nachrichten: true },
    ],
  }
  return flat[rolle] ?? []
}

function flattenNav(config) {
  return config.flatMap(entry => entry.gruppe ? entry.items : [entry])
}

// Session beitreten Modal (für Schüler)
function JoinSessionModal({ onClose }) {
  const [code, setCode] = useState('')
  const [fehler, setFehler] = useState('')
  const navigate = useNavigate()

  function beitreten() {
    const trimmed = code.trim().toUpperCase()
    if (trimmed.length < 4) { setFehler('Bitte gültigen Code eingeben.'); return }
    navigate(`/session/${trimmed}`)
    onClose()
  }

  return (
    <div style={{ position:'fixed', inset:0, zIndex:300, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:360, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>🎬 Session beitreten</h3>
          <button onClick={onClose} aria-label="Schließen" style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:10, margin:-10, minWidth:44, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
        </div>
        <p style={{ margin:'0 0 16px', fontSize:13, color:'var(--text-3)' }}>Gib den 6-stelligen Code ein, den dir dein Lehrer gegeben hat.</p>
        <input
          value={code}
          onChange={e => { setCode(e.target.value.toUpperCase()); setFehler('') }}
          onKeyDown={e => e.key === 'Enter' && beitreten()}
          placeholder="ABC123"
          maxLength={6}
          autoFocus
          style={{ width:'100%', boxSizing:'border-box', padding:'14px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:28, fontFamily:'monospace', fontWeight:900, letterSpacing:'0.25em', textAlign:'center', outline:'none', background:'var(--bg)', color:'var(--text)', marginBottom:fehler ? 8 : 16 }}
        />
        {fehler && <div style={{ fontSize:12, color:'var(--danger)', marginBottom:12, fontWeight:600 }}>{fehler}</div>}
        <button onClick={beitreten}
          style={{ width:'100%', padding:'12px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:15, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          Beitreten →
        </button>
      </div>
    </div>
  )
}

// Settings Panel
function SettingsPanel({ onClose }) {
  const { theme, darkMode, lang, changeTheme, toggleDark, setLang, großeSchrift, toggleGrosseSchrift, T } = useApp()
  const isMobile = window.innerWidth < 769
  const [show, setShow] = useState(false)
  useEffect(() => { requestAnimationFrame(() => setShow(true)) }, [])

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'flex-end',
      justifyContent: isMobile ? 'center' : 'flex-end',
      background: 'rgba(0,0,0,0.35)',
    }} onClick={onClose} role="dialog" aria-modal="true" aria-label={T('settings')}>
      <div style={{
        background: 'var(--surface)',
        borderRadius: isMobile ? 'var(--radius-lg) var(--radius-lg) 0 0' : 'var(--radius-lg)',
        padding: 24,
        paddingBottom: isMobile ? 'max(24px, env(safe-area-inset-bottom, 0px))' : 24,
        margin: isMobile ? 0 : 16,
        width: isMobile ? '100%' : 300,
        boxShadow: 'var(--shadow-lg)',
        border: isMobile ? 'none' : '1px solid var(--border)',
        transform: show ? 'translateY(0)' : 'translateY(100%)',
        transition: 'transform 0.28s cubic-bezier(0.32, 0.72, 0, 1)',
      }} onClick={e => e.stopPropagation()}>
        {isMobile && <div style={{ width: 36, height: 4, borderRadius: 2, background: 'var(--border)', margin: '0 auto 20px' }} />}

        {/* Sprache */}
        <div style={{ marginBottom: 20 }}>
          <div style={s.settLabel}>{T('settings')} – Sprache</div>
          <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
            {['de','en','tr'].map(l => (
              <button key={l} onClick={() => setLang(l)}
                style={{ ...s.settBtn, ...(lang===l ? s.settBtnAktiv : {}) }}>
                {l === 'de' ? '🇩🇪 DE' : l === 'en' ? '🇬🇧 EN' : '🇹🇷 TR'}
              </button>
            ))}
          </div>
        </div>

        {/* Dark Mode */}
        <div style={{ marginBottom: 20 }}>
          <div style={s.settLabel}>{darkMode ? T('dark_mode') : T('light_mode')}</div>
          <button onClick={toggleDark} style={{ ...s.settBtn, marginTop: 8, width: '100%' }}>
            {darkMode ? '☀️ Hellmodus' : '🌙 Dunkelmodus'}
          </button>
        </div>

        {/* Themes */}
        <div style={{ marginBottom: 20 }}>
          <div style={s.settLabel}>{T('theme')}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 8 }}>
            {THEME_KEYS.map(key => (
              <button key={key} onClick={() => changeTheme(key)}
                style={{
                  ...s.settBtn,
                  ...(theme === key ? s.settBtnAktiv : {}),
                  display: 'flex', alignItems: 'center', gap: 6,
                }}>
                {THEMES[key].icon} {THEMES[key].name.de}
              </button>
            ))}
          </div>
        </div>

        {/* Barrierefreiheit */}
        <div>
          <div style={s.settLabel}>{T('barrierefreiheit')}</div>
          <button
            onClick={toggleGrosseSchrift}
            aria-pressed={großeSchrift}
            style={{ ...s.settBtn, marginTop: 8, width: '100%', ...(großeSchrift ? s.settBtnAktiv : {}) }}>
            {großeSchrift ? `🔡 ${T('normale_schrift')}` : `🔠 ${T('grosse_schrift')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  settLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  settBtn: { padding: '12px 14px', minHeight: 44, borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  settBtnAktiv: { background: 'var(--primary)', color: 'var(--primary-fg)', borderColor: 'var(--primary)' },
}

function zeitAgo(iso) {
  const diff = Date.now() - new Date(iso).getTime()
  if (diff < 60000)    return 'Gerade eben'
  if (diff < 3600000)  return `${Math.floor(diff / 60000)} Min.`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} Std.`
  return new Date(iso).toLocaleDateString('de-DE', { day: '2-digit', month: 'short' })
}

function NavGroup({ gruppe, items, setSidebarOffen, ungelesen = 0, pillMode = false }) {
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

function NavItem({ item, mobile = false, setSidebarOffen, ungelesen = 0, pillMode = false }) {
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
        <span style={{ position:'relative', display:'inline-flex', lineHeight:1 }}>
          <span style={{ fontSize: mobile ? 20 : 16 }}>{item.icon}</span>
          {item.nachrichten && ungelesen > 0 && (
            <span style={{ position:'absolute', top:-4, right:-7, minWidth:14, height:14, borderRadius:7, background:'var(--danger)', color:'#fff', fontSize:9, fontWeight:800, display:'flex', alignItems:'center', justifyContent:'center', lineHeight:1, padding:'0 3px', zIndex:1 }}>
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

function DesktopNav({ navConfig, setSidebarOffen, ungelesen }) {
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
        : <NavItem key={entry.to} item={entry} setSidebarOffen={setSidebarOffen} ungelesen={ungelesen} pillMode />
      )}
    </nav>
  )
}

export default function AppLayout() {
  const { profil, rolle, schule, abmelden, T, toasts, removeToast, confirmState, resolveConfirm, schulenListe, darkMode, großeSchrift } = useApp()
  const navigate = useNavigate()
  const location = useLocation()
  const swipeStartX = useRef(null)
  const histIdxRef = useRef(null)
  const currentHistIdx = window.history.state?.idx ?? 0
  const pageDir = histIdxRef.current !== null && currentHistIdx < histIdxRef.current ? 'back' : 'forward'
  histIdxRef.current = currentHistIdx
  const [sidebarOffen, setSidebarOffen]         = useState(false)
  const [joinSessionOffen, setJoinSessionOffen] = useState(false)
  const [changelogOffen, setChangelogOffen] = useState(false)
  const [ungelesen, setUngelesen]           = useState([])
  const touchStartX                         = useRef(null)
  const [installPrompt, setInstallPrompt]   = useState(null)
  const [keyboardOffen, setKeyboardOffen]   = useState(false)
  const navConfig = getNavConfig(rolle, T)
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
    // ── Ripple effect on all buttons ──────────────────────────
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

    // ── Modal entrance animation (MutationObserver) ───────────
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

  async function handleAbmelden() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

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

  return (
    <div style={{ display: 'flex', minHeight: '100dvh', background: 'var(--bg)', fontFamily: "'Outfit', 'DM Sans', sans-serif" }}>

      {/* Desktop Sidebar */}
      <aside style={{
        width: 240, minWidth: 240, background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '20px 12px',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }} className="desktop-sidebar">

        {/* Logo */}
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

        {/* Nav */}
        <DesktopNav navConfig={navConfig} setSidebarOffen={setSidebarOffen} ungelesen={ungelesen.length} />

        {/* Session beitreten (Schüler + Vorstand) */}
        {(rolle === 'schueler' || rolle === 'vorstand') && (
          <button onClick={() => setJoinSessionOffen(true)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginBottom:12, width:'100%' }}>
            🎬 Session beitreten
          </button>
        )}

        {/* Schul-Wechsler */}
        {schulenListe.length > 1 && rolle !== 'superadmin' && (
          <NavLink to="/schulen"
            style={({ isActive }) => ({ ...btnStyle, textDecoration: 'none', color: isActive ? 'var(--primary)' : 'var(--text-3)', marginBottom: 4 })}>
            🏫 {schule?.name ?? T('school_switcher')} ▾
          </NavLink>
        )}

        {/* Bottom */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink to="/profil" style={({ isActive }) => ({ ...btnStyle, color: isActive ? 'var(--primary)' : 'var(--text-3)', textDecoration:'none' })}>
            👤 {T('profile_title')}
          </NavLink>
          <NavLink to="/einstellungen" style={({ isActive }) => ({ ...btnStyle, color: isActive ? 'var(--primary)' : 'var(--text-3)', textDecoration:'none' })}>
            ⚙️ {T('settings')}
          </NavLink>
          <button onClick={() => window.location.reload()} style={{ ...btnStyle, fontSize: 14, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '10px 12px', borderRadius: 'var(--radius)', marginTop: 2, marginBottom: 2 }}>↻ Aktualisieren</button>
          <button onClick={handleAbmelden} style={btnStyle}>👋 {T('logout')}</button>
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
          <aside style={{
            width: 'min(260px, calc(100vw - 48px))',
            background: 'var(--surface)', borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column',
            position: 'relative', zIndex: 1,
            height: '100%', overflow: 'hidden',
          }}>
            {/* Header */}
            <div style={{ padding: 'calc(20px + env(safe-area-inset-top, 0px)) 12px 16px', borderBottom: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexShrink: 0 }}>
              {schule?.logo_url
                ? <img src={schule.logo_url} alt={schule.name ?? 'Logo'} style={{ maxHeight: 36, maxWidth: 140, objectFit: 'contain' }} />
                : <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>♩ Staccato</div>
              }
              <button onClick={() => setSidebarOffen(false)} aria-label="Menü schließen" style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)', padding: 10, margin: -10, minWidth: 44, minHeight: 44, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
            </div>
            {/* Scrollable Nav */}
            <nav style={{ flex: 1, overflowY: 'auto', padding: '8px 12px' }}>
              {navConfig.map(entry => entry.gruppe
                ? <NavGroup key={entry.gruppe} {...entry} setSidebarOffen={setSidebarOffen} ungelesen={ungelesen.length} />
                : <NavItem  key={entry.to}    item={entry} setSidebarOffen={setSidebarOffen} ungelesen={ungelesen.length} />
              )}
            </nav>
            {/* Sticky Footer */}
            <div style={{ flexShrink: 0, padding: '0 12px 12px' }}>
              {(rolle === 'schueler' || rolle === 'vorstand') && (
                <button onClick={() => { setJoinSessionOffen(true); setSidebarOffen(false) }}
                  style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginBottom:8, width:'100%' }}>
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
                <NavLink to="/profil" onClick={() => setSidebarOffen(false)} style={({ isActive }) => ({ ...btnStyle, textDecoration:'none', color: isActive ? 'var(--primary)' : 'var(--text-3)' })}>
                  👤 {T('profile_title')}
                </NavLink>
                <NavLink to="/einstellungen" onClick={() => setSidebarOffen(false)} style={({ isActive }) => ({ ...btnStyle, textDecoration:'none', color: isActive ? 'var(--primary)' : 'var(--text-3)' })}>
                  ⚙️ {T('settings')}
                </NavLink>
                <button onClick={handleAbmelden} style={btnStyle}>👋 {T('logout')}</button>
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
            <button onClick={() => window.location.reload()} style={{ border: 'none', fontSize: 16, fontWeight: 700, cursor: 'pointer', color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 12%, transparent)', padding: '7px 12px', borderRadius: 'var(--radius)', fontFamily: 'inherit', lineHeight: 1, minHeight: 44 }}>↻ Reload</button>
          </div>
        </header>

        {/* Offline-Banner */}
        <OfflineBanner />

        {/* Content */}
        <main
          style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }}
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
        <nav style={{
          display: 'none', alignItems: 'center',
          padding: '8px 12px',
          paddingBottom: 'calc(8px + env(safe-area-inset-bottom, 0px))',
          background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          position: 'sticky', bottom: 0,
          zIndex: 10,
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

      {/* Changelog Modal */}
      {changelogOffen && (
        <div style={{ position:'fixed', inset:0, zIndex:9999, background:'rgba(0,0,0,0.45)', backdropFilter:'blur(3px)', display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => e.target === e.currentTarget && setChangelogOffen(false)}>
          <div style={{ background:'var(--surface)', borderRadius:20, width:'100%', maxWidth:480, maxHeight:'80vh', display:'flex', flexDirection:'column', boxShadow:'0 24px 60px rgba(0,0,0,0.25)', overflow:'hidden' }}>
            <div style={{ padding:'24px 24px 16px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'space-between', flexShrink:0 }}>
              <div>
                <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>✨ Versionshistorie</div>
                <div style={{ fontSize:12, color:'var(--text-3)', marginTop:3 }}>Staccato v{version}</div>
              </div>
              <button onClick={() => setChangelogOffen(false)} aria-label="Schließen" style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--text-3)', lineHeight:1, padding:10, margin:-10, minWidth:44, minHeight:44, display:'flex', alignItems:'center', justifyContent:'center' }}>✕</button>
            </div>
            <div style={{ overflowY:'auto', padding:'16px 24px 24px', display:'flex', flexDirection:'column', gap:24 }}>
              {CHANGELOG.map(entry => (
                <div key={entry.version}>
                  <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:12 }}>
                    <div style={{ fontSize:13, fontWeight:800, color:'var(--primary)', background:'color-mix(in srgb, var(--primary) 12%, transparent)', padding:'3px 10px', borderRadius:99 }}>v{entry.version}</div>
                    <div style={{ fontSize:12, color:'var(--text-3)' }}>{entry.date}</div>
                  </div>
                  <ul style={{ listStyle:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:8 }}>
                    {entry.features.map((f, i) => (
                      <li key={i} style={{ display:'flex', alignItems:'flex-start', gap:10, padding:'8px 12px', borderRadius:10, background:'var(--bg-2)' }}>
                        <span style={{ fontSize:16, lineHeight:1.4, flexShrink:0 }}>{f.icon}</span>
                        <span style={{ fontSize:13, color:'var(--text-2)', lineHeight:1.5 }}>{f.de}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Responsive CSS */}
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&display=swap');

        * { box-sizing: border-box; margin: 0; padding: 0; }
        html { height: -webkit-fill-available; }
        body {
          background: var(--bg);
          color: var(--text);
          min-height: 100dvh;
          overscroll-behavior: none;
          -webkit-tap-highlight-color: transparent;
        }

        /* Inputs & Selects */
        input, textarea, select {
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          touch-action: manipulation;
        }
        input:focus, textarea:focus, select:focus {
          outline: none !important;
          border-color: var(--primary) !important;
          box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary) 20%, transparent) !important;
        }

        /* Buttons */
        button {
          transition: all 0.15s ease;
          touch-action: manipulation;
          -webkit-tap-highlight-color: transparent;
        }
        button:active:not(:disabled) { transform: scale(0.96) !important; }

        /* Focus-Ring für Tastatur-Navigation */
        button:focus-visible,
        a:focus-visible,
        input:focus-visible,
        select:focus-visible,
        textarea:focus-visible {
          outline: 2px solid var(--primary) !important;
          outline-offset: 2px !important;
          box-shadow: none !important;
        }

        /* Scrollbar (nur Desktop) */
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

        /* Modal-Overlays: Bottom-Sheet auf Mobile */
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

          /* Active indicator pill on bottom nav items */
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
