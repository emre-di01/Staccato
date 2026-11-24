// Rahmen der öffentlichen Shop-Seiten: Schule oben, Sprache, Pflichtlinks unten. Keine App-Hülle, keine Anmeldung.
import { useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { UI_CSS } from '../../ui'
import { NEU_THEME } from '../../themes/themes'
import { schulfarbenTokens } from '../schulfarbe'

export default function ShopRahmen({ schule, titel, testmodus, fuss, children }) {
  const { T, lang, setLang, darkMode } = useApp()
  useEffect(() => { if (titel) document.title = titel }, [titel])
  // Design und Farbe der verkaufenden Schule, unabhängig davon, wer gerade angemeldet ist
  const { globalCss: _, ...farben } = NEU_THEME[darkMode ? 'dark' : 'light']
  return (
    <div style={{ ...farben, ...schulfarbenTokens(schule?.farbe, darkMode), minHeight: '100dvh', background: 'var(--bg)', color: 'var(--text)', display: 'flex', flexDirection: 'column' }}>
      {testmodus && <div role="status" style={{ padding: '10px 20px', background: '#FDE68A', color: '#422006', fontSize: 16, fontWeight: 700, textAlign: 'center' }}>{T('shop_testmodus')}</div>}
      <header style={{ width: '100%', maxWidth: 640, margin: '0 auto', padding: '14px 20px 0', boxSizing: 'border-box', display: 'flex', alignItems: 'center', gap: 12 }}>
        {schule?.logo_url && <img src={schule.logo_url} alt="" style={{ width: 48, height: 48, objectFit: 'contain', borderRadius: 12, background: '#FFFFFF', padding: 4, boxSizing: 'border-box', flexShrink: 0 }} />}
        <div style={{ flex: 1, minWidth: 0, fontSize: 18, fontWeight: 700, overflowWrap: 'anywhere' }}>{schule?.name}</div>
        <div role="group" aria-label={T('nau_sprache')} style={{ display: 'flex', gap: 2, padding: 4, borderRadius: 14, background: 'var(--n-fill)', flexShrink: 0 }}>
          {['de', 'en', 'tr'].map(l => (
            <button key={l} onClick={() => setLang(l)} aria-pressed={lang === l} style={{
              minWidth: 40, height: 40, borderRadius: 10, border: 'none', fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer',
              background: lang === l ? 'var(--bg)' : 'transparent', color: lang === l ? 'var(--text)' : 'var(--text-2)',
            }}>{l.toUpperCase()}</button>
          ))}
        </div>
      </header>
      <main className="n-seite" style={{ flex: 1, width: '100%', maxWidth: 640, margin: '0 auto', padding: '20px 20px 32px', boxSizing: 'border-box' }}>{children}</main>
      {fuss && (
        <footer style={{ width: '100%', maxWidth: 640, margin: '0 auto', display: 'flex', flexWrap: 'wrap', gap: '0 24px', padding: '8px 20px calc(96px + env(safe-area-inset-bottom, 0px))', boxSizing: 'border-box', borderTop: '1px solid var(--n-sep)' }}>{fuss}</footer>
      )}
      <style>{UI_CSS}</style>
    </div>
  )
}

export const textKnopf = { background: 'none', border: 'none', padding: '12px 0', fontFamily: 'inherit', fontSize: 16, color: 'var(--text-2)', cursor: 'pointer', textAlign: 'left' }
export const h1 = { margin: 0, fontSize: 30, lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }
