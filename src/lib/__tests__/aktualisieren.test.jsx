// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { act } from 'react'
import { createRoot } from 'react-dom/client'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const app = vi.hoisted(() => ({ toast: vi.fn(), ladeProfil: vi.fn(async () => {}) }))
vi.mock('../../context/AppContext', () => ({ useApp: () => ({ T: k => k, toast: app.toast, ladeProfil: app.ladeProfil, session: { user: { id: 'ich' } } }) }))

let sw, root, invalidieren, m, Ziehen, sichtbarkeit, jetzt
const los = () => act(async () => { for (let i = 0; i < 5; i++) await Promise.resolve() })
const sichtbar = async s => { sichtbarkeit = s; document.dispatchEvent(new Event('visibilitychange')); await los() }
const touch = (typ, ziel, x, y) => act(async () => {
  const e = new Event(typ, { bubbles: true, cancelable: true })
  e.touches = typ === 'touchend' ? [] : [{ clientX: x, clientY: y }]
  ziel.dispatchEvent(e)
})
async function ziehe(ziel, dx, dy) {
  await touch('touchstart', ziel, 100, 100)
  await touch('touchmove', ziel, 100 + dx / 2, 100 + dy / 2)
  await touch('touchmove', ziel, 100 + dx, 100 + dy)
  await touch('touchend', ziel)
  await los()
}

beforeEach(async () => {
  vi.resetModules()
  app.toast.mockClear(); app.ladeProfil.mockClear()
  sessionStorage.clear()
  sichtbarkeit = 'visible'; jetzt = 1_000_000
  Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => sichtbarkeit })
  vi.spyOn(Date, 'now').mockImplementation(() => jetzt)
  vi.spyOn(globalThis, 'setInterval').mockReturnValue(0)
  globalThis.fetch = vi.fn(async () => ({ ok: true }))
  sw = Object.assign(new EventTarget(), { controller: {}, update: vi.fn(async () => {}), getRegistration: async () => ({ update: sw.update }) })
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: sw })
  window.history.replaceState(null, '', '/schueler')
  m = await import('../aktualisieren')
  const { queryClient } = await import('../queryClient')
  invalidieren = vi.spyOn(queryClient, 'invalidateQueries').mockResolvedValue()
  Ziehen = (await import('../../neu/ZiehenAktualisieren')).default
})
afterEach(() => { if (root) act(() => root.unmount()); root = null; document.body.innerHTML = ''; delete navigator.serviceWorker; vi.restoreAllMocks() })

describe('Zurückkehren in die App', () => {
  // Ein Aufruf je Modulinstanz; alte Instanzen hängen noch am document, stören aber nicht (eigener queryClient)
  const weg = async ms => { await sichtbar('hidden'); jetzt += ms; await sichtbar('visible') }
  it('lädt Daten nach und sucht eine neue Version', async () => {
    m.starteAktualisierung()
    await weg(60_000)
    expect(invalidieren).toHaveBeenCalledTimes(1)
    expect(sw.update).toHaveBeenCalled()
    const { predicate } = invalidieren.mock.calls[0][0]
    expect(predicate({ queryKey: ['n-kurse'] })).toBe(true)
    expect(predicate({ queryKey: ['n-event-bild', 'x'] })).toBe(false)
  })
  it('lässt kurze Wechsel in Ruhe', async () => {
    m.starteAktualisierung()
    await weg(3000)
    expect(invalidieren).not.toHaveBeenCalled()
  })
  it('behält die Daten, wenn der Server nicht antwortet', async () => {
    m.starteAktualisierung()
    globalThis.fetch = vi.fn(async () => { throw new TypeError('Load failed') })
    await weg(60_000)
    expect(invalidieren).not.toHaveBeenCalled()
  })
  it.each(['/kasse', '/einlass', '/beamer', '/session/ABC123', '/shop/schule', '/lehrer/kurse/1/unterrichtsmodus'])('stört %s nicht', async pfad => {
    m.starteAktualisierung()
    window.history.replaceState(null, '', pfad)
    await weg(60_000)
    expect(invalidieren).not.toHaveBeenCalled()
  })
})

describe('neue Version', () => {
  it('wird erkannt, die Erstinstallation nicht', () => {
    sw.controller = null
    m.starteAktualisierung()
    sw.dispatchEvent(new Event('controllerchange'))
    expect(m.versionBereit()).toBe(false)
    sw.dispatchEvent(new Event('controllerchange'))
    expect(m.versionBereit()).toBe(true)
  })
})

describe('Ziehen zum Aktualisieren', () => {
  async function zeige(aktiv = true) {
    const el = document.body.appendChild(document.createElement('div'))
    root = createRoot(el)
    await act(async () => root.render(<><main id="n-inhalt"><p id="text">Hallo</p><textarea id="feld" /></main><Ziehen aktiv={aktiv} /></>))
    return id => document.getElementById(id)
  }
  it('lädt bei genügend Zug Daten und Profil neu', async () => {
    const $ = await zeige()
    await ziehe($('text'), 0, 200)
    expect(invalidieren).toHaveBeenCalledTimes(1)
    expect(app.ladeProfil).toHaveBeenCalledWith('ich')
  })
  it('zu kurz, seitlich, nach oben oder im Textfeld: nichts', async () => {
    const $ = await zeige()
    await ziehe($('text'), 0, 80)
    await ziehe($('text'), 250, 200)
    await ziehe($('text'), 0, -200)
    await ziehe($('feld'), 0, 200)
    expect(invalidieren).not.toHaveBeenCalled()
  })
  it('nicht bei offenem Blatt, nicht wenn gescrollt, nicht wenn ausgeschaltet', async () => {
    const $ = await zeige()
    const blatt = document.body.appendChild(document.createElement('div'))
    blatt.setAttribute('role', 'dialog')
    await ziehe($('text'), 0, 200)
    blatt.remove()
    expect(m.ziehbar($('text'), 40)).toBe(false)
    act(() => root.unmount()); document.body.innerHTML = ''
    const $2 = await zeige(false)
    await ziehe($2('text'), 0, 200)
    expect(invalidieren).not.toHaveBeenCalled()
  })
  it('meldet fehlende Verbindung', async () => {
    globalThis.fetch = vi.fn(async () => ({ ok: false }))
    const $ = await zeige()
    await ziehe($('text'), 0, 200)
    expect(app.toast).toHaveBeenCalledWith('n_keine_verbindung', 'error')
    expect(app.ladeProfil).not.toHaveBeenCalled()
  })
})
