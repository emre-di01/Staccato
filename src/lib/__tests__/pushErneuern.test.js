import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { aboAktuell, pushErneuern, urlBase64ToUint8Array } from '../pushErneuern'

const ALT = 'AQID', NEU = 'BAUG'
const abo = (key, endpoint) => ({ endpoint, options: { applicationServerKey: urlBase64ToUint8Array(key).buffer }, getKey: () => new Uint8Array([1]).buffer, unsubscribe: vi.fn(async () => { aktuell = null; return true }) })
let aktuell, subscribe, upsert, geloescht, zeile

const db = { from: () => ({
  select: () => ({ eq: () => ({ eq: () => ({ maybeSingle: async () => ({ data: zeile }) }) }) }),
  upsert, delete: () => ({ eq: () => ({ eq: async (_s, e) => { geloescht.push(e) } }) }),
}) }

beforeEach(() => {
  aktuell = abo(ALT, 'alt'); geloescht = []; zeile = { id: 1 }
  subscribe = vi.fn(async () => (aktuell = abo(NEU, 'neu')))
  upsert = vi.fn(async () => ({ error: null })); db.from = (f => () => ({ ...f(), upsert }))(db.from)
  vi.stubGlobal('Notification', { permission: 'granted' })
  vi.stubGlobal('PushManager', class {})
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { ready: Promise.resolve({ pushManager: { getSubscription: async () => aktuell, subscribe } }) } })
})
afterEach(() => { vi.unstubAllGlobals(); delete navigator.serviceWorker })

describe('Push-Abo erneuern', () => {
  it('erkennt einen alten Schlüssel', () => {
    expect(aboAktuell(abo(ALT, 'x'), ALT)).toBe(true)
    expect(aboAktuell(abo(ALT, 'x'), NEU)).toBe(false)
    expect(aboAktuell({ options: {} }, NEU)).toBe(true)
  })
  it('erneuert und entfernt die alte Adresse', async () => {
    expect(await pushErneuern(db, 'u1', NEU)).toBe(true)
    expect(upsert.mock.calls[0][0]).toMatchObject({ user_id: 'u1', endpoint: 'neu', platform: 'web' })
    expect(geloescht).toEqual(['alt'])
  })
  it('tut nichts bei aktuellem Schlüssel, fremdem Abo oder ohne Erlaubnis', async () => {
    expect(await pushErneuern(db, 'u1', ALT)).toBe(false)
    zeile = null
    expect(await pushErneuern(db, 'u1', NEU)).toBe(false)
    zeile = { id: 1 }; Notification.permission = 'denied'
    expect(await pushErneuern(db, 'u1', NEU)).toBe(false)
    expect(subscribe).not.toHaveBeenCalled()
  })
})
