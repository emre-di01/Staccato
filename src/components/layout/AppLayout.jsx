import { useState } from 'react'
import { NavLink, Outlet, useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { startseiteNach } from '../ProtectedRoute'
import { THEMES, THEME_KEYS } from '../../themes/themes'
import { supabase } from '../../lib/supabase'

// Nav-Items je Rolle
function getNavItems(rolle, T) {
  const items = {
    admin: [
      { icon: '📊', label: T('dashboard'),   to: '/admin' },
      { icon: '👥', label: T('members'),     to: '/admin/mitglieder' },
      { icon: '🎵', label: 'Kurse',          to: '/admin/kurse' },
      { icon: '📅', label: T('schedule'),    to: '/admin/stundenplan' },
      { icon: '🏫', label: T('rooms'),       to: '/admin/raeume' },
      { icon: '🎼', label: T('repertoire'),  to: '/admin/repertoire' },
      { icon: '🎭', label: T('events'),      to: '/admin/events' },
      { icon: '💰', label: T('billing'),     to: '/admin/abrechnung' },
      { icon: '📋', label: T('prospects'),   to: '/admin/interessenten' },
      { icon: '💬', label: T('messages'),    to: '/admin/nachrichten' },
      { icon: '📂', label: 'Kurs-Ansicht',  to: '/lehrer/kurse' },
    ],
    superadmin: [
      { icon: '📊', label: T('dashboard'),   to: '/admin' },
      { icon: '👥', label: T('members'),     to: '/admin/mitglieder' },
      { icon: '🎵', label: 'Kurse',          to: '/admin/kurse' },
      { icon: '📅', label: T('schedule'),    to: '/admin/stundenplan' },
      { icon: '🏫', label: T('rooms'),       to: '/admin/raeume' },
      { icon: '🎼', label: T('repertoire'),  to: '/admin/repertoire' },
      { icon: '🎭', label: T('events'),      to: '/admin/events' },
      { icon: '💰', label: T('billing'),     to: '/admin/abrechnung' },
      { icon: '💬', label: T('messages'),    to: '/admin/nachrichten' },
      { icon: '📂', label: 'Kurs-Ansicht',  to: '/lehrer/kurse' },
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
      { icon: '🎵', label: 'Meine Kurse',    to: '/schueler/stundenplan' },
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
  }
  return items[rolle] ?? []
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

        {/* Bottom */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <NavLink to="/profil" style={({ isActive }) => ({ ...btnStyle, color: isActive ? 'var(--primary)' : 'var(--text-3)', textDecoration:'none' })}>
            👤 Mein Profil
          </NavLink>
          <button onClick={() => setSettingsOffen(true)} style={btnStyle}>⚙️ {T('settings')}</button>
          <button onClick={handleAbmelden} style={btnStyle}>👋 {T('logout')}</button>
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
            <div style={{ borderTop: '1px solid var(--border)', paddingTop: 12, display: 'flex', flexDirection: 'column', gap: 4 }}>
              <NavLink to={`/${rolle === 'superadmin' ? 'admin' : rolle}/profil`} onClick={() => setSidebarOffen(false)} style={{ ...btnStyle, textDecoration:'none', color:'var(--text-3)' }}>
                👤 Mein Profil
              </NavLink>
              <button onClick={() => { setSettingsOffen(true); setSidebarOffen(false) }} style={btnStyle}>⚙️ {T('settings')}</button>
              <button onClick={handleAbmelden} style={btnStyle}>👋 {T('logout')}</button>
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
          <button onClick={() => setSettingsOffen(true)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: 'var(--text-2)' }}>⚙️</button>
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
