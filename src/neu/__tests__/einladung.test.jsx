// @vitest-environment jsdom
import { describe, it, expect, vi, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import { t } from '../../i18n/translations'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const sb = vi.hoisted(() => ({ rpc: vi.fn(), invoke: vi.fn() }))
vi.mock('../../lib/supabase', () => ({ supabase: { rpc: sb.rpc, functions: { invoke: sb.invoke } } }))
const toast = vi.fn()
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ T: k => t('de', k), toast }) }))
const { EinladungModal } = await import('../../pages/admin/Mitgliederverwaltung')

let root
const text = () => document.body.textContent
const knopf = n => [...document.querySelectorAll('button')].find(b => b.textContent.includes(n))
async function einladen(mailErgebnis) {
  sb.rpc.mockResolvedValue({ data: { action: 'einladung_erstellt', token: 'tok', email: 'a@b.de' }, error: null })
  sb.invoke.mockResolvedValue(mailErgebnis)
  root = createRoot(document.body.appendChild(document.createElement('div')))
  await act(async () => root.render(<EinladungModal onClose={() => {}} T={k => t('de', k)} />))
  const feld = document.querySelector('input[type=email]')
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(feld, 'a@b.de')
    feld.dispatchEvent(new Event('input', { bubbles: true }))
  })
  await act(async () => knopf(t('de', 'invitation_send')).click())
}
afterEach(() => { act(() => root.unmount()); document.body.innerHTML = ''; delete navigator.share })

describe('EinladungModal', () => {
  it('meldet Erfolg nur, wenn die Mail wirklich rausging', async () => {
    await einladen({ data: { ok: true }, error: null })
    expect(text()).toContain('Einladung versendet!')
    expect(sb.invoke).toHaveBeenCalledWith('send-email', { body: { type: 'schuleinladung', token: 'tok' } })
  })
  it('sagt ehrlich, wenn die Mail scheitert, und bietet den Link an', async () => {
    navigator.share = vi.fn(async () => {})
    await einladen({ data: null, error: new Error('500') })
    expect(text()).not.toContain('Einladung versendet!')
    expect(text()).toContain('konnte aber nicht gesendet werden')
    knopf('Link selbst verschicken').click()
    expect(navigator.share.mock.calls[0][0].url).toMatch(/\/einladung\/tok$/)
  })
})
