// Ticket-Mail: ein QR-Code pro Ticket als eingebettetes Bild, alle Tickets zusätzlich als PDF im Anhang.
// Wird nur bei Bedarf geladen (index.ts), damit ein Problem mit QR-Code oder PDF nie die übrigen Mails betrifft.
import { deflateSync } from 'node:zlib'
import QRCode from 'npm:qrcode@1.5.4'
import { ticketFarben, ticketZeit } from '../_shared/ticketDesign.js'
import { BAND } from '../_shared/ticketBand.ts'

export interface TicketMail {
  name: string
  lang: string
  event: { titel: string; beginn: string; ort: string | null }
  schule: { name: string; zeitzone: string | null; farbe?: string | null }
  tickets: { id: string; code: string; preis: number | string; status?: string }[]
  link: string
  demo?: boolean
}

const TEXTE: Record<string, Record<string, string>> = {
  de: {
    betreff: 'Dein Ticket: {titel}', betreffN: 'Deine {n} Tickets: {titel}', hallo: 'Hallo {name},',
    da: 'dein Ticket ist da!', daN: 'deine {n} Tickets sind da!', freude: 'Wir freuen uns auf dich.',
    eins: 'Dein Ticket', nr: 'Ticket {nr} von {n}', datei: 'Tickets',
    pdf: 'Dein Ticket hängt auch als PDF an.', pdfN: 'Alle Tickets hängen auch als PDF an.', pdfZusatz: 'Zum Ausdrucken oder Weiterleiten.',
    hinweis: 'Zeige den QR-Code am Einlass, auf dem Handy oder ausgedruckt. Jedes Ticket gilt einmal. Bitte nicht öffentlich teilen.',
    knopf: 'Ticket öffnen', knopfN: 'Tickets öffnen', fuss: 'Diese Nachricht wurde automatisch von Staccato verschickt. Bitte nicht direkt antworten.',
    demo: 'Demo: Diese Tickets gelten nicht am Einlass. Es wurde nichts abgebucht.',
  },
  en: {
    betreff: 'Your ticket: {titel}', betreffN: 'Your {n} tickets: {titel}', hallo: 'Hello {name},',
    da: 'your ticket is here!', daN: 'your {n} tickets are here!', freude: 'We look forward to seeing you.',
    eins: 'Your ticket', nr: 'Ticket {nr} of {n}', datei: 'Tickets',
    pdf: 'Your ticket is also attached as a PDF.', pdfN: 'All tickets are also attached as a PDF.', pdfZusatz: 'To print or forward.',
    hinweis: 'Show the QR code at the entrance, on your phone or printed. Each ticket is valid once. Please do not share it publicly.',
    knopf: 'Open ticket', knopfN: 'Open tickets', fuss: 'This message was sent automatically by Staccato. Please do not reply directly.',
    demo: 'Demo: these tickets are not valid for admission. Nothing was charged.',
  },
  tr: {
    betreff: 'Biletin: {titel}', betreffN: '{n} biletin: {titel}', hallo: 'Merhaba {name},',
    da: 'biletin hazır!', daN: '{n} biletin hazır!', freude: 'Seni görmeyi dört gözle bekliyoruz.',
    eins: 'Biletin', nr: 'Bilet {nr} / {n}', datei: 'Biletler',
    pdf: 'Biletin PDF olarak da ekte.', pdfN: 'Tüm biletler PDF olarak da ekte.', pdfZusatz: 'Yazdırmak veya iletmek için.',
    hinweis: 'QR kodunu girişte telefondan veya çıktı olarak göster. Her bilet bir kez geçerlidir. Lütfen herkese açık paylaşma.',
    knopf: 'Bileti aç', knopfN: 'Biletleri aç', fuss: 'Bu mesaj Staccato tarafından otomatik gönderildi. Lütfen doğrudan yanıtlama.',
    demo: 'Demo: Bu biletler girişte geçerli değildir. Ödeme alınmadı.',
  },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
// Werte über eine Funktion einsetzen, damit „$“ in Titeln oder Namen nichts auslöst
const setze = (s: string, w: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(w[k] ?? ''))
const bytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))

// QR-Code als PNG (1 Bit, 4 Felder Rand). Selbst geschrieben statt QRCode.toBuffer, weil das bei vielen
// Tickets die Rechenzeit der Function aufbraucht
interface QrMatrix { size: number; data: ArrayLike<number | boolean> }
const CRC = Uint32Array.from({ length: 256 }, (_, n) => { for (let k = 0; k < 8; k++) n = n & 1 ? 0xEDB88320 ^ (n >>> 1) : n >>> 1; return n >>> 0 })
function stueck(typ: string, daten: Uint8Array) {
  const s = new Uint8Array(12 + daten.length), v = new DataView(s.buffer)
  v.setUint32(0, daten.length)
  for (let i = 0; i < 4; i++) s[4 + i] = typ.charCodeAt(i)
  s.set(daten, 8)
  let c = 0xFFFFFFFF
  for (let i = 4; i < 8 + daten.length; i++) c = CRC[(c ^ s[i]) & 255] ^ (c >>> 8)
  v.setUint32(8 + daten.length, (c ^ 0xFFFFFFFF) >>> 0)
  return s
}
export function qrPng({ size, data }: QrMatrix) {
  const K = 12, RAND = 4, seite = (size + 2 * RAND) * K, breite = Math.ceil(seite / 8) + 1
  const roh = new Uint8Array(breite * seite).fill(255)
  for (let y = 0; y < seite; y++) {
    const z = y * breite, qy = Math.floor(y / K) - RAND
    roh[z] = 0   // kein Filter
    if (y % K) { roh.copyWithin(z, z - breite, z); continue }
    if (qy < 0 || qy >= size) continue
    for (let x = 0; x < size; x++) if (data[qy * size + x]) for (let p = (x + RAND) * K; p < (x + RAND + 1) * K; p++) roh[z + 1 + (p >> 3)] &= ~(128 >> (p & 7))
  }
  const kopf = new Uint8Array(13), v = new DataView(kopf.buffer)
  v.setUint32(0, seite); v.setUint32(4, seite); kopf[8] = 1   // 1 Bit Graustufen
  const teile = [Uint8Array.of(137, 80, 78, 71, 13, 10, 26, 10), stueck('IHDR', kopf), stueck('IDAT', deflateSync(roh)), stueck('IEND', new Uint8Array(0))]
  const aus = new Uint8Array(teile.reduce((n, t) => n + t.length, 0))
  let o = 0
  for (const t of teile) { aus.set(t, o); o += t.length }
  return aus
}

// PDF mit allen Tickets; null, wenn es nicht erzeugt werden kann – die Tickets selbst sollen trotzdem ankommen
async function pdf(m: TicketMail, codes: QrMatrix[]): Promise<Uint8Array | null> {
  try {
    const { ticketPdf } = await import('../_shared/ticketPdf.ts')
    return await ticketPdf(m, codes)
  } catch (e) {
    console.error('[ticket-pdf]', (e as Error).message)
    return null
  }
}

// { subject, html (ganze Mail), attachments (für nodemailer) }
export async function ticketMail(m: TicketMail) {
  const T = TEXTE[m.lang] ?? TEXTE.de
  const n = m.tickets.length
  const f = ticketFarben(m.schule.farbe)
  const z = ticketZeit(m.event, m.schule, m.lang)
  const { Buffer } = await import('node:buffer')

  const codes: QrMatrix[] = m.tickets.map(t => QRCode.create('staccato:ticket:' + t.code, { errorCorrectionLevel: 'M' }).modules)
  const bilder = m.tickets.map((t, i) => ({
    filename: `Ticket_${i + 1}.png`,
    content: Buffer.from(qrPng(codes[i])),
    contentType: 'image/png', contentDisposition: 'inline', cid: `ticket-${t.id}@staccato`,
  }))
  const anhang = await pdf(m, codes)
  const attachments: Record<string, unknown>[] = [
    { filename: 'Noten.png', content: Buffer.from(bytes(BAND)), contentType: 'image/png', contentDisposition: 'inline', cid: 'noten@staccato' },
    ...bilder,
  ]
  if (anhang) attachments.push({ filename: `${`${T.datei}_${m.event.titel}`.replace(/[^\p{L}\p{N}]+/gu, '_').slice(0, 60)}.pdf`, content: Buffer.from(anhang), contentType: 'application/pdf' })

  const schrift = "font-family:Inter,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Arial,sans-serif"
  const verlauf = `background-color:${f.hero};background-image:linear-gradient(135deg,${f.hero},${f.hero2})`
  const tabelle = 'role="presentation" cellpadding="0" cellspacing="0" border="0"'

  const karten = m.tickets.map((t, i) => `
    <table ${tabelle} width="100%" style="margin:0 0 22px;border-collapse:separate">
      <tr><td align="center" bgcolor="${f.hero}" style="${verlauf};border-radius:22px 22px 0 0;padding:16px 20px;color:#ffffff;font-size:20px;font-weight:800;${schrift}">${esc(n === 1 ? T.eins : setze(T.nr, { nr: i + 1, n }))}</td></tr>
      <tr><td align="center" bgcolor="#ffffff" style="background-color:#ffffff;border:2px solid ${f.tint};border-top:3px dashed ${f.hero};border-radius:0 0 22px 22px;padding:18px">
        <img src="cid:ticket-${t.id}@staccato" width="280" height="280" alt="QR-Code" style="display:block;width:280px;max-width:100%;height:auto;background:#ffffff">
      </td></tr>
    </table>`).join('')

  const html = `<!DOCTYPE html><html lang="${esc(m.lang)}"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(m.event.titel)}</title></head>
<body style="margin:0;padding:0;background-color:#f2efec;${schrift}">
<div style="display:none;max-height:0;overflow:hidden;mso-hide:all">${esc(`${m.event.titel} · ${z.wochentag}, ${z.datum}, ${z.uhr}`)}</div>
<table ${tabelle} width="100%" bgcolor="#f2efec" style="background-color:#f2efec"><tr><td align="center" style="padding:28px 12px">
<table ${tabelle} width="100%" style="max-width:580px;border-collapse:separate">
  <tr><td bgcolor="${f.hero}" style="${verlauf};border-radius:28px 28px 0 0;padding:30px 0 0">
    <table ${tabelle} style="margin:0 30px"><tr>
      <td width="46" height="46" align="center" bgcolor="#ffffff" style="background-color:#ffffff;border-radius:14px;color:${f.hero};font-size:26px;font-weight:800;${schrift}">${esc(m.schule.name.trim().charAt(0).toLocaleUpperCase('de') || 'S')}</td>
      <td style="padding-left:14px;color:${f.sub};font-size:16px;font-weight:500;${schrift}">${esc(m.schule.name)}</td>
    </tr></table>
    <p style="margin:30px 30px 4px;color:${f.sub};font-size:19px;${schrift}">${esc(setze(T.hallo, { name: m.name }))}</p>
    <h1 style="margin:0 30px;color:#ffffff;font-size:36px;line-height:1.12;font-weight:800;letter-spacing:-0.8px;${schrift}">${esc(setze(n === 1 ? T.da : T.daN, { n }))}</h1>
    <img src="cid:noten@staccato" width="580" alt="" style="display:block;width:100%;height:auto;margin:6px 0 0">
  </td></tr>
  <tr><td bgcolor="#ffffff" style="background-color:#ffffff;border-radius:0 0 28px 28px;padding:30px">
    ${m.demo ? `<p style="margin:0 0 22px;padding:14px 16px;border-radius:14px;background-color:#fde68a;color:#422006;font-size:16px;font-weight:700;${schrift}">${esc(T.demo)}</p>` : ''}
    <table ${tabelle} width="100%" style="margin:0 0 26px"><tr>
      <td width="84" valign="top">
        <table ${tabelle} width="84"><tr><td align="center" bgcolor="${f.hero}" style="background-color:${f.hero};border-radius:16px 16px 0 0;padding:6px 0;color:#ffffff;font-size:15px;font-weight:800;${schrift}">${esc(z.monat)}</td></tr>
        <tr><td align="center" bgcolor="${f.tint}" style="background-color:${f.tint};border-radius:0 0 16px 16px;padding:4px 0 8px;color:#1c1c1e;font-size:42px;line-height:1.1;font-weight:800;${schrift}">${esc(z.tag)}</td></tr></table>
      </td>
      <td valign="top" style="padding-left:20px;${schrift}">
        <p style="margin:0 0 6px;color:#1c1c1e;font-size:23px;line-height:1.2;font-weight:800;letter-spacing:-0.3px">${esc(m.event.titel)}</p>
        <p style="margin:0;color:#55555c;font-size:17px;line-height:1.5"><strong style="color:#1c1c1e">${esc(`${z.wochentag}, ${z.uhr}`)}</strong><br>${esc(z.datum)}${m.event.ort ? `<br>${esc(m.event.ort)}` : ''}</p>
      </td>
    </tr></table>
    ${karten}
    ${anhang ? `<table ${tabelle} width="100%" style="margin:0 0 22px"><tr><td bgcolor="${f.tint}" style="background-color:${f.tint};border-radius:18px;padding:18px 20px;color:${f.tintFg};font-size:17px;line-height:1.45;${schrift}"><strong>${esc(n === 1 ? T.pdf : T.pdfN)}</strong><br>${esc(T.pdfZusatz)}</td></tr></table>` : ''}
    <table ${tabelle} width="100%"><tr><td align="center" bgcolor="${f.hero}" style="${verlauf};border-radius:18px"><a href="${esc(m.link)}" style="display:block;padding:18px 24px;color:#ffffff;text-decoration:none;font-size:19px;font-weight:800;${schrift}">${esc(n === 1 ? T.knopf : T.knopfN)}</a></td></tr></table>
    <p style="margin:24px 0 0;color:#55555c;font-size:15px;line-height:1.55;${schrift}">${esc(T.hinweis)}</p>
    <p style="margin:18px 0 0;color:#1c1c1e;font-size:18px;font-weight:800;${schrift}">${esc(T.freude)}</p>
  </td></tr>
  <tr><td align="center" style="padding:20px 24px 0;color:#77726d;font-size:13px;line-height:1.5;${schrift}">${esc(m.schule.name)}<br>${esc(T.fuss)}</td></tr>
</table></td></tr></table></body></html>`

  return { subject: `${m.demo ? '[DEMO] ' : ''}${setze(n === 1 ? T.betreff : T.betreffN, { n, titel: m.event.titel })}`, html, attachments }
}
