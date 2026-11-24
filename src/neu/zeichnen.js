// Zeichenhilfen für Canvas-Druckvorlagen (Raum-Aushang, Tickets). Canvas kann alle Schriftzeichen, auch ş/ğ/ı.
const SCHRIFT = 'Inter, system-ui, sans-serif'

export function bildLaden(src, cors) {
  return new Promise((ok, err) => {
    const i = new Image()
    if (cors) i.crossOrigin = 'anonymous'
    i.onload = () => ok(i); i.onerror = err; i.src = src
  })
}

// Größte Schrift (bis max), mit der der Text in die Breite passt
export function passend(ctx, text, max, min, breite, gewicht) {
  let g = max
  do { ctx.font = `${gewicht} ${g}px ${SCHRIFT}`; g -= 2 } while (g > min && ctx.measureText(text).width > breite)
}

// Text auf höchstens maxZeilen umbrechen; zu lange Wörter und Reste werden mit … gekürzt
export function umbrechen(ctx, text, breite, maxZeilen) {
  const passt = s => ctx.measureText(s).width <= breite
  const kuerzen = s => { let k = s; while (k && !passt(k + '…')) k = k.slice(0, -1).trimEnd(); return k + '…' }
  const zeilen = []
  let zeile = ''
  for (const wort of String(text).trim().split(/\s+/)) {
    const neu = zeile ? `${zeile} ${wort}` : wort
    if (passt(neu) || !zeile) { zeile = neu; continue }
    zeilen.push(zeile)
    zeile = wort
  }
  if (zeile) zeilen.push(zeile)
  if (zeilen.length > maxZeilen) zeilen.splice(maxZeilen - 1, zeilen.length, zeilen.slice(maxZeilen - 1).join(' '))
  return zeilen.map(z => passt(z) ? z : kuerzen(z))
}
