// Meldung von SumUp zu einem Bezahlvorgang (?schule=<id>) und interner Abgleich (pg_cron sumup-abgleich).
// Die Meldung ist nicht signiert und wird nur als Anstoß genommen: Was gilt, sagt die Abfrage bei SumUp.
// Antwort ≠ 2xx → SumUp schickt die Meldung erneut.
import { db, konto, rpc } from '../_shared/shop.ts'
import { vorgangPruefen } from '../_shared/sumup.ts'

const UUID = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/

Deno.serve(async req => {
  if (req.method !== 'POST') return new Response('', { status: 405 })
  const geheim = Deno.env.get('INTERNAL_SECRET'), kopf = req.headers.get('x-internal-secret')
  // deno-lint-ignore no-explicit-any
  const b: any = await req.json().catch(() => null)
  if (kopf) return geheim && kopf === geheim && b?.aufgabe === 'abgleich' ? await abgleich() : new Response('', { status: 403 })

  const schule = new URL(req.url).searchParams.get('schule') ?? ''
  const id = b?.id ?? b?.payload?.checkout_id
  if (!UUID.test(schule) || typeof id !== 'string' || id.length > 100) return new Response('', { status: 400 })
  try {
    const d = db()
    const { data: o } = await d.from('ticket_bestellungen').select('id, schule_id, checkout_id').eq('checkout_id', id).eq('schule_id', schule).eq('anbieter', 'sumup').maybeSingle()
    const k = o ? await konto(d, schule, 'sumup') : null
    if (k) await vorgangPruefen(d, k, o)   // Unbekanntes wird ohne Rückfrage bei SumUp verworfen
    return new Response('', { status: 200 })
  } catch (e) {
    console.error('[sumup-webhook]', (e as Error).message)
    return new Response('', { status: 500 })
  }
})

async function abgleich() {
  const d = db()
  const liste = await rpc(d, 'sumup_abgleich_liste', {})
  let fehler = 0
  for (const o of liste) {
    try {
      const k = await konto(d, o.schule_id, 'sumup')
      if (k && !k.neu_verbinden) await vorgangPruefen(d, k, o)
    } catch (e) { fehler++; console.error('[sumup-webhook] Abgleich', o.id, (e as Error).message) }
  }
  return new Response(JSON.stringify({ geprueft: liste.length, fehler }), { headers: { 'Content-Type': 'application/json' } })
}
