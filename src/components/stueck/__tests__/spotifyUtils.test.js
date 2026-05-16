import { describe, it, expect } from 'vitest'
import { spotifyTrackId } from '../SpotifyModal'

describe('spotifyTrackId', () => {
  it('extrahiert Track-ID aus normaler URL', () => {
    expect(spotifyTrackId('https://open.spotify.com/track/4iV5W9uYEdYUVa79Axb7Rh')).toBe('4iV5W9uYEdYUVa79Axb7Rh')
  })

  it('extrahiert Track-ID aus URL mit Query-Parametern', () => {
    expect(spotifyTrackId('https://open.spotify.com/track/abc123XYZ?si=xyz')).toBe('abc123XYZ')
  })

  it('gibt null für Album-URL zurück', () => {
    expect(spotifyTrackId('https://open.spotify.com/album/abc123')).toBeNull()
  })

  it('gibt null für leere/falsche Eingabe zurück', () => {
    expect(spotifyTrackId('')).toBeNull()
    expect(spotifyTrackId(null)).toBeNull()
    expect(spotifyTrackId(undefined)).toBeNull()
    expect(spotifyTrackId('kein-link')).toBeNull()
  })
})
