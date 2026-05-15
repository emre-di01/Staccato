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

function genPass(): string {
  const chars = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789'
  return Array.from({ length: 12 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return new Response('Method Not Allowed', { status: 405, headers: CORS })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader?.startsWith('Bearer ')) return new Response('Unauthorized', { status: 401, headers: CORS })

  const supabase = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
  const userClient = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_ANON_KEY')!, {
    global: { headers: { Authorization: authHeader } }
  })

  const { data: { user }, error: authErr } = await userClient.auth.getUser()
  if (authErr || !user) return new Response('Unauthorized', { status: 401, headers: CORS })

  const { data: profil } = await supabase.from('profiles').select('rolle').eq('id', user.id).single()
  if (profil?.rolle !== 'superadmin') return new Response('Forbidden', { status: 403, headers: CORS })

  let body: { anfrage_id: string }
  try { body = await req.json() } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: CORS })
  }

  const { data: anfrage } = await supabase.from('demo_anfragen').select('*').eq('id', body.anfrage_id).single()
  if (!anfrage) return new Response(JSON.stringify({ error: 'Anfrage nicht gefunden' }), { status: 404, headers: CORS })
  if (anfrage.status !== 'ausstehend') return new Response(JSON.stringify({ error: 'Anfrage bereits bearbeitet' }), { status: 409, headers: CORS })

  try {
    const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 8)
    const adminEmail    = `demo-admin-${suffix}@staccato-music.de`
    const lehrerEmail   = `demo-lehrer-${suffix}@staccato-music.de`
    const schuelerEmail = `demo-schueler-${suffix}@staccato-music.de`
    const vorstandEmail = `demo-vorstand-${suffix}@staccato-music.de`
    const adminPass    = genPass()
    const lehrerPass   = genPass()
    const schuelerPass = genPass()
    const vorstandPass = genPass()
    const expiresAt    = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString()

    // 1. Create demo school
    const { data: schule, error: schuleErr } = await supabase.from('schulen').insert({
      name: anfrage.schul_name,
      ist_demo: true,
      demo_expires_at: expiresAt,
      aktiv: true,
    }).select('id').single()
    if (schuleErr || !schule) throw new Error(`Schule konnte nicht erstellt werden: ${schuleErr?.message}`)
    const schuleId = schule.id

    // 2. Create 3 auth users + profiles + memberships
    async function createDemoUser(email: string, pass: string, name: string, rolle: string) {
      const { data: { user: u }, error: createErr } = await supabase.auth.admin.createUser({
        email, password: pass, email_confirm: true,
      })
      if (createErr || !u) throw new Error(`Benutzer konnte nicht erstellt werden: ${createErr?.message ?? 'unbekannter Fehler'}`)
      await supabase.from('profiles').update({
        voller_name: name, rolle, schule_id: schuleId, letzte_schule_id: schuleId,
      }).eq('id', u.id)
      await supabase.from('schul_mitgliedschaften').insert({ user_id: u.id, schule_id: schuleId, rolle })
      return u.id
    }

    const adminId    = await createDemoUser(adminEmail, adminPass, 'Max Mustermann', 'admin')
    const lehrerId   = await createDemoUser(lehrerEmail, lehrerPass, 'Lisa Weber', 'lehrer')
    const schuelerId = await createDemoUser(schuelerEmail, schuelerPass, 'Tom Fischer', 'schueler')
    const vorstandId = await createDemoUser(vorstandEmail, vorstandPass, 'Anna Becker', 'vorstand')

    // 3. Seed demo data
    // Rooms
    const { data: raeume, error: raumErr } = await supabase.from('raeume').insert([
      { schule_id: schuleId, name: 'Raum 101', kapazitaet: 8, ausstattung: ['Klavier', 'Notenständer'] },
      { schule_id: schuleId, name: 'Aula', kapazitaet: 80, ausstattung: ['Bühne', 'Flügel', 'PA-Anlage'] },
    ]).select('id, name')
    if (raumErr || !raeume) throw new Error(`Räume konnten nicht erstellt werden: ${raumErr?.message}`)
    const raum101Id = raeume[0].id
    const aulaId    = raeume[1].id

    // Instruments
    const { data: instrumente, error: instrErr } = await supabase.from('instrumente').insert([
      { schule_id: schuleId, icon: '🎹', name_de: 'Klavier', name_en: 'Piano', name_tr: 'Piyano', aktiv: true },
      { schule_id: schuleId, icon: '🎸', name_de: 'Gitarre', name_en: 'Guitar', name_tr: 'Gitar', aktiv: true },
      { schule_id: schuleId, icon: '🎻', name_de: 'Violine', name_en: 'Violin', name_tr: 'Keman', aktiv: true },
    ]).select('id, name_de')
    if (instrErr || !instrumente) throw new Error(`Instrumente konnten nicht erstellt werden: ${instrErr?.message}`)
    const klavierId = instrumente[0].id
    const gitarreId = instrumente[1].id

    await supabase.from('lehrer_instrumente').insert([
      { lehrer_id: lehrerId, instrument_id: klavierId },
      { lehrer_id: lehrerId, instrument_id: gitarreId },
    ])

    // Courses
    const heute = new Date()
    const von   = heute.toISOString().slice(0, 10)
    const bis   = new Date(Date.now() + 7 * 7 * 24 * 60 * 60 * 1000).toISOString().slice(0, 10)

    const { data: k1, error: k1Err } = await supabase.from('unterricht').insert({
      schule_id: schuleId, name: 'Einzelunterricht Klavier', typ: 'einzel',
      wochentag: 'mo', uhrzeit_von: '15:00', uhrzeit_bis: '15:45',
      raum_id: raum101Id, instrument_id: klavierId,
      abrechnungs_typ: 'einzeln', farbe: '#6366f1',
    }).select('id').single()
    if (k1Err || !k1) throw new Error(`Kurs 1 fehlgeschlagen: ${k1Err?.message}`)
    const kurs1Id = k1.id

    const { data: k2, error: k2Err } = await supabase.from('unterricht').insert({
      schule_id: schuleId, name: 'Gitarren-Gruppe', typ: 'gruppe',
      wochentag: 'mi', uhrzeit_von: '17:00', uhrzeit_bis: '18:00',
      raum_id: raum101Id, instrument_id: gitarreId,
      abrechnungs_typ: 'pauschale', farbe: '#f59e0b',
    }).select('id').single()
    if (k2Err || !k2) throw new Error(`Kurs 2 fehlgeschlagen: ${k2Err?.message}`)
    const kurs2Id = k2.id

    const { data: k3, error: k3Err } = await supabase.from('unterricht').insert({
      schule_id: schuleId, name: 'Schulchor', typ: 'chor',
      wochentag: 'do', uhrzeit_von: '18:00', uhrzeit_bis: '19:30',
      raum_id: aulaId, instrument_id: null,
      abrechnungs_typ: 'pauschale', farbe: '#10b981',
    }).select('id').single()
    if (k3Err || !k3) throw new Error(`Kurs 3 fehlgeschlagen: ${k3Err?.message}`)
    const kurs3Id = k3.id

    // Teacher + student links
    await supabase.from('unterricht_lehrer').insert([
      { unterricht_id: kurs1Id, lehrer_id: lehrerId, rolle: 'hauptlehrer' },
      { unterricht_id: kurs2Id, lehrer_id: lehrerId, rolle: 'hauptlehrer' },
      { unterricht_id: kurs3Id, lehrer_id: lehrerId, rolle: 'hauptlehrer' },
    ])
    await supabase.from('unterricht_schueler').insert([
      { unterricht_id: kurs1Id, schueler_id: schuelerId, status: 'aktiv' },
      { unterricht_id: kurs2Id, schueler_id: schuelerId, status: 'aktiv' },
      { unterricht_id: kurs3Id, schueler_id: schuelerId, status: 'aktiv' },
    ])

    // Generate lessons for all 3 courses
    await Promise.all([
      supabase.rpc('stunden_generieren', { unterricht_id: kurs1Id, von, bis }),
      supabase.rpc('stunden_generieren', { unterricht_id: kurs2Id, von, bis }),
      supabase.rpc('stunden_generieren', { unterricht_id: kurs3Id, von, bis }),
    ])

    // Repertoire pieces
    const { data: stueck1 } = await supabase.from('stuecke').insert({
      titel: 'Für Elise', komponist: 'Ludwig van Beethoven',
      tonart: 'a-Moll', tempo: 80,
      erstellt_von: adminId,
    }).select('id').single()
    const { data: stueck2 } = await supabase.from('stuecke').insert({
      titel: 'Knockin\' on Heaven\'s Door', komponist: 'Bob Dylan',
      tonart: 'G-Dur', tempo: 72,
      erstellt_von: adminId,
    }).select('id').single()
    await supabase.from('unterricht_stuecke').insert([
      { unterricht_id: kurs1Id, stueck_id: stueck1!.id, status: 'aktuell', reihenfolge: 1 },
      { unterricht_id: kurs2Id, stueck_id: stueck2!.id, status: 'aktuell', reihenfolge: 1 },
    ])

    // Event
    const konzertDatum = new Date(Date.now() + 50 * 24 * 60 * 60 * 1000).toISOString()
    const { data: event } = await supabase.from('events').insert({
      schule_id: schuleId, titel: 'Frühjahrskonzert',
      typ: 'konzert', beginn: konzertDatum,
      ort: anfrage.schul_name, oeffentlich: true,
      beschreibung: 'Das jährliche Frühjahrskonzert – alle Schülerinnen und Schüler sind eingeladen.',
    }).select('id').single()
    if (event) {
      await supabase.from('event_teilnehmer').insert([
        { event_id: event.id, profil_id: adminId,    zusage: 'zugesagt' },
        { event_id: event.id, profil_id: lehrerId,   zusage: 'zugesagt' },
        { event_id: event.id, profil_id: schuelerId, zusage: 'offen' },
        { event_id: event.id, profil_id: vorstandId, zusage: 'zugesagt' },
      ])
    }

    // 4. Mark request as approved
    await supabase.from('demo_anfragen').update({
      status: 'genehmigt', genehmigt_am: new Date().toISOString(), schule_id: schuleId,
    }).eq('id', anfrage.id)

    // 5. Send credentials email to requester
    const ablauf = new Date(expiresAt).toLocaleDateString('de-DE', { day: '2-digit', month: 'long', year: 'numeric' })
    await transport.sendMail({
      from: SMTP_FROM, to: anfrage.email,
      subject: `Deine Staccato Demo-Zugangsdaten – ${anfrage.schul_name}`,
      html: html(`
        <h2 style="margin:0 0 8px;color:#1e293b">Hallo ${esc(anfrage.name)},</h2>
        <p style="margin:0 0 20px;color:#475569">
          deine persönliche Demo-Umgebung für <strong>${esc(anfrage.schul_name)}</strong> ist bereit!
          Du hast <strong>7 Tage</strong> (bis zum ${ablauf}), um alle Features auszuprobieren.
        </p>
        <p style="margin:0 0 16px;color:#475569;font-weight:600">Du erhältst vier Zugänge, um alle Nutzerrollen zu testen:</p>

        <table style="background:#f8fafc;border-radius:10px;padding:20px;width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td colspan="2" style="padding:0 0 12px;font-weight:700;color:#1e293b;font-size:15px">🏛 Administrator</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px;width:100px">E-Mail</td>
              <td style="padding:4px 0;font-family:monospace;font-size:14px;color:#1e293b">${esc(adminEmail)}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px">Passwort</td>
              <td style="padding:4px 0;font-family:monospace;font-size:14px;color:#1e293b">${esc(adminPass)}</td></tr>
        </table>

        <table style="background:#f8fafc;border-radius:10px;padding:20px;width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td colspan="2" style="padding:0 0 12px;font-weight:700;color:#1e293b;font-size:15px">🎹 Lehrer/in</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px;width:100px">E-Mail</td>
              <td style="padding:4px 0;font-family:monospace;font-size:14px;color:#1e293b">${esc(lehrerEmail)}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px">Passwort</td>
              <td style="padding:4px 0;font-family:monospace;font-size:14px;color:#1e293b">${esc(lehrerPass)}</td></tr>
        </table>

        <table style="background:#f8fafc;border-radius:10px;padding:20px;width:100%;border-collapse:collapse;margin-bottom:16px">
          <tr><td colspan="2" style="padding:0 0 12px;font-weight:700;color:#1e293b;font-size:15px">🎵 Schüler/in</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px;width:100px">E-Mail</td>
              <td style="padding:4px 0;font-family:monospace;font-size:14px;color:#1e293b">${esc(schuelerEmail)}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px">Passwort</td>
              <td style="padding:4px 0;font-family:monospace;font-size:14px;color:#1e293b">${esc(schuelerPass)}</td></tr>
        </table>

        <table style="background:#f8fafc;border-radius:10px;padding:20px;width:100%;border-collapse:collapse;margin-bottom:24px">
          <tr><td colspan="2" style="padding:0 0 12px;font-weight:700;color:#1e293b;font-size:15px">📋 Vorstand</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px;width:100px">E-Mail</td>
              <td style="padding:4px 0;font-family:monospace;font-size:14px;color:#1e293b">${esc(vorstandEmail)}</td></tr>
          <tr><td style="padding:4px 0;color:#64748b;font-size:14px">Passwort</td>
              <td style="padding:4px 0;font-family:monospace;font-size:14px;color:#1e293b">${esc(vorstandPass)}</td></tr>
        </table>

        <a href="${APP_URL}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 32px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">
          Zur App →
        </a>

        <p style="margin:24px 0 0;color:#94a3b8;font-size:12px">
          Die Demo-Schule und alle Zugänge werden am ${ablauf} automatisch gelöscht.
          Bei Interesse an einem echten Account melde dich einfach bei uns.
        </p>
      `),
    })

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...CORS, 'Content-Type': 'application/json' },
    })
  } catch (err) {
    console.error('[demo-genehmigen]', err)
    return new Response(JSON.stringify({ error: (err as Error).message }), { status: 500, headers: CORS })
  }
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
