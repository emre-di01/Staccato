import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

serve(async (req) => {
  const url = new URL(req.url)
  const token = url.searchParams.get('token')

  if (!token) {
    return new Response('Missing token', { status: 400, headers: { 'Content-Type': 'text/plain' } })
  }

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  )

  // resolve user by token
  const { data: profil } = await supabase
    .from('profiles')
    .select('id, voller_name, rolle, schule_id, schulen(zeitzone)')
    .eq('kalender_token', token)
    .single()

  if (!profil) {
    return new Response('Invalid token', { status: 401, headers: { 'Content-Type': 'text/plain' } })
  }

  const tz = (profil.schulen as { zeitzone?: string } | null)?.zeitzone ?? 'Europe/Berlin'
  const events: ICalEvent[] = []

  // ─── Stunden ──────────────────────────────────────────────
  const rolle = profil.rolle as string
  const seit = new Date(Date.now() - 90 * 86400000).toISOString()

  async function stundenFuerIds(unterrichtIds: string[]) {
    if (unterrichtIds.length === 0) return
    const { data: stunden } = await supabase
      .from('stunden')
      .select('id, beginn, ende, unterricht(name, typ, raeume(name)), raum_override:raeume(name)')
      .in('unterricht_id', unterrichtIds)
      .neq('status', 'abgesagt')
      .gte('beginn', seit)
    for (const s of stunden ?? []) {
      const u = s.unterricht as { name?: string; raeume?: { name?: string } | null } | null
      const kursName = u?.name ?? 'Unterricht'
      const raum = (s.raum_override as { name?: string } | null)?.name ?? u?.raeume?.name ?? ''
      events.push({
        uid: `stunde-${s.id}@staccato`,
        summary: `🎵 ${kursName}`,
        dtstart: s.beginn,
        dtend:   s.ende,
        location: raum,
        description: '',
      })
    }
  }

  // collect course IDs the user is personally involved in
  const unterrichtIds = new Set<string>()

  // courses where user teaches
  if (rolle === 'lehrer' || rolle === 'admin' || rolle === 'superadmin') {
    const { data: rows } = await supabase
      .from('unterricht_lehrer')
      .select('unterricht_id')
      .eq('lehrer_id', profil.id)
    for (const r of rows ?? []) unterrichtIds.add(r.unterricht_id)
  }

  // courses where user is enrolled as student
  {
    const { data: rows } = await supabase
      .from('unterricht_schueler')
      .select('unterricht_id')
      .eq('schueler_id', profil.id)
      .eq('status', 'aktiv')
    for (const r of rows ?? []) unterrichtIds.add(r.unterricht_id)
  }

  await stundenFuerIds([...unterrichtIds])

  // ─── Events (zugesagt) ────────────────────────────────────
  const { data: tnRows } = await supabase
    .from('event_teilnehmer')
    .select('event_id, events(id, titel, beginn, ende, ort, beschreibung, typ)')
    .eq('profil_id', profil.id)
    .eq('zusage', 'zugesagt')

  for (const tn of tnRows ?? []) {
    const ev = tn.events as {
      id: string; titel: string; beginn: string; ende?: string
      ort?: string; beschreibung?: string; typ?: string
    } | null
    if (!ev) continue
    const dtend = ev.ende ?? addOneHour(ev.beginn)
    events.push({
      uid: `event-${ev.id}@staccato`,
      summary: `🎭 ${ev.titel}`,
      dtstart: ev.beginn,
      dtend,
      location: ev.ort ?? '',
      description: ev.beschreibung ?? '',
    })
  }

  const ical = buildICal(events, profil.voller_name ?? 'Staccato', tz)

  return new Response(ical, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="staccato.ics"',
      'Cache-Control': 'no-cache, no-store',
    },
  })
})

// ─── Types ────────────────────────────────────────────────

interface ICalEvent {
  uid: string
  summary: string
  dtstart: string
  dtend: string
  location: string
  description: string
}

// ─── iCal builder ─────────────────────────────────────────

function buildICal(events: ICalEvent[], calName: string, tz: string): string {
  const stamp = fmtDt(new Date().toISOString())
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Staccato//Staccato//DE',
    `X-WR-CALNAME:${escapeText(calName)} – Staccato`,
    `X-WR-TIMEZONE:${tz}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
  ]

  for (const ev of events) {
    lines.push('BEGIN:VEVENT')
    lines.push(`UID:${ev.uid}`)
    lines.push(`DTSTAMP:${stamp}`)
    lines.push(`DTSTART:${fmtDt(ev.dtstart)}`)
    lines.push(`DTEND:${fmtDt(ev.dtend)}`)
    lines.push(`SUMMARY:${escapeText(ev.summary)}`)
    if (ev.location) lines.push(`LOCATION:${escapeText(ev.location)}`)
    if (ev.description) lines.push(`DESCRIPTION:${escapeText(ev.description)}`)
    lines.push('END:VEVENT')
  }

  lines.push('END:VCALENDAR')

  // RFC 5545: fold lines > 75 octets
  return lines.map(foldLine).join('\r\n') + '\r\n'
}

function fmtDt(iso: string): string {
  // Convert ISO timestamp to iCal UTC format: 20260503T140000Z
  const d = new Date(iso)
  const pad = (n: number) => String(n).padStart(2, '0')
  return (
    d.getUTCFullYear().toString() +
    pad(d.getUTCMonth() + 1) +
    pad(d.getUTCDate()) +
    'T' +
    pad(d.getUTCHours()) +
    pad(d.getUTCMinutes()) +
    pad(d.getUTCSeconds()) +
    'Z'
  )
}

function escapeText(s: string): string {
  return s.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n')
}

function foldLine(line: string): string {
  // RFC 5545 §3.1: fold at 75 octets (not chars, but close enough for UTF-8 ASCII mix)
  if (line.length <= 75) return line
  let out = ''
  let i = 0
  while (i < line.length) {
    if (i === 0) { out += line.slice(0, 75); i = 75 }
    else { out += '\r\n ' + line.slice(i, i + 74); i += 74 }
  }
  return out
}

function addOneHour(iso: string): string {
  return new Date(new Date(iso).getTime() + 3600000).toISOString()
}
