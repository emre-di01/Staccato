import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'
import nodemailer from 'npm:nodemailer@6'

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SMTP_HOST = Deno.env.get('SMTP_HOST') ?? 'smtp.1blu.de'
const SMTP_PORT = parseInt(Deno.env.get('SMTP_PORT') ?? '465')
const SMTP_USER = Deno.env.get('SMTP_USER') ?? ''
const SMTP_PASS = Deno.env.get('SMTP_PASS') ?? ''
const SMTP_FROM = `Staccato <${Deno.env.get('SMTP_FROM') ?? 'staccato@401dev.de'}>`
const APP_URL   = (Deno.env.get('APP_URL') ?? 'http://localhost:5173').replace(/\/$/, '')

const transport = nodemailer.createTransport({
  host: SMTP_HOST,
  port: SMTP_PORT,
  secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) return new Response('Unauthorized', { status: 401, headers: CORS })

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  let body: Record<string, unknown>
  try { body = await req.json() } catch {
    return new Response('Invalid JSON', { status: 400, headers: CORS })
  }

  try {
    const { type } = body
    if (type === 'welcome')           await sendWelcome(body, supabase)
    else if (type === 'event_invite') await sendEventInvite(body, supabase)
    else if (type === 'new_piece')    await sendNewPiece(body, supabase)
    else return new Response(JSON.stringify({ error: 'Unknown type' }), { status: 400, headers: CORS })

    return new Response(JSON.stringify({ ok: true }), { headers: { ...CORS, 'Content-Type': 'application/json' } })
  } catch (err) {
    console.error('[send-email]', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: CORS })
  }
})

// ─── Welcome ──────────────────────────────────────────────────

async function sendWelcome(body: Record<string, unknown>, _supabase: ReturnType<typeof createClient>) {
  const { email, voller_name, passwort, rolle } = body as {
    email: string; voller_name: string; passwort: string; rolle: string
  }
  const rollenText: Record<string, string> = {
    schueler: 'Schüler/in', lehrer: 'Lehrer/in',
    eltern: 'Elternteil', admin: 'Administrator/in', superadmin: 'Administrator/in',
  }
  await transport.sendMail({
    from: SMTP_FROM,
    to: email,
    subject: 'Willkommen bei Staccato – deine Zugangsdaten',
    html: html(`
      <h2 style="margin:0 0 8px;color:#1e293b">Hallo ${esc(voller_name)},</h2>
      <p style="margin:0 0 20px;color:#475569">dein Konto bei <strong>Staccato</strong> wurde angelegt.
      Du bist als <strong>${esc(rollenText[rolle] ?? rolle)}</strong> registriert.</p>

      <table style="background:#f8fafc;border-radius:10px;padding:20px;width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:120px">E-Mail</td>
            <td style="padding:6px 0;font-weight:600;color:#1e293b">${esc(email)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px">Passwort</td>
            <td style="padding:6px 0;font-weight:600;color:#1e293b">${esc(passwort)}</td></tr>
      </table>

      <p style="margin:20px 0 8px;color:#475569">Melde dich jetzt an und ändere dein Passwort unter <em>Profil → Passwort ändern</em>.</p>
      <a href="${APP_URL}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Zur App</a>
    `),
  })
}

// ─── Event Invitation ─────────────────────────────────────────

async function sendEventInvite(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { event_id, profil_id } = body as { event_id: string; profil_id: string }

  const [{ data: event }, { data: profil }, { data: { user } }] = await Promise.all([
    supabase.from('events').select('titel, typ, beginn, ende, ort, beschreibung').eq('id', event_id).single(),
    supabase.from('profiles').select('voller_name, email_benachrichtigungen').eq('id', profil_id).single(),
    supabase.auth.admin.getUserById(profil_id),
  ])

  if (!user?.email || !event) return
  if (profil?.email_benachrichtigungen?.event_invite === false) return

  const beginn = new Date(event.beginn as string)
  const datum  = beginn.toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
  const uhrzeit = beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })
  const typLabel: Record<string, string> = {
    konzert: 'Konzert', vorspiel: 'Vorspiel', pruefung: 'Prüfung',
    veranstaltung: 'Veranstaltung', sonstiges: 'Veranstaltung',
  }

  await transport.sendMail({
    from: SMTP_FROM,
    to: user.email,
    subject: `Einladung: ${event.titel}`,
    html: html(`
      <h2 style="margin:0 0 8px;color:#1e293b">Hallo ${esc(profil?.voller_name ?? '')},</h2>
      <p style="margin:0 0 20px;color:#475569">du wurdest zu folgendem ${esc(typLabel[event.typ as string] ?? 'Event')} eingeladen:</p>

      <table style="background:#f8fafc;border-radius:10px;padding:20px;width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:100px">Titel</td>
            <td style="padding:6px 0;font-weight:700;color:#1e293b;font-size:16px">${esc(event.titel as string)}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px">Datum</td>
            <td style="padding:6px 0;color:#1e293b">${datum}</td></tr>
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px">Uhrzeit</td>
            <td style="padding:6px 0;color:#1e293b">${uhrzeit} Uhr</td></tr>
        ${event.ort ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px">Ort</td>
            <td style="padding:6px 0;color:#1e293b">${esc(event.ort as string)}</td></tr>` : ''}
        ${event.beschreibung ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;vertical-align:top">Hinweis</td>
            <td style="padding:6px 0;color:#475569;font-size:14px">${esc(event.beschreibung as string)}</td></tr>` : ''}
      </table>

      <p style="margin:20px 0 8px;color:#475569">Bitte bestätige deine Teilnahme in der App.</p>
      <a href="${APP_URL}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Zur App</a>
    `),
  })
}

// ─── New Piece ────────────────────────────────────────────────

async function sendNewPiece(body: Record<string, unknown>, supabase: ReturnType<typeof createClient>) {
  const { unterricht_id, stueck_id } = body as { unterricht_id: string; stueck_id: string }

  const [{ data: stueck }, { data: kurs }, { data: schuelerListe }] = await Promise.all([
    supabase.from('stuecke').select('titel, komponist').eq('id', stueck_id).single(),
    supabase.from('unterricht').select('name').eq('id', unterricht_id).single(),
    supabase.from('unterricht_schueler').select('schueler_id').eq('unterricht_id', unterricht_id).eq('status', 'aktiv'),
  ])

  if (!stueck || !kurs || !schuelerListe?.length) return

  await Promise.allSettled(
    schuelerListe.map(async ({ schueler_id }) => {
      const [{ data: profil }, { data: { user } }] = await Promise.all([
        supabase.from('profiles').select('voller_name, email_benachrichtigungen').eq('id', schueler_id).single(),
        supabase.auth.admin.getUserById(schueler_id),
      ])
      if (!user?.email) return
      if (profil?.email_benachrichtigungen?.new_piece === false) return

      await transport.sendMail({
        from: SMTP_FROM,
        to: user.email,
        subject: `Neues Stück in deinem Kurs: ${stueck.titel}`,
        html: html(`
          <h2 style="margin:0 0 8px;color:#1e293b">Hallo ${esc(profil?.voller_name ?? '')},</h2>
          <p style="margin:0 0 20px;color:#475569">
            Im Kurs <strong>${esc(kurs.name as string)}</strong> wurde ein neues Stück hinzugefügt:
          </p>

          <table style="background:#f8fafc;border-radius:10px;padding:20px;width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:120px">Titel</td>
                <td style="padding:6px 0;font-weight:700;color:#1e293b;font-size:16px">${esc(stueck.titel as string)}</td></tr>
            ${stueck.komponist ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px">Komponist</td>
                <td style="padding:6px 0;color:#1e293b">${esc(stueck.komponist as string)}</td></tr>` : ''}
            <tr><td style="padding:6px 0;color:#64748b;font-size:14px">Kurs</td>
                <td style="padding:6px 0;color:#1e293b">${esc(kurs.name as string)}</td></tr>
          </table>

          <p style="margin:20px 0 8px;color:#475569">Das Stück ist jetzt in deiner Staccato-App verfügbar.</p>
          <a href="${APP_URL}" style="display:inline-block;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Zur App</a>
        `),
      })
    })
  )
}

// ─── Helpers ──────────────────────────────────────────────────

function esc(str: string): string {
  return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;')
}

function html(content: string): string {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Staccato</title></head>
<body style="margin:0;padding:0;background:#f1f5f9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif">
<table width="100%" cellpadding="0" cellspacing="0" style="background:#f1f5f9;padding:40px 20px">
  <tr><td align="center">
    <table width="100%" style="max-width:560px;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)">
      <tr><td style="background:#6366f1;padding:28px 32px">
        <p style="margin:0;color:#fff;font-size:22px;font-weight:800;letter-spacing:-.5px">🎵 Staccato</p>
        <p style="margin:4px 0 0;color:#c7d2fe;font-size:13px">Musikschule</p>
      </td></tr>
      <tr><td style="padding:32px">
        ${content}
        <hr style="margin:32px 0;border:none;border-top:1px solid #e2e8f0">
        <p style="margin:0;color:#94a3b8;font-size:12px">Diese Nachricht wurde automatisch von Staccato versandt. Bitte nicht direkt antworten.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
