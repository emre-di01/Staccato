import { describe, it, expect } from 'vitest'
import {
  noteIndex,
  transponiereAkkord,
  transponiereText,
  aktuelleTonartenInfo,
  youtubeId,
  dateiIcon,
} from '../akkordeUtils'

// ─── noteIndex ────────────────────────────────────────────────

describe('noteIndex', () => {
  it('findet Sharp-Töne', () => {
    expect(noteIndex('C')).toBe(0)
    expect(noteIndex('C#')).toBe(1)
    expect(noteIndex('F#')).toBe(6)
    expect(noteIndex('B')).toBe(11)
  })

  it('findet Flat-Töne', () => {
    expect(noteIndex('Db')).toBe(1)
    expect(noteIndex('Eb')).toBe(3)
    expect(noteIndex('Bb')).toBe(10)
  })

  it('gibt -1 für unbekannte Töne zurück', () => {
    expect(noteIndex('X')).toBe(-1)
    expect(noteIndex('')).toBe(-1)
  })
})

// ─── transponiereAkkord ───────────────────────────────────────

describe('transponiereAkkord', () => {
  it('transponiert einfache Dur-Akkorde nach oben', () => {
    expect(transponiereAkkord('C', 2)).toBe('D')
    expect(transponiereAkkord('G', 1)).toBe('Ab')  // Ab bevorzugt gegenüber G#
    expect(transponiereAkkord('A', 2)).toBe('B')
  })

  it('transponiert einfache Akkorde nach unten', () => {
    expect(transponiereAkkord('D', -2)).toBe('C')
    expect(transponiereAkkord('C', -1)).toBe('B')
  })

  it('bevorzugt Flat-Schreibweise für bestimmte Tonarten', () => {
    expect(transponiereAkkord('E', 1)).toBe('F')
    expect(transponiereAkkord('F', 1)).toBe('Gb')   // nicht F#
    expect(transponiereAkkord('A', 1)).toBe('Bb')   // nicht A#
    expect(transponiereAkkord('D', 1)).toBe('Eb')   // nicht D#
  })

  it('behält Akkord-Suffix bei', () => {
    expect(transponiereAkkord('Am', 2)).toBe('Bm')
    expect(transponiereAkkord('Gmaj7', 1)).toBe('Abmaj7')  // Ab bevorzugt
    expect(transponiereAkkord('F#m7', 1)).toBe('Gm7')
    expect(transponiereAkkord('Cm7', -1)).toBe('Bm7')
  })

  it('Oktav-Wraparound funktioniert', () => {
    expect(transponiereAkkord('B', 1)).toBe('C')
    expect(transponiereAkkord('C', -1)).toBe('B')
    expect(transponiereAkkord('C', 12)).toBe('C')
    expect(transponiereAkkord('C', -12)).toBe('C')
  })

  it('gibt Akkord unverändert zurück bei ht=0', () => {
    expect(transponiereAkkord('Am7', 0)).toBe('Am7')
    expect(transponiereAkkord('Gbmaj9', 0)).toBe('Gbmaj9')
  })

  it('gibt Akkord unverändert zurück wenn kein Root erkannt', () => {
    expect(transponiereAkkord('N.C.', 3)).toBe('N.C.')
    expect(transponiereAkkord('/', 2)).toBe('/')
  })

  it('funktioniert mit Flat-Input', () => {
    expect(transponiereAkkord('Bb', 2)).toBe('C')
    expect(transponiereAkkord('Ebm', 1)).toBe('Em')
  })
})

// ─── transponiereText ─────────────────────────────────────────

describe('transponiereText', () => {
  it('transponiert alle Akkorde in eckigen Klammern', () => {
    const text = '[C]Hallo [G]Welt'
    expect(transponiereText(text, 2)).toBe('[D]Hallo [A]Welt')
  })

  it('lässt Text außerhalb der Klammern unverändert', () => {
    const text = '[Am]Strophe Text hier [C]noch mehr'
    const result = transponiereText(text, 0)
    expect(result).toBe(text)
  })

  it('gibt null/undefined unverändert zurück', () => {
    expect(transponiereText(null, 2)).toBe(null)
    expect(transponiereText(undefined, 2)).toBe(undefined)
  })

  it('gibt Text bei ht=0 unverändert zurück', () => {
    const text = '[C]Test [G]Text'
    expect(transponiereText(text, 0)).toBe(text)
  })

  it('transponiert mehrzeiligen Text', () => {
    const text = '[C]Zeile 1\n[G]Zeile 2\n[Am]Zeile 3'
    expect(transponiereText(text, 3)).toBe('[Eb]Zeile 1\n[Bb]Zeile 2\n[Cm]Zeile 3')
  })
})

// ─── aktuelleTonartenInfo ─────────────────────────────────────

describe('aktuelleTonartenInfo', () => {
  it('gibt Tonart-Info für erkannten ersten Akkord zurück', () => {
    expect(aktuelleTonartenInfo('[C]Text', 0)).toBe('C (+0 HT)')
    expect(aktuelleTonartenInfo('[G]Text', 2)).toBe('A (+2 HT)')
    expect(aktuelleTonartenInfo('[D]Text', -1)).toBe('Db (-1 HT)')  // Db bevorzugt
  })

  it('gibt null zurück wenn kein Akkord gefunden', () => {
    expect(aktuelleTonartenInfo('Kein Akkord hier', 0)).toBe(null)
    expect(aktuelleTonartenInfo('', 2)).toBe(null)
    expect(aktuelleTonartenInfo(null, 2)).toBe(null)
  })

  it('zeigt positives Vorzeichen für aufwärts-Transposition', () => {
    const info = aktuelleTonartenInfo('[C]Text', 5)
    expect(info).toMatch(/\+5 HT/)
  })

  it('zeigt negatives Vorzeichen für abwärts-Transposition', () => {
    const info = aktuelleTonartenInfo('[C]Text', -3)
    expect(info).toMatch(/-3 HT/)
  })
})

// ─── youtubeId ───────────────────────────────────────────────

describe('youtubeId', () => {
  it('extrahiert ID aus watch-URL', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extrahiert ID aus youtu.be-URL', () => {
    expect(youtubeId('https://youtu.be/dQw4w9WgXcQ')).toBe('dQw4w9WgXcQ')
  })

  it('extrahiert ID aus URL mit weiteren Parametern', () => {
    expect(youtubeId('https://www.youtube.com/watch?v=abc123&t=42')).toBe('abc123')
  })

  it('gibt undefined zurück für leere oder ungültige URLs', () => {
    expect(youtubeId('')).toBe(undefined)
    expect(youtubeId('https://vimeo.com/123456')).toBe(undefined)
    expect(youtubeId(null)).toBe(undefined)
    expect(youtubeId(undefined)).toBe(undefined)
  })
})

// ─── dateiIcon ────────────────────────────────────────────────

describe('dateiIcon', () => {
  it('gibt korrektes Icon für Dateitypen', () => {
    expect(dateiIcon('noten.pdf')).toBe('📄')
    expect(dateiIcon('lied.mp3')).toBe('🎵')
    expect(dateiIcon('probe.wav')).toBe('🎵')
    expect(dateiIcon('video.mp4')).toBe('🎬')
    expect(dateiIcon('bild.jpg')).toBe('🖼')
    expect(dateiIcon('archiv.zip')).toBe('🗜')
  })

  it('ist case-insensitiv', () => {
    expect(dateiIcon('Noten.PDF')).toBe('📄')
    expect(dateiIcon('Audio.MP3')).toBe('🎵')
  })

  it('gibt Fallback-Icon für unbekannte Typen', () => {
    expect(dateiIcon('datei.xyz')).toBe('📎')
    expect(dateiIcon('keinext')).toBe('📎')
    expect(dateiIcon('')).toBe('📎')
  })

  it('unterstützt alle Audio-Formate', () => {
    for (const ext of ['mp3', 'wav', 'ogg', 'm4a', 'aac', 'flac']) {
      expect(dateiIcon(`test.${ext}`)).toBe('🎵')
    }
  })
})
