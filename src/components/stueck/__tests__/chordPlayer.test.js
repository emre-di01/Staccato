import { describe, it, expect } from 'vitest'
import { akkordZuNoten } from '../ChordPlayer'

describe('akkordZuNoten', () => {
  it('gibt Dur-Dreiklang für einfache Akkorde zurück', () => {
    const noten = akkordZuNoten('C')
    expect(noten).toEqual(['C3', 'E3', 'G3'])
  })

  it('gibt Moll-Dreiklang zurück', () => {
    expect(akkordZuNoten('Am')).toEqual(['A3', 'C4', 'E4'])
    expect(akkordZuNoten('Em')).toEqual(['E3', 'G3', 'B3'])
  })

  it('gibt Septakkord-Töne zurück', () => {
    expect(akkordZuNoten('G7')).toHaveLength(4)
    expect(akkordZuNoten('Dm7')).toHaveLength(4)
    expect(akkordZuNoten('Cmaj7')).toHaveLength(4)
  })

  it('gibt leeres Array für unbekannten Root zurück', () => {
    expect(akkordZuNoten('X')).toEqual([])
    expect(akkordZuNoten('')).toEqual([])
    expect(akkordZuNoten('N.C.')).toEqual([])
  })

  it('verarbeitet Sharp-Akkorde korrekt', () => {
    const noten = akkordZuNoten('F#')
    expect(noten[0]).toBe('F#3')
    expect(noten).toHaveLength(3)
  })

  it('gibt Oktave 4 für Töne die über B3 hinausgehen', () => {
    const noten = akkordZuNoten('A')
    expect(noten[0]).toBe('A3')
    expect(noten[1]).toBe('C#4') // Terz springt in Oktave 4
  })

  it('dim7 hat 4 Töne im Abstand von 3 Halbtönen', () => {
    const noten = akkordZuNoten('Cdim7')
    expect(noten).toHaveLength(4)
  })

  it('aug hat übermäßige Quint', () => {
    const noten = akkordZuNoten('Caug')
    expect(noten).toHaveLength(3)
    expect(noten).toContain('G#3')
  })
})
