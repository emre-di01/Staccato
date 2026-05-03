import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { startseiteNach } from '../ProtectedRoute'
import { THEMES, THEME_KEYS } from '../../themes/themes'
import { supabase } from '../../lib/supabase'
import { version } from '../../../package.json'
import { CHANGELOG } from '../../changelog'

// Nav-Items je Rolle
function getNavItems(rolle, T) {
  const items = {
    admin: [
      { icon: '📊', label: T('dashboard'),             to: '/admin' },
      { icon: '👥', label: T('members'),               to: '/admin/mitglieder' },
      { icon: '🎵', label: 'Kurse',                    to: '/admin/kurse' },
      { icon: '📅', label: T('schedule'),              to: '/admin/stundenplan' },
      { icon: '🏫', label: T('rooms'),                 to: '/admin/raeume' },
      { icon: '🎼', label: T('repertoire'),            to: '/admin/repertoire' },
      { icon: '🎭', label: T('events'),                to: '/admin/events' },
      { icon: '💰', label: T('billing'),               to: '/admin/abrechnung' },
      { icon: '📋', label: T('prospects'),             to: '/admin/interessenten' },
      { icon: '💬', label: T('messages'),              to: '/admin/nachrichten' },
      { icon: '📂', label: 'Kurs-Ansicht',            to: '/lehrer/kurse' },
      { icon: '🎯', label: T('vorstand_ziele'),        to: '/vorstand/ziele' },
      { icon: '📝', label: T('vorstand_protokolle'),   to: '/vorstand/protokolle' },
    ],
    superadmin: [
      { icon: '📊', label: T('dashboard'),             to: '/admin' },
      { icon: '👥', label: T('members'),               to: '/admin/mitglieder' },
      { icon: '🎵', label: 'Kurse',                    to: '/admin/kurse' },
      { icon: '📅', label: T('schedule'),              to: '/admin/stundenplan' },
      { icon: '🏫', label: T('rooms'),                 to: '/admin/raeume' },
      { icon: '🎼', label: T('repertoire'),            to: '/admin/repertoire' },
      { icon: '🎭', label: T('events'),                to: '/admin/events' },
      { icon: '💰', label: T('billing'),               to: '/admin/abrechnung' },
      { icon: '📋', label: T('prospects'),             to: '/admin/interessenten' },
      { icon: '💬', label: T('messages'),              to: '/admin/nachrichten' },
      { icon: '📂', label: 'Kurs-Ansicht',            to: '/lehrer/kurse' },
      { icon: '🎯', label: T('vorstand_ziele'),        to: '/vorstand/ziele' },
      { icon: '📝', label: T('vorstand_protokolle'),   to: '/vorstand/protokolle' },
    ],
    lehrer: [
      { icon: '📊', label: T('dashboard'),     to: '/lehrer' },
      { icon: '🎵', label: T('my_classes'),    to: '/lehrer/kurse' },
      { icon: '📅', label: 'Stundenplan',      to: '/lehrer/anwesenheit' },
      { icon: '👥', label: T('my_students'),   to: '/lehrer/schueler' },
      { icon: '🎼', label: T('repertoire'),    to: '/lehrer/repertoire' },
      { icon: '🎭', label: T('events'),        to: '/lehrer/events' },
      { icon: '💬', label: T('messages'),      to: '/lehrer/nachrichten' },
    ],
    schueler: [
      { icon: '📊', label: T('dashboard'),   to: '/schueler' },
      { icon: '📅', label: 'Stundenplan',    to: '/schueler/stundenplan' },
      { icon: '🎵', label: 'Meine Kurse',    to: '/schueler/kurse' },
      { icon: '🎼', label: T('repertoire'),  to: '/schueler/repertoire' },
      { icon: '🎭', label: T('events'),      to: '/schueler/events' },
      { icon: '💬', label: T('messages'),    to: '/schueler/nachrichten' },
    ],
    eltern: [
      { icon: '📊', label: T('dashboard'),   to: '/eltern' },
      { icon: '📅', label: T('schedule'),    to: '/eltern/stundenplan' },
      { icon: '📁', label: T('files'),       to: '/eltern/dateien' },
      { icon: '🎭', label: T('events'),      to: '/eltern/events' },
      { icon: '💬', label: T('messages'),    to: '/eltern/nachrichten' },
    ],
    vorstand: [
      { icon: '📊', label: T('dashboard'),           to: '/vorstand' },
      { icon: '🎯', label: T('vorstand_ziele'),      to: '/vorstand/ziele' },
      { icon: '📝', label: T('vorstand_protokolle'), to: '/vorstand/protokolle' },
      { icon: '📅', label: 'Stundenplan',            to: '/vorstand/stundenplan' },
      { icon: '🎵', label: 'Meine Kurse',            to: '/vorstand/kurse' },
      { icon: '🎼', label: T('repertoire'),          to: '/vorstand/repertoire' },
      { icon: '🎭', label: T('events'),              to: '/vorstand/events' },
    ],
  }
  return items[rolle] ?? []
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
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)' }}>✕</button>
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
  const { theme, darkMode, lang, changeTheme, toggleDark, setLang, T } = useApp()

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 200,
      display: 'flex', alignItems: 'flex-end', justifyContent: 'flex-end',
    }} onClick={onClose}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        padding: 24, margin: 16, width: 300,
        boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)',
      }} onClick={e => e.stopPropagation()}>

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
        <div>
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
      </div>
    </div>
  )
}

const s = {
  settLabel: { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em' },
  settBtn: { padding: '8px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 13, cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s' },
  settBtnAktiv: { background: 'var(--primary)', color: 'var(--primary-fg)', borderColor: 'var(--primary)' },
}

export default function AppLayout() {
  const { profil, rolle, abmelden, T } = useApp()
  const navigate = useNavigate()
  const [sidebarOffen, setSidebarOffen] = useState(false)
  const [settingsOffen, setSettingsOffen] = useState(false)
  const [joinSessionOffen, setJoinSessionOffen] = useState(false)
  const [changelogOffen, setChangelogOffen] = useState(false)
  const navItems = getNavItems(rolle, T)

  async function handleAbmelden() {
    await supabase.auth.signOut()
    window.location.href = '/login'
  }

  const NavItem = ({ item, mobile = false }) => (
    <NavLink
      to={item.to}
      end={item.to.split('/').length === 2}
      onClick={() => setSidebarOffen(false)}
      style={({ isActive }) => mobile ? {
        display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
        padding: '8px 4px', borderRadius: 10, textDecoration: 'none', flex: 1,
        background: isActive ? 'var(--bg-2)' : 'transparent',
        color: isActive ? 'var(--primary)' : 'var(--text-3)',
        fontSize: 10, fontWeight: isActive ? 700 : 500,
        transition: 'all 0.15s',
      } : {
        display: 'flex', alignItems: 'center', gap: 12,
        padding: '10px 16px', borderRadius: 'var(--radius)',
        textDecoration: 'none', fontSize: 14, fontWeight: 500,
        color: isActive ? 'var(--primary-fg)' : 'var(--text-2)',
        background: isActive ? 'var(--primary)' : 'transparent',
        transition: 'all 0.15s',
        marginBottom: 2,
      }}
    >
      <span style={{ fontSize: mobile ? 20 : 16 }}>{item.icon}</span>
      <span>{item.label}</span>
    </NavLink>
  )

  return (
    <div style={{ display: 'flex', minHeight: '100vh', background: 'var(--bg)', fontFamily: "'Outfit', 'DM Sans', sans-serif" }}>

      {/* Desktop Sidebar */}
      <aside style={{
        width: 240, minWidth: 240, background: 'var(--surface)',
        borderRight: '1px solid var(--border)',
        display: 'flex', flexDirection: 'column', padding: '20px 12px',
        position: 'sticky', top: 0, height: '100vh', overflowY: 'auto',
      }} className="desktop-sidebar">

        {/* Logo */}
        <div style={{ padding: '0 8px 20px', borderBottom: '1px solid var(--border)', marginBottom: 16 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: 'var(--primary)', letterSpacing: '-0.5px' }}>
            ♩ Staccato
          </div>
          {profil && (
            <div style={{ marginTop: 8 }}>
              <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text)' }}>{profil.voller_name}</div>
              <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: 2 }}>{T(rolle)}</div>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav style={{ flex: 1 }}>
          {navItems.map(item => <NavItem key={item.to} item={item} />)}
        </nav>

        {/* Session beitreten (Schüler + Vorstand) */}
        {(rolle === 'schueler' || rolle === 'vorstand') && (
          <button onClick={() => setJoinSessionOffen(true)}
            style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginBottom:12, width:'100%' }}>
            🎬 Session beitreten
          </button>
        )}

        {/* Bottom */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink to="/profil" style={({ isActive }) => ({ ...btnStyle, color: isActive ? 'var(--primary)' : 'var(--text-3)', textDecoration:'none' })}>
            👤 Mein Profil
          </NavLink>
          <button onClick={() => setSettingsOffen(true)} style={btnStyle}>⚙️ {T('settings')}</button>
          <button onClick={() => window.location.reload()} style={{ ...btnStyle, fontSize: 14, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 10%, transparent)', padding: '10px 12px', borderRadius: 'var(--radius)', marginTop: 2, marginBottom: 2 }}>↻ Aktualisieren</button>
          <button onClick={handleAbmelden} style={btnStyle}>👋 {T('logout')}</button>
          <button onClick={() => setChangelogOffen(true)} style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', marginTop: 8, opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%', padding: '2px 0' }}>
            v{version} ✨
          </button>
        </div>
      </aside>

      {/* Mobile Sidebar Overlay */}
      {sidebarOffen && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 100, display: 'flex' }}>
          <div style={{ position: 'absolute', inset: 0, background: 'rgba(0,0,0,0.5)' }} onClick={() => setSidebarOffen(false)} />
          <aside style={{
            width: 260, background: 'var(--surface)', borderRight: '1px solid var(--border)',
            display: 'flex', flexDirection: 'column', padding: '20px 12px',
            position: 'relative', zIndex: 1, overflowY: 'auto',
          }}>
            <div style={{ padding: '0 8px 20px', borderBottom: '1px solid var(--border)', marginBottom: 16, display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div style={{ fontSize: 20, fontWeight: 800, color: 'var(--primary)' }}>♩ Staccato</div>
              <button onClick={() => setSidebarOffen(false)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-3)' }}>✕</button>
            </div>
            <nav style={{ flex: 1 }}>
              {navItems.map(item => <NavItem key={item.to} item={item} />)}
            </nav>
            {(rolle === 'schueler' || rolle === 'vorstand') && (
              <button onClick={() => { setJoinSessionOffen(true); setSidebarOffen(false) }}
                style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', marginBottom:12, width:'100%' }}>
                🎬 Session beitreten
              </button>
            )}
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <NavLink to={`/${rolle === 'superadmin' ? 'admin' : rolle}/profil`} onClick={() => setSidebarOffen(false)} style={{ ...btnStyle, textDecoration:'none', color:'var(--text-3)' }}>
                👤 Mein Profil
              </NavLink>
              <button onClick={() => { setSettingsOffen(true); setSidebarOffen(false) }} style={btnStyle}>⚙️ {T('settings')}</button>
              <button onClick={handleAbmelden} style={btnStyle}>👋 {T('logout')}</button>
              <button onClick={() => { setChangelogOffen(true); setSidebarOffen(false) }} style={{ fontSize: 10, color: 'var(--text-3)', textAlign: 'center', marginTop: 8, opacity: 0.5, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', width: '100%', padding: '2px 0' }}>
                v{version} ✨
              </button>
            </div>
          </aside>
        </div>
      )}

      {/* Main */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
        {/* Mobile Header */}
        <header style={{
          display: 'none', alignItems: 'center', justifyContent: 'space-between',
          padding: '12px 16px', background: 'var(--surface)',
          borderBottom: '1px solid var(--border)', position: 'sticky', top: 0, zIndex: 50,
        }} className="mobile-header">
          <button onClick={() => setSidebarOffen(true)} style={{ background: 'none', border: 'none', fontSize: 22, cursor: 'pointer', color: 'var(--text)' }}>☰</button>
          <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>♩ Staccato</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button onClick={() => setSettingsOffen(true)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-2)' }}>⚙️</button>
            <button onClick={() => window.location.reload()} style={{ background: 'none', border: 'none', fontSize: 24, cursor: 'pointer', color: 'var(--primary)', padding: '0 4px', lineHeight: 1 }}>↻</button>
          </div>
        </header>

        {/* Content */}
        <main style={{ flex: 1, padding: '32px 40px', overflowY: 'auto' }} className="main-content">
          <Outlet />
        </main>

        {/* Mobile Bottom Nav */}
        <nav style={{
          display: 'none', alignItems: 'center',
          padding: '8px 12px', background: 'var(--surface)',
          borderTop: '1px solid var(--border)',
          position: 'sticky', bottom: 0,
        }} className="mobile-bottom-nav">
          {navItems.slice(0, 5).map(item => <NavItem key={item.to} item={item} mobile />)}
        </nav>
      </div>

      {settingsOffen && <SettingsPanel onClose={() => setSettingsOffen(false)} />}
      {joinSessionOffen && <JoinSessionModal onClose={() => setJoinSessionOffen(false)} />}

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
              <button onClick={() => setChangelogOffen(false)} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--text-3)', lineHeight:1 }}>✕</button>
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
        body { background: var(--bg); color: var(--text); }
        
        @media (max-width: 768px) {
          .desktop-sidebar { display: none !important; }
          .mobile-header { display: flex !important; }
          .mobile-bottom-nav { display: flex !important; }
          .main-content { padding: 16px !important; padding-bottom: 80px !important; }
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
