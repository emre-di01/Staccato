// Daten und App-Version aktuell halten, ohne dass die App geschlossen werden muss
// (als PWA gibt es keinen Neu-laden-Knopf und die Seite bleibt oft tagelang offen).
import { useEffect, useRef, useSyncExternalStore } from 'react'
import { queryClient } from './queryClient'

const WEG_MS     = 10 * 1000        // erst nach dieser Zeit im Hintergrund nachladen (Kamera, Dateiauswahl)
const VERSION_MS = 60 * 60 * 1000   // Suche nach neuer Version bei dauerhaft offener App
const SPERRE     = 'staccato_neu_geladen'

// Hier nie von selbst nachladen: Live-Stunde, Beamer, Einlass/Kasse, öffentlicher Shop
const RUHIG = /^\/(session|beamer|einlass|kasse|shop)(\/|$)|\/unterrichtsmodus$/
export const istRuhig = pfad => RUHIG.test(pfad)

// Antwortet der Server? Sonst würde ein Nachladen gute Daten durch leere oder alte ersetzen
// (direkt nach dem Aufwecken ist das Netz oft noch nicht da). /auth wird vom Service Worker nicht zwischengespeichert.
async function erreichbar() {
  const abbruch = new AbortController()
  const t = setTimeout(() => abbruch.abort(), 5000)
  try {
    const r = await fetch(`${import.meta.env.VITE_SUPABASE_URL}/auth/v1/health`, {
      headers: { apikey: import.meta.env.VITE_SUPABASE_ANON_KEY }, cache: 'no-store', signal: abbruch.signal,
    })
    return r.ok
  } catch { return false } finally { clearTimeout(t) }
}

// Alle Daten neu holen (Titelbilder nicht: ihre Links gelten noch, sie würden nur flackern).
// false = keine Verbindung, die bisherigen Daten bleiben stehen
export async function datenNeuLaden() {
  if (!await erreichbar()) return false
  await queryClient.invalidateQueries({ predicate: q => q.queryKey[0] !== 'n-event-bild' })
  return true
}

// ─── Neue App-Version ─────────────────────────────────────────
let bereit = false
const hoerer = new Set()
const abonnieren = f => { hoerer.add(f); return () => hoerer.delete(f) }

// Neue Version ist installiert; sie gilt ab dem nächsten vollständigen Laden
export const versionBereit = () => bereit
export const useVersionBereit = () => useSyncExternalStore(abonnieren, versionBereit)

const sw = () => (typeof navigator !== 'undefined' ? navigator.serviceWorker : undefined)

export async function versionSuchen() {
  try { await (await sw()?.getRegistration())?.update() } catch { /* offline */ }
}

// Fehlt ein Programmteil (alte Version, Datei auf dem Server ersetzt): einmal neu laden, nicht in Schleife
export function einmalNeuLaden() {
  if (!navigator.onLine) return
  try {
    if (Date.now() - Number(sessionStorage.getItem(SPERRE) ?? 0) < 30000) return
    sessionStorage.setItem(SPERRE, String(Date.now()))
  } catch { return }
  window.location.reload()
}

export function starteAktualisierung() {
  // Beim allerersten Besuch übernimmt der Service Worker ebenfalls; das ist keine neue Version
  let hatteVersion = !!sw()?.controller
  sw()?.addEventListener('controllerchange', () => {
    if (hatteVersion) { bereit = true; hoerer.forEach(f => f()) }
    hatteVersion = true
  })
  window.addEventListener('vite:preloadError', einmalNeuLaden)
  setInterval(versionSuchen, VERSION_MS)

  let wegSeit = null
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') { wegSeit = Date.now(); return }
    const weg = wegSeit ? Date.now() - wegSeit : 0
    wegSeit = null
    if (weg < WEG_MS) return
    versionSuchen()
    if (!istRuhig(window.location.pathname)) datenNeuLaden()
  })
}

// ─── Ziehen zum Aktualisieren ─────────────────────────────────
export const ZIEH_SCHWELLE = 70
const KEIN_ZIEHEN = 'input, textarea, select, canvas, audio, video, iframe, [contenteditable="true"], [role="dialog"], [role="alertdialog"]'

// Darf eine Berührung an dieser Stelle das Aktualisieren auslösen?
export function ziehbar(ziel, oben = window.scrollY) {
  if (oben > 0 || !(ziel instanceof Element)) return false
  if (document.querySelector('[role="dialog"], [role="alertdialog"]') || ziel.closest(KEIN_ZIEHEN)) return false
  for (let el = ziel; el && el !== document.body; el = el.parentElement) if (el.scrollTop > 0) return false
  return true
}

// Ruft onZug(px) während des Ziehens und onLos(erreicht) am Ende auf
export function useZiehen(aktiv, onZug, onLos) {
  // Über eine Ref, damit ein Neuzeichnen mitten im Ziehen die Geste nicht abbricht
  const rueckruf = useRef(null)
  useEffect(() => { rueckruf.current = { onZug, onLos } })
  useEffect(() => {
    if (!aktiv) return
    let start = null, zug = 0
    const ab = e => {
      start = e.touches.length === 1 && ziehbar(e.target) ? { x: e.touches[0].clientX, y: e.touches[0].clientY, sicher: false } : null
      zug = 0
    }
    const ende = erreicht => {
      if (start?.sicher) rueckruf.current.onLos(erreicht)
      start = null
    }
    const bewegt = e => {
      if (!start) return
      if (e.touches.length > 1) { ende(false); return }
      const dx = e.touches[0].clientX - start.x, dy = e.touches[0].clientY - start.y
      if (!start.sicher) {
        if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return
        // Seitlich gewischt oder nach oben gescrollt: diese Berührung gehört nicht uns
        if (dy <= 0 || Math.abs(dx) > Math.abs(dy)) { start = null; return }
        start.sicher = true
      }
      zug = Math.max(0, Math.min(110, dy * 0.5))
      if (e.cancelable) e.preventDefault()
      rueckruf.current.onZug(zug)
    }
    const los = () => ende(zug >= ZIEH_SCHWELLE)
    const abbruch = () => ende(false)
    document.addEventListener('touchstart', ab, { passive: true })
    document.addEventListener('touchmove', bewegt, { passive: false })
    document.addEventListener('touchend', los)
    document.addEventListener('touchcancel', abbruch)
    return () => {
      document.removeEventListener('touchstart', ab)
      document.removeEventListener('touchmove', bewegt)
      document.removeEventListener('touchend', los)
      document.removeEventListener('touchcancel', abbruch)
    }
  }, [aktiv])
}
