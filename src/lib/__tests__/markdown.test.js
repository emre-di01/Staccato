import { describe, it, expect } from 'vitest'
import { safeMarkdown } from '../markdown'

describe('safeMarkdown', () => {
  it('konvertiert Markdown zu HTML', () => {
    const result = safeMarkdown('# Titel')
    expect(result).toContain('<h1>')
    expect(result).toContain('Titel')
  })

  it('rendert fetten und kursiven Text', () => {
    expect(safeMarkdown('**fett**')).toContain('<strong>')
    expect(safeMarkdown('*kursiv*')).toContain('<em>')
  })

  it('rendert Blockquotes', () => {
    expect(safeMarkdown('> Refrain')).toContain('<blockquote>')
  })

  it('bereinigt gefährliche XSS-Inhalte', () => {
    const result = safeMarkdown('<script>alert("xss")</script>')
    expect(result).not.toContain('<script>')
    expect(result).not.toContain('alert')
  })

  it('entfernt onclick-Attribute', () => {
    const result = safeMarkdown('<a href="x" onclick="evil()">Link</a>')
    expect(result).not.toContain('onclick')
  })

  it('behandelt leere Eingabe', () => {
    expect(safeMarkdown('')).toBeDefined()
    expect(safeMarkdown(null)).toBeDefined()
    expect(safeMarkdown(undefined)).toBeDefined()
  })

  it('rendert Horizontaltrennlinien (---)', () => {
    const result = safeMarkdown('---')
    expect(result).toContain('<hr')
  })

  it('rendert Zeilenumbrüche in Strophen', () => {
    const text = '### Strophe 1\nZeile 1\nZeile 2'
    const result = safeMarkdown(text)
    expect(result).toContain('<h3>')
    expect(result).toContain('Zeile 1')
    expect(result).toContain('Zeile 2')
  })
})
