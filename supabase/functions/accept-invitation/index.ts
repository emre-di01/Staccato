import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: { token: string; voller_name: string; passwort: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS })
  }

  const { token, voller_name, passwort } = body

  if (!token || !voller_name?.trim() || !passwort) {
    return new Response(JSON.stringify({ error: 'Missing fields' }), { status: 400, headers: CORS })
  }

  if (passwort.length < 6) {
    return new Response(JSON.stringify({ error: 'Passwort muss mindestens 6 Zeichen haben.' }), { status: 400, headers: CORS })
  }

  // Einladung laden
  const { data: einladung, error: loadErr } = await supabase
    .from('schul_einladungen')
    .select('id, email, schule_id, rolle, status, ablauf_am')
    .eq('token', token)
    .single()

  if (loadErr || !einladung) {
    return new Response(JSON.stringify({ error: 'Einladung nicht gefunden.' }), { status: 404, headers: CORS })
  }
  if (einladung.status !== 'offen') {
    return new Response(JSON.stringify({ error: 'Einladung bereits verwendet.' }), { status: 400, headers: CORS })
  }
  if (new Date(einladung.ablauf_am) < new Date()) {
    return new Response(JSON.stringify({ error: 'Einladung abgelaufen.' }), { status: 400, headers: CORS })
  }

  // Auth-User anlegen
  const { data: { user }, error: createErr } = await supabase.auth.admin.createUser({
    email: einladung.email,
    password: passwort,
    email_confirm: true,
    user_metadata: {
      voller_name: voller_name.trim(),
      rolle:       einladung.rolle,
      schule_id:   einladung.schule_id,
    },
  })

  if (createErr || !user) {
    const msg = (createErr?.message ?? '').toLowerCase()
    if (msg.includes('already') || msg.includes('registered') || msg.includes('exists')) {
      return new Response(JSON.stringify({
        error:   'already_exists',
        message: 'Diese E-Mail hat bereits ein Konto. Bitte melde dich an und nutze den Einladungslink erneut.',
      }), { status: 409, headers: CORS })
    }
    return new Response(JSON.stringify({ error: createErr?.message ?? 'Fehler beim Anlegen.' }), { status: 500, headers: CORS })
  }

  // Profil anlegen/aktualisieren — upsert statt update, damit auch dann ein
  // Profil entsteht, wenn der handle_new_user-Trigger nicht gefeuert hat.
  await supabase.from('profiles').upsert({
    id:               user.id,
    voller_name:      voller_name.trim(),
    rolle:            einladung.rolle,
    schule_id:        einladung.schule_id,
    letzte_schule_id: einladung.schule_id,
  }, { onConflict: 'id' })

  // Mitgliedschaft anlegen
  await supabase.from('schul_mitgliedschaften').upsert({
    user_id:   user.id,
    schule_id: einladung.schule_id,
    rolle:     einladung.rolle,
  }, { onConflict: 'user_id,schule_id' })

  // Einladung als angenommen markieren
  await supabase.from('schul_einladungen').update({ status: 'angenommen' }).eq('id', einladung.id)

  return new Response(JSON.stringify({ ok: true, email: einladung.email }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})
