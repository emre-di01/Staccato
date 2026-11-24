// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { t } from '../../i18n/translations'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const sb = vi.hoisted(() => ({ invoke: vi.fn(), upsert: vi.fn(async () => ({ error: null })), bestellungen: [], shop: null, konto: { verbunden: false } }))
vi.mock('../../lib/supabase', () => {
  const q = { select: () => q, eq: () => q, order: () => q, range: async () => ({ data: sb.bestellungen, error: null }), maybeSingle: async () => ({ data: sb.shop, error: null }), upsert: sb.upsert }
  return { supabase: { from: () => q, rpc: async () => ({ data: sb.konto, error: null }), functions: { invoke: sb.invoke } } }
})
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ T: k => t('de', k), lang: 'de', setLang() {}, darkMode: false, schule: { id: 's', name: 'Müzik Şule & Co.' }, toast() {}, confirm: async () => true }) }))
vi.mock('../ticketPdf', () => ({ ticketBilder: async () => {}, ticketPdf: async () => new File([], 'x.pdf') }))
vi.mock('qrcode', () => ({ default: { toDataURL: async x => `data:${x}` } }))
const { default: Shop } = await import('../shop/Shop')
const { default: Bestellung } = await import('../shop/Bestellung')
const { default: AdminTicketshop, STRIPE_LINK } = await import('../admin/Ticketshop')
const { default: TicketBestellungen } = await import('../admin/TicketBestellungen')
const { slugAus, SLUG } = await import('../ticketshop')
const { summe } = await import('../shop/daten')
const { einstellungenAusFormular, bestellungenAuswerten } = await import('../tickets')

const schule = { name: 'Probe', zeitzone: 'Europe/Berlin' }
const event = { id: 'ev1', titel: 'Winterkonzert', beginn: '2099-12-12T18:00:00Z', ort: 'Aula', lage: { ok: true, grund: null, max: 4, preis: 15, knapp: 3 } }
const angebot = (events = [event]) => ({ ok: true, schule, impressum: 'IMP', agb: 'AGB-TEXT', datenschutz: 'DS', testmodus: true, events })
const ZUGANG = 'a'.repeat(64)
let root
const text = () => document.body.textContent.replace(/ /g, ' ')
const knopf = n => [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent).replace(/ /g, ' ') === n)
const warte = (ms = 20) => act(() => new Promise(r => setTimeout(r, ms)))
const klick = async n => { await act(async () => knopf(n).click()); await warte() }
const tippe = async (el, wert) => act(async () => {
  Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), 'value').set.call(el, wert)
  el.dispatchEvent(new Event('input', { bubbles: true }))
})
async function zeige(pfad) {
  root = createRoot(document.body.appendChild(document.createElement('div')))
  await act(async () => root.render(
    <MemoryRouter initialEntries={[pfad]}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>
      <Routes><Route path="/shop/bestellung/:zugang" element={<Bestellung />} /><Route path="/shop/:slug" element={<Shop />} /><Route path="/bestellungen" element={<TicketBestellungen ev={{ id: 'ev1' }} kapazitaet={10} onClose={() => {}} />} /><Route path="/admin" element={<AdminTicketshop />} /></Routes>
    </QueryClientProvider></MemoryRouter>))
  await warte()
}
const antworten = karte => sb.invoke.mockImplementation(async (name, { body }) => {
  const a = karte[body.aktion]
  const r = typeof a === 'function' ? a(body) : a
  return r?.http ? { data: null, error: { context: { json: async () => r.body } } } : { data: r, error: null }
})
const aufrufe = aktion => sb.invoke.mock.calls.map(c => c[1].body).filter(b => b.aktion === aktion)
beforeEach(() => { sb.invoke.mockReset(); sb.upsert.mockClear(); sb.shop = null; sb.konto = { verbunden: false }; window.scrollTo = () => {} })
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = '' })

describe('Shop', () => {
  const ausfuellen = async () => {
    await tippe(document.querySelector('input[autocomplete="name"]'), 'Gast Öz')
    await tippe(document.querySelector('input[type="email"]'), 'gast@example.test')
  }
  it('einzelne Veranstaltung direkt kaufbar, Rechtstexte verlieren keine Eingaben', async () => {
    antworten({ info: angebot(), kaufen: { ok: false, grund: 'ausverkauft' } })
    await zeige('/shop/probe')
    expect(text()).toContain('Testbetrieb')
    expect(text()).toContain('Noch 3 Plätze frei')
    await klick('Ein Ticket mehr')
    await ausfuellen()
    await klick('AGB lesen')
    expect(text()).toContain('AGB-TEXT')
    await klick('Zurück')
    expect(document.querySelector('input[type="email"]').value).toBe('gast@example.test')
    await klick('Jetzt für 30 € kaufen')
    expect(text()).toContain('Bitte die AGB bestätigen.')
    expect(aufrufe('kaufen')).toEqual([])
    await act(async () => document.querySelector('#shop-agb').click())
    await klick('Jetzt für 30 € kaufen')
    expect(aufrufe('kaufen')).toEqual([{ aktion: 'kaufen', event_id: 'ev1', anzahl: 2, betrag: 30, name: 'Gast Öz', email: 'gast@example.test', sprache: 'de', agb: true, website: '' }])
    expect(text()).toContain('Gerade wurden die letzten Tickets verkauft.')
    expect(aufrufe('info').length).toBe(2)   // freie Plätze neu geladen
  })
  it('Doppelklick kauft nur einmal', async () => {
    antworten({ info: angebot(), kaufen: () => new Promise(() => {}) })
    await zeige('/shop/probe')
    await ausfuellen()
    await act(async () => document.querySelector('#shop-agb').click())
    const f = document.querySelector('form')
    await act(async () => { f.requestSubmit(); f.requestSubmit() })
    expect(aufrufe('kaufen').length).toBe(1)
  })
  it('mehrere Veranstaltungen: Liste, ausverkaufte nicht kaufbar', async () => {
    antworten({ info: angebot([event, { ...event, id: 'ev2', titel: 'Voll', lage: { ok: false, grund: 'ausverkauft', max: 0, preis: 9 } }]) })
    await zeige('/shop/probe')
    expect(text()).toContain('Ausverkauft')
    expect(document.querySelectorAll('article button').length).toBe(1)
    await klick('Tickets kaufen · 15 €')
    expect(text()).toContain('Wie viele Tickets?')
    await klick('Alle Veranstaltungen')
    expect(text()).toContain('Voll')
  })
  it('unbekannter Shop', async () => {
    antworten({ info: { http: 404, body: { ok: false, grund: 'nicht_gefunden' } } })
    await zeige('/shop/nix')
    expect(text()).toContain('gibt es nicht')
  })
  it('Beträge genau in Cent', () => { expect(summe(3, 8.1)).toBe(24.3); expect(summe(3, 0.7)).toBe(2.1) })
})

describe('Bestellung', () => {
  const o = werte => ({ ok: true, status: 'bezahlt', name: 'Gast', email: 'g$&@example.test', betrag: 15, slug: 'probe', event, schule, tickets: [{ id: 'aaaaaaaa-1', preis: 15, status: 'gueltig', code: 'c'.repeat(32) }], ...werte })
  it('zeigt QR-Codes nach der Zahlung', async () => {
    antworten({ bestellung: o() })
    await zeige(`/shop/bestellung/${ZUGANG}`)
    expect(text()).toContain('Bezahlt!')
    expect(text()).toContain('g$&@example.test')
    expect(document.querySelector('article img').src).toContain('c'.repeat(32))
  })
  it('Abbruch gibt Plätze frei', async () => {
    antworten({ abbrechen: o({ status: 'verfallen', tickets: [] }) })
    await zeige(`/shop/bestellung/${ZUGANG}?abbruch=1`)
    expect(aufrufe('abbrechen').length).toBe(1)
    expect(text()).toContain('Kauf abgebrochen')
    expect(text()).toContain('Es wurde nichts bezahlt')
  })
  it('wartet auf die Bestätigung', async () => {
    antworten({ bestellung: o({ status: 'reserviert', tickets: [{ id: 't', preis: 15, status: 'reserviert', code: null }] }) })
    await zeige(`/shop/bestellung/${ZUGANG}`)
    expect(text()).toContain('Zahlung wird geprüft')
    expect(document.querySelector('article')).toBe(null)
  })
  it('storniert und unbekannt', async () => {
    antworten({ bestellung: o({ status: 'storniert', tickets: [], zurueck: 0, automatisch: true }) })
    await zeige(`/shop/bestellung/${ZUGANG}`)
    expect(text()).toContain('bekommst du das Geld zurück')
    act(() => root.unmount()); document.body.innerHTML = ''
    antworten({ bestellung: { http: 404, body: { ok: false, grund: 'nicht_gefunden' } } })
    await zeige(`/shop/bestellung/${ZUGANG}`)
    expect(text()).toContain('Diese Bestellung gibt es nicht')
  })
})

describe('Nachbetreuung', () => {
  it('Tickets nochmal schicken: immer dieselbe Antwort', async () => {
    antworten({ info: angebot(), nochmal: { ok: true } })
    await zeige('/shop/probe')
    await klick('Tickets nochmal schicken')
    const feld = [...document.querySelectorAll('input[type="email"]')].find(i => !i.closest('[hidden]'))
    await tippe(feld, 'quatsch'); await klick('Tickets schicken')
    expect(aufrufe('nochmal')).toEqual([])
    await tippe(feld, 'gast@example.test'); await klick('Tickets schicken')
    expect(aufrufe('nochmal')).toEqual([{ aktion: 'nochmal', slug: 'probe', email: 'gast@example.test', website: '' }])
    expect(text()).toContain('Gibt es zu dieser E-Mail gültige Tickets')
  })
  it('verspricht keine Rückzahlung, die es nicht gibt', async () => {
    const b = w => ({ ok: true, status: 'storniert', email: 'a@b.de', slug: 'probe', event, schule, tickets: [], zurueck: 0, automatisch: false, ...w })
    antworten({ bestellung: b() })
    await zeige(`/shop/bestellung/${ZUGANG}`)
    expect(text()).toContain('wende dich an Probe')
    expect(text()).not.toContain('Geld zurück')
    act(() => root.unmount()); document.body.innerHTML = ''
    antworten({ bestellung: b({ zurueck: 15 }) })
    await zeige(`/shop/bestellung/${ZUGANG}`)
    expect(text()).toContain('Du bekommst 15 € auf deine Karte zurück')
  })
  const bestellung = w => ({ id: 'b1', herkunft: 'shop', kaeufer_name: 'Gast Öz', kaeufer_email: 'gast@example.test', status: 'bezahlt', erstellt_am: '2026-11-24T10:00:00Z', kaeufer: null,
    tickets: [{ id: 't1', preis: 15, status: 'gueltig' }, { id: 't2', preis: 15, status: 'gueltig' }], ticket_online_erstattungen: [],
    ticket_zahlungen: [{ id: 'z', methode: 'stripe', betrag: 30, zeitpunkt: '2026-11-24T10:01:00Z', ticket_erstattungen: [] }], ...w })
  const oeffnen = async b => {
    sb.bestellungen = [b]
    await zeige('/bestellungen')
    await klick(`Bezahlt (${b.status === 'bezahlt' ? 1 : 0})`)
    const zeile = [...document.querySelectorAll('button')].find(x => x.textContent.includes('Gast Öz'))
    await act(async () => zeile.click()); await warte()
  }
  it('Storno geht über Stripe; Wiederholung nach Netzfehler mit gleicher ID', async () => {
    let n = 0
    antworten({ stornieren: () => n++ ? { ok: true, erstattung: 'erledigt' } : { http: 500, body: null } })
    await oeffnen(bestellung())
    expect(knopf('30,00 € bar erhalten')).toBeFalsy()
    await klick('Tickets stornieren')
    await act(async () => document.querySelector('input[type="checkbox"]').click())
    await klick('Tickets stornieren')
    expect(text()).toContain('nichts doppelt zurückgezahlt')
    await klick('Tickets stornieren')
    const a = aufrufe('stornieren')
    expect(a.length).toBe(2)
    expect(a[0]).toMatchObject({ bestellung_id: 'b1', ticket_ids: ['t2'], betrag: 15 })
    expect(a[1].vorgang).toBe(a[0].vorgang)
    expect(a[0].vorgang).toMatch(/^[0-9a-f-]{36}$/)
  })
  it('offene Rückzahlung lässt sich wiederholen', async () => {
    antworten({ wiederholen: { ok: true, erstattung: 'erledigt' } })
    await oeffnen(bestellung({ tickets: [{ id: 't1', preis: 15, status: 'storniert' }, { id: 't2', preis: 15, status: 'gueltig' }], ticket_online_erstattungen: [{ vorgang: 'v1', betrag: 15, erledigt_am: null }] }))
    expect(text()).toContain('Rückzahlung von 15,00 € steht noch aus')
    expect(knopf('Geld zurückzahlen')).toBeFalsy()   // schon beauftragt
    await klick('Nochmal versuchen')
    expect(aufrufe('wiederholen')).toEqual([{ bestellung_id: 'b1', aktion: 'wiederholen', vorgang: 'v1' }])
  })
  it('E-Mail korrigieren', async () => {
    antworten({ mail: { ok: true, geaendert: true } })
    await oeffnen(bestellung())
    await klick('Tickets per E-Mail senden')
    await tippe(document.querySelector('input[type="email"]'), ' Richtig@example.test')
    await klick('Tickets per E-Mail senden')
    expect(aufrufe('mail')).toEqual([{ bestellung_id: 'b1', aktion: 'mail', email: 'richtig@example.test' }])
  })
})

describe('Einrichtung', () => {
  it('Schlüssel geht nur an die Function; Webhook von Hand möglich', async () => {
    antworten({ verbinden: b => b.webhook_geheim ? { ok: true } : { ok: false, grund: 'webhook_noetig', url: 'https://api/x', ereignisse: ['checkout.session.completed'] } })
    await zeige('/admin')
    await tippe(document.querySelector('input[type="password"]'), ' rk_test_abc ')
    await klick('Verbinden')
    expect(text()).toContain('https://api/x')
    await tippe(document.querySelectorAll('input[type="password"]')[1], 'whsec_abc')
    await klick('Verbinden')
    expect(aufrufe('verbinden')).toEqual([
      { aktion: 'verbinden', schule_id: 's', schluessel: 'rk_test_abc' },
      { aktion: 'verbinden', schule_id: 's', schluessel: 'rk_test_abc', webhook_geheim: 'whsec_abc' },
    ])
    expect([...document.querySelectorAll('input[type="password"]')].every(i => i.value === '')).toBe(true)
  })
  it('öffnet nicht ohne Pflichttexte und Stripe', async () => {
    await zeige('/admin')
    await act(async () => document.querySelector('[role="switch"]').click())
    await klick('Speichern')
    expect(text()).toContain('Bitte Impressum, AGB und Datenschutz ausfüllen.')
    for (const f of document.querySelectorAll('textarea')) await tippe(f, 'Text')
    await klick('Speichern')
    expect(text()).toContain('Bitte zuerst Stripe verbinden.')
    expect(sb.upsert).not.toHaveBeenCalled()
  })
  it('speichert', async () => {
    sb.konto = { verbunden: true, livemode: false, letzte4: '4242' }
    sb.shop = { slug: 'probe', aktiv: true, impressum: 'I', agb: 'A', datenschutz: 'D' }
    await zeige('/admin')
    expect(text()).toContain('Testbetrieb · …4242')
    await klick('Speichern')
    expect(sb.upsert.mock.calls[0][0]).toMatchObject({ schule_id: 's', slug: 'probe', aktiv: true, agb: 'A' })
  })
  it('Stripe-Link wählt genau die drei nötigen Rechte vor', () => {
    const u = new URL(STRIPE_LINK)
    expect(u.origin + u.pathname).toBe('https://dashboard.stripe.com/test/apikeys/create')
    expect(u.searchParams.getAll('permissions[]')).toEqual(['rak_checkout_session_write', 'rak_charge_write', 'rak_webhook_write'])
  })
  it('Adressvorschlag', () => {
    expect(slugAus('Müzik Şule & Co.')).toBe('muezik-sule-co')
    expect(slugAus('İstanbul Straße')).toBe('istanbul-strasse')
    expect(SLUG.test(slugAus('Übungs-Café'))).toBe(true)
  })
})

describe('Veranstaltung und Bestellungen', () => {
  const form = { aktiv: true, kapazitaet: '100', preis_normal: '15', obergrenze: '10', frist_tage: '7', freigabe_minuten: '30' }
  it('Shop-Einstellungen', () => {
    expect(einstellungenAusFormular({ ...form, shop_aktiv: true, mitglieder_reserve: '20' }).werte).toMatchObject({ shop_aktiv: true, mitglieder_reserve: 20 })
    expect(einstellungenAusFormular({ ...form, shop_aktiv: true, mitglieder_reserve: '101' }).fehler).toBe('sh_fehler_reserve')
    expect(einstellungenAusFormular({ ...form, preis_normal: '0,40', shop_aktiv: true, mitglieder_reserve: '' }).fehler).toBe('sh_fehler_preis')
    expect(einstellungenAusFormular({ ...form, mitglieder_reserve: '999' }).werte).toMatchObject({ shop_aktiv: false, mitglieder_reserve: 0 })
  })
  it('trennt bar und online', () => {
    const b = (id, methode, herkunft) => ({ id, herkunft, status: 'bezahlt', tickets: [{ id, preis: 15, status: 'gueltig' }], ticket_zahlungen: [{ id, methode, betrag: 15, ticket_erstattungen: [] }] })
    const { liste, stand } = bestellungenAuswerten([b('1', 'bar', 'mitglied'), b('2', 'stripe', 'shop')])
    expect(stand).toMatchObject({ eingenommen: 15, online: 15 })
    expect(liste.map(x => x.online)).toEqual([false, true])
  })
})
