// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { t } from '../../i18n/translations'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const db = vi.hoisted(() => ({ rpc: null, tabellen: {}, geschrieben: null }))
vi.mock('../../lib/supabase', () => {
  const abfrage = name => {
    const q = { select: () => q, eq: () => q, order: () => q, maybeSingle: () => q,
      insert: werte => { db.geschrieben = { name, werte }; return Promise.resolve({ error: null }) },
      update: werte => { db.geschrieben = { name, werte }; return { eq: () => Promise.resolve({ error: db.updateFehler ?? null }) } },
      then: ok => ok({ data: db.tabellen[name] ?? [], error: null }) }
    return q
  }
  return { supabase: { from: abfrage, rpc: (...a) => db.rpc(...a) } }
})
const toast = vi.fn()
vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ T: k => t('de', k), lang: 'de', zeitzone: 'Europe/Berlin', profil: { id: 'ich' }, schule: { id: 's' }, toast }),
}))
const { EventTickets } = await import('../EventTickets')
const { default: TicketBlatt } = await import('../admin/TicketBlatt')

const ev = { id: 'ev1', titel: 'Winterkonzert', beginn: '2099-12-12T18:00:00Z', oeffentlich: false }
const info = { ok: true, grund: null, frei: 40, meine: 0, max: 10, rest_verguenstigt: 3, preis_normal: 15, preis_verguenstigt: 8.5, frist: '2099-12-01T17:00:00Z' }
let root
const warte = () => act(() => new Promise(r => setTimeout(r, 20)))
const text = () => document.body.textContent.replace(/ /g, ' ')
const knopf = name => [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent).replace(/ /g, ' ') === name)
const klick = async name => { await act(async () => knopf(name).click()); await warte() }
async function zeige(el) {
  const div = document.body.appendChild(document.createElement('div'))
  root = createRoot(div)
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  await act(async () => root.render(<MemoryRouter><QueryClientProvider client={qc}>{el}</QueryClientProvider></MemoryRouter>))
  await warte()
}
beforeEach(() => { db.tabellen = {}; db.geschrieben = null; db.updateFehler = null; toast.mockClear() })
afterEach(() => { act(() => root.unmount()); document.body.innerHTML = '' })

describe('EventTickets', () => {
  it('zeigt nichts ohne Verkauf und ohne eigene Tickets', async () => {
    await zeige(<EventTickets ev={ev} />)
    expect(text()).toBe('')
  })

  it('rechnet die Summe und reserviert mit dem bestätigten Betrag', async () => {
    db.tabellen.ticket_einstellungen = [{ event_id: 'ev1' }]
    const rpc = vi.fn(async name => ({ data: name === 'ticket_info' ? info : { ok: true, status: 'reserviert' }, error: null }))
    db.rpc = rpc
    await zeige(<EventTickets ev={ev} />)
    await klick('Tickets reservieren')
    for (let i = 0; i < 4; i++) await klick('Mehr Tickets')
    expect(text()).toContain('3 × 8,50 €')
    expect(text()).toContain('2 × 15,00 €')
    expect(text()).toContain('1. Dez. 2099, 18:00')
    await klick('Für 55,50 € reservieren')
    expect(rpc).toHaveBeenCalledWith('tickets_reservieren', { p_event_id: 'ev1', p_anzahl: 5, p_betrag: 55.5 })
    expect(toast).toHaveBeenCalledWith('Tickets reserviert', 'success')
  })

  it('zeigt Fehlergrund des Servers', async () => {
    db.tabellen.ticket_einstellungen = [{ event_id: 'ev1' }]
    db.rpc = async name => ({ data: name === 'ticket_info' ? info : { ok: false, grund: 'preis_geaendert' }, error: null })
    await zeige(<EventTickets ev={ev} />)
    await klick('Tickets reservieren')
    await klick('Für 8,50 € reservieren')
    expect(text()).toContain('Der Preis hat sich geändert')
    expect(toast).not.toHaveBeenCalled()
  })

  it('zeigt eigene Reservierung mit Frist und Grund, wenn nichts mehr geht', async () => {
    db.tabellen.ticket_bestellungen = [{ id: 'b', event_id: 'ev1', status: 'reserviert', frist: '2099-12-01T17:00:00Z', tickets: [{ status: 'reserviert', preis: 8.5 }, { status: 'reserviert', preis: 15 }] }]
    db.rpc = async () => ({ data: { ...info, ok: false, grund: 'obergrenze' }, error: null })
    await zeige(<EventTickets ev={ev} />)
    expect(text()).toContain('2 Tickets · noch bezahlen')
    await klick('Meine Tickets')
    expect(text()).toContain('23,50 €')
    expect(text()).toContain('Bar bezahlen bis')
    expect(text()).toContain('Mehr Tickets sind pro Mitglied nicht möglich.')
  })
})

describe('TicketBlatt', () => {
  const setze = async (label, wert) => {
    const feld = [...document.querySelectorAll('label')].find(l => l.textContent.startsWith(label)).querySelector('input')
    await act(async () => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(feld, wert)
      feld.dispatchEvent(new Event('input', { bubbles: true }))
    })
  }

  it('prüft Pflichtfelder und legt Einstellungen an', async () => {
    const onFertig = vi.fn()
    await zeige(<TicketBlatt ev={ev} einstellungen={null} onClose={() => {}} onFertig={onFertig} />)
    await klick('Speichern')
    expect(text()).toContain('Bitte die Zahl der Plätze angeben.')
    expect(db.geschrieben).toBeNull()
    await setze('Plätze insgesamt', '120')
    await setze('Normalpreis', '15')
    await setze('Preis an der Abendkasse', '18,50')
    await klick('Speichern')
    expect(db.geschrieben.werte).toMatchObject({ event_id: 'ev1', kapazitaet: 120, preis_normal: 15, preis_abendkasse: 18.5, kontingent: 0, aktiv: false })
    expect(onFertig).toHaveBeenCalled()
  })

  it('erklärt, wenn die Kapazität schon belegt ist', async () => {
    db.updateFehler = { message: 'ticket_kapazitaet_belegt:42' }
    const einst = { aktiv: true, kapazitaet: 50, preis_normal: 15, preis_verguenstigt: 8, kontingent: 3, obergrenze: 10, frist_tage: 7, bis_abendkasse: false, freigabe_minuten: 30 }
    await zeige(<TicketBlatt ev={ev} einstellungen={einst} onClose={() => {}} onFertig={() => {}} />)
    expect(text()).toContain('Diese Veranstaltung ist nicht öffentlich.')
    await setze('Plätze insgesamt', '10')
    await klick('Speichern')
    expect(text()).toContain('Es sind schon 42 Plätze belegt')
  })
})
