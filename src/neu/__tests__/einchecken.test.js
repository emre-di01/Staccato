import { describe, it, expect, vi } from 'vitest'

vi.mock('../../lib/supabase', () => ({ supabase: {} }))
const { checkinAusQr, raumQrInhalt } = await import('../einchecken')

describe('checkinAusQr', () => {
  it('erkennt Raum-Aufkleber', () => {
    const token = 'a1b2c3d4e5f60718293a4b5c6d7e8f90'
    expect(checkinAusQr(raumQrInhalt(token))).toEqual({ art: 'raum', token })
  })

  it('erkennt Beitritts-Link mit Einchecken-Token', () => {
    expect(checkinAusQr('https://app.staccato-music.de/session/abc123?ci=0123456789abcdef'))
      .toEqual({ art: 'stunde', token: '0123456789abcdef', code: 'ABC123' })
  })

  it('Beitritts-Link ohne Token ist nur Beitreten', () => {
    expect(checkinAusQr('https://app.staccato-music.de/session/ABC123')).toEqual({ art: 'session', code: 'ABC123' })
  })

  it('lehnt fremde Codes ab', () => {
    expect(checkinAusQr('https://example.com')).toBeNull()
    expect(checkinAusQr('staccato:raum:<script>')).toBeNull()
    expect(checkinAusQr('')).toBeNull()
  })
})
