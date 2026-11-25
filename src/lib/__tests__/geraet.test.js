// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { geraetLeeren, pushAbmelden } from '../geraet'
import { queryClient } from '../queryClient'
import { aufteilen, profilSpeichern } from '../bankdaten'
import { readFileSync } from 'fs'

describe('geraetLeeren', () => {
  afterEach(() => { delete globalThis.caches })
  it('verwirft geladene Daten und alte Zwischenspeicher, das Programm bleibt', async () => {
    const weg = []
    globalThis.caches = { keys: async () => ['workbox-precache-v2-x', 'supabase-data', 'supabase-storage'], delete: async n => weg.push(n) }
    queryClient.setQueryData(['x'], 'geheim')
    sessionStorage.setItem('staccato_nach_login', '/admin/mitglieder')
    await geraetLeeren()
    expect(queryClient.getQueryData(['x'])).toBeUndefined()
    expect(sessionStorage.getItem('staccato_nach_login')).toBeNull()
    expect(weg).toEqual(['supabase-data', 'supabase-storage'])
  })
  it('geht auch ohne Cache-Schnittstelle', async () => { await expect(geraetLeeren()).resolves.toBeUndefined() })
})

describe('pushAbmelden', () => {
  let unsubscribe, geloescht
  const sb = { from: () => ({ delete: () => ({ eq: (...a) => ({ eq: (...b) => { geloescht.push([a, b]); return Promise.resolve({}) } }) }) }) }
  beforeEach(() => {
    unsubscribe = vi.fn(async () => true); geloescht = []
    window.PushManager = function () {}
    Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: async () => ({ pushManager: { getSubscription: async () => ({ endpoint: 'e1', unsubscribe }) } }) } })
  })
  afterEach(() => { delete navigator.serviceWorker; delete window.PushManager })
  it('beendet das Abo dieses Browsers', async () => {
    await pushAbmelden(sb, 'ich')
    expect(geloescht).toEqual([[['user_id', 'ich'], ['endpoint', 'e1']]])
    expect(unsubscribe).toHaveBeenCalled()
  })
  it('hält das Abmelden nie auf', async () => {
    await expect(pushAbmelden({ from: () => { throw new Error('offline') } }, 'ich')).resolves.toBeUndefined()
    await expect(pushAbmelden(sb, null)).resolves.toBeUndefined()
  })
})

describe('Bankdaten', () => {
  it('werden vom Profil getrennt', () => {
    expect(aufteilen({ telefon: '1', iban: null, mitgliedsbeitrag: 5 })).toEqual({ profil: { telefon: '1' }, bank: { iban: null, mitgliedsbeitrag: 5 } })
  })
  it('gehen nur an bankdaten_setzen, auch beim Löschen', async () => {
    const update = vi.fn(() => ({ eq: async () => ({ error: null }) })), rpc = vi.fn(async () => ({ error: null }))
    expect(await profilSpeichern({ from: () => ({ update }), rpc }, 'p', { telefon: '1', iban: null })).toBeNull()
    expect(update).toHaveBeenCalledWith({ telefon: '1' })
    expect(rpc).toHaveBeenCalledWith('bankdaten_setzen', { p_profil: 'p', p_daten: { iban: null } })
  })
  it('melden Fehler', async () => {
    const e = { message: 'nein' }
    expect(await profilSpeichern({ rpc: async () => ({ error: e }) }, 'p', { iban: 'x' })).toBe(e)
  })
})

it('Service Worker speichert keine API-Antworten', () => {
  const sw = readFileSync('src/sw.js', 'utf8')
  expect(sw).not.toMatch(/registerRoute|NetworkFirst|CacheFirst/)
  expect(sw).toContain("'supabase-data', 'supabase-storage'")
})
