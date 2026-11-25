// Ticket als PDF oder Bild: eine A5-Seite pro Ticket, keine persönlichen Daten.
// Das Aussehen steht in ticketDesign.js und gilt auch für den PDF-Anhang der Ticket-Mail.
import QRCode from 'qrcode'
import { B, H, qrPfad, ticketSchritte } from '../../supabase/functions/_shared/ticketDesign.js'
import { bildLaden } from './zeichnen'
import { ticketQrInhalt, ticketNummer, euro } from './tickets'

const schrift = (g, fett) => `${fett ? 800 : 500} ${g}px Inter, system-ui, sans-serif`

// Eine Ticketseite zeichnen. texte: T-Funktion; logo: geladenes Bild oder null
export function zeichneTicket(cvs, { ticket, nr, anzahl, event, schule, qr, logo, T, lang }) {
  cvs.width = B; cvs.height = H
  const ctx = cvs.getContext('2d')
  const messe = (text, g, fett) => { ctx.font = schrift(g, fett); return ctx.measureText(text).width }
  const texte = { schild: T('tk_schild'), eins: T('tk_dein_ticket'), nr: T('tk_nr_von'), nummer: T('tk_nummer'), hinweis: T('tk_pdf_hinweis') }
  for (const s of ticketSchritte({ ticket, nr, anzahl, nummer: ticketNummer(ticket), preis: euro(ticket.preis, lang), event, schule, qr, logo, texte, lang, messe })) {
    ctx.save()
    if (s.clip) ctx.clip(new Path2D(s.clip))
    ctx.globalAlpha = s.alpha ?? 1
    if (s.art === 'bild') ctx.drawImage(s.bild, s.x, s.y, s.b, s.h)
    else if (s.art === 'qr') {
      ctx.translate(s.x, s.y); ctx.scale(s.g / s.qr.n, s.g / s.qr.n)
      ctx.fillStyle = '#111114'; ctx.fill(new Path2D(s.qr.d))
    } else if (s.art === 'text') {
      ctx.translate(s.x, s.y); ctx.rotate(s.dreh ?? 0)
      ctx.font = schrift(s.g, s.fett); ctx.fillStyle = s.farbe
      ctx.textAlign = s.ausrichtung === 'mitte' ? 'center' : 'left'
      ctx.fillText(s.text, 0, s.dreh ? s.g * 0.36 : 0)   // gedrehter Text: (x, y) ist die Mitte
    } else if (s.linie) {
      ctx.strokeStyle = s.linie; ctx.lineWidth = s.dicke
      if (s.rund) ctx.lineCap = 'round'
      if (s.strich) ctx.setLineDash(s.strich)
      ctx.stroke(new Path2D(s.d))
    } else {
      const v = s.fuell
      if (v.von) {
        const verlauf = ctx.createLinearGradient(v.x0, v.y0, v.x1, v.y1)
        verlauf.addColorStop(0, v.von); verlauf.addColorStop(1, v.bis)
        ctx.fillStyle = verlauf
      } else ctx.fillStyle = v
      ctx.fill(new Path2D(s.d))
    }
    ctx.restore()
  }
}

const dateiname = (T, event, endung) => `${`${T('tk_tickets')}_${event.titel}`.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60)}${endung}`

async function zeichner({ anzahl, event, schule, T, lang }) {
  try { await document.fonts?.ready } catch { /* egal */ }
  const logo = schule.logo_url ? await bildLaden(schule.logo_url, true).catch(() => null) : null
  const cvs = document.createElement('canvas')
  return ({ ticket, nr }) => {
    const qr = qrPfad(QRCode.create(ticketQrInhalt(ticket.code), { errorCorrectionLevel: 'M' }).modules)
    zeichneTicket(cvs, { ticket, nr, anzahl, event, schule, qr, logo, T, lang })
    return cvs
  }
}

// Ein Bild pro Ticket (zum Verschicken); fertig(ticketId, Datei) wird nacheinander aufgerufen
export async function ticketBilder({ tickets, fertig, ...rest }) {
  const zeichne = await zeichner(rest)
  for (const x of tickets) {
    const cvs = zeichne(x)
    const blob = await new Promise(ok => cvs.toBlob(ok, 'image/jpeg', 0.92))
    fertig(x.ticket.id, blob && new File([blob], dateiname(rest.T, rest.event, `_${x.nr}.jpg`), { type: 'image/jpeg' }))
  }
}

// PDF mit einer Seite pro Ticket. tickets: [{ ticket, nr }]
export async function ticketPdf({ tickets, ...rest }) {
  const { default: jsPDF } = await import('jspdf')
  const zeichne = await zeichner(rest)
  const doc = new jsPDF({ unit: 'mm', format: 'a5' })
  for (const [i, x] of tickets.entries()) {
    const cvs = zeichne(x)
    if (i > 0) doc.addPage()
    doc.addImage(cvs.toDataURL('image/jpeg', 0.92), 'JPEG', 0, 0, 148, 210)   // PNG wäre bei vielen Tickets sehr langsam
  }
  return new File([doc.output('blob')], dateiname(rest.T, rest.event, '.pdf'), { type: 'application/pdf' })
}
