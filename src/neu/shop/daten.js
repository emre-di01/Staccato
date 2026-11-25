// Öffentlicher Ticketshop: Aufrufe der Edge Function „shop“ und kleine Rechenhilfen
import { supabase } from '../../lib/supabase'

// Antwort der Function; ohne Verbindung { ok: false, grund: 'netz' }
export async function shopAufruf(aktion, werte = {}) {
  try {
    const { data, error } = await supabase.functions.invoke('shop', { body: { aktion, ...werte } })
    if (!error) return data
    const antwort = await error.context?.json?.().catch(() => null)
    return antwort?.grund ? antwort : { ok: false, grund: 'netz' }
  } catch { return { ok: false, grund: 'netz' } }
}

// Die Function läuft auf dem Server und signiert Bilder mit dessen interner Adresse (z. B. http://kong:8000);
// für den Browser zählt die öffentliche Adresse der API
export function bildAdresse(url, api = import.meta.env.VITE_SUPABASE_URL) {
  if (!url || !api) return url ?? null
  try {
    const { pathname, search } = new URL(url)
    return new URL(pathname + search, api).href
  } catch { return null }
}

// In Cent gerechnet, damit der Betrag genau dem des Servers entspricht
export const summe = (anzahl, preis) => anzahl * Math.round(preis * 100) / 100

// gleiche Regeln wie shop_reservieren()
export const nameGueltig = n => n.trim().length >= 2
export const emailGueltig = e => /^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]{2,}$/.test(e.trim())

// Gründe, für die es einen eigenen Text gibt (shop_fehler_<grund>)
export const GRUENDE = ['angaben', 'anzahl', 'ausverkauft', 'zu_wenig_frei', 'betrag', 'zu_viele', 'beendet', 'noch_nicht', 'nicht_verfuegbar', 'netz', 'fehler', 'allgemein']
export const fehlerText = (T, grund) => T(`shop_fehler_${GRUENDE.includes(grund) ? grund : 'fehler'}`)

// Begonnene Bestellung nur in diesem Tab merken (Rückkehr von der Bezahlseite), nicht dauerhaft auf dem Gerät
const MERKER = 'staccato_shop_bestellung'
export function bestellungMerken(zugang) {
  try { sessionStorage.setItem(MERKER, zugang) } catch { /* gesperrt: Rückkehr zeigt den Hinweis auf die E-Mail */ }
}
export function bestellungHolen() {
  try {
    const z = sessionStorage.getItem(MERKER)
    return /^[0-9a-f]{64}$/.test(z ?? '') ? z : null
  } catch { return null }
}
export function bestellungVergessen() {
  try { sessionStorage.removeItem(MERKER) } catch { /* gesperrt */ }
}
