import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const INTERNAL_SECRET = Deno.env.get('INTERNAL_SECRET') ?? ''
const BP_URL = 'http://host.docker.internal:9876/analyse'

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })

  try {
    const { youtube_url } = await req.json()
    if (!youtube_url) {
      return new Response(JSON.stringify({ error: 'youtube_url fehlt' }), {
        status: 400, headers: { ...CORS, 'Content-Type': 'application/json' },
      })
    }

    const res = await fetch(BP_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${INTERNAL_SECRET}`,
      },
      body: JSON.stringify({ youtube_url }),
    })

    const data = await res.json()
    return new Response(JSON.stringify(data), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (e: any) {
    return new Response(JSON.stringify({ error: e.message }), {
      status: 500, headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  }
})
