// Öffentlicher Ticketshop (ohne Anmeldung): Angebot, Kauf starten, Bestellung ansehen, abbrechen
import { hash } from '../_shared/krypto.ts'
import { stripe } from '../_shared/stripe.ts'
import { bezahlseite, bezahlseiteSchliessen, vorgangPruefen, zugang as sumupZugang } from '../_shared/sumup.ts'
import { abschliessen, APP_URL, db, konto, mailBereit, rpc, schluesselVon, ticketsSenden } from '../_shared/shop.ts'

const CORS = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type' }
const antwort = (d: unknown, status = 200) => new Response(JSON.stringify(d), { status, headers: { ...CORS, 'Content-Type': 'application/json' } })
const ZUGANG = /^[0-9a-f]{64}$/
const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return antwort({ ok: false, grund: 'methode' }, 405)
  let b: Record<string, unknown>
  try { b = await req.json() } catch { return antwort({ ok: false, grund: 'angaben' }, 400) }
  try {
    switch (b.aktion) {
      case 'info': return await info(String(b.slug ?? ''))
      case 'kaufen': return await kaufen(req, b)
      case 'bestellung': return await bestellung(String(b.zugang ?? ''))
      case 'nochmal': return await nochmal(req, String(b.slug ?? ''), String(b.email ?? ''), b.website)
      case 'abbrechen': return await abbrechen(String(b.zugang ?? ''))
      default: return antwort({ ok: false, grund: 'angaben' }, 400)
    }
  } catch (e) {
    console.error('[shop]', b.aktion, (e as Error).message)
    return antwort({ ok: false, grund: 'fehler' }, 500)
  }
})

async function info(slug: string) {
  const d = db()
  const r = /^[a-z0-9-]{3,40}$/.test(slug) ? await rpc(d, 'shop_info', { p_slug: slug }) : null
  if (!r) return antwort({ ok: false, grund: 'nicht_gefunden' }, 404)
  for (const e of r.events) {
    const { data } = e.bild_pfad ? await d.storage.from('event-bilder').createSignedUrl(e.bild_pfad, 3600) : { data: null }
    e.bild_url = data?.signedUrl ?? null
    delete e.bild_pfad
  }
  return antwort({ ok: true, ...r })
}

// Letzte öffentliche Adresse: interne stammen von unseren Proxys, weiter vorn stehende kann der Client fälschen
function adresse(req: Request) {
  return (req.headers.get('x-forwarded-for') ?? '').split(',').map(x => x.trim()).filter(x => x && !/^(10\.|127\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|::1|f[cd]|fe80)/i.test(x)).pop()
}

async function kaufen(req: Request, b: Record<string, unknown>) {
  if (b.website) return antwort({ ok: false, grund: 'angaben' }, 400)   // unsichtbares Feld, nur Bots füllen es aus
  if (!UUID.test(String(b.event_id ?? '')) || b.agb !== true) return antwort({ ok: false, grund: 'angaben' }, 400)
  const d = db()
  const ip = adresse(req)
  const r = await rpc(d, 'shop_reservieren', {
    p_event_id: b.event_id, p_anzahl: Number.isInteger(b.anzahl) ? b.anzahl : null, p_betrag: typeof b.betrag === 'number' ? b.betrag : null,
    p_name: String(b.name ?? ''), p_email: String(b.email ?? ''), p_sprache: String(b.sprache ?? 'de'), p_ip_hash: ip ? await hash(ip) : null,
  })
  if (!r.ok) return antwort(r)
  try {
    const k = await konto(d, r.schule_id, r.anbieter)
    // Schlüssel zwischendurch gewechselt: nie echtes Geld für Demo-Tickets oder umgekehrt
    if (!k || k.livemode === r.demo) throw new Error('Kein passendes Zahlungskonto')
    const { data: ev } = await d.from('events').select('titel').eq('id', b.event_id).single()
    if (k.anbieter === 'sumup') {
      const c = await bezahlseite(await sumupZugang(d, k, r.schule_id), k, r, b.anzahl as number, String(ev.titel))
      await rpc(d, 'shop_checkout_setzen', { p_bestellung_id: r.bestellung_id, p_checkout_id: c.id })
      return antwort({ ok: true, url: c.url, zugang: r.zugang })
    }
    const s = await stripe(await schluesselVon(k, r.schule_id), 'POST', 'checkout/sessions', {
      mode: 'payment', payment_method_types: ['card'], client_reference_id: r.bestellung_id, locale: ['de', 'en', 'tr'].includes(String(b.sprache)) ? b.sprache : 'auto',
      customer_email: String(b.email).trim().toLowerCase(),
      line_items: [{ quantity: b.anzahl, price_data: { currency: 'eur', unit_amount: Math.round(r.preis * 100), product_data: { name: String(ev.titel).slice(0, 200) } } }],
      payment_intent_data: { metadata: { bestellung: r.bestellung_id } },
      success_url: `${APP_URL}/shop/bestellung/${r.zugang}`, cancel_url: `${APP_URL}/shop/bestellung/${r.zugang}?abbruch=1`,
      expires_at: Math.floor(Date.now() / 1000) + 31 * 60,
    }, `checkout-${r.bestellung_id}`)
    await rpc(d, 'shop_checkout_setzen', { p_bestellung_id: r.bestellung_id, p_checkout_id: s.id })
    return antwort({ ok: true, url: s.url, zugang: r.zugang })
  } catch (e) {
    await rpc(d, 'shop_verwerfen', { p_bestellung_id: r.bestellung_id })   // Plätze nicht blockieren
    throw e
  }
}

async function laden(d: ReturnType<typeof db>, zugang: string) {
  return ZUGANG.test(zugang) ? await rpc(d, 'shop_bestellung', { p_zugang: zugang }) : null
}
// nur, was der Käufer sehen darf
// deno-lint-ignore no-explicit-any
const oeffentlich = (o: any) => ({ ok: true, demo: o.demo, status: o.status, name: o.name, email: o.email, betrag: o.betrag, slug: o.slug, zurueck: o.zurueck, automatisch: o.automatisch, event: o.event, schule: o.schule, tickets: o.tickets })

async function bestellung(zugang: string) {
  const d = db()
  let o = await laden(d, zugang)
  if (!o) return antwort({ ok: false, grund: 'nicht_gefunden' }, 404)
  // Meldung noch nicht da: direkt beim Anbieter nachfragen
  if (o.checkout_id && (o.status === 'reserviert' || o.status === 'verfallen')) {
    try {
      const k = await konto(d, o.schule_id, o.anbieter)
      if (k?.anbieter === 'sumup') {
        await vorgangPruefen(d, k, o)
        o = await laden(d, zugang)
      } else if (k) {
        const schluessel = await schluesselVon(k, o.schule_id)
        const s = await stripe(schluessel, 'GET', `checkout/sessions/${encodeURIComponent(o.checkout_id)}`)
        if (s.payment_status === 'paid') { await abschliessen(d, o.schule_id, schluessel, s); o = await laden(d, zugang) }
      }
    } catch (e) { console.error('[shop] Rückfrage', (e as Error).message); o = await laden(d, zugang) }
  }
  return antwort(oeffentlich(o))
}

async function abbrechen(zugang: string) {
  const d = db()
  const o = await laden(d, zugang)
  if (!o) return antwort({ ok: false, grund: 'nicht_gefunden' }, 404)
  if (o.status === 'reserviert' && o.checkout_id) {
    const k = await konto(d, o.schule_id, o.anbieter)
    // Erst die Bezahlseite schließen; klappt das nicht (z. B. gerade bezahlt), bleibt die Reservierung bestehen
    if (k?.anbieter === 'sumup') {
      let zu = false
      try { zu = await bezahlseiteSchliessen(await sumupZugang(d, k, o.schule_id), o.checkout_id) } catch { /* nicht erreichbar */ }
      if (!zu) return await bestellung(zugang)
    } else if (k) {
      try { await stripe(await schluesselVon(k, o.schule_id), 'POST', `checkout/sessions/${encodeURIComponent(o.checkout_id)}/expire`, {}) } catch { return await bestellung(zugang) }
    }
    await rpc(d, 'shop_verwerfen', { p_bestellung_id: o.id })
  }
  return antwort(oeffentlich(await laden(d, zugang)))
}

// Tickets nochmal schicken. Immer dieselbe Antwort und im Hintergrund verschickt: niemand erfährt (auch nicht über die Dauer),
// ob es zu einer Adresse Tickets gibt. Geschickt wird nur an die hinterlegte Adresse.
async function nochmal(req: Request, slug: string, email: string, website: unknown) {
  if (website || !/^[a-z0-9-]{3,40}$/.test(slug) || email.length > 200 || !email.includes('@')) return antwort({ ok: false, grund: 'angaben' }, 400)
  if (!mailBereit()) { console.warn('[shop] kein Mailversand eingerichtet'); return antwort({ ok: false, grund: 'kein_mailversand' }) }
  const d = db()
  const ip = adresse(req)
  const r = await rpc(d, 'shop_nochmal', { p_slug: slug, p_email: email, p_ip_hash: ip ? await hash(ip) : null })
  if (!r.ok) return antwort(r)
  const senden = async () => {
    for (const id of r.ids) {
      try { await ticketsSenden(d, id) } catch (e) {
        console.error('[shop] nochmal', (e as Error).message)
        await rpc(d, 'shop_mail_beanspruchen', { p_bestellung_id: id, p_zurueck: true }).catch(() => {})
      }
    }
  }
  // @ts-ignore EdgeRuntime gibt es nur in der Laufzeit
  EdgeRuntime.waitUntil(senden())
  return antwort({ ok: true })
}
