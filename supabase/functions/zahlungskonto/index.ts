// Stripe-Konto einer Schule verbinden oder trennen (nur Admins der Schule). Der Schlüssel wird nie zurückgegeben.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { verschluesseln } from '../_shared/krypto.ts'
import { stripe, StripeFehler } from '../_shared/stripe.ts'
import { db, konto, schluesselVon } from '../_shared/shop.ts'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const antwort = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const EREIGNISSE = ['checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired']

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return antwort({ ok: false }, 405)
  const auth = req.headers.get('Authorization') ?? ''
  const nutzer = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: auth } } })
  const { data: { user } } = await nutzer.auth.getUser()
  if (!user) return antwort({ ok: false, grund: 'anmeldung' }, 401)
  try {
    const { aktion, schule_id, schluessel, webhook_geheim } = await req.json()
    const { data: darf } = await nutzer.rpc('ist_admin_von_schule', { p_schule_id: schule_id })
    if (darf !== true) return antwort({ ok: false, grund: 'verboten' }, 403)
    const d = db()
    if (aktion === 'trennen') {
      await alterWebhookWeg(d, schule_id)
      const { error } = await d.from('schul_zahlungskonten').delete().eq('schule_id', schule_id)
      if (error) throw new Error(error.message)
      return antwort({ ok: true })
    }
    if (aktion === 'verbinden') return await verbinden(d, user.id, schule_id, String(schluessel ?? '').trim(), webhook_geheim ? String(webhook_geheim).trim() : null)
    return antwort({ ok: false, grund: 'angaben' }, 400)
  } catch (e) {
    console.error('[zahlungskonto]', (e as Error).message)
    return antwort({ ok: false, grund: 'fehler' }, 500)
  }
})

// grund: vollzugriff | format | livemodus | ungueltig | rechte | webhook_noetig
async function verbinden(d: ReturnType<typeof db>, nutzerId: string, schule: string, schluessel: string, geheim: string | null) {
  if (/^sk_/.test(schluessel)) return antwort({ ok: false, grund: 'vollzugriff' })
  const m = /^rk_(test|live)_[A-Za-z0-9]{10,}$/.exec(schluessel)
  if (!m || (geheim && !/^whsec_[A-Za-z0-9+/=]{10,}$/.test(geheim))) return antwort({ ok: false, grund: 'format' })
  const livemode = m[1] === 'live'
  // Testschlüssel sind überall erlaubt: damit läuft der Shop als Demo, die Tickets gelten nicht (20261124000012)
  if (livemode && Deno.env.get('STRIPE_LIVE_ERLAUBT') !== 'true') return antwort({ ok: false, grund: 'livemodus' })

  // Rechte prüfen: Bezahlvorgänge und Erstattungen
  for (const pfad of ['checkout/sessions?limit=1', 'refunds?limit=1']) {
    try { await stripe(schluessel, 'GET', pfad) } catch (e) {
      if (e instanceof StripeFehler) return antwort({ ok: false, grund: e.status === 401 ? 'ungueltig' : 'rechte', was: pfad.split('?')[0] })
      throw e
    }
  }

  let webhookId: string | null = null
  if (!geheim) {
    // Adresse, unter der Stripe uns erreicht (in Prod ist SUPABASE_URL container-intern)
    const basis = (Deno.env.get('OEFFENTLICHE_API_URL') ?? Deno.env.get('SUPABASE_URL')!).replace(/\/$/, '')
    try {
      const w = await stripe(schluessel, 'POST', 'webhook_endpoints', { url: `${basis}/functions/v1/stripe-webhook?schule=${schule}`, enabled_events: EREIGNISSE, description: 'Staccato Ticketshop' })
      webhookId = w.id
      geheim = w.secret
    } catch (e) {
      if (e instanceof StripeFehler) return antwort({ ok: false, grund: 'webhook_noetig', url: `${basis}/functions/v1/stripe-webhook?schule=${schule}`, ereignisse: EREIGNISSE })
      throw e
    }
  }
  await alterWebhookWeg(d, schule)
  const { error } = await d.from('schul_zahlungskonten').upsert({
    schule_id: schule, anbieter: 'stripe', livemode, letzte4: schluessel.slice(-4), webhook_id: webhookId, erstellt_von: nutzerId, erstellt_am: new Date().toISOString(),
    schluessel: await verschluesseln(schluessel, schule, 'api'), webhook_geheim: await verschluesseln(geheim!, schule, 'webhook'),
  })
  if (error) throw new Error(error.message)
  return antwort({ ok: true, livemode, letzte4: schluessel.slice(-4) })
}

async function alterWebhookWeg(d: ReturnType<typeof db>, schule: string) {
  const k = await konto(d, schule)
  if (!k?.webhook_id) return
  try { await stripe(await schluesselVon(k, schule), 'DELETE', `webhook_endpoints/${k.webhook_id}`) } catch (e) { console.warn('[zahlungskonto] alter Webhook', (e as Error).message) }
}
