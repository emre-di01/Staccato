// Shop-Bestellungen verwalten (nur Admins der Schule): Tickets schicken, E-Mail korrigieren, stornieren und online erstatten
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { stripe, StripeFehler } from '../_shared/stripe.ts'
import { erstattenSumup, SumupFehler } from '../_shared/sumup.ts'
import { type Anbieter, type DB, db, konto, mailBereit, rpc, schluesselVon, ticketsSenden } from '../_shared/shop.ts'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const antwort = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return antwort({ ok: false, grund: 'methode' }, 405)
  const nutzer = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, { global: { headers: { Authorization: req.headers.get('Authorization') ?? '' } } })
  const { data: { user } } = await nutzer.auth.getUser()
  if (!user) return antwort({ ok: false, grund: 'anmeldung' }, 401)
  try {
    const b = await req.json()
    if (!UUID.test(String(b.bestellung_id ?? ''))) return antwort({ ok: false, grund: 'angaben' }, 400)
    const d = db()
    const { data: o } = await d.from('ticket_bestellungen').select('id, schule_id, herkunft, kaeufer_email, demo, anbieter').eq('id', b.bestellung_id).maybeSingle()
    const { data: darf } = o ? await nutzer.rpc('ist_admin_von_schule', { p_schule_id: o.schule_id }) : { data: false }
    if (darf !== true || o.herkunft !== 'shop') return antwort({ ok: false, grund: 'verboten' }, 403)
    switch (b.aktion) {
      case 'mail': return await mail(d, o, b.email)
      case 'stornieren': return await stornieren(d, o, user.id, b)
      case 'wiederholen': return await wiederholen(d, o, String(b.vorgang ?? ''))
      default: return antwort({ ok: false, grund: 'angaben' }, 400)
    }
  } catch (e) {
    console.error('[shop-verwaltung]', (e as Error).message)
    return antwort({ ok: false, grund: 'fehler' }, 500)
  }
})

interface Bestellung { id: string; schule_id: string; kaeufer_email: string; demo: boolean; anbieter: Anbieter | null }

async function mail(d: DB, o: Bestellung, email: unknown) {
  // Erst prüfen: ohne Mailversand bekäme der Käufer neue Codes, ohne sie je zu sehen
  if (!mailBereit()) return antwort({ ok: false, grund: 'kein_mailversand' })
  const r = await rpc(d, 'shop_email_aendern', { p_bestellung_id: o.id, p_email: String(email ?? o.kaeufer_email) })
  if (!r.ok) return antwort(r)
  try {
    if (!await ticketsSenden(d, o.id)) return antwort({ ok: false, grund: 'nicht_moeglich', geaendert: r.geaendert })
  } catch (e) {
    console.error('[shop-verwaltung] Mail', (e as Error).message)
    return antwort({ ok: false, grund: 'mail', geaendert: r.geaendert })
  }
  await d.from('ticket_bestellungen').update({ mail_am: new Date().toISOString() }).eq('id', o.id)
  return antwort({ ok: true, geaendert: r.geaendert })
}

async function stornieren(d: DB, o: Bestellung, von: string, b: Record<string, unknown>) {
  const ids = Array.isArray(b.ticket_ids) ? b.ticket_ids.map(String) : []
  if (!UUID.test(String(b.vorgang ?? '')) || ids.some(i => !UUID.test(i)) || typeof b.betrag !== 'number') return antwort({ ok: false, grund: 'angaben' }, 400)
  // Ohne Konto beim Anbieter der Bestellung ließe sich nichts erstatten: nicht erst stornieren und dann hängen bleiben
  // (auch nicht mit dem Schlüssel des anderen Modus)
  if (b.betrag > 0 && !kannErstatten(await konto(d, o.schule_id, o.anbieter), o.demo)) return antwort({ ok: false, grund: 'kein_konto' })
  const r = await rpc(d, 'shop_storno_beginnen', { p_bestellung_id: o.id, p_ticket_ids: ids, p_betrag: b.betrag, p_vorgang: b.vorgang, p_von: von })
  if (!r.ok) return antwort(r)
  return antwort({ ok: true, erstattung: r.erstatten ? await erstatten(d, String(b.vorgang)) : 'keine' })
}

const kannErstatten = (k: Awaited<ReturnType<typeof konto>>, demo: boolean) => !!k && !k.neu_verbinden && k.livemode === !demo

async function wiederholen(d: DB, o: Bestellung, vorgang: string) {
  const i = UUID.test(vorgang) ? await rpc(d, 'shop_erstattung_info', { p_vorgang: vorgang }) : null
  if (!i || i.bestellung_id !== o.id) return antwort({ ok: false, grund: 'angaben' }, 400)
  return antwort({ ok: true, erstattung: await erstatten(d, vorgang) })
}

// Beim Anbieter erstatten und festhalten; beliebig wiederholbar. 'erledigt' | 'offen'
async function erstatten(d: DB, vorgang: string): Promise<'erledigt' | 'offen'> {
  const i = await rpc(d, 'shop_erstattung_info', { p_vorgang: vorgang })
  if (i.erledigt) return 'erledigt'
  try {
    const k = await konto(d, i.schule_id, i.anbieter)
    if (!k) return 'offen'
    if (k.anbieter === 'sumup') return await erstattenSumup(d, k, i.schule_id, vorgang) ? 'erledigt' : 'offen'
    const schluessel = await schluesselVon(k, i.schule_id)
    // Was ist bei Stripe schon passiert? Unsere Erstattung (Antwort ging verloren) oder eine von Hand im Stripe-Dashboard
    const liste = await stripe(schluessel, 'GET', `refunds?payment_intent=${encodeURIComponent(i.zahlung)}&limit=100`)
    // deno-lint-ignore no-explicit-any
    const neu = liste.data.filter((r: any) => !['failed', 'canceled'].includes(r.status) && !i.bekannt.includes(r.id))
    // deno-lint-ignore no-explicit-any
    const eigene = neu.filter((r: any) => r.metadata?.vorgang === vorgang)
    // deno-lint-ignore no-explicit-any
    const fremde = neu.filter((r: any) => !r.metadata?.vorgang)
    const gebucht = [...eigene, ...fremde]
    const cent = Math.round(i.betrag * 100)
    // deno-lint-ignore no-explicit-any
    const rest = cent - gebucht.reduce((s: number, r: any) => s + r.amount, 0)
    if (rest > 0) {
      const r = await stripe(schluessel, 'POST', 'refunds', { payment_intent: i.zahlung, amount: rest, metadata: { vorgang } }, `storno-${vorgang}-${rest}-${i.versuch}`)
      if (['failed', 'canceled'].includes(r.status)) throw new StripeFehler(400, r.status, 'Erstattung fehlgeschlagen')
      gebucht.push(r)
    }
    await rpc(d, 'shop_erstattung_fertig', { p_vorgang: vorgang, p_erstattungen: gebucht.map(r => ({ id: r.id, betrag: r.amount / 100 })) })
    return 'erledigt'
  } catch (e) {
    // Tickets sind storniert, das Geld noch nicht zurück: bleibt offen und lässt sich wiederholen
    // Stripe merkt sich auch Ablehnungen zum Idempotenzschlüssel; bei 409/5xx ist unklar, ob erstattet wurde → Schlüssel behalten
    if (e instanceof StripeFehler && e.status >= 400 && e.status < 500 && e.status !== 409) await rpc(d, 'shop_erstattung_abgelehnt', { p_vorgang: vorgang, p_versuch: i.versuch })
    console.error('[shop-verwaltung] Erstattung', e instanceof StripeFehler || e instanceof SumupFehler ? e.code : '', (e as Error).message)
    return 'offen'
  }
}
