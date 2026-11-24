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
    const q = { select: () => q, eq: () => q, order: () => q, range: () => q, maybeSingle: () => q,
      insert: werte => { db.geschrieben = { name, werte }; return Promise.resolve({ error: null }) },
      update: werte => { db.geschrieben = { name, werte }; return { eq: () => Promise.resolve({ error: db.updateFehler ?? null }) } },
      then: ok => ok({ data: db.tabellen[name] ?? [], error: null }) }
    return q
  }
  return { supabase: { from: abfrage, rpc: (...a) => db.rpc(...a) } }
})
vi.mock('../ticketPdf', () => ({
  ticketPdf: async () => new File(['x'], 'Ticket.pdf', { type: 'application/pdf' }),
  ticketBilder: async ({ tickets, fertig }) => tickets.forEach(x => fertig(x.ticket.id, new File(['x'], `Ticket_${x.nr}.jpg`, { type: 'image/jpeg' }))),
}))
const toast = vi.fn()
const confirm = vi.fn(async () => true)
vi.mock('../../context/AppContext', () => ({
  useApp: () => ({ T: k => t('de', k), lang: 'de', zeitzone: 'Europe/Berlin', profil: { id: 'ich' }, rolle: 'schueler', schule: { id: 's', name: 'Chor' }, toast, confirm }),
}))
const { EventTickets, TicketStart } = await import('../EventTickets')
const { default: TicketBlatt } = await import('../admin/TicketBlatt')
const { default: NeuTickets } = await import('../seiten/Tickets')
const { default: TicketBestellungen } = await import('../admin/TicketBestellungen')

const ev = { id: 'ev1', titel: 'Winterkonzert', beginn: '2099-12-12T18:00:00Z', oeffentlich: false }
const info = { ok: true, grund: null, frei: 40, meine: 0, max: 10, rest_verguenstigt: 3, preis_normal: 15, preis_verguenstigt: 8.5, frist: '2099-12-01T17:00:00Z' }
let root
const warte = () => act(() => new Promise(r => setTimeout(r, 20)))
const text = () => document.body.textContent.replace(/\u00a0/g, ' ')
const knopf = name => [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent).replace(/\u00a0/g, ' ') === name)
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

  it('rechnet die Summe, reserviert und sagt, was jetzt zu tun ist', async () => {
    db.tabellen.ticket_einstellungen = [{ event_id: 'ev1' }]
    const rpc = vi.fn(async name => ({ data: name === 'ticket_info' ? info : { ok: true, status: 'reserviert', betrag: 55.5, frist: '2099-12-04T22:59:00Z' }, error: null }))
    db.rpc = rpc
    await zeige(<EventTickets ev={ev} />)
    await klick('Tickets reservieren')
    expect(text()).toContain('Zusammen 8,50 €')
    for (let i = 0; i < 4; i++) await klick('Mehr Tickets')
    expect(text()).toContain('Zusammen 55,50 €')
    expect(text()).toContain('3 × 8,50 € + 2 × 15 €')
    await klick('Reservieren')
    expect(rpc).toHaveBeenCalledWith('tickets_reservieren', { p_event_id: 'ev1', p_anzahl: 5, p_betrag: 55.5 })
    expect(text()).toContain('Reserviert!')
    expect(text()).toContain('Bitte 55,50 € bar bezahlen bis Freitag, 4. Dezember.')   // 23:59 → ohne Uhrzeit
  })

  it('zeigt Fehlergrund des Servers', async () => {
    db.tabellen.ticket_einstellungen = [{ event_id: 'ev1' }]
    db.rpc = async name => ({ data: name === 'ticket_info' ? info : { ok: false, grund: 'preis_geaendert' }, error: null })
    await zeige(<EventTickets ev={ev} />)
    await klick('Tickets reservieren')
    await klick('Reservieren')
    expect(text()).toContain('Der Preis hat sich geändert')
    expect(text()).not.toContain('Reserviert!')
  })

  it('zeigt nur den Grund, wenn nichts geht', async () => {
    db.tabellen.ticket_einstellungen = [{ event_id: 'ev1' }]
    db.rpc = async () => ({ data: { ...info, ok: false, grund: 'ausverkauft' }, error: null })
    await zeige(<EventTickets ev={ev} />)
    await klick('Tickets reservieren')
    expect(text()).toContain('Ausverkauft')
    expect(knopf('Reservieren')).toBeUndefined()
  })

  it('zeigt auf der Karte, was noch zu zahlen ist', async () => {
    db.tabellen.ticket_bestellungen = [{ id: 'b', event_id: 'ev1', status: 'reserviert', frist: '2099-12-04T17:00:00Z', tickets: [{ status: 'reserviert', preis: 9 }, { status: 'reserviert', preis: 15 }] }]
    await zeige(<EventTickets ev={ev} />)
    expect(text()).toContain('Bitte 24 € bar bezahlen bis Freitag, 4. Dezember, 18:00.')
    expect(knopf('Meine Tickets')).toBeTruthy()
    expect(knopf('Tickets reservieren')).toBeUndefined()
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

describe('TicketBestellungen', () => {
  const bestellung = teil => ({ id: 'b1', herkunft: 'mitglied', status: 'reserviert', frist: '2099-12-01T17:00:00Z', erstellt_am: '2099-11-20T10:00:00Z', kaeufer: { voller_name: 'Ayla Test' },
    tickets: [{ id: 't1', preis: 8.5, verguenstigt: true, status: 'reserviert' }, { id: 't2', preis: 15, verguenstigt: false, status: 'reserviert' }], ticket_zahlungen: [], ...teil })
  const personKnopf = () => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Ayla Test'))

  it('bestätigt den Geldeingang mit dem angezeigten Betrag', async () => {
    db.tabellen.ticket_bestellungen = [bestellung()]
    db.rpc = vi.fn(async () => ({ data: { ok: true }, error: null }))
    await zeige(<TicketBestellungen ev={ev} kapazitaet={100} onClose={() => {}} />)
    expect(text()).toContain('2 / 100')
    await act(async () => personKnopf().click())
    await klick('23,50 € bar erhalten')
    expect(confirm.mock.calls.at(-1)[0]).toContain('Ayla Test')
    expect(db.rpc).toHaveBeenCalledWith('ticket_zahlung_bestaetigen', { p_bestellung_id: 'b1', p_betrag: 23.5 })
  })

  it('storniert ausgewählte Tickets mit Erstattung', async () => {
    db.tabellen.ticket_bestellungen = [bestellung({ status: 'bezahlt', frist: null, tickets: [{ id: 't1', preis: 8.5, verguenstigt: true, status: 'gueltig' }, { id: 't2', preis: 15, verguenstigt: false, status: 'gueltig' }],
      ticket_zahlungen: [{ id: 'z', betrag: 23.5, zeitpunkt: '2099-11-21T10:00:00Z', person: { voller_name: 'Admin' }, ticket_erstattungen: [] }] })]
    db.rpc = vi.fn(async () => ({ data: { ok: true }, error: null }))
    await zeige(<TicketBestellungen ev={ev} kapazitaet={100} onClose={() => {}} />)
    await klick('Bezahlt (1)')
    await act(async () => personKnopf().click())
    await klick('Tickets stornieren')
    expect(document.querySelector('input').type).toBe('checkbox')
    await act(async () => document.querySelector('input[type=checkbox]').click())
    expect(document.querySelector('input:not([type=checkbox])').value).toBe('15,00')
    await klick('Tickets stornieren')
    expect(db.rpc).toHaveBeenCalledWith('tickets_stornieren', { p_bestellung_id: 'b1', p_ticket_ids: ['t2'], p_erstattung: 15 })
  })

  it('storniert nichts ohne Bestätigung', async () => {
    db.tabellen.ticket_bestellungen = [bestellung()]
    db.rpc = vi.fn()
    confirm.mockResolvedValueOnce(false)
    await zeige(<TicketBestellungen ev={ev} kapazitaet={100} onClose={() => {}} />)
    await act(async () => personKnopf().click())
    await klick('Tickets stornieren')
    await klick('Tickets stornieren')
    expect(db.rpc).not.toHaveBeenCalled()
  })
})

describe('NeuTickets', () => {
  const daten = [{ id: 'b', status: 'bezahlt', frist: null, schule: { name: 'Chor', zeitzone: 'Europe/Berlin' },
    event: { id: 'ev1', titel: 'Winterkonzert', beginn: ev.beginn, ende: null, ort: 'Aula', bild_pfad: null },
    tickets: [{ id: 'aaaaaaaa-1', preis: 8, status: 'eingeloest', code: 'c1', eingeloest_am: '2099-12-12T17:30:00Z' }, { id: 'bbbbbbbb-2', preis: 8, status: 'gueltig', code: 'c2' }] }]
  const oeffnen = async (teil = daten) => {
    db.rpc = async () => ({ error: null, data: teil })
    await zeige(<NeuTickets />)
    await warte()
  }
  afterEach(() => { delete navigator.share; delete navigator.canShare })

  it('zeigt die Tickets sofort untereinander, gültige zuerst', async () => {
    await oeffnen()
    expect([...document.querySelectorAll('article')].map(a => a.getAttribute('aria-label'))).toEqual(['Ticket 2 von 2', 'Ticket 1 von 2'])
    expect(document.querySelectorAll('article img')).toHaveLength(1)
    expect(text()).toContain('Bereit')
    expect(text()).toContain('Benutzt, 18:30')
  })

  it('hat Nachkaufen und Ausdrucken oben, vor den Tickets', async () => {
    db.tabellen.ticket_einstellungen = [{ event_id: 'ev1' }]
    await oeffnen()
    const erstes = document.querySelector('article')
    for (const name of ['Weitere Tickets', 'Ausdrucken']) expect(knopf(name).compareDocumentPosition(erstes) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    db.rpc = async () => ({ data: info, error: null })
    await klick('Weitere Tickets')
    expect(text()).toContain('Wie viele Tickets?')
  })

  it('zeigt bei mehreren Veranstaltungen eine Liste mit Zustand', async () => {
    const offen = { id: 'c', status: 'reserviert', frist: '2099-12-04T22:59:00Z', schule: daten[0].schule, event: { ...daten[0].event, id: 'ev2', titel: 'Chorabend' }, tickets: [{ id: 'cccccccc-3', preis: 8, status: 'reserviert', code: null }] }
    await oeffnen([...daten, offen])
    expect(text()).toContain('Bereit')
    expect(text()).toContain('Bitte bezahlen')
    expect(document.querySelectorAll('article')).toHaveLength(0)
  })

  it('verschickt das vorbereitete Bild noch im selben Klick', async () => {
    navigator.canShare = () => true
    navigator.share = vi.fn(async () => {})
    await oeffnen()
    knopf('Verschicken').click()                         // ohne Warten: share muss synchron aufgerufen werden
    expect(navigator.share).toHaveBeenCalledTimes(1)
    expect(navigator.share.mock.calls[0][0].files[0].name).toBe('Ticket_2.jpg')
  })

  it('speichert stattdessen, wenn der Browser das Teilen ablehnt', async () => {
    URL.createObjectURL = vi.fn(() => 'blob:x'); URL.revokeObjectURL = vi.fn()
    HTMLAnchorElement.prototype.click = vi.fn()
    navigator.canShare = () => true
    navigator.share = vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'NotAllowedError' }) })
    await oeffnen()
    await klick('Verschicken')
    expect(URL.createObjectURL).toHaveBeenCalled()
    expect(toast).toHaveBeenCalledWith('Bild gespeichert', 'success')
  })

  it('bietet ohne Teilen-Funktion das Speichern an', async () => {
    await oeffnen()
    expect(knopf('Verschicken')).toBeUndefined()
    expect(knopf('Als Bild speichern')).toBeTruthy()
  })
})

describe('TicketStart', () => {
  const gruppe = tickets => [{ id: 'b', status: 'bezahlt', frist: null, schule: { zeitzone: 'Europe/Berlin' }, event: { id: 'ev1', titel: 'Winterkonzert', beginn: ev.beginn, ende: null }, tickets }]
  it('führt mit einem Tipp zu den gültigen Tickets', async () => {
    db.rpc = async () => ({ error: null, data: gruppe([{ id: '1', preis: 8, status: 'gueltig', code: 'a' }, { id: '2', preis: 8, status: 'gueltig', code: 'b' }]) })
    await zeige(<TicketStart />)
    const link = document.querySelector('a')
    expect(link.textContent).toBe('Meine 2 Tickets')
    expect(link.getAttribute('href')).toBe('/tickets?event=ev1')
  })
  it('zeigt nichts, wenn alles benutzt ist', async () => {
    db.rpc = async () => ({ error: null, data: gruppe([{ id: '1', preis: 8, status: 'eingeloest', code: 'a', eingeloest_am: ev.beginn }]) })
    await zeige(<TicketStart />)
    expect(text()).toBe('')
  })
})
