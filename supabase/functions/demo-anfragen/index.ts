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
const APP_URL = (Deno.env.get('APP_URL') ?? 'https://app.staccato-music.de').replace(/\/$/, '')

const transport = nodemailer.createTransport({
  host: SMTP_HOST, port: SMTP_PORT, secure: SMTP_PORT === 465,
  auth: { user: SMTP_USER, pass: SMTP_PASS },
})

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS })

  let body: { name?: string; email?: string; schul_name?: string; beschreibung?: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS })
  }

  const { name, email, schul_name, beschreibung } = body
  if (!name?.trim() || !email?.trim() || !schul_name?.trim()) {
    return new Response(JSON.stringify({ error: 'Name, E-Mail und Schulname sind erforderlich.' }), { status: 400, headers: CORS })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // Max 3 pending requests per email
  const { count } = await supabase
    .from('demo_anfragen')
    .select('id', { count: 'exact', head: true })
    .eq('email', email.trim().toLowerCase())
    .eq('status', 'ausstehend')
  if ((count ?? 0) >= 3) {
    return new Response(JSON.stringify({ error: 'Zu viele ausstehende Anfragen für diese E-Mail-Adresse.' }), { status: 429, headers: CORS })
  }

  const { data: anfrage, error } = await supabase
    .from('demo_anfragen')
    .insert({ name: name.trim(), email: email.trim().toLowerCase(), schul_name: schul_name.trim(), beschreibung: beschreibung?.trim() ?? null })
    .select('id')
    .single()

  if (error) {
    console.error('[demo-anfragen]', error)
    return new Response(JSON.stringify({ error: 'Fehler beim Speichern.' }), { status: 500, headers: CORS })
  }

  // Confirmation to requester
  await transport.sendMail({
    from: SMTP_FROM, to: email.trim(),
    subject: 'Deine Demo-Anfrage bei Staccato',
    html: html(`
      <h2 style="margin:0 0 8px;color:#1e293b">Hallo ${esc(name)},</h2>
      <p style="margin:0 0 20px;color:#475569">
        vielen Dank für dein Interesse an Staccato! Wir haben deine Demo-Anfrage für
        <strong>${esc(schul_name)}</strong> erhalten.
      </p>
      <p style="margin:0 0 20px;color:#475569">
        Wir prüfen deine Anfrage und melden uns <strong>in der Regel innerhalb von 24 Stunden</strong>
        mit deinen persönlichen Demo-Zugangsdaten bei dir.
      </p>
      <table style="background:#f8fafc;border-radius:10px;padding:20px;width:100%;border-collapse:collapse">
        <tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:120px">Schulname</td>
            <td style="padding:6px 0;font-weight:600;color:#1e293b">${esc(schul_name)}</td></tr>
        ${beschreibung ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;vertical-align:top">Beschreibung</td>
            <td style="padding:6px 0;color:#475569;font-size:14px;line-height:1.6">${esc(beschreibung)}</td></tr>` : ''}
      </table>
      <p style="margin:24px 0 0;color:#94a3b8;font-size:13px">
        Falls du Fragen hast, antworte einfach auf diese E-Mail.
      </p>
    `),
  }).catch(e => console.error('[demo-anfragen] confirmation mail failed:', e))

  // Notification to superadmin
  const { data: admins } = await supabase.from('profiles').select('id').eq('rolle', 'superadmin').limit(5)
  if (admins?.length) {
    await Promise.allSettled(admins.map(async (a) => {
      const { data: { user } } = await supabase.auth.admin.getUserById(a.id)
      if (!user?.email) return
      await transport.sendMail({
        from: SMTP_FROM, to: user.email,
        subject: `Neue Demo-Anfrage: ${schul_name}`,
        html: html(`
          <h2 style="margin:0 0 8px;color:#1e293b">Neue Demo-Anfrage</h2>
          <p style="margin:0 0 20px;color:#475569">Eine neue Demo-Anfrage ist eingegangen:</p>
          <table style="background:#f8fafc;border-radius:10px;padding:20px;width:100%;border-collapse:collapse">
            <tr><td style="padding:6px 0;color:#64748b;font-size:14px;width:120px">Name</td>
                <td style="padding:6px 0;font-weight:600;color:#1e293b">${esc(name)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;font-size:14px">E-Mail</td>
                <td style="padding:6px 0;color:#1e293b">${esc(email)}</td></tr>
            <tr><td style="padding:6px 0;color:#64748b;font-size:14px">Schulname</td>
                <td style="padding:6px 0;color:#1e293b">${esc(schul_name)}</td></tr>
            ${beschreibung ? `<tr><td style="padding:6px 0;color:#64748b;font-size:14px;vertical-align:top">Beschreibung</td>
                <td style="padding:6px 0;color:#475569;font-size:14px;line-height:1.6">${esc(beschreibung)}</td></tr>` : ''}
          </table>
          <a href="${APP_URL}/superadmin/demos" style="display:inline-block;margin-top:24px;background:#6366f1;color:#fff;padding:12px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">Anfrage verwalten →</a>
        `),
      })
    }))
  }

  return new Response(JSON.stringify({ ok: true, id: anfrage.id }), {
    headers: { ...CORS, 'Content-Type': 'application/json' },
  })
})

function esc(s: string) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;') }
function html(content: string) {
  return `<!DOCTYPE html><html lang="de"><head><meta charset="UTF-8"><title>Staccato</title></head>
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
        <p style="margin:0;color:#94a3b8;font-size:12px">Diese Nachricht wurde automatisch von Staccato versandt.</p>
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}
