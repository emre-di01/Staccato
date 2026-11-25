// Stripe- oder SumUp-Konto einer Schule verbinden oder trennen (nur Admins der Schule). Schlüssel und Token werden nie zurückgegeben.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { entschluesseln, hash, verschluesseln } from '../_shared/krypto.ts'
import { stripe, StripeFehler } from '../_shared/stripe.ts'
import { type Anbieter, db, konto, schluesselVon } from '../_shared/shop.ts'
import { anmeldeLink, haendler, type Haendler, haendlerListe, oauthBereit, RECHTE, sumup, SumupFehler, type Token, tokenAusCode } from '../_shared/sumup.ts'

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
    const b = await req.json()
    const { aktion, schule_id, schluessel, webhook_geheim } = b
    if (aktion === 'sumup_fertig') return await sumupFertig(nutzer, user.id, b)   // Schule steht im gespeicherten Vorgang
    const { data: darf } = await nutzer.rpc('ist_admin_von_schule', { p_schule_id: schule_id })
    if (darf !== true) return antwort({ ok: false, grund: 'verboten' }, 403)
    const d = db()
    if (aktion === 'trennen') {
      const anbieter = b.anbieter === 'sumup' ? 'sumup' : 'stripe'
      if (anbieter === 'stripe') await alterWebhookWeg(d, schule_id)
      const { error } = await d.from('schul_zahlungskonten').delete().eq('schule_id', schule_id).eq('anbieter', anbieter)
      if (error) throw new Error(error.message)
      return antwort({ ok: true })
    }
    if (aktion === 'verbinden') return await verbinden(d, user.id, schule_id, String(schluessel ?? '').trim(), webhook_geheim ? String(webhook_geheim).trim() : null)
    if (aktion === 'sumup_moeglich') return antwort({ ok: true, oauth: oauthBereit() })
    if (aktion === 'sumup_schluessel') return await sumupSchluessel(d, user.id, schule_id, String(schluessel ?? '').trim(), b.haendler)
    if (aktion === 'sumup_start') return await sumupStart(d, user.id, schule_id)
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
    schule_id: schule, anbieter: 'stripe', aktiv: await wirdAktiv(d, schule, 'stripe'), livemode, letzte4: schluessel.slice(-4), webhook_id: webhookId, erstellt_von: nutzerId, erstellt_am: new Date().toISOString(),
    schluessel: await verschluesseln(schluessel, schule, 'api'), webhook_geheim: await verschluesseln(geheim!, schule, 'webhook'),
  })
  if (error) throw new Error(error.message)
  return antwort({ ok: true, livemode, letzte4: schluessel.slice(-4) })
}

async function alterWebhookWeg(d: ReturnType<typeof db>, schule: string) {
  const k = await konto(d, schule, 'stripe')
  if (!k?.webhook_id) return
  try { await stripe(await schluesselVon(k, schule), 'DELETE', `webhook_endpoints/${k.webhook_id}`) } catch (e) { console.warn('[zahlungskonto] alter Webhook', (e as Error).message) }
}

// Der erste verbundene Anbieter ist im Shop aktiv; ein zweiter wird erst auf Wunsch aktiv (zahlungskonto_waehlen)
async function wirdAktiv(d: ReturnType<typeof db>, schule: string, anbieter: Anbieter): Promise<boolean> {
  const { data } = await d.from('schul_zahlungskonten').select('anbieter, aktiv').eq('schule_id', schule)
  return !(data ?? []).some((k: { anbieter: string; aktiv: boolean }) => k.aktiv && k.anbieter !== anbieter)
}

// ── SumUp ──
// grund: oeffentlich | format | ungueltig | rechte | haendler (Auswahl nötig: liste) | livemodus | waehrung
async function sumupSchluessel(d: ReturnType<typeof db>, nutzerId: string, schule: string, schluessel: string, wahl: unknown) {
  if (/^sup_pk_/.test(schluessel)) return antwort({ ok: false, grund: 'oeffentlich' })
  if (!/^sup_sk_[A-Za-z0-9_-]{10,200}$/.test(schluessel)) return antwort({ ok: false, grund: 'format' })
  return await sumupVerbinden(d, nutzerId, schule, schluessel, wahl, { art: 'schluessel', inhalt: schluessel })
}

async function sumupVerbinden(d: ReturnType<typeof db>, nutzerId: string, schule: string, token: string, wahl: unknown, z: { art: 'schluessel' | 'oauth'; inhalt: string }) {
  let h: Haendler, treffer: Haendler
  try {
    // Nur Konten, die dieser Zugang wirklich sehen darf, nie ungeprüft die Angabe aus dem Browser
    const liste = await haendlerListe(token)
    const passend = wahl ? liste.filter(x => x.code === String(wahl)) : liste
    if (passend.length !== 1) return antwort({ ok: false, grund: 'haendler', liste: liste.map(({ code, name, sandbox }) => ({ code, name, sandbox })) })
    treffer = passend[0]
    h = await haendler(token, treffer.code)
    await sumup(token, 'GET', 'v0.1/checkouts?checkout_reference=staccato-pruefung')
  } catch (e) {
    if (e instanceof SumupFehler && e.status < 500 && e.status !== 429) return antwort({ ok: false, grund: e.status === 401 ? 'ungueltig' : 'rechte' })
    throw e
  }
  if (h.waehrung !== 'EUR') return antwort({ ok: false, grund: 'waehrung' })
  if (!h.sandbox && Deno.env.get('STRIPE_LIVE_ERLAUBT') !== 'true') return antwort({ ok: false, grund: 'livemodus', konto: treffer.name })
  const letzte4 = h.code.slice(-4).padStart(4, '·')
  const { error } = await d.from('schul_zahlungskonten').upsert({
    schule_id: schule, anbieter: 'sumup', aktiv: await wirdAktiv(d, schule, 'sumup'), art: z.art, haendler: h.code, livemode: !h.sandbox, letzte4, neu_verbinden: false,
    webhook_id: null, webhook_geheim: null, erstellt_von: nutzerId, erstellt_am: new Date().toISOString(), schluessel: await verschluesseln(z.inhalt, schule, 'sumup'),
  })
  if (error) throw new Error(error.message)
  return antwort({ ok: true, livemode: !h.sandbox, letzte4, haendler: h.code })
}

async function sumupStart(d: ReturnType<typeof db>, nutzerId: string, schule: string) {
  if (!oauthBereit()) return antwort({ ok: false, grund: 'nicht_eingerichtet' })
  const state = [...crypto.getRandomValues(new Uint8Array(32))].map(x => x.toString(16).padStart(2, '0')).join('')
  await d.from('zahlungskonto_oauth').delete().lt('erstellt_am', new Date(Date.now() - 15 * 60_000).toISOString())
  const { error } = await d.from('zahlungskonto_oauth').insert({ state_hash: await hash(state), schule_id: schule, nutzer_id: nutzerId })
  if (error) throw new Error(error.message)
  return antwort({ ok: true, url: anmeldeLink(state) })
}

// Rückkehr von SumUp: { state, code } oder nach der Händlerauswahl { state, haendler }
// grund: abgelaufen | verboten | ungueltig | rechte | haendler | livemodus | waehrung
// deno-lint-ignore no-explicit-any
async function sumupFertig(nutzer: any, nutzerId: string, b: Record<string, unknown>) {
  const d = db()
  if (!oauthBereit()) return antwort({ ok: false, grund: 'nicht_eingerichtet' })
  if (!/^[0-9a-f]{64}$/.test(String(b.state ?? ''))) return antwort({ ok: false, grund: 'abgelaufen' })
  // Der Vorgang gehört genau der Person, die ihn begonnen hat, und gilt nur einmal
  const { data: v } = await d.from('zahlungskonto_oauth').delete().eq('state_hash', await hash(String(b.state))).eq('nutzer_id', nutzerId)
    .gt('erstellt_am', new Date(Date.now() - 15 * 60_000).toISOString()).select().maybeSingle()
  if (!v) return antwort({ ok: false, grund: 'abgelaufen' })
  const { data: darf } = await nutzer.rpc('ist_admin_von_schule', { p_schule_id: v.schule_id })
  if (darf !== true) return antwort({ ok: false, grund: 'verboten' }, 403)

  let token: Token
  if (v.zugang) token = JSON.parse(await entschluesseln(v.zugang, v.schule_id, 'sumup-oauth'))
  else {
    if (typeof b.code !== 'string' || !b.code || b.code.length > 2000) return antwort({ ok: false, grund: 'ungueltig' })
    try {
      const r = await tokenAusCode(b.code)
      if (r.rechte.length && RECHTE.some(x => !r.rechte.includes(x))) return antwort({ ok: false, grund: 'rechte' })
      token = r.token
    } catch (e) {
      if (e instanceof SumupFehler && e.status < 500) { console.error('[zahlungskonto] SumUp', e.code); return antwort({ ok: false, grund: 'ungueltig' }) }
      throw e
    }
  }
  const antw = await sumupVerbinden(d, nutzerId, v.schule_id, token.access, v.zugang ? b.haendler : null, { art: 'oauth', inhalt: JSON.stringify(token) })
  // Mehrere Händlerkonten: Vorgang mit den Token behalten, bis eines gewählt ist
  if ((await antw.clone().json()).grund === 'haendler') {
    const { error } = await d.from('zahlungskonto_oauth').insert({ state_hash: v.state_hash, schule_id: v.schule_id, nutzer_id: nutzerId, erstellt_am: v.erstellt_am, zugang: await verschluesseln(JSON.stringify(token), v.schule_id, 'sumup-oauth') })
    if (error) throw new Error(error.message)
  }
  return antw
}
