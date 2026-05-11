import { createClient } from 'jsr:@supabase/supabase-js@2'
import webpush from 'npm:web-push'

const VAPID_PUBLIC_KEY  = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT     = Deno.env.get('VAPID_SUBJECT')!
const APP_URL           = (Deno.env.get('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '')

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY)

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
)

function rolePfad(rolle: string): string {
  switch (rolle) {
    case 'lehrer':     return '/lehrer'
    case 'schueler':   return '/schueler'
    case 'admin':
    case 'superadmin': return '/admin'
    case 'eltern':     return '/eltern'
    case 'vorstand':   return '/vorstand'
    default:           return ''
  }
}

async function sendPushToRecipients(
  recipients: { id: string; url: string }[],
  title: string,
  body: string,
) {
  if (!recipients.length) return
  const urlMap = Object.fromEntries(recipients.map(r => [r.id, r.url]))

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth_key, user_id')
    .in('user_id', recipients.map(r => r.id))
  if (!subs?.length) { console.log('No push subscriptions found for users'); return }

  await Promise.allSettled(subs.map(async sub => {
    const url     = urlMap[sub.user_id] ?? APP_URL
    const payload = JSON.stringify({ title, body, url })
    try {
      await webpush.sendNotification(
        { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
        payload,
      )
      console.log('Push sent to', sub.user_id)
    } catch (err: unknown) {
      const status = (err as { statusCode?: number }).statusCode
      console.error('Push failed for', sub.user_id, status)
      if (status === 404 || status === 410) {
        await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
      }
    }
  }))
}

const CORS_HEADERS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, content-type' }

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS })
  }

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }
  const userClient = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_ANON_KEY')!,
    { global: { headers: { Authorization: authHeader } } },
  )
  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) {
    return new Response('Unauthorized', { status: 401, headers: CORS_HEADERS })
  }

  const payload = await req.json()

  // ── Neue Nachricht ──────────────────────────────────────────
  if (payload.nachricht_id) {
    const { data: msg } = await supabase
      .from('nachrichten')
      .select('typ, betreff, gesendet_von, empfaenger_id, kurs_id, schule_id')
      .eq('id', payload.nachricht_id)
      .single()
    if (!msg) return new Response('not found', { status: 404 })

    const { data: sender } = await supabase.from('profiles').select('voller_name').eq('id', msg.gesendet_von).single()

    let rawIds: string[] = []
    if (msg.typ === 'direkt' && msg.empfaenger_id) {
      rawIds = [msg.empfaenger_id]
    } else if (msg.typ === 'broadcast') {
      const { data } = await supabase.from('profiles').select('id').eq('schule_id', msg.schule_id).eq('aktiv', true).neq('id', msg.gesendet_von)
      rawIds = (data ?? []).map((p: { id: string }) => p.id)
    } else if (msg.typ === 'kurs' && msg.kurs_id) {
      const [{ data: schueler }, { data: lehrer }] = await Promise.all([
        supabase.from('unterricht_schueler').select('schueler_id').eq('unterricht_id', msg.kurs_id),
        supabase.from('unterricht_lehrer').select('lehrer_id').eq('unterricht_id', msg.kurs_id),
      ])
      rawIds = [
        ...(schueler ?? []).map((r: { schueler_id: string }) => r.schueler_id),
        ...(lehrer   ?? []).map((r: { lehrer_id:   string }) => r.lehrer_id),
      ].filter(id => id !== msg.gesendet_von)
    }

    const pushKey = msg.typ === 'broadcast' ? 'broadcast' : msg.typ === 'kurs' ? 'kurs' : 'new_message'
    const { data: prefs } = await supabase
      .from('profiles')
      .select('id, rolle, email_benachrichtigungen')
      .in('id', rawIds)
    const recipients = (prefs ?? [])
      .filter((p: { email_benachrichtigungen: Record<string, unknown> | null }) => {
        const push = p.email_benachrichtigungen?.push as Record<string, boolean> | undefined
        return push?.[pushKey] !== false
      })
      .map((p: { id: string; rolle: string }) => ({
        id: p.id,
        url: APP_URL + rolePfad(p.rolle) + '/nachrichten?id=' + payload.nachricht_id,
      }))

    await sendPushToRecipients(recipients, msg.betreff, `von ${sender?.voller_name ?? 'Staccato'}`)
    return new Response('ok', { headers: { 'Content-Type': 'text/plain' } })
  }

  // ── Neues Stück im Kurs ────────────────────────────────────
  if (payload.type === 'new_piece') {
    const { unterricht_id, stueck_id } = payload as { unterricht_id: string; stueck_id: string }
    const [{ data: stueck }, { data: kurs }, { data: schuelerListe }] = await Promise.all([
      supabase.from('stuecke').select('titel').eq('id', stueck_id).single(),
      supabase.from('unterricht').select('name').eq('id', unterricht_id).single(),
      supabase.from('unterricht_schueler').select('schueler_id').eq('unterricht_id', unterricht_id).eq('status', 'aktiv'),
    ])
    if (!stueck || !kurs) return new Response('not found', { status: 404 })

    const roheIds = (schuelerListe ?? []).map((r: { schueler_id: string }) => r.schueler_id)
    const { data: prefs } = await supabase.from('profiles').select('id, email_benachrichtigungen').in('id', roheIds)
    const recipients = (prefs ?? [])
      .filter((p: { email_benachrichtigungen: Record<string, unknown> | null }) => {
        const push = p.email_benachrichtigungen?.push as Record<string, boolean> | undefined
        return push?.kurs !== false
      })
      .map((p: { id: string }) => ({
        id: p.id,
        url: APP_URL + '/schueler/kurse',
      }))

    await sendPushToRecipients(recipients, `Neues Stück: ${stueck.titel}`, `Im Kurs „${kurs.name}"`)
    return new Response('ok', { headers: { 'Content-Type': 'text/plain' } })
  }

  return new Response('missing payload', { status: 400 })
})
