// Schlanker SumUp-Zugriff ohne SDK. Zugang je Schule: API-Schlüssel oder OAuth-Token (schul_zahlungskonten.art).
// SumUp signiert Meldungen nicht und kennt keine Idempotenzschlüssel: Der Status wird immer abgefragt, Erstattungen laufen
// unter einer Sperre und werden vorher mit SumUp abgeglichen.
import { entschluesseln, verschluesseln } from './krypto.ts'
import { APP_URL, type DB, type Konto, rpc, ticketsMailen } from './shop.ts'

const API = Deno.env.get('SUMUP_API') ?? 'https://api.sumup.com'   // nur für Tests überschrieben
// config.toml lässt „env(NAME)“ stehen, wenn die Variable fehlt
const umgebung = (n: string) => { const w = Deno.env.get(n) ?? ''; return w.startsWith('env(') ? '' : w }
const CLIENT_ID = umgebung('SUMUP_CLIENT_ID'), CLIENT_SECRET = umgebung('SUMUP_CLIENT_SECRET')
export const oauthBereit = () => !!CLIENT_ID && !!CLIENT_SECRET
export const OAUTH_RUECKWEG = `${APP_URL}/admin/ticketshop/sumup`
export const RECHTE = ['payments', 'transactions.history', 'user.profile_readonly']
const SPERRE_ERSTATTUNG = 600   // s; so lange bleibt eine unklare Erstattung liegen, bevor sie neu abgeglichen wird

export class SumupFehler extends Error {
  constructor(public status: number, public code: string, nachricht: string) { super(nachricht) }
}

// deno-lint-ignore no-explicit-any
export async function sumup(token: string, methode: 'GET' | 'POST' | 'DELETE', pfad: string, daten?: Record<string, unknown>): Promise<any> {
  const r = await fetch(`${API}/${pfad}`, {
    method: methode,
    headers: { Authorization: `Bearer ${token}`, ...(daten ? { 'Content-Type': 'application/json' } : {}) },
    body: daten ? JSON.stringify(daten) : undefined,
    signal: AbortSignal.timeout(15000),
  })
  const j = await r.json().catch(() => ({}))
  // Meldung von SumUp nur ins Protokoll, nie an Gäste
  if (!r.ok) throw new SumupFehler(r.status, j?.error_code ?? j?.title ?? 'fehler', j?.message ?? j?.detail ?? `HTTP ${r.status}`)
  return j
}

// ── Zugang ──
export interface Token { access: string; refresh: string | null; bis: number }

async function tokenAbruf(felder: Record<string, string>) {
  const r = await fetch(`${API}/token`, {
    method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ ...felder, client_id: CLIENT_ID, client_secret: CLIENT_SECRET }), signal: AbortSignal.timeout(15000),
  })
  const j = await r.json().catch(() => ({}))
  if (!r.ok || !j.access_token) throw new SumupFehler(r.status, j?.error ?? 'fehler', 'Token nicht erhalten')
  return { token: { access: j.access_token, refresh: j.refresh_token ?? null, bis: Date.now() + (j.expires_in ?? 3600) * 1000 } as Token, rechte: String(j.scope ?? '').split(/\s+/).filter(Boolean) }
}
export const tokenAusCode = (code: string) => tokenAbruf({ grant_type: 'authorization_code', code, redirect_uri: OAUTH_RUECKWEG })
export const anmeldeLink = (state: string) => `${API}/authorize?${new URLSearchParams({ response_type: 'code', client_id: CLIENT_ID, redirect_uri: OAUTH_RUECKWEG, scope: RECHTE.join(' '), state })}`

const lies = async (k: Konto, schule: string) => JSON.parse(await entschluesseln(k.schluessel, schule, 'sumup')) as Token
const gueltig = (t: Token) => t.bis > Date.now() + 120_000

// Gültiger Bearer-Token. OAuth: erneuern; SumUp kann dabei den Refresh-Token wechseln, deshalb erneuert immer nur einer.
export async function zugang(d: DB, k: Konto, schule: string): Promise<string> {
  if (k.art !== 'oauth') return await entschluesseln(k.schluessel, schule, 'sumup')
  let t = await lies(k, schule)
  if (gueltig(t)) return t.access
  const sperre = `token:${schule}`
  for (let i = 0; i < 20; i++) {
    if (await rpc(d, 'zahlung_sperren', { p_name: sperre, p_sekunden: 30 })) {
      let neu: Konto | null = null
      try {
        neu = await frisch(d, schule)   // ein anderer könnte gerade fertig geworden sein
        t = await lies(neu, schule)
        if (gueltig(t)) return t.access
        if (!t.refresh) throw new SumupFehler(400, 'invalid_grant', 'kein Refresh-Token')
        const { token } = await tokenAbruf({ grant_type: 'refresh_token', refresh_token: t.refresh })
        token.refresh ??= t.refresh
        const { error } = await d.from('schul_zahlungskonten').update({ schluessel: await verschluesseln(JSON.stringify(token), schule, 'sumup'), neu_verbinden: false })
          .eq('schule_id', schule).eq('anbieter', 'sumup').eq('schluessel', neu.schluessel)
        if (error) throw new Error(error.message)
        return token.access
      } catch (e) {
        // Freigabe entzogen oder abgelaufen: nicht weiter probieren, Admin muss neu verbinden
        if (neu && e instanceof SumupFehler && e.code === 'invalid_grant') await d.from('schul_zahlungskonten').update({ neu_verbinden: true }).eq('schule_id', schule).eq('anbieter', 'sumup').eq('schluessel', neu.schluessel)
        throw e
      } finally { await rpc(d, 'zahlung_entsperren', { p_name: sperre }) }
    }
    await new Promise(r => setTimeout(r, 500))
    t = await lies(await frisch(d, schule), schule)
    if (gueltig(t)) return t.access
  }
  throw new Error('SumUp-Token wird gerade erneuert')
}

async function frisch(d: DB, schule: string): Promise<Konto> {
  const { data } = await d.from('schul_zahlungskonten').select('anbieter, schluessel, webhook_geheim, webhook_id, livemode, art, haendler, neu_verbinden').eq('schule_id', schule).eq('anbieter', 'sumup').maybeSingle()
  if (!data || data.art !== 'oauth') throw new Error('SumUp nicht verbunden')
  return data
}

// Händlerkonten, auf die der Zugang zugreifen darf
export interface Haendler { code: string; name: string; sandbox: boolean; waehrung: string }
export async function haendler(token: string, code: string): Promise<Haendler> {
  const m = await sumup(token, 'GET', `v1/merchants/${encodeURIComponent(code)}`)
  return { code: m.merchant_code ?? code, name: String(m.business_profile?.name ?? m.company?.name ?? m.alias ?? code), sandbox: m.sandbox === true, waehrung: m.default_currency }
}
export async function haendlerListe(token: string): Promise<Haendler[]> {
  const r = await sumup(token, 'GET', 'v0.1/memberships?limit=25&status=accepted')
  const liste: Haendler[] = []
  // deno-lint-ignore no-explicit-any
  for (const m of (r.items ?? []).filter((x: any) => (x.resource?.type ?? x.type) === 'merchant').slice(0, 12)) {
    try {
      const h = await haendler(token, m.resource?.id ?? m.resource_id)
      liste.push({ ...h, name: m.resource?.name ?? h.name })
    } catch (e) { if (!(e instanceof SumupFehler) || (e.status !== 403 && e.status !== 404)) throw e }
  }
  return liste
}

// ── Bezahlvorgang ──
const basis = () => (Deno.env.get('OEFFENTLICHE_API_URL') ?? Deno.env.get('SUPABASE_URL')!).replace(/\/$/, '')

// deno-lint-ignore no-explicit-any
export async function bezahlseite(token: string, k: Konto, r: any, anzahl: number, titel: string): Promise<{ id: string; url: string }> {
  const c = await sumup(token, 'POST', 'v0.1/checkouts', {
    checkout_reference: r.bestellung_id, amount: Math.round(r.preis * 100) * anzahl / 100, currency: 'EUR', merchant_code: k.haendler,
    description: `${anzahl} × ${titel}`.slice(0, 200), hosted_checkout: { enabled: true },
    redirect_url: `${APP_URL}/shop/bestellung/${r.zugang}`, return_url: `${basis()}/functions/v1/sumup-webhook?schule=${r.schule_id}`,
    valid_until: new Date(Date.now() + 31 * 60_000).toISOString(),
  })
  if (!c.id || !/^https:\/\//.test(c.hosted_checkout_url ?? '')) throw new Error('SumUp: keine Bezahlseite erhalten')
  return { id: c.id, url: c.hosted_checkout_url }
}
export const checkoutLaden = (token: string, id: string) => sumup(token, 'GET', `v0.1/checkouts/${encodeURIComponent(id)}`)

// Bezahlseite schließen; false = geht nicht mehr (z. B. gerade bezahlt)
export async function bezahlseiteSchliessen(token: string, id: string): Promise<boolean> {
  try { await sumup(token, 'DELETE', `v0.1/checkouts/${encodeURIComponent(id)}`); return true } catch {
    try { return (await checkoutLaden(token, id)).status === 'EXPIRED' } catch { return false }
  }
}

// Bezahlten Vorgang verbuchen; wiederholbar. Wirft bei Fehlern, damit die Meldung bzw. der Abgleich es erneut versucht.
// deno-lint-ignore no-explicit-any
export async function abschliessenSumup(d: DB, schule: string, k: Konto, token: string, c: any): Promise<string> {
  if (c.status !== 'PAID') return 'offen'
  // deno-lint-ignore no-explicit-any
  const zahlung = (c.transactions ?? []).find((t: any) => t.status === 'SUCCESSFUL')?.id ?? c.transaction_id
  if (!zahlung || !c.checkout_reference) throw new Error('SumUp: bezahlt, aber ohne Transaktion')
  if (c.merchant_code !== k.haendler) return 'ungueltig'
  const { data: b } = await d.from('ticket_bestellungen').select('demo').eq('id', c.checkout_reference).eq('schule_id', schule).maybeSingle()
  if (!b || b.demo === k.livemode) return 'ungueltig'   // nie echtes Geld für Demo-Tickets oder umgekehrt
  const { ergebnis } = await rpc(d, 'shop_bezahlt', {
    p_schule_id: schule, p_bestellung_id: c.checkout_reference, p_checkout_id: c.id, p_zahlung_id: zahlung, p_betrag: c.amount, p_waehrung: c.currency, p_anbieter: 'sumup',
  })
  if (ergebnis === 'erstatten') {
    const fertig = await unterSperre(d, zahlung, async () => {
      const { data: z } = await d.from('ticket_zahlungen').select('ticket_erstattungen(betrag)').eq('externe_id', zahlung).single()
      const bestaetigt = cent((z.ticket_erstattungen ?? []).reduce((s: number, r: { betrag: number }) => s + Number(r.betrag), 0))
      if (bestaetigt >= cent(c.amount)) return
      await auszahlen(token, k, zahlung, cent(c.amount) - bestaetigt, bestaetigt)
      await rpc(d, 'shop_erstattet', { p_zahlung_id: zahlung, p_erstattung_id: `su:auto:${zahlung}`, p_betrag: (cent(c.amount) - bestaetigt) / 100 })
    })
    if (!fertig) throw new Error('SumUp: Erstattung läuft noch')
    return 'erstattet'
  }
  if (ergebnis === 'bezahlt' || ergebnis === 'schon_bezahlt') await ticketsMailen(d, c.checkout_reference)
  return ergebnis
}

// Einen offenen Vorgang bei SumUp nachsehen und zu Ende bringen (Meldung, Rückkehr des Käufers, Abgleich)
export async function vorgangPruefen(d: DB, k: Konto, b: { id: string; schule_id: string; checkout_id: string }): Promise<string> {
  const token = await zugang(d, k, b.schule_id)
  const c = await checkoutLaden(token, b.checkout_id)
  let e = 'offen', ende = false
  if (c.status === 'PAID') {
    e = await abschliessenSumup(d, b.schule_id, k, token, c)
    ende = e !== 'offen'
    if (e === 'ungueltig') console.warn('[sumup] passt zu keiner Bestellung', b.checkout_id)
  } else if (c.status === 'EXPIRED') {
    await rpc(d, 'shop_verwerfen', { p_bestellung_id: b.id })
    ende = true
  }
  if (ende) await d.from('ticket_bestellungen').update({ checkout_ende: true }).eq('id', b.id).eq('checkout_id', b.checkout_id)
  return e
}

// ── Erstattung ──
const cent = (x: number) => Math.round(Number(x) * 100)

// Führt tun() aus, wenn niemand sonst gerade für diese Zahlung erstattet. false = gesperrt.
// Bei unklarem Ausgang (Zeitüberschreitung, 5xx, 409) bleibt die Sperre liegen: SumUp zeigt die Erstattung evtl. verzögert an.
async function unterSperre(d: DB, zahlung: string, tun: () => Promise<void>): Promise<boolean> {
  const name = `erstattung:${zahlung}`
  if (!await rpc(d, 'zahlung_sperren', { p_name: name, p_sekunden: SPERRE_ERSTATTUNG })) return false
  let unklar = true
  try {
    await tun()
    unklar = false
  } catch (e) {
    if (e instanceof VorAuszahlung || (e instanceof SumupFehler && e.status >= 400 && e.status < 500 && ![408, 409].includes(e.status))) unklar = false
    throw e instanceof VorAuszahlung ? e.grund : e
  } finally { if (!unklar) await rpc(d, 'zahlung_entsperren', { p_name: name }) }
  return true
}
class VorAuszahlung extends Error { constructor(public grund: Error) { super(grund.message) } }

// Was SumUp über das von uns Verbuchte hinaus schon erstattet hat (verlorene Antwort oder von Hand), wird angerechnet
async function auszahlen(token: string, k: Konto, zahlung: string, betrag: number, bestaetigt: number) {
  let rest: number
  try {
    const t = await sumup(token, 'GET', `v2.1/merchants/${encodeURIComponent(k.haendler!)}/transactions?id=${encodeURIComponent(zahlung)}`)
    // deno-lint-ignore no-explicit-any
    const summe = (liste: any[], feld: string) => (liste ?? []).filter(x => x[feld] === 'REFUND' && x.status !== 'FAILED').reduce((s, x) => s + Math.abs(cent(x.amount)), 0)
    const schon = Math.max(summe(t.transaction_events, 'event_type'), summe(t.events, 'type'), cent(t.refunded_amount ?? 0),
      t.simple_status === 'CANCELLED' ? cent(t.amount) : 0)
    rest = betrag - Math.max(0, schon - bestaetigt)
  } catch (e) { throw new VorAuszahlung(e as Error) }   // noch nichts ausgelöst
  if (rest > 0) await sumup(token, 'POST', `v1.0/merchants/${encodeURIComponent(k.haendler!)}/payments/${encodeURIComponent(zahlung)}/refunds`, { amount: rest })
}

// Beauftragte Erstattung (ticket_online_erstattungen) auszahlen und festhalten; beliebig wiederholbar
export async function erstattenSumup(d: DB, k: Konto, schule: string, vorgang: string): Promise<boolean> {
  const token = await zugang(d, k, schule)
  const { zahlung } = await rpc(d, 'shop_erstattung_info', { p_vorgang: vorgang })
  return await unterSperre(d, zahlung, async () => {
    const i = await rpc(d, 'shop_erstattung_info', { p_vorgang: vorgang })   // unter der Sperre frisch lesen
    if (i.erledigt) return
    await auszahlen(token, k, zahlung, cent(i.betrag), cent(i.bestaetigt))
    await rpc(d, 'shop_erstattung_fertig', { p_vorgang: vorgang, p_erstattungen: [{ id: `su:${vorgang}`, betrag: i.betrag }] })
  })
}
