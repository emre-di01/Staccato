import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
vi.mock('../../context/AppContext', () => ({ useApp: () => ({}) }))
const { betragAus, einstellungenAusFormular, preisBerechnen, aktiveBestellungen, bestellungenAuswerten } = await import('../tickets')

const basis = {
  aktiv: true, kapazitaet: '200', preis_normal: '15', ermaessigt: true, preis_verguenstigt: '8,50', preis_abendkasse: '', kontingent: '3', obergrenze: '10',
  verkauf_von: '', verkauf_bis: '', frist_tage: '7', bis_abendkasse: false, freigabe_minuten: '30',
}
const fehler = teil => einstellungenAusFormular({ ...basis, ...teil }).fehler

describe('betragAus', () => {
  it('liest Komma und Punkt', () => {
    expect(betragAus('12,50')).toBe(12.5)
    expect(betragAus('12.5')).toBe(12.5)
    expect(betragAus(' 0 ')).toBe(0)
  })
  it('leer ist null, Unsinn ist NaN', () => {
    expect(betragAus('')).toBeNull()
    for (const s of ['-1', '1,234', 'abc', '1.000,00']) expect(betragAus(s)).toBeNaN()
  })
})

describe('einstellungenAusFormular', () => {
  it('liefert Werte für die Datenbank', () => {
    expect(einstellungenAusFormular(basis).werte).toMatchObject({
      aktiv: true, kapazitaet: 200, preis_normal: 15, preis_verguenstigt: 8.5, kontingent: 3, obergrenze: 10,
      verkauf_von: null, verkauf_bis: null, frist_tage: 7, bis_abendkasse: false, freigabe_minuten: 30,
    })
  })
  it('ohne Vergünstigung kein Kontingent', () => {
    expect(einstellungenAusFormular({ ...basis, ermaessigt: false, preis_verguenstigt: 'x' }).werte).toMatchObject({ preis_verguenstigt: null, kontingent: 0 })
  })
  it('Abendkassenpreis: leer, gleich oder höher als normal', () => {
    expect(einstellungenAusFormular(basis).werte.preis_abendkasse).toBeNull()
    expect(einstellungenAusFormular({ ...basis, preis_abendkasse: '15' }).werte.preis_abendkasse).toBe(15)
    expect(einstellungenAusFormular({ ...basis, preis_abendkasse: '18,50' }).werte.preis_abendkasse).toBe(18.5)
    expect(fehler({ preis_abendkasse: '10' })).toBe('tk_fehler_abendkasse')
    expect(fehler({ preis_abendkasse: 'x' })).toBe('tk_fehler_preis')
  })
  it('lehnt ungültige Angaben ab', () => {
    expect(fehler({ kapazitaet: '0' })).toBe('tk_fehler_kapazitaet')
    expect(fehler({ preis_normal: '' })).toBe('tk_fehler_preis')
    expect(fehler({ preis_verguenstigt: '20' })).toBe('tk_fehler_verguenstigt')
    expect(fehler({ kontingent: '0' })).toBe('tk_fehler_kontingent')
    expect(fehler({ obergrenze: '2' })).toBe('tk_fehler_kontingent_grenze')
    expect(fehler({ verkauf_von: '2026-12-02T10:00', verkauf_bis: '2026-12-01T10:00' })).toBe('tk_fehler_zeitraum')
    expect(fehler({ frist_tage: '0' })).toBe('tk_fehler_frist')
    expect(fehler({ bis_abendkasse: true, freigabe_minuten: '' })).toBe('tk_fehler_freigabe')
  })
})

describe('preisBerechnen', () => {
  const info = { rest_verguenstigt: 3, preis_verguenstigt: 8.1, preis_normal: 15.35 }
  it('rechnet zuerst vergünstigt, dann normal', () => {
    expect(preisBerechnen(info, 2)).toEqual({ verguenstigt: 2, normal: 0, betrag: 16.2 })
    expect(preisBerechnen(info, 5)).toEqual({ verguenstigt: 3, normal: 2, betrag: 55 })
  })
  it('ohne Vergünstigung', () => {
    expect(preisBerechnen({ rest_verguenstigt: 0, preis_verguenstigt: null, preis_normal: 10 }, 3)).toEqual({ verguenstigt: 0, normal: 3, betrag: 30 })
  })
  it('keine Rundungsfehler', () => {
    expect(preisBerechnen({ rest_verguenstigt: 3, preis_verguenstigt: 0.1, preis_normal: 1 }, 3).betrag).toBe(0.3)
  })
})

describe('aktiveBestellungen', () => {
  const jetzt = new Date('2026-12-01T12:00:00Z').getTime()
  const t = (status, preis = 8) => ({ status, preis })
  it('lässt verfallene, abgelaufene und stornierte weg', () => {
    const liste = aktiveBestellungen([
      { id: 1, status: 'reserviert', frist: '2026-12-02T12:00:00Z', tickets: [t('reserviert'), t('reserviert', 15)] },
      { id: 2, status: 'reserviert', frist: '2026-12-01T11:59:00Z', tickets: [t('reserviert')] },
      { id: 3, status: 'verfallen', frist: '2026-11-01T12:00:00Z', tickets: [t('verfallen')] },
      { id: 4, status: 'bezahlt', frist: null, tickets: [t('gueltig'), t('storniert')] },
      { id: 5, status: 'bezahlt', frist: null, tickets: [t('storniert')] },
    ], jetzt)
    expect(liste.map(b => [b.id, b.anzahl, b.betrag])).toEqual([[1, 2, 23], [4, 1, 8]])
  })
})

describe('bestellungenAuswerten', () => {
  const jetzt = new Date('2026-12-01T12:00:00Z').getTime()
  const t = (status, preis) => ({ id: `${status}${preis}`, status, preis })
  const { liste, stand } = bestellungenAuswerten([
    { id: 'offen', status: 'reserviert', frist: '2026-12-02T00:00:00Z', tickets: [t('reserviert', 8), t('storniert', 15)], ticket_zahlungen: [] },
    { id: 'abgelaufen', status: 'reserviert', frist: '2026-11-30T00:00:00Z', tickets: [t('reserviert', 8)], ticket_zahlungen: [] },
    { id: 'teil', status: 'bezahlt', tickets: [t('gueltig', 8), t('eingeloest', 8), t('storniert', 15)], ticket_zahlungen: [{ betrag: 31, ticket_erstattungen: [{ betrag: 10 }] }] },
    { id: 'vorher', status: 'bezahlt', tickets: [t('gueltig', 8), t('storniert', 15)], ticket_zahlungen: [{ betrag: 8, ticket_erstattungen: [] }] },
    { id: 'gratis', status: 'storniert', tickets: [t('storniert', 0)], ticket_zahlungen: [] },
  ], jetzt)
  const b = id => liste.find(x => x.id === id)

  it('ordnet Zustand und Filtergruppe zu', () => {
    expect(liste.map(x => [x.id, x.zustand, x.gruppe])).toEqual([
      ['offen', 'reserviert', 'offen'], ['abgelaufen', 'verfallen', 'erledigt'], ['teil', 'bezahlt', 'bezahlt'],
      ['vorher', 'bezahlt', 'bezahlt'], ['gratis', 'storniert', 'erledigt']])
  })
  it('rechnet nur laufende Tickets', () => {
    expect([b('offen').anzahl, b('offen').betrag]).toEqual([1, 8])
    expect([b('teil').anzahl, b('teil').betrag]).toEqual([2, 16])
  })
  it('erstattbar: nur was bezahlt, storniert und noch nicht erstattet ist', () => {
    expect(b('teil').erstattbar).toBe(5)
    expect(b('vorher').erstattbar).toBe(0)
    expect(b('offen').erstattbar).toBe(0)
  })
  it('Gesamtstand', () => {
    expect(stand).toEqual({ gueltig: 3, reserviert: 1, eingenommen: 29, erstattet: 10 })
  })
})
