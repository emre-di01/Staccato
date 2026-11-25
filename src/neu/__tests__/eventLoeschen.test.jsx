// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { t } from '../../i18n/translations'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const h = vi.hoisted(() => ({ rpc: null, geloescht: [], confirm: null, toast: null, scan: [] }))
vi.mock('../../lib/supabase', () => {
  const tabelle = name => {
    const q = { select: () => q, eq: () => q, neq: () => q, delete: () => { h.geloescht.push(name); return q }, then: ok => ok({ data: [], error: null, count: 0 }) }
    return q
  }
  return { supabase: { from: tabelle, storage: { from: () => ({ remove: async () => ({}) }) }, rpc: (...a) => h.rpc(...a) } }
})
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ T: k => t('de', k), lang: 'de', rolle: 'admin', profil: { id: 'ich' }, schule: { id: 's' }, toast: h.toast, confirm: h.confirm }) }))
const { useEventLoeschen } = await import('../eventLoeschen')
const { default: EinlassStart } = await import('../einlass/EinlassStart')

let root, loeschen
function Huelle() { loeschen = useEventLoeschen(); return null }
async function zeige(el) {
  root = createRoot(document.body.appendChild(document.createElement('div')))
  await act(async () => root.render(<MemoryRouter initialEntries={['/admin']}><QueryClientProvider client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}>{el}</QueryClientProvider></MemoryRouter>))
  await act(() => new Promise(r => setTimeout(r, 20)))
}
beforeEach(() => { h.geloescht = []; h.confirm = vi.fn(async () => true); h.toast = vi.fn() })
afterEach(() => { act(() => root.unmount()); document.body.innerHTML = '' })
const mit = (hatTickets, antwort) => { h.rpc = vi.fn(async (name) => ({ data: name === 'event_hat_tickets' ? hatTickets : antwort, error: null })) }

describe('useEventLoeschen', () => {
  it('ohne Bestellungen wie bisher', async () => {
    mit(false); await zeige(<Huelle />)
    expect(await loeschen({ id: 'e' })).toBe(true)
    expect(h.geloescht).toContain('events')
  })
  it('bezahlt: weist auf die Belege hin und nutzt event_loeschen', async () => {
    mit(true, { ok: true, art: 'ausblenden' }); await zeige(<Huelle />)
    expect(await loeschen({ id: 'e' })).toBe(true)
    expect(h.confirm.mock.calls[0][1].sub).toBe(t('de', 'tk_loeschen_bezahlt'))
    expect(h.rpc).toHaveBeenLastCalledWith('event_loeschen', { p_event_id: 'e' })
    expect(h.geloescht).toEqual([])
  })
  it('noch nicht vorbei: Meldung, keine Rückfrage', async () => {
    mit(true, { ok: false, grund: 'nicht_vorbei' }); await zeige(<Huelle />)
    expect(await loeschen({ id: 'e' })).toBe(false)
    expect(h.toast).toHaveBeenCalledWith(t('de', 'tk_loeschen_nicht_vorbei'), 'error')
    expect(h.confirm).not.toHaveBeenCalled()
  })
  it('Abbrechen löscht nichts', async () => {
    mit(true, { ok: true, art: 'endgueltig' }); h.confirm = vi.fn(async () => false); await zeige(<Huelle />)
    expect(await loeschen({ id: 'e' })).toBe(false)
    expect(h.rpc).not.toHaveBeenCalledWith('event_loeschen', { p_event_id: 'e' })
  })
})

it('Startseite zeigt eine vergangene Veranstaltung nicht mehr zum Scannen', async () => {
  const ev = (id, titel, bis) => ({ id, titel, scanbar: true, beginn: '2026-01-01T10:00:00Z', bis })
  h.rpc = async name => ({ data: name === 'meine_scan_events' ? [ev('1', 'Vorbei', new Date(Date.now() - 60000).toISOString()), ev('2', 'Läuft', new Date(Date.now() + 3600000).toISOString())] : [], error: null })
  await zeige(<EinlassStart />)
  expect(document.body.textContent).toContain('Läuft')
  expect(document.body.textContent).not.toContain('Vorbei')
})
