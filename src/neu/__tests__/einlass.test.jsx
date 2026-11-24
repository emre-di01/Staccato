// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { t } from '../../i18n/translations'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const rpc = vi.hoisted(() => vi.fn())
const kamera = vi.hoisted(() => ({ melden: null }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc } }))
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ T: k => t('de', k), lang: 'de', zeitzone: 'Europe/Berlin', profil: { id: 'ich' }, schule: { id: 's' }, rolle: 'schueler' }) }))
vi.mock('../kamera', async orig => ({ ...(await orig()), useKameraScan: f => { kamera.melden = f; return { videoRef: { current: null }, canvasRef: { current: null }, fehler: '' } } }))
const { ticketAusQr, ticketScannen } = await import('../tickets')
const { default: Einlass, Scanner } = await import('../einlass/Einlass')

const QR = n => 'staccato:ticket:' + String(n).repeat(32).slice(0, 32)
const ev = { id: 'ev1', titel: 'Winterkonzert', beginn: '2099-12-12T18:00:00Z', zeitzone: 'Europe/Berlin', ab: '2099-12-12T06:00:00Z', scanbar: true, eingelassen: 4, gesamt: 80 }
const antwort = (ergebnis, teil) => ({ data: { ergebnis, eingelassen: 5, gesamt: 80, ...teil }, error: null })
let root
const text = () => document.body.textContent
const knopf = n => [...document.querySelectorAll('button')].find(b => b.textContent === n)
const scanne = inhalt => act(async () => { kamera.melden(inhalt); await Promise.resolve() })
async function zeige(el) {
  root = createRoot(document.body.appendChild(document.createElement('div')))
  await act(async () => root.render(<MemoryRouter><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{el}</QueryClientProvider></MemoryRouter>))
}
beforeEach(() => rpc.mockReset())
afterEach(() => { if (root) act(() => root.unmount()); root = null; document.body.innerHTML = ''; vi.useRealTimers() })

describe('ticketAusQr', () => {
  it('nimmt nur Staccato-Tickets an', () => {
    expect(ticketAusQr(QR('a'))).toBe('a'.repeat(32))
    for (const x of ['https://example.com', 'staccato:raum:' + 'a'.repeat(32), 'staccato:ticket:kurz', 'staccato:ticket:' + 'g'.repeat(32), '', null]) expect(ticketAusQr(x)).toBeNull()
  })
})

describe('ticketScannen', () => {
  it('wiederholt bei Netzfehlern mit derselben Scan-ID', async () => {
    rpc.mockRejectedValueOnce(new Error('offline')).mockResolvedValueOnce({ data: null, error: { message: 'fetch failed' } }).mockResolvedValueOnce(antwort('ok'))
    expect((await ticketScannen('ev1', 'c', 'id1', 0)).ergebnis).toBe('ok')
    expect(rpc.mock.calls.map(c => c[1].p_scan_id)).toEqual(['id1', 'id1', 'id1'])
  })
  it('meldet fehlendes Netz und fehlende Freigabe', async () => {
    rpc.mockRejectedValue(new Error('offline'))
    expect((await ticketScannen('ev1', 'c', 'x', 0)).ergebnis).toBe('netz')
    rpc.mockReset().mockResolvedValue({ data: null, error: { code: '42501' } })
    expect((await ticketScannen('ev1', 'c', 'x', 0)).ergebnis).toBe('verboten')
    expect(rpc).toHaveBeenCalledTimes(1)
  })
})

describe('Scanner', () => {
  it('zeigt Grün, zählt mit und geht von selbst weiter; gleiches Ticket davor löst nicht erneut aus', async () => {
    vi.useFakeTimers()
    rpc.mockResolvedValue(antwort('ok'))
    await zeige(<Scanner ev={ev} onClose={() => {}} />)
    expect(text()).toContain('4 von 80 drin')
    await scanne(QR('a'))
    expect(text()).toContain('Willkommen!')
    expect(text()).toContain('5 von 80 drin')
    await scanne(QR('b'))                                 // während der Anzeige ignoriert
    await act(async () => vi.advanceTimersByTime(1900))
    expect(text()).not.toContain('Willkommen!')
    await scanne(QR('a'))
    expect(rpc).toHaveBeenCalledTimes(1)
    await scanne(QR('b'))
    expect(rpc).toHaveBeenCalledTimes(2)
  })
  it('bleibt bei Rot stehen, bis jemand auf Weiter tippt', async () => {
    vi.useFakeTimers()
    rpc.mockResolvedValue(antwort('schon_eingeloest', { eingeloest_am: '2099-12-12T17:02:00Z' }))
    await zeige(<Scanner ev={ev} onClose={() => {}} />)
    await scanne(QR('a'))
    await act(async () => vi.advanceTimersByTime(10000))
    expect(text()).toContain('Schon benutzt')
    expect(text()).toContain('um 18:02')
    await act(async () => knopf('Weiter').click())
    expect(text()).not.toContain('Schon benutzt')
  })
  it('lehnt fremde QR-Codes ohne Serveranfrage ab', async () => {
    await zeige(<Scanner ev={ev} onClose={() => {}} />)
    await scanne('https://example.com')
    expect(text()).toContain('Kein gültiges Ticket')
    expect(rpc).not.toHaveBeenCalled()
  })
  it('nennt bei falscher Veranstaltung die richtige', async () => {
    rpc.mockResolvedValue(antwort('falsche_veranstaltung', { event_titel: 'Chorabend' }))
    await zeige(<Scanner ev={ev} onClose={() => {}} />)
    await scanne(QR('a'))
    expect(text()).toContain('Falsche Veranstaltung')
    expect(text()).toContain('Chorabend')
  })
})

describe('Einlass', () => {
  it('führt bei einer Veranstaltung direkt zum Scannen', async () => {
    rpc.mockResolvedValue({ data: [ev], error: null })
    await zeige(<Einlass />)
    await act(() => new Promise(r => setTimeout(r, 20)))
    expect(text()).toContain('von 80 sind drin')
    expect(knopf('Tickets scannen')).toBeTruthy()
  })
  it('zeigt ohne Freigabe nichts zum Scannen', async () => {
    rpc.mockResolvedValue({ data: [], error: null })
    await zeige(<Einlass />)
    await act(() => new Promise(r => setTimeout(r, 20)))
    expect(text()).toContain('Keine Veranstaltung zum Scannen')
  })
})
