// @vitest-environment jsdom
import { it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { t } from '../../i18n/translations'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
window.matchMedia = () => ({ matches: true, addEventListener() {}, removeEventListener() {} })
const ev = { id: 'ev1', titel: 'Winterkonzert', typ: 'konzert', beginn: '2099-12-12T18:00:00Z', oeffentlich: true, event_teilnehmer: [], event_stuecke: [] }
const einst = { event_id: 'ev1', aktiv: true, kapazitaet: 200, preis_normal: 15 }
vi.mock('../../lib/supabase', () => {
  const tabelle = name => {
    let einzeln = false
    const q = { select: () => q, eq: () => q, gte: () => q, lte: () => q, order: () => q, range: () => q, maybeSingle: () => { einzeln = true; return q },
      then: ok => ok({ error: null, data: name === 'events' ? [ev] : name === 'ticket_einstellungen' ? (einzeln ? einst : [einst]) : [] }) }
    return q
  }
  return { supabase: { from: tabelle, rpc: async () => ({ data: { ok: true, frei: 5, max: 5, rest_verguenstigt: 0, preis_normal: 15 }, error: null }) } }
})
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ T: k => t('de', k), lang: 'de', zeitzone: 'Europe/Berlin', profil: { id: 'ich' }, schule: { id: 's' }, rolle: 'admin', toast() {}, confirm: async () => true }) }))
const { default: AdminEvents } = await import('../admin/Events')
let root
const bis = async (f, ms = 4000) => { const ende = Date.now() + ms; while (!f() && Date.now() < ende) await act(() => new Promise(r => setTimeout(r, 25))); return f() }
afterEach(() => { act(() => root.unmount()); document.body.innerHTML = '' })

it('Admins können in Verwaltung → Events für sich reservieren', async () => {
  root = createRoot(document.body.appendChild(document.createElement('div')))
  await act(async () => root.render(<MemoryRouter><QueryClientProvider client={new QueryClient()}><AdminEvents /></QueryClientProvider></MemoryRouter>))
  const knopf = await bis(() => [...document.querySelectorAll('button')].find(b => b.textContent === 'Tickets reservieren'))
  expect(knopf).toBeTruthy()
  await act(async () => knopf.click())
  expect(await bis(() => document.body.textContent.includes('Wie viele Tickets?'))).toBe(true)
})
