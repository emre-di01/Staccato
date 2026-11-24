// Ticket-Mail: ein QR-Code pro Ticket als eingebettetes Bild. Wird nur bei Bedarf geladen (index.ts),
// damit ein Problem mit der QR-Bibliothek nie die übrigen Mails betrifft.
import QRCode from 'npm:qrcode@1.5.4'

export interface TicketMail {
  name: string
  lang: string
  event: { titel: string; beginn: string; ort: string | null }
  schule: { name: string; zeitzone: string | null }
  tickets: { id: string; code: string }[]
  link: string
}

const LOCALE: Record<string, string> = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const TEXTE: Record<string, Record<string, string>> = {
  de: {
    betreff: 'Dein Ticket: {titel}', betreffN: 'Deine {n} Tickets: {titel}', hallo: 'Hallo {name},',
    danke: 'hier ist dein Ticket:', dankeN: 'hier sind deine {n} Tickets:',
    nr: 'Ticket {nr} von {n}', hinweis: 'Zeige den QR-Code am Einlass, auf dem Handy oder ausgedruckt. Jedes Ticket gilt einmal. Bitte nicht öffentlich teilen.',
    knopf: 'In Staccato öffnen',
  },
  en: {
    betreff: 'Your ticket: {titel}', betreffN: 'Your {n} tickets: {titel}', hallo: 'Hello {name},',
    danke: 'here is your ticket:', dankeN: 'here are your {n} tickets:',
    nr: 'Ticket {nr} of {n}', hinweis: 'Show the QR code at the entrance, on your phone or printed. Each ticket is valid once. Please do not share it publicly.',
    knopf: 'Open in Staccato',
  },
  tr: {
    betreff: 'Biletin: {titel}', betreffN: '{n} biletin: {titel}', hallo: 'Merhaba {name},',
    danke: 'biletin burada:', dankeN: '{n} biletin burada:',
    nr: 'Bilet {nr} / {n}', hinweis: 'QR kodunu girişte telefondan veya çıktı olarak göster. Her bilet bir kez geçerlidir. Lütfen herkese açık paylaşma.',
    knopf: 'Staccato\'da aç',
  },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// Werte über eine Funktion einsetzen, damit „$“ in Titeln oder Namen nichts auslöst
const setze = (s: string, w: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(w[k] ?? ''))

// { subject, content (HTML für die Standardvorlage), attachments (für nodemailer) }
export async function ticketMail(m: TicketMail) {
  const T = TEXTE[m.lang] ?? TEXTE.de
  const n = m.tickets.length
  const zeit = (opt: Intl.DateTimeFormatOptions) =>
    new Intl.DateTimeFormat(LOCALE[m.lang] ?? 'de-DE', { timeZone: m.schule.zeitzone ?? 'Europe/Berlin', ...opt }).format(new Date(m.event.beginn))
  const datum = `${zeit({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${zeit({ hour: '2-digit', minute: '2-digit' })}`

  const bilder = await Promise.all(m.tickets.map(async (t, i) => ({
    filename: `Ticket_${i + 1}.png`,
    content: await QRCode.toBuffer('staccato:ticket:' + t.code, { width: 480, margin: 4 }),
    contentType: 'image/png',
    cid: `ticket-${t.id}@staccato`,
  })))

  const karten = m.tickets.map((t, i) => `
      <table width="100%" cellpadding="0" cellspacing="0" style="margin:0 0 20px;border:1px solid #e2e8f0;border-radius:12px"><tr><td align="center" style="padding:20px">
        <p style="margin:0 0 4px;color:#1e293b;font-size:18px;font-weight:800">${esc(n === 1 ? m.event.titel : setze(T.nr, { nr: i + 1, n }))}</p>
        <img src="cid:ticket-${t.id}@staccato" width="280" height="280" alt="QR-Code" style="display:block;width:280px;height:280px;background:#ffffff">
      </td></tr></table>`).join('')

  return {
    subject: setze(n === 1 ? T.betreff : T.betreffN, { n, titel: m.event.titel }),
    attachments: bilder,
    content: `
      <h2 style="margin:0 0 8px;color:#1e293b">${esc(setze(T.hallo, { name: m.name }))}</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:16px">${esc(setze(n === 1 ? T.danke : T.dankeN, { n }))}</p>
      <p style="margin:0 0 2px;color:#1e293b;font-size:20px;font-weight:800">${esc(m.event.titel)}</p>
      <p style="margin:0 0 20px;color:#475569;font-size:16px;line-height:1.5">${esc(datum)}${m.event.ort ? `<br>${esc(m.event.ort)}` : ''}<br>${esc(m.schule.name)}</p>
      ${karten}
      <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.5">${esc(T.hinweis)}</p>
      <a href="${esc(m.link)}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">${esc(T.knopf)}</a>
    `,
  }
}
