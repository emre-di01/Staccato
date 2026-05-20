import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LYRICA_URL = 'http://lyrica:9877'

function extractVideoId(url: string): string | null {
  return url?.match(/(?:v=|youtu\.be\/|embed\/)([A-Za-z0-9_-]{11})/)?.[1] ?? null
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { titel, komponist, youtube_url } = await req.json()

    let data: any = null

    // Direkt per YouTube video ID (genauer, kein Suchen nötig)
    if (youtube_url) {
      const videoId = extractVideoId(youtube_url)
      if (videoId) {
        const res = await fetch(`${LYRICA_URL}/lyrics/youtube?video_id=${videoId}`, {
          signal: AbortSignal.timeout(20000),
        })
        if (res.ok) data = await res.json()
      }
    }

    // Fallback: Titel + Interpret
    if (!data || data.status !== 'success' || !data.data?.lyrics) {
      if (!titel) {
        return new Response(JSON.stringify({ error: 'Titel oder YouTube-Link erforderlich.' }), {
          status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
        })
      }
      const params = new URLSearchParams({ song: titel, fast: 'true' })
      if (komponist) params.set('artist', komponist)
      const res = await fetch(`${LYRICA_URL}/lyrics/?${params}`, {
        signal: AbortSignal.timeout(20000),
      })
      if (res.ok) data = await res.json()
    }

    if (!data || data.status !== 'success' || !data.data?.lyrics) {
      return new Response(JSON.stringify({ error: 'Keine Lyrics gefunden.' }), {
        status: 404, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({
      lyrics:   data.data.lyrics,
      quelle:   data.data.source ?? 'unbekannt',
      artist:   data.data.artist,
      titel:    data.data.title,
    }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
