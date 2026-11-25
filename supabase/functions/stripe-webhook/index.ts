// Zahlungsbestätigung von Stripe, je Schule mit eigener Adresse (?schule=<id>) und eigenem Signaturschlüssel.
// Antwort ≠ 2xx → Stripe schickt das Ereignis erneut.
import { entschluesseln } from '../_shared/krypto.ts'
import { signaturGueltig } from '../_shared/stripe.ts'
import { abschliessen, db, konto, rpc, schluesselVon } from '../_shared/shop.ts'

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('', { status: 405 })
  const schule = new URL(req.url).searchParams.get('schule') ?? ''
  if (!UUID.test(schule)) return new Response('', { status: 400 })
  const roh = await req.text()
  try {
    const d = db()
    const k = await konto(d, schule, 'stripe')
    if (!k || !await signaturGueltig(roh, req.headers.get('stripe-signature'), await entschluesseln(k.webhook_geheim!, schule, 'webhook'))) {
      return new Response('', { status: 400 })
    }
    const ev = JSON.parse(roh)
    if (ev.livemode !== k.livemode) return new Response('', { status: 400 })
    const s = ev.data?.object
    if (ev.type === 'checkout.session.completed' || ev.type === 'checkout.session.async_payment_succeeded') {
      const e = await abschliessen(d, schule, await schluesselVon(k, schule), s)
      if (e === 'ungueltig') console.warn('[stripe-webhook] passt zu keiner Bestellung', s?.id)
    } else if (ev.type === 'checkout.session.expired' && UUID.test(s?.client_reference_id ?? '')) {
      // nur Bestellungen dieser Schule und dieses Bezahlvorgangs
      const { data: b } = await d.from('ticket_bestellungen').select('id').eq('id', s.client_reference_id).eq('schule_id', schule).eq('checkout_id', s.id).maybeSingle()
      if (b) await rpc(d, 'shop_verwerfen', { p_bestellung_id: b.id })
    }
    return new Response(JSON.stringify({ received: true }), { headers: { 'Content-Type': 'application/json' } })
  } catch (e) {
    console.error('[stripe-webhook]', (e as Error).message)
    return new Response('', { status: 500 })
  }
})
