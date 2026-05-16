import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const CLIENT_ID      = Deno.env.get('SPOTIFY_CLIENT_ID')      ?? ''
const CLIENT_SECRET  = Deno.env.get('SPOTIFY_CLIENT_SECRET')  ?? ''

// ── Spotify Token Cache ───────────────────────────────────────
let cachedToken = ''
let tokenExpiry = 0

async function getSpotifyToken(): Promise<string> {
  if (cachedToken && Date.now() < tokenExpiry) return cachedToken
  const res  = await fetch('https://accounts.spotify.com/api/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type:    'client_credentials',
      client_id:     CLIENT_ID,
      client_secret: CLIENT_SECRET,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error('Spotify-Token konnte nicht geholt werden')
  cachedToken = data.access_token
  tokenExpiry = Date.now() + (data.expires_in - 60) * 1000
  return cachedToken
}

// ── GetSongBPM key → deutsche Tonart ─────────────────────────
// API gibt z.B. "Am", "C", "F#m", "Bb", "Db" zurück
const KEY_MAP: Record<string, string> = {
  'C': 'C', 'C#': 'Cis', 'Db': 'Des', 'D': 'D', 'D#': 'Dis', 'Eb': 'Es',
  'E': 'E', 'F': 'F', 'F#': 'Fis', 'Gb': 'Ges', 'G': 'G', 'G#': 'Gis',
  'Ab': 'As', 'A': 'A', 'A#': 'Ais', 'Bb': 'B', 'B': 'H',
}

function bpmKeyZuTonart(key: string | null | undefined): string | null {
  if (!key) return null
  const moll  = key.endsWith('m')
  const basis = moll ? key.slice(0, -1) : key
  const de    = KEY_MAP[basis]
  if (!de) return null
  return moll ? `${de.toLowerCase()}-Moll` : `${de}-Dur`
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const url   = new URL(req.url)
    const q     = url.searchParams.get('q')

    // ── Spotify Track-Suche ────────────────────────────────────
    if (q) {
      const token = await getSpotifyToken()
      const res   = await fetch(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(q)}&type=track&limit=8`,
        { headers: { Authorization: `Bearer ${token}` } }
      )
      const data   = await res.json()
      const tracks = (data.tracks?.items ?? []).map((t: any) => ({
        id:     t.id,
        name:   t.name,
        artist: t.artists?.[0]?.name ?? '',
        album:  t.album?.name ?? '',
        cover:  t.album?.images?.[2]?.url ?? null,
      }))
      return new Response(JSON.stringify({ tracks }), {
        headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response('Bad Request', { status: 400, headers: CORS })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
