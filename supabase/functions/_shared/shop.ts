// Gemeinsames von „shop“ und „stripe-webhook“: Schlüssel laden, Zahlung abschließen, Tickets verschicken
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import { entschluesseln } from './krypto.ts'
import { stripe } from './stripe.ts'

// deno-lint-ignore no-explicit-any
export type DB = any
export const APP_URL = (Deno.env.get('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '')
export const db = (): DB => createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } })

export async function rpc(d: DB, name: string, werte: Record<string, unknown>) {
  const { data, error } = await d.rpc(name, werte)
  if (error) throw new Error(`${name}: ${error.message}`)
  return data
}

export async function konto(d: DB, schuleId: string) {
  const { data } = await d.from('schul_zahlungskonten').select('schluessel, webhook_geheim, webhook_id, livemode').eq('schule_id', schuleId).maybeSingle()
  return data as { schluessel: string; webhook_geheim: string; webhook_id: string | null; livemode: boolean } | null
}
export const schluesselVon = (k: { schluessel: string }, schuleId: string) => entschluesseln(k.schluessel, schuleId, 'api')

// Bezahlte Checkout-Sitzung verbuchen; wiederholbar. Wirft bei Fehlern, damit Stripe den Webhook erneut schickt.
// deno-lint-ignore no-explicit-any
export async function abschliessen(d: DB, schuleId: string, schluessel: string, s: any): Promise<string> {
  const bestellung = s.client_reference_id as string
  const zahlung = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id
  if (s.payment_status !== 'paid' || !bestellung || !zahlung) return 'offen'
  const { ergebnis } = await rpc(d, 'shop_bezahlt', {
    p_schule_id: schuleId, p_bestellung_id: bestellung, p_checkout_id: s.id, p_zahlung_id: zahlung,
    p_betrag: s.amount_total / 100, p_waehrung: s.currency,
  })
  if (ergebnis === 'erstatten') {
    // gleicher Idempotenzschlüssel → auch bei Wiederholung nur eine Erstattung
    const r = await stripe(schluessel, 'POST', 'refunds', { payment_intent: zahlung }, `erstattung-${zahlung}`)
    await rpc(d, 'shop_erstattet', { p_zahlung_id: zahlung, p_erstattung_id: r.id, p_betrag: r.amount / 100 })
    return 'erstattet'
  }
  if (ergebnis === 'bezahlt' || ergebnis === 'schon_bezahlt') await ticketsMailen(d, bestellung)
  return ergebnis
}

// Erste Mail nach der Zahlung, genau eine; schlägt sie fehl, wird der Anspruch zurückgegeben und der Fehler gemeldet
export async function ticketsMailen(d: DB, bestellung: string) {
  if (!mailBereit()) { console.warn('[shop] kein Mailversand eingerichtet'); return }
  if (!await rpc(d, 'shop_mail_beanspruchen', { p_bestellung_id: bestellung })) return
  try { await ticketsSenden(d, bestellung) } catch (e) {
    await rpc(d, 'shop_mail_beanspruchen', { p_bestellung_id: bestellung, p_zurueck: true })
    throw e
  }
}

export const mailBereit = () => !!Deno.env.get('SMTP_USER')

// Gültige Tickets an die hinterlegte Adresse schicken; false: es gibt keine gültigen
export async function ticketsSenden(d: DB, bestellung: string): Promise<boolean> {
  const { data: b } = await d.from('ticket_bestellungen').select('zugang').eq('id', bestellung).single()
  const o = await rpc(d, 'shop_bestellung', { p_zugang: b.zugang })
  const gueltig = (o.tickets as { id: string; code: string; status: string }[]).filter(t => t.status === 'gueltig')
  if (!gueltig.length) return false
  const [{ ticketMail }, { default: nodemailer }] = await Promise.all([import('../send-email/tickets.ts'), import('npm:nodemailer@6')])
  const mail = await ticketMail({ name: o.name, lang: o.sprache ?? 'de', event: o.event, schule: o.schule, tickets: gueltig, link: `${APP_URL}/shop/bestellung/${b.zugang}` })
  const port = parseInt(Deno.env.get('SMTP_PORT') ?? '465')
  const t = nodemailer.createTransport({ host: Deno.env.get('SMTP_HOST'), port, secure: port === 465, auth: { user: Deno.env.get('SMTP_USER'), pass: Deno.env.get('SMTP_PASS') } })
  await t.sendMail({
    from: `Staccato <${Deno.env.get('SMTP_FROM')}>`, to: o.email, subject: mail.subject, attachments: mail.attachments,
    html: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body style="margin:0;background:#f1f5f9;font-family:-apple-system,'Segoe UI',Roboto,sans-serif"><table width="100%" cellpadding="0" cellspacing="0" style="padding:32px 16px"><tr><td align="center"><table width="100%" style="max-width:560px;background:#ffffff;border-radius:16px"><tr><td style="padding:32px">${mail.content}</td></tr></table></td></tr></table></body></html>`,
  })
  return true
}
