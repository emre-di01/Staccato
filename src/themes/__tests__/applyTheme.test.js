import { describe, it, expect, beforeEach, vi } from 'vitest'
import { applyTheme, THEMES, THEME_KEYS } from '../themes'

beforeEach(() => {
  document.documentElement.removeAttribute('data-theme')
  document.documentElement.removeAttribute('data-mode')
  document.documentElement.removeAttribute('data-transitioning')
  document.documentElement.style.cssText = ''
  document.getElementById('staccato-theme-global')?.remove()
  vi.useFakeTimers()
})

describe('applyTheme — CSS-Variablen', () => {
  it('setzt --primary für klassik light', () => {
    applyTheme('klassik', false)
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#1a1410')
  })

  it('setzt --primary für klassik dark', () => {
    applyTheme('klassik', true)
    expect(document.documentElement.style.getPropertyValue('--primary')).toBe('#c9a84c')
  })

  it('setzt data-theme Attribut', () => {
    applyTheme('modern', false)
    expect(document.documentElement.getAttribute('data-theme')).toBe('modern')
  })

  it('setzt data-mode auf light/dark', () => {
    applyTheme('bold', false)
    expect(document.documentElement.getAttribute('data-mode')).toBe('light')
    applyTheme('bold', true)
    expect(document.documentElement.getAttribute('data-mode')).toBe('dark')
  })

  it('setzt data-transitioning und entfernt es nach 400ms', () => {
    applyTheme('klassik', false)
    expect(document.documentElement.hasAttribute('data-transitioning')).toBe(true)
    vi.advanceTimersByTime(400)
    expect(document.documentElement.hasAttribute('data-transitioning')).toBe(false)
  })

  it('tut nichts bei unbekanntem Theme', () => {
    applyTheme('klassik', false)
    const vorher = document.documentElement.getAttribute('data-theme')
    applyTheme('gibts-nicht', false)
    expect(document.documentElement.getAttribute('data-theme')).toBe(vorher)
  })
})

describe('applyTheme — alle Themes', () => {
  it('setzt --radius für jedes Theme ohne Fehler', () => {
    for (const key of THEME_KEYS) {
      applyTheme(key, false)
      expect(document.documentElement.style.getPropertyValue('--radius')).toBeTruthy()
      applyTheme(key, true)
      expect(document.documentElement.style.getPropertyValue('--radius')).toBeTruthy()
    }
  })

  it('liquid light injiziert globales CSS <style> Tag', () => {
    applyTheme('liquid', false)
    const styleEl = document.getElementById('staccato-theme-global')
    expect(styleEl).not.toBeNull()
    expect(styleEl.textContent).toContain('backdrop-filter')
  })

  it('klassik entfernt globales <style> Tag', () => {
    applyTheme('liquid', false)
    expect(document.getElementById('staccato-theme-global')).not.toBeNull()
    applyTheme('klassik', false)
    expect(document.getElementById('staccato-theme-global')).toBeNull()
  })

  it('jedes Theme hat --bg, --text, --primary, --radius', () => {
    const pflichtVars = ['--bg', '--text', '--primary', '--radius']
    for (const key of THEME_KEYS) {
      for (const mode of [false, true]) {
        applyTheme(key, mode)
        for (const v of pflichtVars) {
          expect(
            document.documentElement.style.getPropertyValue(v),
            `${key} ${mode ? 'dark' : 'light'} fehlt ${v}`
          ).toBeTruthy()
        }
      }
    }
  })
})
