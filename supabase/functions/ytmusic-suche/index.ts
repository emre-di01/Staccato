import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const LYRICA_URL = 'http://lyrica:9877'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { q } = await req.json()
    if (!q) {
      return new Response(JSON.stringify({ error: 'q fehlt' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(`${LYRICA_URL}/search/youtube?q=${encodeURIComponent(q)}`, {
      signal: AbortSignal.timeout(20000),
    })
    const data = await res.json()

    if (data.status !== 'success') {
      return new Response(JSON.stringify({ error: 'Suche fehlgeschlagen.' }), {
        status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    return new Response(JSON.stringify({ tracks: data.tracks }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
