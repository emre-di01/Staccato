import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

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

  const mitglieder_reserve = f.shop_aktiv ? ganzzahl(f.mitglieder_reserve || '0') : 0
  if (f.shop_aktiv && !(preis_normal >= 0.5)) return { fehler: 'sh_fehler_preis' }   // Stripe nimmt mindestens 0,50 €
  if (!(mitglieder_reserve >= 0 && mitglieder_reserve <= kapazitaet)) return { fehler: 'sh_fehler_reserve' }

  return {
    werte: {
      shop_aktiv: !!f.shop_aktiv, mitglieder_reserve,
      aktiv: !!f.aktiv, kapazitaet, preis_normal, preis_verguenstigt, preis_abendkasse, kontingent, obergrenze, verkauf_von, verkauf_bis,
      frist_tage: frist_tage > 0 ? frist_tage : 7, bis_abendkasse: !!f.bis_abendkasse,
      freigabe_minuten: freigabe_minuten >= 0 ? freigabe_minuten : 30,
    },
  }
}

// ─── Reservieren (Mitglieder) ─────────────────────────────────

// Veranstaltungen mit eingeschaltetem Verkauf (nur sichtbare): Set der event_ids
export function useTicketVerkauf() {
  const { profil, schule } = useApp()
  return useQuery({
    queryKey: ['n-ticket-verkauf', profil?.id, schule?.id],
    enabled: !!profil?.id && !!schule?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_einstellungen').select('event_id').eq('aktiv', true)
      if (error) throw error
      return data.map(e => e.event_id)
    },
  })
}

export function useMeineBestellungen() {
  const { profil } = useApp()
  return useQuery({
    queryKey: ['n-ticket-bestellungen', profil?.id],
    enabled: !!profil?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('ticket_bestellungen')
        .select('id, event_id, status, frist, erstellt_am, tickets(id, preis, verguenstigt, status)')
        .eq('kaeufer_id', profil.id).order('erstellt_am')
      if (error) throw error
      return data
    },
  })
}

export function useTicketInfo(eventId) {
  const { profil } = useApp()
  return useQuery({
    queryKey: ['n-ticket-info', eventId, profil?.id],
    enabled: !!eventId && !!profil?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('ticket_info', { p_event_id: eventId })
      if (error) throw error
      return data
    },
  })
}

// Erst vergünstigte, dann normale Tickets (wie tickets_reservieren). In Cent gerechnet, damit der Betrag exakt passt.
export function preisBerechnen(info, anzahl) {
  const verguenstigt = Math.min(anzahl, info.rest_verguenstigt)
  const normal = anzahl - verguenstigt
  const cent = verguenstigt * Math.round((info.preis_verguenstigt ?? 0) * 100) + normal * Math.round(info.preis_normal * 100)
  return { verguenstigt, normal, betrag: cent / 100 }
}

// Laufende Bestellungen: ohne stornierte, verfallene und abgelaufene; mit Anzahl und Betrag der gültigen Tickets
export function aktiveBestellungen(bestellungen, jetzt = Date.now()) {
  return (bestellungen ?? [])
    .filter(b => b.status === 'bezahlt' || (b.status === 'reserviert' && new Date(b.frist) > jetzt))
    .map(b => {
      const tickets = b.tickets.filter(t => ['reserviert', 'gueltig', 'eingeloest'].includes(t.status))
      return { ...b, anzahl: tickets.length, betrag: tickets.reduce((s, t) => s + Math.round(t.preis * 100), 0) / 100 }
    })
    .filter(b => b.anzahl > 0)
}

// ─── Bestellungen einer Veranstaltung (Admins) ────────────────

const SEITE = 500   // unter dem Zeilenlimit der API
export async function alleBestellungenLaden(eventId) {
  const alle = []
  for (let von = 0; ; von += SEITE) {
    const { data, error } = await supabase.from('ticket_bestellungen')
      .select(`id, herkunft, kaeufer_name, kaeufer_email, auto_erstatten, demo, status, frist, erstellt_am,
        kaeufer:profiles!ticket_bestellungen_kaeufer_id_fkey(voller_name, avatar_url),
        tickets(id, preis, verguenstigt, status, an_kasse),
        ticket_online_erstattungen(vorgang, betrag, erledigt_am),
        ticket_zahlungen(id, methode, betrag, zeitpunkt, person:profiles!ticket_zahlungen_angenommen_von_fkey(voller_name),
          ticket_erstattungen(id, betrag, zeitpunkt, person:profiles!ticket_erstattungen_erstattet_von_fkey(voller_name)))`)
      .eq('event_id', eventId).order('erstellt_am', { ascending: false }).order('id').range(von, von + SEITE - 1)
    if (error) throw error
    alle.push(...data)
    if (data.length < SEITE) return alle
  }
}

const cent = betrag => Math.round(betrag * 100)
const summeCent = (liste, feld) => liste.reduce((s, x) => s + cent(x[feld]), 0)

// Ergänzt je Bestellung: zustand (reserviert | bezahlt | storniert | verfallen, abgelaufene Frist = verfallen),
// gruppe (Filter), anzahl und betrag, Zahlung, Erstattungen, noch erstattbarer Betrag. Dazu der Gesamtstand.
export function bestellungenAuswerten(bestellungen, jetzt = Date.now()) {
  const stand = { gueltig: 0, reserviert: 0, eingenommen: 0, erstattet: 0, online: 0 }
  const liste = (bestellungen ?? []).map(b => {
    const zustand = b.status === 'reserviert' && new Date(b.frist) <= jetzt ? 'verfallen' : b.status
    const laufend = zustand === 'reserviert' || zustand === 'bezahlt'
    const aktiv = laufend ? b.tickets.filter(t => ['reserviert', 'gueltig', 'eingeloest', 'demo'].includes(t.status)) : b.tickets
    const zahlung = b.ticket_zahlungen?.[0] ?? null
    const erstattungen = (b.ticket_zahlungen ?? []).flatMap(z => z.ticket_erstattungen ?? [])
    const erstattetCent = summeCent(erstattungen, 'betrag')
    const storniertCent = summeCent(b.tickets.filter(t => t.status === 'storniert'), 'preis')
    const online = zahlung?.methode === 'stripe'
    const offeneErstattungen = (b.ticket_online_erstattungen ?? []).filter(o => !o.erledigt_am)
    if (!b.demo) {   // Demo zählt nirgends mit
      if (zustand === 'reserviert') stand.reserviert += aktiv.length
      if (zustand === 'bezahlt') stand.gueltig += aktiv.length
      if (online) stand.online += cent(zahlung.betrag) - erstattetCent
      else {
        stand.eingenommen += zahlung ? cent(zahlung.betrag) : 0
        stand.erstattet += erstattetCent
      }
    }
    return {
      ...b, zustand, online: online || b.herkunft === 'shop', offeneErstattungen, gruppe: zustand === 'reserviert' ? 'offen' : zustand === 'bezahlt' ? 'bezahlt' : 'erledigt',
      anzahl: aktiv.length, betrag: summeCent(aktiv, 'preis') / 100, zahlung, erstattungen,
      // Teilstorno vor dem Bezahlen zählt nicht: erstattbar ist höchstens, was bezahlt und storniert wurde
      erstattbar: zahlung && !b.auto_erstatten ? Math.max(Math.min(storniertCent, cent(zahlung.betrag) - summeCent(b.tickets.filter(t => ['gueltig', 'eingeloest', 'demo'].includes(t.status)), 'preis')) - erstattetCent - summeCent(offeneErstattungen, 'betrag'), 0) / 100 : 0,
    }
  })
  // Eingenommen = bar in der Kasse verblieben; online = über Stripe, abzüglich Erstattungen
  return { liste, stand: { ...stand, eingenommen: (stand.eingenommen - stand.erstattet) / 100, erstattet: stand.erstattet / 100, online: stand.online / 100 } }
}

// ─── Eigene Tickets mit QR-Code ───────────────────────────────

// Nur der Zufallscode, keine persönlichen Daten; kein Link, die Handy-Kamera öffnet damit nichts
export const TICKET_PREFIX = 'staccato:ticket:'
export const ticketQrInhalt = code => TICKET_PREFIX + code

// Kurze Nummer für Rückfragen – aus der Ticket-ID, nicht aus dem geheimen Code
export const ticketNummer = ticket => ticket.id.slice(0, 8).toUpperCase()

export function useMeineTickets() {
  const { profil } = useApp()
  return useQuery({
    queryKey: ['n-meine-tickets', profil?.id],
    enabled: !!profil?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meine_tickets')
      if (error) throw error
      return data
    },
  })
}

const NACHLAUF = 6 * 60 * 60 * 1000   // ohne Endzeit gilt eine Veranstaltung 6 h nach Beginn als vorbei

// Bestellungen je Veranstaltung zusammenfassen:
// { event, schule, vergangen, tickets: [{ ticket, nr }] (gültig/eingelöst), offen: [Reservierungen], storniert: Anzahl }
export function ticketsNachEvent(bestellungen, jetzt = Date.now()) {
  const gruppen = new Map()
  for (const b of bestellungen ?? []) {
    if (!gruppen.has(b.event.id)) {
      const ende = b.event.ende ? new Date(b.event.ende).getTime() : new Date(b.event.beginn).getTime() + NACHLAUF
      gruppen.set(b.event.id, { event: b.event, schule: b.schule, vergangen: ende < jetzt, tickets: [], offen: [], storniert: 0 })
    }
    const g = gruppen.get(b.event.id)
    for (const t of b.tickets ?? []) {
      if (t.code) g.tickets.push({ ticket: t, nr: g.tickets.length + 1 })
      else if (t.status === 'storniert') g.storniert++
    }
    if (b.status === 'reserviert' && new Date(b.frist) > jetzt) {
      const reserviert = (b.tickets ?? []).filter(t => t.status === 'reserviert')
      if (reserviert.length) g.offen.push({ id: b.id, frist: b.frist, anzahl: reserviert.length, betrag: summeCent(reserviert, 'preis') / 100 })
    }
  }
  return [...gruppen.values()].filter(g => g.tickets.length || g.offen.length || g.storniert)
}

// ─── Anzeige ──────────────────────────────────────────────────

// „24 €“ bzw. „8,50 €“
export function geldKurz(betrag, lang) {
  const ganz = Number.isInteger(Number(betrag))
  return new Intl.NumberFormat(LOCALE[lang] ?? 'de-DE', { style: 'currency', currency: 'EUR', minimumFractionDigits: ganz ? 0 : 2, maximumFractionDigits: ganz ? 0 : 2 }).format(betrag)
}

// „Freitag, 4. Dezember“, mit Uhrzeit außer bei Fristen bis Tagesende (23:59)
export function tagAusgeschrieben(iso, tz, lang, { mitZeit = true } = {}) {
  const d = new Date(iso)
  const f = opt => new Intl.DateTimeFormat(LOCALE[lang] ?? 'de-DE', { timeZone: tz ?? 'Europe/Berlin', ...opt }).format(d)
  const uhr = f({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  const tag = f({ weekday: 'long', day: 'numeric', month: 'long' })
  return mitZeit && uhr !== '23:59' ? `${tag}, ${uhr}` : tag
}

// ─── Einlass ──────────────────────────────────────────────────

// Geheimer Code aus dem QR-Inhalt, sonst null
export function ticketAusQr(text) {
  const t = String(text ?? '').trim()
  if (!t.startsWith(TICKET_PREFIX)) return null
  const code = t.slice(TICKET_PREFIX.length)
  return /^[0-9a-f]{32}$/.test(code) ? code : null
}

// Veranstaltungen, bei denen ich scannen darf (nur noch nicht vorbei)
export function useScanEvents() {
  const { profil, schule } = useApp()
  return useQuery({
    queryKey: ['n-scan-events', profil?.id, schule?.id],
    enabled: !!profil?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meine_scan_events')
      if (error) throw error
      return data
    },
  })
}

const VERSUCHE = 3
const ZEITLIMIT = 6000
// Scannen mit Wiederholung: Die Scan-ID bleibt gleich, deshalb entwertet eine Wiederholung nie doppelt.
// Ergebnis wie ticket_scannen(), bei fehlender Verbindung { ergebnis: 'netz' }, ohne Berechtigung { ergebnis: 'verboten' }.
export async function ticketScannen(eventId, code, scanId, pause = 600) {
  for (let i = 0; i < VERSUCHE; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, pause))
    try {
      const abbruch = new Promise((_, nein) => setTimeout(() => nein(new Error('zeit')), ZEITLIMIT))
      const { data, error } = await Promise.race([supabase.rpc('ticket_scannen', { p_event_id: eventId, p_code: code, p_scan_id: scanId }), abbruch])
      if (!error) return data
      if (error.code === '42501') return { ergebnis: 'verboten' }
    } catch { /* keine Verbindung – nochmal */ }
  }
  return { ergebnis: 'netz' }
}

// Veranstaltungen, bei denen ich kassieren darf
export function useKassenEvents() {
  const { profil, schule } = useApp()
  return useQuery({
    queryKey: ['n-kassen-events', profil?.id, schule?.id],
    enabled: !!profil?.id,
    staleTime: 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('meine_kassen_events')
      if (error) throw error
      return data
    },
  })
}

// Kassenvorgang mit Wiederholung bei Netzaussetzern (die Funktionen erkennen Wiederholungen selbst).
// Ergebnis der Funktion oder { ok: false, grund: 'netz' | 'verboten' }
export async function sicherAusfuehren(name, werte, pause = 600) {
  for (let i = 0; i < VERSUCHE; i++) {
    if (i > 0) await new Promise(r => setTimeout(r, pause))
    try {
      const abbruch = new Promise((_, nein) => setTimeout(() => nein(new Error('zeit')), ZEITLIMIT))
      const { data, error } = await Promise.race([supabase.rpc(name, werte), abbruch])
      if (!error) return data
      if (error.code === '42501') return { ok: false, grund: 'verboten' }
    } catch { /* keine Verbindung – nochmal */ }
  }
  return { ok: false, grund: 'netz' }
}

// Gültige Tickets einer Bestellung per Mail an den Käufer. true, wenn die Mail rausging.
// art 'ticket_reservierung': stattdessen Betrag und Zahlungsfrist (nur für die eigene Reservierung).
export async function ticketMailSenden(bestellungId, art = 'tickets') {
  const { error } = await supabase.functions.invoke('send-email', { body: { type: art, bestellung_id: bestellungId } })
  return !error
}

// Shop-Bestellung verwalten (Admins): Tickets schicken, stornieren, online erstatten. Ohne Verbindung { ok: false, grund: 'netz' }
export async function shopVerwalten(bestellungId, werte) {
  try {
    const { data, error } = await supabase.functions.invoke('shop-verwaltung', { body: { bestellung_id: bestellungId, ...werte } })
    if (!error) return data
    const antwort = await error.context?.json?.().catch(() => null)
    return antwort?.grund ? antwort : { ok: false, grund: 'netz' }
  } catch { return { ok: false, grund: 'netz' } }
}
