// Schlanker Stripe-Zugriff ohne SDK
const API = Deno.env.get('STRIPE_API') ?? 'https://api.stripe.com'   // nur für Tests überschrieben
const VERSION = '2024-06-20'

export class StripeFehler extends Error {
  constructor(public status: number, public code: string, nachricht: string) { super(nachricht) }
}

// verschachtelte Werte → form-Felder: { a: { b: 1 }, c: ['x'] } → a[b]=1, c[0]=x
function felder(o: Record<string, unknown>, pre = '', out = new URLSearchParams()): URLSearchParams {
  for (const [k, v] of Object.entries(o)) {
    if (v === undefined || v === null) continue
    const name = pre ? `${pre}[${k}]` : k
    if (typeof v === 'object') felder(v as Record<string, unknown>, name, out)
    else out.append(name, String(v))
  }
  return out
}

// deno-lint-ignore no-explicit-any
export async function stripe(schluessel: string, methode: 'GET' | 'POST' | 'DELETE', pfad: string, daten?: Record<string, unknown>, idempotenz?: string): Promise<any> {
  const r = await fetch(`${API}/v1/${pfad}`, {
    method: methode,
    headers: {
      Authorization: `Bearer ${schluessel}`, 'Stripe-Version': VERSION,
      ...(daten ? { 'Content-Type': 'application/x-www-form-urlencoded' } : {}),
      ...(idempotenz ? { 'Idempotency-Key': idempotenz } : {}),
    },
    body: daten ? felder(daten) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  const j = await r.json().catch(() => ({}))
  // Meldung von Stripe nur ins Protokoll, nie an Gäste
  if (!r.ok) throw new StripeFehler(r.status, j?.error?.code ?? j?.error?.type ?? 'fehler', j?.error?.message ?? `HTTP ${r.status}`)
  return j
}

// Signatur des Webhooks prüfen (Stripe-Signature: t=…,v1=…), höchstens 5 Minuten alt
export async function signaturGueltig(roh: string, kopf: string | null, geheim: string, jetzt = Date.now()): Promise<boolean> {
  if (!kopf || !geheim) return false
  const teile = kopf.split(',').map(x => x.trim().split('='))
  const t = teile.find(([k]) => k === 't')?.[1]
  const v1 = teile.filter(([k]) => k === 'v1').map(([, v]) => v)
  if (!t || !/^\d+$/.test(t) || Math.abs(jetzt / 1000 - Number(t)) > 300) return false
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(geheim), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign'])
  const soll = [...new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${t}.${roh}`)))].map(b => b.toString(16).padStart(2, '0')).join('')
  // Vergleich in konstanter Zeit
  return v1.some(ist => {
    if (ist.length !== soll.length) return false
    let d = 0
    for (let i = 0; i < soll.length; i++) d |= ist.charCodeAt(i) ^ soll.charCodeAt(i)
    return d === 0
  })
}
