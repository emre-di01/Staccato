// Tickets als PDF (A5, eine Seite pro Ticket) für den Mail-Anhang. Vektor, daher scharf und klein.
// Nur bei Bedarf laden (dynamischer import), damit ein Problem hier nie andere Mails betrifft.
import { PDFDocument, PDFName, PDFOperator, type PDFFont, type PDFPage, pushGraphicsState, popGraphicsState, concatTransformationMatrix,
  clip, endPath, fill, stroke, setFillingRgbColor, setStrokingRgbColor, setLineWidth, setLineCap,
  setDashPattern, setGraphicsState, rgb, degrees } from 'npm:pdf-lib@1.17.1'
import fontkit from 'npm:@pdf-lib/fontkit@1.1.1'
import { B, H, qrPfad, ticketEinzeln, ticketGrund } from './ticketDesign.js'
import { FETT, MITTEL } from './ticketSchrift.ts'

// deno-lint-ignore no-explicit-any
type Schritt = any
export interface PdfTicket { id: string; code: string; preis: number | string; status?: string }
export interface QrMatrix { size: number; data: ArrayLike<number | boolean> }
export interface PdfAngaben {
  tickets: PdfTicket[]; lang: string
  event: { titel: string; beginn: string; ort: string | null }
  schule: { name: string; zeitzone: string | null; farbe?: string | null }
}

const LOCALE: Record<string, string> = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const TEXTE: Record<string, Record<string, string>> = {
  de: { schild: 'TICKET', nr: 'Ticket {nr} von {n}', eins: 'Dein Ticket', nummer: 'Nr.', hinweis: 'Dieses Ticket gilt für eine Person und wird am Einlass einmal gescannt. Bitte den QR-Code nicht öffentlich teilen.' },
  en: { schild: 'TICKET', nr: 'Ticket {nr} of {n}', eins: 'Your ticket', nummer: 'No.', hinweis: 'This ticket admits one person and is scanned once at the entrance. Please do not share the QR code publicly.' },
  tr: { schild: 'BİLET', nr: 'Bilet {nr} / {n}', eins: 'Biletin', nummer: 'No.', hinweis: 'Bu bilet bir kişi için geçerlidir ve girişte bir kez okutulur. Lütfen QR kodunu herkese açık paylaşma.' },
}

const bytes = (b64: string) => Uint8Array.from(atob(b64), c => c.charCodeAt(0))
const farbe = (h: string) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16) / 255) as [number, number, number]
const BREITE = 148 / 25.4 * 72, HOEHE = 210 / 25.4 * 72, F = BREITE / B

// Pfad als ein fertiges Stück PDF-Inhalt: viel schneller als ein Objekt je Linie (Rechenzeit der Function ist begrenzt)
const BEFEHL: Record<string, [string, number]> = { M: ['m', 2], L: ['l', 2], C: ['c', 6], Z: ['h', 0] }
function pfadOps(d: string) {
  const t = d.trim().split(/\s+/)
  const aus: string[] = []
  for (let i = 0; i < t.length;) {
    const [op, n] = BEFEHL[t[i]]
    for (let k = 1; k <= n; k++) aus.push(t[i + k])
    aus.push(op)
    i += n + 1
  }
  // deno-lint-ignore no-explicit-any
  return [PDFOperator.of(aus.join(' ') as any)]
}

// codes: QR-Matrix je Ticket (von tickets.ts, weil die Mail dieselben Codes zeigt)
export async function ticketPdf(m: PdfAngaben, codes: QrMatrix[]): Promise<Uint8Array> {
  const T = TEXTE[m.lang] ?? TEXTE.de
  const doc = await PDFDocument.create()
  doc.registerFontkit(fontkit)
  doc.setTitle(m.event.titel)
  doc.setCreator('Staccato'); doc.setProducer('Staccato')
  const mittel = await doc.embedFont(bytes(MITTEL)), fett = await doc.embedFont(bytes(FETT))
  // Zeichen, die die Schrift nicht hat (Emojis u. Ä.), weglassen statt als Kästchen drucken
  const bekannt = new Set(fett.getCharacterSet())
  const sauber = (s: string) => [...String(s).normalize('NFC')].filter(c => bekannt.has(c.codePointAt(0)!) || /\s/.test(c)).join('').replace(/\s+/g, ' ').trim()
  const font = (f?: boolean): PDFFont => f ? fett : mittel
  // Breiten wachsen gleichmäßig mit der Größe: jeden Text nur einmal messen
  const breiten = new Map<string, number>()
  const messe = (t: string, g: number, f?: boolean) => {
    const k = (f ? 'f' : 'm') + t
    let w = breiten.get(k)
    if (w === undefined) breiten.set(k, w = font(f).widthOfTextAtSize(sauber(t), 1000) / 1000)
    return w * g
  }
  const euro = (n: number) => new Intl.NumberFormat(LOCALE[m.lang] ?? 'de-DE', { style: 'currency', currency: 'EUR' }).format(n)

  const event = { ...m.event, titel: sauber(m.event.titel) || T.schild, ort: sauber(m.event.ort ?? '') || null }
  const schule = { ...m.schule, name: sauber(m.schule.name) }
  const zeichnen = (page: PDFPage, schritte: Schritt[]) => {
    for (const s of schritte) {
      if (s.art === 'qr') pfad(doc, page, { d: s.qr.d, fuell: '#111114' }, [s.g / s.qr.n, s.x, s.y])
      else if (s.art === 'pfad') pfad(doc, page, s)
      else if (s.art === 'text') text(page, s, font(s.fett), sauber(s.text))
    }
  }

  // Der gemeinsame Grund steht nur einmal in der Datei, alle Seiten verweisen darauf
  const vorlage = doc.addPage([BREITE, HOEHE])
  zeichnen(vorlage, ticketGrund({ event, schule, logo: null, texte: T, lang: m.lang, messe }))
  const { Contents, Resources } = vorlage.node.normalizedEntries()
  const grund = Contents!.asArray()

  for (const [i, ticket] of m.tickets.entries()) {
    const page = doc.addPage([BREITE, HOEHE])
    page.node.set(PDFName.of('Contents'), doc.context.obj([...grund]))
    page.node.set(PDFName.of('Resources'), Resources)
    const qr = qrPfad(codes[i])
    zeichnen(page, ticketEinzeln({ ticket, nr: i + 1, anzahl: m.tickets.length, nummer: ticket.id.slice(0, 8).toUpperCase(), preis: euro(Number(ticket.preis)), qr, texte: T }))
  }
  doc.removePage(0)
  doc.context.delete(vorlage.ref)
  return await doc.save({ objectsPerTick: Infinity })
}

function pfad(doc: PDFDocument, page: PDFPage, s: Schritt, [k, dx, dy] = [1, 0, 0]) {
  const ops: PDFOperator[] = [pushGraphicsState(), concatTransformationMatrix(F * k, 0, 0, -F * k, dx * F, HOEHE - dy * F)]
  if (s.clip) ops.push(...pfadOps(s.clip), clip(), endPath())
  if (s.alpha != null && s.alpha < 1) ops.push(setGraphicsState(page.node.newExtGState('Gs', doc.context.obj({ Type: 'ExtGState', ca: s.alpha, CA: s.alpha }))))
  const p = pfadOps(s.d)
  if (s.linie) {
    ops.push(setStrokingRgbColor(...farbe(s.linie)), setLineWidth(s.dicke))
    if (s.rund) ops.push(setLineCap(1))
    if (s.strich) ops.push(setDashPattern(s.strich, 0))
    ops.push(...p, stroke())
  } else if (typeof s.fuell === 'string') ops.push(setFillingRgbColor(...farbe(s.fuell)), ...p, fill())
  else {
    const v = s.fuell
    const verlauf = doc.context.register(doc.context.obj({
      ShadingType: 2, ColorSpace: 'DeviceRGB', Coords: [v.x0, v.y0, v.x1, v.y1], Extend: [true, true],
      Function: { FunctionType: 2, Domain: [0, 1], C0: farbe(v.von), C1: farbe(v.bis), N: 1 },
    }))
    const { Resources } = page.node.normalizedEntries()
    const alle = Resources.lookup(PDFName.of('Shading')) ?? doc.context.obj({})
    const name = PDFName.of(`Sh${verlauf.objectNumber}`)
    // deno-lint-ignore no-explicit-any
    ;(alle as any).set(name, verlauf)
    Resources.set(PDFName.of('Shading'), alle)
    // deno-lint-ignore no-explicit-any
    ops.push(...p, clip(), endPath(), PDFOperator.of('sh' as any, [name]))
  }
  ops.push(popGraphicsState())
  page.pushOperators(...ops)
}

function text(page: PDFPage, s: Schritt, font: PDFFont, t: string) {
  if (!t) return
  const b = s.ausrichtung === 'mitte' ? font.widthOfTextAtSize(t, s.g) / 2 : 0
  const w = s.dreh ?? 0
  // gedrehter Text: (x, y) ist die Mitte, sonst die Grundlinie
  const tief = s.dreh ? s.g * 0.36 : 0
  const x = s.x - b * Math.cos(w) - tief * Math.sin(w), y = s.y - b * Math.sin(w) + tief * Math.cos(w)
  page.drawText(t, { x: x * F, y: HOEHE - y * F, size: s.g * F, font, color: rgb(...farbe(s.farbe)), opacity: s.alpha ?? 1, rotate: degrees(-w * 180 / Math.PI) })
}
