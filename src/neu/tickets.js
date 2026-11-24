import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

// ─── Ticketverkauf: Einstellungen je Veranstaltung ────────────

export function useTicketEinstellungen(eventId) {
  return useQuery({
    queryKey: ['n-ticket-einstellungen', eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_einstellungen').select('*').eq('event_id', eventId).maybeSingle()
      if (error) throw error
      return data
    },
  })
}

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
export const euro = (betrag, lang) => new Intl.NumberFormat(LOCALE[lang] ?? 'de-DE', { style: 'currency', currency: 'EUR' }).format(betrag)

// „12,50“ oder „12.50“ → 12.5; leer → null; ungültig → NaN
export function betragAus(text) {
  const s = String(text ?? '').trim()
  if (!s) return null
  return /^\d{1,6}([.,]\d{1,2})?$/.test(s) ? Number(s.replace(',', '.')) : NaN
}

const ganzzahl = text => /^\d{1,6}$/.test(String(text ?? '').trim()) ? Number(text) : NaN

// Prüft das Formular (gleiche Regeln wie die Datenbank).
// Ergebnis: { fehler: Übersetzungsschlüssel } oder { werte } für ticket_einstellungen.
export function einstellungenAusFormular(f) {
  const kapazitaet = ganzzahl(f.kapazitaet)
  if (!(kapazitaet > 0)) return { fehler: 'tk_fehler_kapazitaet' }
  const preis_normal = betragAus(f.preis_normal)
  if (preis_normal === null || Number.isNaN(preis_normal)) return { fehler: 'tk_fehler_preis' }
  const obergrenze = ganzzahl(f.obergrenze)
  if (!(obergrenze > 0)) return { fehler: 'tk_fehler_obergrenze' }

  let preis_verguenstigt = null
  let kontingent = 0
  if (f.ermaessigt) {
    preis_verguenstigt = betragAus(f.preis_verguenstigt)
    if (preis_verguenstigt === null || Number.isNaN(preis_verguenstigt)) return { fehler: 'tk_fehler_preis' }
    if (preis_verguenstigt > preis_normal) return { fehler: 'tk_fehler_verguenstigt' }
    kontingent = ganzzahl(f.kontingent)
    if (!(kontingent > 0)) return { fehler: 'tk_fehler_kontingent' }
    if (kontingent > obergrenze) return { fehler: 'tk_fehler_kontingent_grenze' }
  }

  const preis_abendkasse = betragAus(f.preis_abendkasse)   // leer = Normalpreis
  if (Number.isNaN(preis_abendkasse)) return { fehler: 'tk_fehler_preis' }
  if (preis_abendkasse !== null && preis_abendkasse < preis_normal) return { fehler: 'tk_fehler_abendkasse' }

  const verkauf_von = f.verkauf_von ? new Date(f.verkauf_von).toISOString() : null
  const verkauf_bis = f.verkauf_bis ? new Date(f.verkauf_bis).toISOString() : null
  if (verkauf_von && verkauf_bis && verkauf_von >= verkauf_bis) return { fehler: 'tk_fehler_zeitraum' }

  const frist_tage = ganzzahl(f.frist_tage)
  if (!f.bis_abendkasse && !(frist_tage > 0)) return { fehler: 'tk_fehler_frist' }
  const freigabe_minuten = ganzzahl(f.freigabe_minuten)
  if (f.bis_abendkasse && !(freigabe_minuten >= 0)) return { fehler: 'tk_fehler_freigabe' }

  return {
    werte: {
      aktiv: !!f.aktiv, kapazitaet, preis_normal, preis_verguenstigt, preis_abendkasse, kontingent, obergrenze, verkauf_von, verkauf_bis,
      frist_tage: frist_tage > 0 ? frist_tage : 7, bis_abendkasse: !!f.bis_abendkasse,
      freigabe_minuten: freigabe_minuten >= 0 ? freigabe_minuten : 30,
    },
  }
}
