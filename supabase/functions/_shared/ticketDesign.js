// Aussehen des Tickets (eine A5-Seite) als Liste von Zeichenschritten. Eine Quelle für beide Ausgaben:
// Browser (Canvas, src/neu/ticketPdf.js) und Mail-Anhang (PDF, ticketPdf.ts). Keine persönlichen Daten.
// Schritte: { art: 'pfad', d, fuell, linie, dicke, strich, alpha, clip } – d nur mit absoluten M/L/C/Z
//           { art: 'text', text, x, y, g, fett, farbe, alpha, ausrichtung, dreh }
//           { art: 'bild', bild, x, y, b, h }
import { schulfarbenTokens } from './schulfarbe.js'

export const B = 1240, H = 1754
const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const STANDARD = { '--n-hero': '#C2410C', '--n-hero-2': '#A3360A', '--n-hero-sub': '#FFE4D6', '--n-tint': '#FFE9DE', '--n-tint-fg': '#9A3412' }

export function ticketFarben(farbe) {
  const f = schulfarbenTokens(farbe, false) ?? STANDARD
  return { hero: f['--n-hero'], hero2: f['--n-hero-2'], sub: f['--n-hero-sub'], tint: f['--n-tint'], tintFg: f['--n-tint-fg'] }
}

export function ticketZeit(event, schule, lang) {
  const zeit = opt => new Intl.DateTimeFormat(LOCALE[lang] ?? 'de-DE', { timeZone: schule.zeitzone ?? 'Europe/Berlin', ...opt }).format(new Date(event.beginn))
  return {
    monat: zeit({ month: 'short' }).replace('.', '').toLocaleUpperCase(LOCALE[lang] ?? 'de-DE'),
    tag: zeit({ day: 'numeric' }),
    wochentag: zeit({ weekday: 'long' }),
    datum: zeit({ day: 'numeric', month: 'long', year: 'numeric' }),
    uhr: zeit({ hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }),
  }
}

const r1 = n => Math.round(n * 10) / 10
const K = 0.5523   // Kreisbogen als Bézierkurve
function rund(x, y, b, h, r) {
  const k = r * (1 - K)
  return `M ${x + r} ${y} L ${x + b - r} ${y} C ${x + b - k} ${y} ${x + b} ${y + k} ${x + b} ${y + r} L ${x + b} ${y + h - r} C ${x + b} ${y + h - k} ${x + b - k} ${y + h} ${x + b - r} ${y + h} L ${x + r} ${y + h} C ${x + k} ${y + h} ${x} ${y + h - k} ${x} ${y + h - r} L ${x} ${y + r} C ${x} ${y + k} ${x + k} ${y} ${x + r} ${y} Z`
}
function ellipse(x, y, rx, ry, w = 0) {
  const c = Math.cos(w), s = Math.sin(w)
  const p = (a, b) => `${r1(x + a * c - b * s)} ${r1(y + a * s + b * c)}`
  return `M ${p(rx, 0)} C ${p(rx, ry * K)} ${p(rx * K, ry)} ${p(0, ry)} C ${p(-rx * K, ry)} ${p(-rx, ry * K)} ${p(-rx, 0)} C ${p(-rx, -ry * K)} ${p(-rx * K, -ry)} ${p(0, -ry)} C ${p(rx * K, -ry)} ${p(rx, -ry * K)} ${p(rx, 0)} Z`
}

// Geschwungene Notenlinien mit Noten: t von links nach rechts, linie 0–4 (oben–unten)
function notenband(x0, y0, breite, hoehe, deckkraft = 0.5) {
  const punkt = (t, l) => {
    const u = 1 - t
    const mitte = y0 + hoehe * (u * u * u * 0.92 + 3 * u * u * t * 0.1 + 3 * u * t * t * 1.15 + t * t * t * 0.12)
    const abstand = 15 + 21 * t
    return [x0 + breite * t, mitte + (l - 2) * abstand, abstand]
  }
  const schritte = []
  for (let l = 0; l < 5; l++) {
    let d = ''
    for (let i = 0; i <= 40; i++) { const [x, y] = punkt(i / 40, l); d += `${i ? 'L' : 'M'} ${r1(x)} ${r1(y)} ` }
    schritte.push({ art: 'pfad', d, linie: '#FFFFFF', dicke: 2.5, alpha: 0.26 })
  }
  const noten = [[0.16, 3], [0.25, 1.5], [0.36, 2.5], [0.43, 1.5], [0.57, 3], [0.67, 1], [0.735, 2], [0.87, 2.5]]
  const balken = [[2, 3], [5, 6]]
  const kopf = noten.map(([t, l]) => { const [x, y, a] = punkt(t, l); return { x, y, a, hals: [x + a * 0.56, y - a * 3.2] } })
  let d = ''
  kopf.forEach(({ x, y, a, hals }, i) => {
    const s = a * 0.12
    d += ellipse(x, y, a * 0.66, a * 0.46, -0.38) + ' '
    d += `M ${r1(hals[0] - s)} ${r1(hals[1])} L ${r1(hals[0] + s)} ${r1(hals[1])} L ${r1(hals[0] + s)} ${r1(y)} L ${r1(hals[0] - s)} ${r1(y)} Z `
    if (!balken.flat().includes(i) && i % 2) d += `M ${r1(hals[0])} ${r1(hals[1])} C ${r1(hals[0] + a * 0.3)} ${r1(hals[1] + a * 0.9)} ${r1(hals[0] + a * 1.3)} ${r1(hals[1] + a * 1.1)} ${r1(hals[0] + a * 0.8)} ${r1(hals[1] + a * 2.1)} C ${r1(hals[0] + a * 0.95)} ${r1(hals[1] + a * 1.3)} ${r1(hals[0] + a * 0.4)} ${r1(hals[1] + a * 1.1)} ${r1(hals[0])} ${r1(hals[1] + a * 0.9)} Z `
  })
  for (const [i, j] of balken) {
    const p = kopf[i].hals, q = kopf[j].hals, h = kopf[j].a * 0.5, s = kopf[i].a * 0.12
    d += `M ${r1(p[0] - s)} ${r1(p[1])} L ${r1(q[0] + s)} ${r1(q[1])} L ${r1(q[0] + s)} ${r1(q[1] + h)} L ${r1(p[0] - s)} ${r1(p[1] + h)} Z `
  }
  schritte.push({ art: 'pfad', d: d.trim(), fuell: '#FFFFFF', alpha: deckkraft })
  return schritte
}

// Für die Mail: nur das Notenband (weiß auf durchsichtig)
export const notenbandSchritte = (b, h) => notenband(-20, h * 0.2, b + 40, h * 0.7)

// Abriss, Mitte und Platz des QR-Codes
const P = 852, M = B / 2, Q = 500, QY = P + 74, QX = M - Q / 2

// messe(text, größe, fett) → Breite. qr: Pfad der dunklen Felder in einem n×n-Raster ({ d, n }) oder Bild
export const ticketSchritte = w => [...ticketGrund(w), ...ticketEinzeln(w)]

// Alles, was auf jedem Ticket einer Bestellung gleich ist (im PDF nur einmal enthalten)
export function ticketGrund({ event, schule, logo, texte, lang, messe }) {
  const f = ticketFarben(schule.farbe)
  const z = ticketZeit(event, schule, lang)
  const s = []
  const pfad = (d, o) => s.push({ art: 'pfad', d, ...o })
  const text = (t, x, y, g, o = {}) => s.push({ art: 'text', text: t, x, y, g, farbe: '#111114', ...o })
  const passend = (t, max, min, breite, fett) => { let g = max; while (g > min && messe(t, g, fett) > breite) g -= 2; return g }
  const kuerzen = (t, g, breite, fett) => { if (messe(t, g, fett) <= breite) return t; let k = t; while (k && messe(k + '…', g, fett) > breite) k = k.slice(0, -1).trimEnd(); return k + '…' }
  const umbrechen = (t, g, breite, max, fett) => {
    const zeilen = []
    let zeile = ''
    for (const w of String(t).trim().split(/\s+/)) {
      const neu = zeile ? `${zeile} ${w}` : w
      if (!zeile || messe(neu, g, fett) <= breite) { zeile = neu; continue }
      zeilen.push(zeile); zeile = w
    }
    if (zeile) zeilen.push(zeile)
    if (zeilen.length > max) zeilen.splice(max - 1, zeilen.length, zeilen.slice(max - 1).join(' '))
    return zeilen.map(x => kuerzen(x, g, breite, fett))
  }

  const L = 50, R = B - 50, O = 50, U = H - 50, N = 36, E = 64   // Ränder, Kerbe, Ecke
  const ke = E * (1 - K), kn = N * (1 - K)
  const RAND = 112, BREITE = B - 2 * RAND

  pfad(`M 0 0 L ${B} 0 L ${B} ${H} L 0 ${H} Z`, { fuell: '#FFFFFF' })

  // Oberer Teil in Schulfarbe, mit Kerben am Abriss
  const oben = `M ${L + E} ${O} L ${R - E} ${O} C ${R - ke} ${O} ${R} ${O + ke} ${R} ${O + E} L ${R} ${P - N} C ${R - N * K} ${P - N} ${R - N} ${P - N * K} ${R - N} ${P} L ${L + N} ${P} C ${L + N} ${P - N * K} ${L + N * K} ${P - N} ${L} ${P - N} L ${L} ${O + E} C ${L} ${O + ke} ${L + ke} ${O} ${L + E} ${O} Z`
  pfad(oben, { fuell: { x0: L, y0: O, x1: R, y1: P, von: f.hero, bis: f.hero2 } })
  for (const [x, y, r, a] of [[1080, 130, 330, 0.07], [1150, 60, 210, 0.08], [130, 840, 260, 0.06]]) pfad(ellipse(x, y, r, r), { fuell: '#FFFFFF', alpha: a, clip: oben })

  // Schule
  const LG = 92, LY = 108
  pfad(rund(RAND, LY, LG, LG, 26), { fuell: '#FFFFFF' })
  if (logo) {
    const k = Math.min((LG - 22) / logo.width, (LG - 22) / logo.height)
    s.push({ art: 'bild', bild: logo, x: RAND + (LG - logo.width * k) / 2, y: LY + (LG - logo.height * k) / 2, b: logo.width * k, h: logo.height * k })
  } else text((schule.name ?? 'S').trim().charAt(0).toLocaleUpperCase('de') || 'S', RAND + LG / 2, LY + 67, 58, { fett: true, farbe: f.hero, ausrichtung: 'mitte' })
  // Schild oben rechts
  const schild = texte.schild, schildB = messe(schild, 28, true) + 56
  pfad(rund(R - 62 - schildB, LY + 18, schildB, 56, 28), { fuell: '#FFFFFF', alpha: 0.2 })
  text(schild, R - 62 - schildB / 2, LY + 56, 28, { fett: true, farbe: '#FFFFFF', ausrichtung: 'mitte' })
  const nameB = R - 62 - schildB - 30 - (RAND + LG + 26)
  const nameG = passend(schule.name ?? '', 38, 24, nameB, false)
  text(kuerzen(schule.name ?? '', nameG, nameB, false), RAND + LG + 26, LY + 59, nameG, { farbe: f.sub })

  // Titel: kurze groß, lange kleiner, höchstens drei Zeilen
  let tg = 104
  while (tg > 62 && umbrechen(event.titel, tg, BREITE, 9, true).length > (tg > 78 ? 2 : 3)) tg -= 6
  const zeilen = umbrechen(event.titel, tg, BREITE, 3, true)
  for (const n of notenband(L - 10, zeilen.length > 1 ? 478 : 420, R - L + 20, zeilen.length > 1 ? 190 : 230, zeilen.length > 1 ? 0.3 : 0.5)) s.push({ ...n, clip: oben })
  zeilen.forEach((t, i) => text(t, RAND, 274 + tg * 0.72 + i * tg * 1.1, tg, { fett: true, farbe: '#FFFFFF' }))

  // Kalenderblatt mit Datum und Ort
  const KB = 176, KH = 186, KY = P - 52 - KH
  pfad(rund(RAND, KY, KB, KH, 34), { fuell: '#FFFFFF' })
  text(z.monat, RAND + KB / 2, KY + 52, 34, { fett: true, farbe: f.hero, ausrichtung: 'mitte' })
  text(z.tag, RAND + KB / 2, KY + 152, 104, { fett: true, ausrichtung: 'mitte' })
  const dx = RAND + KB + 34, db = R - 62 - dx
  const ort = event.ort ? umbrechen(event.ort, 34, db, 2, false) : []
  let y = KY + (ort.length > 1 ? 44 : ort.length ? 62 : 84)
  text(`${z.wochentag}, ${z.uhr}`, dx, y, passend(`${z.wochentag}, ${z.uhr}`, 48, 30, db, true), { fett: true, farbe: '#FFFFFF' })
  y += 50
  text(z.datum, dx, y, passend(z.datum, 36, 26, db, false), { farbe: f.sub })
  ort.forEach((t, i) => text(t, dx, y + 48 + i * 42, 34, { farbe: f.sub }))

  // Unterer Teil
  const unten = `M ${L + N} ${P} L ${R - N} ${P} C ${R - N} ${P + N * K} ${R - N * K} ${P + N} ${R} ${P + N} L ${R} ${U - E} C ${R} ${U - ke} ${R - ke} ${U} ${R - E} ${U} L ${L + E} ${U} C ${L + ke} ${U} ${L} ${U - ke} ${L} ${U - E} L ${L} ${P + N} C ${L + N * K} ${P + N} ${L + N} ${P + N * K} ${L + N} ${P} Z`
  pfad(unten, { linie: f.tint, dicke: 5 })
  pfad(`M ${L + N + 22} ${P} L ${R - N - 22} ${P}`, { linie: '#FFFFFF', dicke: 9, strich: [0, 24], rund: true })

  // Klangwelle links und rechts vom QR-Code
  const hoehen = [0.26, 0.5, 0.82, 0.58, 1, 0.44, 0.7, 0.3]
  hoehen.forEach((h, i) => {
    for (const x of [QX - 92 - i * 24, QX + Q + 78 + i * 24]) {
      const hh = 230 * h * (1 - i * 0.05)
      pfad(rund(r1(x), r1(QY + Q / 2 - hh / 2), 14, r1(hh), 7), { fuell: { x0: 0, y0: QY + Q / 2 - 115, x1: 0, y1: QY + Q / 2 + 115, von: f.hero, bis: f.hero2 }, alpha: 1 - i * 0.11 })
    }
  })
  // Ecken um den QR-Code
  const A = 30, EK = 74, x0 = QX - A, x1 = QX + Q + A, y0 = QY - A, y1 = QY + Q + A, rr = 34, kk = rr * (1 - K)
  for (const d of [
    `M ${x0} ${y0 + EK} L ${x0} ${y0 + rr} C ${x0} ${y0 + kk} ${x0 + kk} ${y0} ${x0 + rr} ${y0} L ${x0 + EK} ${y0}`,
    `M ${x1 - EK} ${y0} L ${x1 - rr} ${y0} C ${x1 - kk} ${y0} ${x1} ${y0 + kk} ${x1} ${y0 + rr} L ${x1} ${y0 + EK}`,
    `M ${x1} ${y1 - EK} L ${x1} ${y1 - rr} C ${x1} ${y1 - kk} ${x1 - kk} ${y1} ${x1 - rr} ${y1} L ${x1 - EK} ${y1}`,
    `M ${x0 + EK} ${y1} L ${x0 + rr} ${y1} C ${x0 + kk} ${y1} ${x0} ${y1 - kk} ${x0} ${y1 - rr} L ${x0} ${y1 - EK}`,
  ]) pfad(d, { linie: f.hero, dicke: 9, rund: true })
  umbrechen(texte.hinweis, 25, R - L - 130, 2, false).forEach((t, i) => text(t, M, U - 68 + i * 33, 25, { farbe: '#55555C', ausrichtung: 'mitte' }))
  return s
}

// Was sich von Ticket zu Ticket unterscheidet
export function ticketEinzeln({ ticket, nr, anzahl, nummer, preis, qr, texte }) {
  const s = [{ art: 'qr', qr, x: QX, y: QY, g: Q }]
  const text = (t, x, y, g, o = {}) => s.push({ art: 'text', text: t, x, y, g, farbe: '#111114', ...o })
  text(anzahl === 1 ? texte.eins : texte.nr.replace('{nr}', nr).replace('{n}', anzahl), M, QY + Q + 98, 54, { fett: true, ausrichtung: 'mitte' })
  text(`${preis}  ·  ${texte.nummer} ${nummer}`, M, QY + Q + 146, 32, { farbe: '#55555C', ausrichtung: 'mitte' })

  // Im Testmodus gekauft: unübersehbar quer über den QR-Code
  if (ticket.status === 'demo') text('DEMO', M, QY + Q / 2, 230, { fett: true, farbe: '#B91C1C', alpha: 0.85, ausrichtung: 'mitte', dreh: -Math.PI / 7 })
  return s
}

// QR-Matrix (qrcode: create(...).modules) als ein Pfad; Felder überlappen minimal, damit keine Haarlinien entstehen
export function qrPfad({ size, data }) {
  let d = ''
  for (let y = 0; y < size; y++) for (let x = 0; x < size; x++) {
    if (!data[y * size + x]) continue
    let e = x
    while (e + 1 < size && data[y * size + e + 1]) e++
    d += `M ${x} ${y} L ${e + 1.02} ${y} L ${e + 1.02} ${y + 1.02} L ${x} ${y + 1.02} Z `
    x = e
  }
  return { d: d.trim(), n: size }
}
