import { describe, it, expect } from 'vitest'
import { t, translations } from '../translations'

describe('t()', () => {
  it('gibt deutschen Text zurück', () => {
    expect(t('de', 'app_name')).toBe('Staccato')
  })

  it('fällt auf Deutsch zurück wenn Sprache fehlt', () => {
    expect(t('en', 'app_name')).toBe('Staccato')
    expect(t('tr', 'app_name')).toBe('Staccato')
  })

  it('gibt den Key zurück wenn kein Eintrag existiert', () => {
    expect(t('de', 'niemals_definierter_key')).toBe('niemals_definierter_key')
    expect(t('en', 'auch_nicht_vorhanden')).toBe('auch_nicht_vorhanden')
  })

  it('gibt deutschen Text zurück für unbekannte Sprache', () => {
    expect(t('zz', 'app_name')).toBe('Staccato')
  })

  it('alle deutschen Keys haben einen Wert', () => {
    const deKeys = Object.keys(translations.de)
    for (const key of deKeys) {
      expect(typeof translations.de[key]).toBe('string')
      expect(translations.de[key].length).toBeGreaterThan(0)
    }
  })

  it('jeder englische Key hat auch einen deutschen Fallback', () => {
    if (!translations.en) return
    for (const key of Object.keys(translations.en)) {
      expect(translations.de[key]).toBeDefined()
    }
  })

  it('gibt leere Strings bei leerem Key nicht als undefined zurück', () => {
    const result = t('de', '')
    expect(result).toBeDefined()
  })
})
