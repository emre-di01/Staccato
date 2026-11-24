// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { t } from '../../i18n/translations'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const sb = vi.hoisted(() => ({ invoke: vi.fn(async () => ({ error: null })), rpc: vi.fn(), geschrieben: [], freigaben: [] }))
vi.mock('../../lib/supabase', () => {
  const tabelle = name => {
    const q = { select: () => q, eq: () => q,
      insert: w => { sb.geschrieben.push(['insert', w]); return Promise.resolve({ error: null }) },
      update: w => { sb.geschrieben.push(['update', w]); return q }, delete: () => { sb.geschrieben.push(['delete']); return q },
      then: ok => ok({ data: name === 'ticket_freigaben' ? sb.freigaben : [{ rolle: 'schueler', person: { id: 'p1', voller_name: 'Ayla Test' } }], error: null }) }
    return q
  }
  return { supabase: { rpc: sb.rpc, from: tabelle, functions: { invoke: sb.invoke } } }
})
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ T: k => t('de', k), lang: 'de', zeitzone: 'Europe/Berlin', profil: { id: 'ich' }, schule: { id: 's' }, rolle: 'schueler', toast: () => {} }) }))
const { sicherAusfuehren } = await import('../tickets')
const { default: Kasse } = await import('../einlass/Kasse')
const { default: EinlassStart } = await import('../einlass/EinlassStart')
const { default: TicketHelfer } = await import('../admin/TicketHelfer')

const ev = { id: 'ev1', titel: 'Winterkonzert', beginn: '2099-12-12T18:00:00Z', zeitzone: 'Europe/Berlin', ab: '2099-12-12T15:00:00Z', offen: true, helfer: true, preis: 18, frei: 14, kassiert: 340 }
let root
const text = () => document.body.textContent.replace(/\u00a0/g, ' ')
const knopf = n => [...document.querySelectorAll('button')].find(b => (b.getAttribute('aria-label') ?? b.textContent).replace(/\u00a0/g, ' ') === n)
const warte = (ms = 20) => act(() => new Promise(r => setTimeout(r, ms)))
const klick = async n => { await act(async () => knopf(n).click()); await warte() }
async function zeige(el) {
  root = createRoot(document.body.appendChild(document.createElement('div')))
  await act(async () => root.render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{el}</QueryClientProvider></MemoryRouter>))
  await warte()
}
const antworten = karte => sb.rpc.mockImplementation(async name => { const a = karte[name] ?? []; return a instanceof Error ? Promise.reject(a) : { data: a, error: null } })
const aufrufe = name => sb.rpc.mock.calls.filter(c => c[0] === name).map(c => c[1])
beforeEach(() => { sb.rpc.mockReset(); sb.invoke.mockClear(); sb.geschrieben = []; sb.freigaben = [] })
afterEach(() => { act(() => root?.unmount()); root = null; document.body.innerHTML = '' })

describe('Kasse', () => {
  it('verkauft neu zum Abendkassenpreis und lässt direkt ein', async () => {
    antworten({ meine_kassen_events: [ev], abendkasse_verkaufen: { ok: true, anzahl: 2 } })
    await zeige(<Kasse />)
    expect(text()).toContain('noch 14 frei')
    expect(text()).toContain('Von dir kassiert: 340 €')
    await klick('Mehr Tickets')
    await klick('36 € bar erhalten')
    expect(aufrufe('abendkasse_verkaufen')[0]).toMatchObject({ p_event_id: 'ev1', p_anzahl: 2, p_betrag: 36 })
    expect(text()).toContain('2 Personen einlassen')
    await klick('Weiter')
    expect(text()).toContain('Zusammen 18 €')
  })

  it('wiederholt nach Netzfehler denselben Vorgang mit derselben Anzahl', async () => {
    let offline = true
    sb.rpc.mockImplementation(async name => {
      if (name === 'meine_kassen_events') return { data: [ev], error: null }
      if (offline) throw new Error('offline')
      return { data: { ok: true, anzahl: 1 }, error: null }
    })
    await zeige(<Kasse />)
    await act(async () => knopf('18 € bar erhalten').click())
    await warte(1500)
    expect(text()).toContain('es wird nichts doppelt gebucht')
    expect(knopf('Mehr Tickets').disabled).toBe(true)
    expect(knopf('Abbrechen und neu beginnen')).toBeUndefined()
    offline = false
    await klick('18 € bar erhalten')
    const ids = aufrufe('abendkasse_verkaufen').map(w => w.p_vorgang)
    expect(ids).toHaveLength(4)
    expect(new Set(ids).size).toBe(1)
    expect(text()).toContain('1 Person einlassen')
  })

  it('kassiert eine Reservierung nach Namenssuche', async () => {
    antworten({ meine_kassen_events: [ev], abendkasse_kassieren: { ok: true, anzahl: 2, eingelassen: true },
      abendkasse_reservierungen: [{ id: 'b1', name: 'Ayla Test', anzahl: 2, betrag: 24 }, { id: 'b2', name: 'Murat Y.', anzahl: 1, betrag: 8 }] })
    await zeige(<Kasse />)
    await klick('Name suchen')
    expect(text()).toContain('Murat Y.')
    await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Ayla Test')).click())
    await klick('24 € bar erhalten')
    expect(aufrufe('abendkasse_kassieren')).toEqual([{ p_bestellung_id: 'b1', p_betrag: 24 }])
    expect(sb.invoke).not.toHaveBeenCalled()              // geht direkt rein, braucht kein Ticket
    expect(text()).toContain('2 Personen einlassen')
  })

  it('vor der Öffnung: nur Reservierungen, niemand wird eingelassen', async () => {
    antworten({ meine_kassen_events: [{ ...ev, offen: false }], abendkasse_kassieren: { ok: true, anzahl: 1, eingelassen: false }, abendkasse_reservierungen: [{ id: 'b1', name: 'Ayla Test', anzahl: 1, betrag: 8 }] })
    await zeige(<Kasse />)
    await warte()
    await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Ayla Test')).click())
    await klick('8 € bar erhalten')
    expect(text()).toContain('Geldeingang bestätigt')
    expect(sb.invoke).toHaveBeenCalledWith('send-email', { body: { type: 'tickets', bestellung_id: 'b1' } })
    expect(text()).not.toContain('einlassen')
    await klick('Weiter')
    await klick('Neu verkaufen')
    expect(text()).toContain('Die Abendkasse öffnet Samstag, 12. Dezember, 16:00.')
  })

  it('lässt nach einer Ablehnung neu beginnen, mit neuem Vorgang', async () => {
    antworten({ meine_kassen_events: [ev], abendkasse_verkaufen: { ok: false, grund: 'betrag' } })
    await zeige(<Kasse />)
    await klick('18 € bar erhalten')
    expect(text()).toContain('Der Preis hat sich geändert')
    await klick('Abbrechen und neu beginnen')
    await klick('18 € bar erhalten')
    expect(new Set(aufrufe('abendkasse_verkaufen').map(w => w.p_vorgang)).size).toBe(2)
  })

  it('lässt Bezahlte per Namen ein, auch nur einen Teil', async () => {
    antworten({ meine_kassen_events: [ev], abendkasse_einlassen: { ok: true, anzahl: 2 },
      abendkasse_reservierungen: [{ id: 'b3', name: 'Fatma K.', status: 'bezahlt', anzahl: 3, betrag: 45, ticket_ids: ['a', 'b', 'c'] }] })
    await zeige(<Kasse />)
    await klick('Name suchen')
    expect(text()).toContain('Bezahlt')
    await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Fatma K.')).click())
    expect(knopf('45 € bar erhalten')).toBeUndefined()
    await klick('Weniger Tickets')
    await klick('2 Personen einlassen')
    expect(aufrufe('abendkasse_einlassen')).toEqual([{ p_bestellung_id: 'b3', p_ticket_ids: ['a', 'b'] }])
    expect(text()).toContain('Stempel nicht vergessen')
  })

  it('erklärt, wenn ein Ticket schon drin ist', async () => {
    antworten({ meine_kassen_events: [ev], abendkasse_einlassen: { ok: false, grund: 'schon_drin' },
      abendkasse_reservierungen: [{ id: 'b3', name: 'Fatma K.', status: 'bezahlt', anzahl: 1, betrag: 15, ticket_ids: ['a'] }] })
    await zeige(<Kasse />)
    await klick('Name suchen')
    await act(async () => [...document.querySelectorAll('button')].find(b => b.textContent.includes('Fatma K.')).click())
    await klick('1 Person einlassen')
    expect(text()).toContain('schon drin')
    expect(text()).not.toContain('Stempel')
  })

  it('zeigt ausverkauft', async () => {
    antworten({ meine_kassen_events: [{ ...ev, frei: 0 }] })
    await zeige(<Kasse />)
    expect(text()).toContain('Ausverkauft')
  })
})

describe('EinlassStart', () => {
  it('zeigt Kassenhelfern die Kasse schon vorher, Admins erst ab Öffnung', async () => {
    antworten({ meine_scan_events: [], meine_kassen_events: [{ ...ev, offen: false }, { ...ev, id: 'ev2', titel: 'Als Admin', offen: false, helfer: false }] })
    await zeige(<EinlassStart />)
    expect([...document.querySelectorAll('a')].map(a => a.getAttribute('href'))).toEqual(['/kasse?event=ev1'])
  })
  it('zeigt Scannen und Kasse auf einer Karte', async () => {
    antworten({ meine_scan_events: [{ id: 'ev1', titel: 'Winterkonzert', scanbar: true }], meine_kassen_events: [ev] })
    await zeige(<EinlassStart />)
    expect([...document.querySelectorAll('a')].map(a => a.textContent)).toEqual(['Tickets scannen', 'Kasse öffnen'])
  })
})

describe('TicketHelfer', () => {
  it('setzt Häkchen einzeln und entfernt ohne Häkchen', async () => {
    sb.freigaben = [{ profil_id: 'p1', scannen: true, kasse: false }]
    await zeige(<TicketHelfer ev={ev} onClose={() => {}} />)
    const [scannen, kasse] = document.querySelectorAll('input[type=checkbox]')
    expect([scannen.checked, kasse.checked]).toEqual([true, false])
    await act(async () => kasse.click()); await warte()
    expect(sb.geschrieben).toEqual([['update', { scannen: true, kasse: true }]])
    await act(async () => document.querySelectorAll('input[type=checkbox]')[0].click()); await warte()
    expect(sb.geschrieben.at(-1)).toEqual(['delete'])
  })
})

describe('sicherAusfuehren', () => {
  it('gibt fachliche Ablehnung sofort zurück', async () => {
    sb.rpc.mockResolvedValue({ data: { ok: false, grund: 'zu_wenig_frei' }, error: null })
    expect(await sicherAusfuehren('x', {}, 0)).toEqual({ ok: false, grund: 'zu_wenig_frei' })
    expect(sb.rpc).toHaveBeenCalledTimes(1)
  })
})
