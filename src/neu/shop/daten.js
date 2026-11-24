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

// In Cent gerechnet, damit der Betrag genau dem des Servers entspricht
export const summe = (anzahl, preis) => anzahl * Math.round(preis * 100) / 100

// gleiche Regeln wie shop_reservieren()
export const nameGueltig = n => n.trim().length >= 2
export const emailGueltig = e => /^[^@\s<>",;]+@[^@\s<>",;]+\.[^@\s<>",;]{2,}$/.test(e.trim())

// Gründe, für die es einen eigenen Text gibt (shop_fehler_<grund>)
export const GRUENDE = ['angaben', 'anzahl', 'ausverkauft', 'zu_wenig_frei', 'betrag', 'zu_viele', 'beendet', 'noch_nicht', 'nicht_verfuegbar', 'netz', 'fehler', 'allgemein']
export const fehlerText = (T, grund) => T(`shop_fehler_${GRUENDE.includes(grund) ? grund : 'fehler'}`)
