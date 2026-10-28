// ─── Staccato 2026 · Design-System ────────────────────────────
// Bausteine der neuen Oberfläche. Farben ausschließlich über CSS-Variablen
// aus NEU_THEME (themes.js), damit hell/dunkel automatisch passt.
// Größen bewusst großzügig: Fließtext 17px, Klickflächen ≥ 44px.

import { useEffect, useId } from 'react'
import { createPortal } from 'react-dom'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Music, Search, X } from 'lucide-react'
import { useApp } from '../context/AppContext'

// ─── Seite mit großem Titel ───────────────────────────────────
// `zurueck`: { to, label } → Link über dem Titel (Unterseiten); { onClick, label } → Knopf
const zurueckStil = { display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 44, margin: '8px 0 -12px 10px', padding: '0 10px 0 0', fontSize: 17, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none' }
export function Seite({ titel, ueber, rechts, zurueck, children }) {
  return (
    <div style={{ maxWidth: 760, margin: '0 auto', paddingBottom: 32 }}>
      {zurueck && (zurueck.onClick ? (
        <button onClick={zurueck.onClick} style={{ ...zurueckStil, background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit' }}>
          <ChevronLeft aria-hidden="true" size={24} />{zurueck.label}
        </button>
      ) : (
        <Link to={zurueck.to} style={zurueckStil}>
          <ChevronLeft aria-hidden="true" size={24} />{zurueck.label}
        </Link>
      ))}
      {(titel || rechts) && (
        <header style={{ padding: '20px 20px 4px', display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            {ueber && <div style={{ fontSize: 14, fontWeight: 600, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-2)' }}>{ueber}</div>}
            {titel && <h1 style={{ margin: ueber ? '4px 0 0' : 0, fontSize: 34, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em', color: 'var(--text)' }}>{titel}</h1>}
          </div>
          {rechts && <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexShrink: 0 }}>{rechts}</div>}
        </header>
      )}
      {children}
    </div>
  )
}

// ─── Abschnitt mit Überschrift ────────────────────────────────
export function Abschnitt({ titel, aktion, children, style }) {
  return (
    <section style={{ marginTop: 32, ...style }}>
      {(titel || aktion) && (
        <div style={{ padding: '0 20px', display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          {titel && <h2 style={{ margin: 0, fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em', color: 'var(--text)' }}>{titel}</h2>}
          {aktion}
        </div>
      )}
      {children}
    </section>
  )
}

export function TextLink({ to, children, onClick }) {
  const style = { fontSize: 17, fontWeight: 600, color: 'var(--primary)', textDecoration: 'none', background: 'none', border: 'none', padding: '10px 0', cursor: 'pointer', fontFamily: 'inherit' }
  return to ? <Link to={to} style={style}>{children}</Link> : <button onClick={onClick} style={style}>{children}</button>
}

// ─── Gruppierte Liste (iOS-Stil) ──────────────────────────────
export function Gruppe({ children, style }) {
  return (
    <div style={{ margin: '0 20px', borderRadius: 18, background: 'var(--n-fill)', overflow: 'hidden', ...style }}>
      {children}
    </div>
  )
}

export function Trenner() {
  return <div style={{ height: 1, background: 'var(--n-sep)', marginLeft: 16 }} />
}

// Listenzeile: Link (to), Knopf (onClick) oder statisch
export function Zeile({ icon: Icon, iconFarbe = 'var(--primary)', bild, titel, untertitel, wert, wertFarbe = 'var(--text-2)', punkt, chevron = true, to, state, onClick, href }) {
  const inhalt = (
    <>
      {bild}
      {Icon && !bild && (
        <span aria-hidden="true" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 20, background: 'var(--bg)', color: iconFarbe, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={20} strokeWidth={1.9} />
        </span>
      )}
      <span style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
        <span style={{ display: 'block', fontSize: 17, fontWeight: 600, color: 'var(--text)', overflowWrap: 'anywhere' }}>{titel}</span>
        {untertitel && <span style={{ display: 'block', fontSize: 15, color: 'var(--text-2)', marginTop: 1 }}>{untertitel}</span>}
      </span>
      {wert != null && <span style={{ fontSize: 16, fontWeight: 600, color: wertFarbe, flexShrink: 0 }}>{wert}</span>}
      {punkt && <span aria-hidden="true" style={{ width: 10, height: 10, borderRadius: 5, background: 'var(--primary)', flexShrink: 0 }} />}
      {chevron && (to || onClick || href) && <ChevronRight aria-hidden="true" size={20} color="var(--n-chev)" style={{ flexShrink: 0 }} />}
    </>
  )
  const style = { display: 'flex', alignItems: 'center', gap: 14, minHeight: 56, padding: '12px 16px', width: '100%', boxSizing: 'border-box', color: 'var(--text)', textDecoration: 'none', background: 'none', border: 'none', fontFamily: 'inherit', cursor: (to || onClick || href) ? 'pointer' : 'default' }
  if (to) return <Link to={to} state={state} style={style}>{inhalt}</Link>
  if (href) return <a href={href} target="_blank" rel="noopener noreferrer" style={style}>{inhalt}</a>
  if (onClick) return <button onClick={onClick} style={style}>{inhalt}</button>
  return <div style={style}>{inhalt}</div>
}

// ─── Knöpfe ───────────────────────────────────────────────────
const KNOPF = {
  primaer:   { background: 'var(--primary)', color: 'var(--primary-fg)', border: 'none' },
  sekundaer: { background: 'var(--n-fill)', color: 'var(--text)', border: 'none' },
  rahmen:    { background: 'transparent', color: 'var(--text)', border: '1.5px solid var(--n-fill-2)' },
  tint:      { background: 'var(--n-tint)', color: 'var(--n-tint-fg)', border: 'none' },
  gefahr:    { background: 'var(--n-fill)', color: 'var(--danger)', border: 'none' },
}
export function Knopf({ variante = 'primaer', icon: Icon, children, voll, klein, style, ...rest }) {
  return (
    <button {...rest} style={{
      ...KNOPF[variante],
      height: klein ? 44 : 52, padding: klein ? '0 16px' : '0 20px', borderRadius: klein ? 22 : 14,
      fontFamily: 'inherit', fontSize: klein ? 16 : 17, fontWeight: 700, cursor: rest.disabled ? 'default' : 'pointer',
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 8,
      width: voll ? '100%' : undefined, opacity: rest.disabled ? 0.6 : 1, whiteSpace: 'nowrap',
      ...style,
    }}>
      {Icon && <Icon aria-hidden="true" size={klein ? 18 : 20} strokeWidth={2.2} />}
      {children}
    </button>
  )
}

// ─── Segment-Umschalter ───────────────────────────────────────
export function Segment({ optionen, wert, onChange, label, style }) {
  return (
    <div role="group" aria-label={label} style={{ padding: 4, borderRadius: 14, background: 'var(--n-fill)', display: 'flex', gap: 4, ...style }}>
      {optionen.map(([id, text]) => {
        const aktiv = wert === id
        return (
          <button key={id} onClick={() => onChange(id)} aria-pressed={aktiv} style={{
            flex: 1, minHeight: 44, borderRadius: 11, border: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: 'pointer', padding: '0 8px',
            background: aktiv ? 'var(--bg)' : 'transparent', color: aktiv ? 'var(--text)' : 'var(--text-2)',
            boxShadow: aktiv ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
          }}>{text}</button>
        )
      })}
    </div>
  )
}

// ─── Filter-Chips ─────────────────────────────────────────────
export function Chips({ optionen, wert, onChange, label }) {
  return (
    <div role="group" aria-label={label} style={{ display: 'flex', gap: 8, overflowX: 'auto', padding: '0 20px', scrollbarWidth: 'none' }}>
      {optionen.map(([id, text]) => {
        const aktiv = wert === id
        return (
          <button key={id} onClick={() => onChange(id)} aria-pressed={aktiv} style={{
            flexShrink: 0, height: 40, padding: '0 16px', borderRadius: 20, border: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: 'pointer',
            background: aktiv ? 'var(--text)' : 'var(--n-fill)', color: aktiv ? 'var(--bg)' : 'var(--text)',
          }}>{text}</button>
        )
      })}
    </div>
  )
}

// ─── Suchfeld ─────────────────────────────────────────────────
export function Suchfeld({ wert, onChange, placeholder, label }) {
  const { T } = useApp()
  return (
    <label style={{ margin: '0 20px', height: 48, padding: '0 14px', borderRadius: 14, background: 'var(--n-fill)', display: 'flex', alignItems: 'center', gap: 10, color: 'var(--text-3)' }}>
      <Search aria-hidden="true" size={20} />
      <span style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0 0 0 0)' }}>{label}</span>
      <input value={wert} onChange={e => onChange(e.target.value)} placeholder={placeholder} type="search"
        style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontFamily: 'inherit', fontSize: 17, color: 'var(--text)', boxShadow: 'none' }} />
      {wert && <button onClick={() => onChange('')} aria-label={T('n_suche_leeren')} style={{ background: 'none', border: 'none', color: 'var(--text-3)', cursor: 'pointer', padding: 8, display: 'flex' }}><X size={18} /></button>}
    </label>
  )
}

// ─── Schalter ─────────────────────────────────────────────────
export function Schalter({ an, onChange, label }) {
  return (
    <button role="switch" aria-checked={an} aria-label={label} onClick={() => onChange(!an)} style={{
      width: 60, height: 36, flexShrink: 0, borderRadius: 18, border: 'none', padding: 3, cursor: 'pointer',
      background: an ? 'var(--primary)' : 'var(--n-fill-2)', display: 'flex', justifyContent: an ? 'flex-end' : 'flex-start',
    }}>
      <span style={{ width: 30, height: 30, borderRadius: 15, background: '#FFFFFF', boxShadow: '0 1px 3px rgba(0,0,0,0.25)' }} />
    </button>
  )
}

// ─── Formularfelder ───────────────────────────────────────────
export const eingabeStil = {
  width: '100%', boxSizing: 'border-box', minHeight: 52, padding: '12px 14px', borderRadius: 14,
  border: '1.5px solid var(--n-fill-2)', background: 'var(--bg)', color: 'var(--text)',
  fontFamily: 'inherit', fontSize: 17, outline: 'none',
}

export function Feld({ label, hinweis, children }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)' }}>{label}</span>
      {children}
      {hinweis && <span style={{ fontSize: 15, color: 'var(--text-2)' }}>{hinweis}</span>}
    </label>
  )
}

// Zeile mit Schalter (Einstellungen)
export function SchalterZeile({ titel, untertitel, an, onChange, disabled }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minHeight: 56, padding: '12px 16px', opacity: disabled ? 0.6 : 1 }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 17, fontWeight: 600 }}>{titel}</div>
        {untertitel && <div style={{ fontSize: 15, color: 'var(--text-2)', marginTop: 1 }}>{untertitel}</div>}
      </div>
      <Schalter an={an} label={titel} onChange={disabled ? () => {} : onChange} />
    </div>
  )
}

// ─── Lied-Kachel ──────────────────────────────────────────────
// Stücke haben keine Cover: jede bekommt eine ruhige, aus der ID abgeleitete Farbe
const LIED_FARBEN = ['#2F4858', '#7A3E48', '#3D5A40', '#3B3F8F', '#8A5A00', '#5B3A6E', '#1F5F6B', '#6B4423']
export function liedFarbe(id = '') {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0
  return LIED_FARBEN[h % LIED_FARBEN.length]
}

export function LiedCover({ id, groesse = 56, radius }) {
  return (
    <span aria-hidden="true" style={{ width: groesse, height: groesse, flexShrink: 0, borderRadius: radius ?? Math.round(groesse / 5.5), background: liedFarbe(id), color: '#FFFFFF', display: 'flex', alignItems: groesse > 100 ? 'flex-end' : 'center', justifyContent: groesse > 100 ? 'flex-start' : 'center', padding: groesse > 100 ? 14 : 0, boxSizing: 'border-box' }}>
      <Music size={groesse > 100 ? 34 : 24} strokeWidth={1.7} />
    </span>
  )
}

export function LiedKachel({ stueck, to, state }) {
  return (
    <Link to={to} state={state} style={{ flex: '0 0 150px', width: 150, color: 'var(--text)', textDecoration: 'none' }}>
      <LiedCover id={stueck.id} groesse={150} radius={16} />
      <div style={{ marginTop: 8, fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stueck.titel}</div>
      {stueck.komponist && <div style={{ fontSize: 15, color: 'var(--text-2)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{stueck.komponist}</div>}
    </Link>
  )
}

export function Regal({ children }) {
  return <div style={{ display: 'flex', gap: 14, overflowX: 'auto', padding: '2px 20px 4px', scrollbarWidth: 'none' }}>{children}</div>
}

// ─── Zustände ─────────────────────────────────────────────────
export function Leer({ text, children }) {
  return (
    <div style={{ margin: '0 20px', padding: '32px 20px', borderRadius: 18, background: 'var(--n-fill)', textAlign: 'center', color: 'var(--text-2)', fontSize: 17, lineHeight: 1.5 }}>
      {text}
      {children && <div style={{ marginTop: 16 }}>{children}</div>}
    </div>
  )
}

export function Laden({ hoehe = 120 }) {
  return (
    <div aria-busy="true" style={{ margin: '0 20px', height: hoehe, borderRadius: 18, background: 'var(--n-fill)', animation: 'nPuls 1.4s ease-in-out infinite' }} />
  )
}

// ─── Blatt (Bottom-Sheet auf dem Handy, zentriert am Computer) ──
export function Blatt({ titel, onClose, children }) {
  const { T } = useApp()
  const titelId = useId()
  useEffect(() => {
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const esc = e => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', esc)
    return () => { document.body.style.overflow = prev; window.removeEventListener('keydown', esc) }
  }, [onClose])
  return createPortal(
    <div className="n-blatt-overlay" onClick={e => e.target === e.currentTarget && onClose()}
      style={{ position: 'fixed', inset: 0, zIndex: 1000, background: 'var(--n-overlay)', display: 'flex' }}>
      <div role="dialog" aria-modal="true" aria-labelledby={titelId} className="n-blatt"
        style={{ background: 'var(--bg)', color: 'var(--text)', width: '100%', maxHeight: '90dvh', overflowY: 'auto', boxShadow: 'var(--shadow-lg)' }}>
        <div style={{ position: 'sticky', top: 0, background: 'var(--bg)', padding: '10px 20px 8px', zIndex: 1 }}>
          <div className="n-blatt-griff" aria-hidden="true" style={{ width: 40, height: 5, borderRadius: 3, background: 'var(--n-fill-2)', margin: '0 auto 10px' }} />
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
            <h2 id={titelId} style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{titel}</h2>
            <button onClick={onClose} aria-label={T('close')} style={{ width: 44, height: 44, borderRadius: 22, border: 'none', background: 'var(--n-fill)', color: 'var(--text)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={20} /></button>
          </div>
        </div>
        <div style={{ padding: '8px 20px 28px' }}>{children}</div>
      </div>
    </div>,
    document.body,
  )
}

// CSS, das die Bausteine brauchen (in der Hülle eingebunden)
export const UI_CSS = `
  @keyframes nPuls { 0%,100% { opacity: 1 } 50% { opacity: .55 } }
  @keyframes nHoch { from { transform: translateY(24px); opacity: 0 } to { transform: none; opacity: 1 } }
  @keyframes nRein { from { opacity: 0; transform: translateY(6px) } to { opacity: 1; transform: none } }
  .n-blatt-overlay { align-items: flex-end; }
  .n-blatt { border-radius: 24px 24px 0 0; animation: nHoch .25s cubic-bezier(.2,.8,.2,1) both; padding-bottom: env(safe-area-inset-bottom, 0px); }
  @media (min-width: 900px) {
    .n-blatt-overlay { align-items: center; justify-content: center; padding: 24px; }
    .n-blatt { max-width: 560px; border-radius: 24px; }
    .n-blatt-griff { display: none; }
  }
  .n-seite { animation: nRein .22s ease both; }
  .n-lied-text h1, .n-lied-text h2, .n-lied-text h3 { font-size: .62em; font-weight: 700; letter-spacing: .06em; text-transform: uppercase; opacity: .85; margin: 1.4em 0 .4em; }
  .n-lied-text p { margin: 0 0 1em; }
  .n-lied-text hr { border: none; border-top: 1px solid rgba(255,255,255,.25); margin: 1.2em 0; }
  .n-lied-text blockquote { margin: 0 0 1em; padding-left: .8em; border-left: 3px solid rgba(255,255,255,.4); }
`
