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

Deno.serve(async (req) => {
  // Nur interner Aufruf via pg_cron/pg_net erlaubt — kein öffentlicher Zugriff
  const secret = req.headers.get('x-internal-secret')
  if (secret !== Deno.env.get('INTERNAL_SECRET')) {
    return new Response('Forbidden', { status: 403 })
  }

  const jetzt = new Date()
  const morgenStart = new Date(jetzt)
  morgenStart.setDate(jetzt.getDate() + 1)
  morgenStart.setHours(0, 0, 0, 0)
  const morgenEnde = new Date(morgenStart)
  morgenEnde.setHours(23, 59, 59, 999)

  // Alle Stunden von morgen laden
  const { data: stunden } = await supabase
    .from('stunden')
    .select('id, beginn, unterricht_id, unterricht(name, schule_id)')
    .gte('beginn', morgenStart.toISOString())
    .lte('beginn', morgenEnde.toISOString())
    .eq('status', 'geplant')

  if (!stunden?.length) {
    console.log('Keine Stunden morgen')
    return new Response('ok – keine Stunden', { status: 200 })
  }

  let gesendet = 0

  for (const stunde of stunden) {
    const unterrichtId = stunde.unterricht_id
    const kursName = (stunde.unterricht as { name: string } | null)?.name ?? 'Unterricht'
    const uhrzeit = new Date(stunde.beginn).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Berlin' })

    // Schüler + Lehrer des Kurses
    const [{ data: schuelerListe }, { data: lehrerListe }] = await Promise.all([
      supabase.from('unterricht_schueler').select('schueler_id').eq('unterricht_id', unterrichtId).eq('status', 'aktiv'),
      supabase.from('unterricht_lehrer').select('lehrer_id').eq('unterricht_id', unterrichtId),
    ])

    const alleIds = [
      ...(schuelerListe ?? []).map((r: { schueler_id: string }) => r.schueler_id),
      ...(lehrerListe  ?? []).map((r: { lehrer_id:   string }) => r.lehrer_id),
    ]
    if (!alleIds.length) continue

    // Push-Einstellungen + Subscriptions laden
    const { data: prefs } = await supabase
      .from('profiles')
      .select('id, rolle, email_benachrichtigungen')
      .in('id', alleIds)

    const empfaenger = (prefs ?? []).filter((p: { email_benachrichtigungen: Record<string, unknown> | null }) => {
      const push = p.email_benachrichtigungen?.push as Record<string, boolean> | undefined
      return push?.erinnerung !== false
    })
    if (!empfaenger.length) continue

    const { data: subs } = await supabase
      .from('push_subscriptions')
      .select('endpoint, p256dh, auth_key, user_id')
      .in('user_id', empfaenger.map((p: { id: string }) => p.id))
    if (!subs?.length) continue

    const rolleMap = Object.fromEntries((prefs ?? []).map((p: { id: string; rolle: string }) => [p.id, p.rolle]))

    await Promise.allSettled(subs.map(async (sub: { endpoint: string; p256dh: string; auth_key: string; user_id: string }) => {
      const rolle = rolleMap[sub.user_id] ?? 'schueler'
      const pfad = rolle === 'lehrer' ? '/lehrer/anwesenheit' : '/schueler/stundenplan'
      const payload = JSON.stringify({
        title: `⏰ Morgen: ${kursName}`,
        body: `Um ${uhrzeit} Uhr`,
        url: APP_URL + pfad,
      })
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth_key } },
          payload,
        )
        gesendet++
      } catch (err: unknown) {
        const status = (err as { statusCode?: number }).statusCode
        if (status === 404 || status === 410) {
          await supabase.from('push_subscriptions').delete().eq('endpoint', sub.endpoint)
        }
      }
    }))
  }

  console.log(`Erinnerungen gesendet: ${gesendet}`)
  return new Response(`ok – ${gesendet} Erinnerungen gesendet`, { status: 200 })
})
