// Ticket als PDF: eine A5-Seite pro Ticket, keine persönlichen Daten
import QRCode from 'qrcode'
import { schulfarbenTokens } from './schulfarbe'
import { bildLaden, passend, umbrechen } from './zeichnen'
import { ticketQrInhalt, ticketNummer, euro } from './tickets'

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const B = 1240, H = 1754   // A5 bei rund 210 dpi
const RAND = 90

// Eine Ticketseite zeichnen. texte: T-Funktion; logo: geladenes Bild oder null
export function zeichneTicket(cvs, { ticket, nr, anzahl, event, schule, qr, logo, T, lang }) {
  cvs.width = B; cvs.height = H
  const ctx = cvs.getContext('2d')
  const M = B / 2
  const f = schulfarbenTokens(schule.farbe, false) ?? { '--n-hero': '#C2410C', '--n-hero-2': '#A3360A', '--n-hero-sub': '#FFE4D6' }
  const zeit = opt => new Intl.DateTimeFormat(LOCALE[lang] ?? 'de-DE', { timeZone: schule.zeitzone ?? 'Europe/Berlin', ...opt }).format(new Date(event.beginn))
  ctx.textBaseline = 'alphabetic'
  ctx.fillStyle = '#FFFFFF'; ctx.fillRect(0, 0, B, H)

  // Kopf in Schulfarbe: Logo und Schulname, Titel, Datum, Ort
  const KOPF = 640
  const verlauf = ctx.createLinearGradient(0, 0, B, KOPF)
  verlauf.addColorStop(0, f['--n-hero']); verlauf.addColorStop(1, f['--n-hero-2'])
  ctx.fillStyle = verlauf; ctx.fillRect(0, 0, B, KOPF)
  const L = 100
  ctx.fillStyle = '#FFFFFF'; ctx.beginPath(); ctx.roundRect(RAND, 70, L, L, 26); ctx.fill()
  if (logo) {
    const s = Math.min((L - 24) / logo.width, (L - 24) / logo.height)
    ctx.drawImage(logo, RAND + (L - logo.width * s) / 2, 70 + (L - logo.height * s) / 2, logo.width * s, logo.height * s)
  } else {
    ctx.fillStyle = f['--n-hero']; ctx.textAlign = 'center'; ctx.font = '800 64px Inter, system-ui, sans-serif'
    ctx.fillText((schule.name ?? 'S').trim().charAt(0).toUpperCase(), RAND + L / 2, 143)
  }
  ctx.textAlign = 'left'
  ctx.fillStyle = f['--n-hero-sub']; passend(ctx, schule.name ?? '', 42, 26, B - 2 * RAND - L - 30, 600)
  ctx.fillText(schule.name ?? '', RAND + L + 30, 135)

  // Lange Titel kleiner, damit Datum und Ort immer Platz haben
  ctx.fillStyle = '#FFFFFF'; ctx.font = '800 78px Inter, system-ui, sans-serif'
  let zeilen = umbrechen(ctx, event.titel, B - 2 * RAND, 3)
  const titelLang = zeilen.length > 2
  if (titelLang) { ctx.font = '800 58px Inter, system-ui, sans-serif'; zeilen = umbrechen(ctx, event.titel, B - 2 * RAND, 3) }
  let y = titelLang ? 262 : 290
  for (const z of zeilen) { ctx.fillText(z, RAND, y); y += titelLang ? 66 : 88 }
  y += titelLang ? 16 : 10
  const datum = `${zeit({ weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })} · ${zeit({ hour: '2-digit', minute: '2-digit' })}`
  passend(ctx, datum, 44, 28, B - 2 * RAND, 700)
  ctx.fillText(datum, RAND, y)
  if (event.ort) {
    ctx.fillStyle = f['--n-hero-sub']; ctx.font = '500 36px Inter, system-ui, sans-serif'
    umbrechen(ctx, event.ort, B - 2 * RAND, 2).forEach((z, k) => ctx.fillText(z, RAND, y + 56 + k * 46))
  }

  // QR-Code
  const Q = 660, qy = KOPF + 80
  ctx.drawImage(qr, M - Q / 2, qy, Q, Q)
  ctx.textAlign = 'center'; ctx.fillStyle = '#111114'
  ctx.font = '800 52px Inter, system-ui, sans-serif'
  ctx.fillText(T('tk_nr_von').replace('{nr}', nr).replace('{n}', anzahl), M, qy + Q + 90)
  ctx.fillStyle = '#55555C'; ctx.font = '500 36px Inter, system-ui, sans-serif'
  ctx.fillText(`${euro(ticket.preis, lang)} · ${T('tk_nummer')} ${ticketNummer(ticket)}`, M, qy + Q + 146)

  // Hinweis
  ctx.strokeStyle = '#DDDDE2'; ctx.lineWidth = 2; ctx.setLineDash([10, 10])
  ctx.beginPath(); ctx.moveTo(RAND, H - 165); ctx.lineTo(B - RAND, H - 165); ctx.stroke(); ctx.setLineDash([])
  ctx.fillStyle = '#55555C'; ctx.font = '400 30px Inter, system-ui, sans-serif'
  umbrechen(ctx, T('tk_pdf_hinweis'), B - 2 * RAND, 2).forEach((z, i) => ctx.fillText(z, M, H - 105 + i * 42))
}

// PDF mit einer Seite pro Ticket. tickets: [{ ticket, nr }]
export async function ticketPdf({ tickets, anzahl, event, schule, T, lang }) {
  const { default: jsPDF } = await import('jspdf')
  try { await document.fonts?.ready } catch { /* egal */ }
  const logo = schule.logo_url ? await bildLaden(schule.logo_url, true).catch(() => null) : null
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  const cvs = document.createElement('canvas')
  for (const [i, { ticket, nr }] of tickets.entries()) {
    const qr = await bildLaden(await QRCode.toDataURL(ticketQrInhalt(ticket.code), { width: 900, margin: 0, color: { dark: '#111114', light: '#FFFFFF' } }))
    zeichneTicket(cvs, { ticket, nr, anzahl, event, schule, qr, logo, T, lang })
    if (i > 0) doc.addPage()
    doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 148, 210)   // PNG wäre bei vielen Tickets sehr langsam
  }
  const name = `${T('tk_tickets')}_${event.titel}`.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60)
  return new File([doc.output('blob')], `${name}.pdf`, { type: 'application/pdf' })
}
