import { ChevronLeft, Music, CircleCheck, CircleAlert } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { UI_CSS } from '../../ui'

// ─── Rahmen für Seiten ohne App-Hülle (Anmeldung, Einladung, Schulwahl) ──
// Eine ruhige, zentrierte Spalte: Zeichen, großer Titel, Inhalt. Sprache oben rechts.
export default function AuthRahmen({ titel, unter, zeichen, zurueck, fuss = true, children }) {
  const { T, lang, setLang } = useApp()
  return (
    <div style={{ minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px 0', minHeight: 56 }}>
        {zurueck ? (
          <button onClick={zurueck.onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 2, minHeight: 44, padding: '0 10px 0 0', background: 'none', border: 'none', fontFamily: 'inherit', fontSize: 17, fontWeight: 600, color: 'var(--primary)', cursor: 'pointer' }}>
            <ChevronLeft aria-hidden="true" size={24} />{zurueck.label}
          </button>
        ) : <span />}
        <div role="group" aria-label={T('nau_sprache')} style={{ display: 'flex', gap: 4, padding: 4, borderRadius: 14, background: 'var(--n-fill)' }}>
          {['de', 'en', 'tr'].map(l => (
            <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} style={{
              minWidth: 44, height: 36, borderRadius: 10, border: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              background: lang === l ? 'var(--bg)' : 'transparent', color: lang === l ? 'var(--text)' : 'var(--text-2)',
              boxShadow: lang === l ? '0 1px 3px rgba(0,0,0,0.12)' : 'none',
            }}>{l.toUpperCase()}</button>
          ))}
        </div>
      </div>

      <main className="n-seite" style={{ flex: 1, width: '100%', maxWidth: 440, margin: '0 auto', padding: '24px 20px 32px', boxSizing: 'border-box' }}>
        <div style={{ marginBottom: 28 }}>
          {zeichen ?? <AppZeichen />}
          {titel && <h1 style={{ margin: '20px 0 0', fontSize: 34, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em' }}>{titel}</h1>}
          {unter && <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.45, color: 'var(--text-2)' }}>{unter}</p>}
        </div>
        {children}
      </main>

      {fuss && (
        <footer style={{ display: 'flex', justifyContent: 'center', gap: 24, padding: '8px 16px calc(16px + env(safe-area-inset-bottom, 0px))' }}>
          <a href="/impressum" style={fussLink}>{T('nau_impressum')}</a>
          <a href="/datenschutz" style={fussLink}>{T('nau_datenschutz')}</a>
        </footer>
      )}
      <style>{UI_CSS}</style>
    </div>
  )
}

const fussLink = { fontSize: 15, color: 'var(--text-2)', textDecoration: 'none', padding: '10px 0' }

// App-Zeichen: orange Kachel mit Note, daneben der Name
export function AppZeichen() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <span aria-hidden="true" style={{ width: 52, height: 52, borderRadius: 14, background: 'linear-gradient(150deg, var(--n-hero), var(--n-hero-2))', color: '#FFFFFF', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Music size={28} strokeWidth={2} />
      </span>
      <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.02em' }}>Staccato</span>
    </div>
  )
}

// Hinweis-Box für Erfolg oder Fehler
export function Meldung({ art = 'ok', children }) {
  const farbe = art === 'ok' ? 'var(--success)' : 'var(--danger)'
  const Icon = art === 'ok' ? CircleCheck : CircleAlert
  return (
    <div role={art === 'ok' ? 'status' : 'alert'} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 14, background: `color-mix(in srgb, ${farbe} 12%, var(--bg))`, color: 'var(--text)', fontSize: 17, lineHeight: 1.45 }}>
      <Icon aria-hidden="true" size={22} color={farbe} style={{ flexShrink: 0, marginTop: 1 }} />
      <span>{children}</span>
    </div>
  )
}

// Zentrierter Zustand (Laden, Fehler, Erfolg) mit großem Symbol
export function Zustand({ icon: Icon, farbe = 'var(--primary)', titel, text, children }) {
  return (
    <div style={{ textAlign: 'center', paddingTop: 24 }}>
      {Icon && (
        <span aria-hidden="true" style={{ width: 72, height: 72, borderRadius: 36, margin: '0 auto 20px', background: 'var(--n-fill)', color: farbe, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <Icon size={34} strokeWidth={1.9} />
        </span>
      )}
      <h1 style={{ margin: 0, fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>{titel}</h1>
      {text && <p style={{ margin: '10px 0 0', fontSize: 17, lineHeight: 1.45, color: 'var(--text-2)' }}>{text}</p>}
      {children && <div style={{ marginTop: 24 }}>{children}</div>}
    </div>
  )
}

export function passwortGueltig(pw) {
  return pw.length >= 8 && /[A-Z]/.test(pw) && /[a-z]/.test(pw) && /[0-9]/.test(pw)
}
