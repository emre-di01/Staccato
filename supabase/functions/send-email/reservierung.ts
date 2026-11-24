// Mail nach der Reservierung: Betrag und Zahlungsfrist, noch kein QR-Code
export interface ReservierungMail {
  name: string
  lang: string
  event: { titel: string; beginn: string; ort: string | null }
  schule: { name: string; zeitzone: string | null }
  anzahl: number
  betrag: number
  frist: string
  link: string
}

const LOCALE: Record<string, string> = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const TEXTE: Record<string, Record<string, string>> = {
  de: {
    betreff: 'Reserviert: {titel}', hallo: 'Hallo {name},', text: 'dein Ticket ist reserviert.', textN: 'deine {n} Tickets sind reserviert.',
    zahlen: 'Bitte {betrag} bar bezahlen bis {zeit}.', danach: 'Sobald die Bezahlung bestätigt ist, bekommst du dein Ticket per E-Mail. Ohne Bezahlung verfällt die Reservierung.', knopf: 'In Staccato öffnen',
  },
  en: {
    betreff: 'Reserved: {titel}', hallo: 'Hello {name},', text: 'your ticket is reserved.', textN: 'your {n} tickets are reserved.',
    zahlen: 'Please pay {betrag} in cash by {zeit}.', danach: 'Once the payment is confirmed, you will receive your ticket by email. Without payment the reservation expires.', knopf: 'Open in Staccato',
  },
  tr: {
    betreff: 'Ayırtıldı: {titel}', hallo: 'Merhaba {name},', text: 'biletin ayırtıldı.', textN: '{n} biletin ayırtıldı.',
    zahlen: 'Lütfen {betrag} tutarını nakit öde. Son gün: {zeit}.', danach: 'Ödeme onaylanınca biletin e-postayla gelir. Ödeme yapılmazsa ayırtma düşer.', knopf: 'Staccato\'da aç',
  },
}

const esc = (s: string) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const setze = (s: string, w: Record<string, string | number>) => s.replace(/\{(\w+)\}/g, (_, k) => String(w[k] ?? ''))

export function reservierungMail(m: ReservierungMail) {
  const T = TEXTE[m.lang] ?? TEXTE.de
  const locale = LOCALE[m.lang] ?? 'de-DE'
  const f = (iso: string, opt: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(locale, { timeZone: m.schule.zeitzone ?? 'Europe/Berlin', ...opt }).format(new Date(iso))
  const uhr = (iso: string) => f(iso, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
  // Fristen bis Tagesende (23:59) ohne Uhrzeit, wie in der App
  const frist = f(m.frist, { weekday: 'long', day: 'numeric', month: 'long' }) + (uhr(m.frist) === '23:59' ? '' : `, ${uhr(m.frist)}`)
  const ganz = Number.isInteger(m.betrag)
  const betrag = new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR', minimumFractionDigits: ganz ? 0 : 2, maximumFractionDigits: ganz ? 0 : 2 }).format(m.betrag)
  const datum = `${f(m.event.beginn, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}, ${uhr(m.event.beginn)}`
  return {
    subject: setze(T.betreff, { titel: m.event.titel }),
    content: `
      <h2 style="margin:0 0 8px;color:#1e293b">${esc(setze(T.hallo, { name: m.name }))}</h2>
      <p style="margin:0 0 20px;color:#475569;font-size:16px">${esc(setze(m.anzahl === 1 ? T.text : T.textN, { n: m.anzahl }))}</p>
      <p style="margin:0 0 2px;color:#1e293b;font-size:20px;font-weight:800">${esc(m.event.titel)}</p>
      <p style="margin:0 0 20px;color:#475569;font-size:16px;line-height:1.5">${esc(datum)}${m.event.ort ? `<br>${esc(m.event.ort)}` : ''}<br>${esc(m.schule.name)}</p>
      <p style="margin:0 0 20px;padding:18px 20px;background:#fff7ed;border-radius:12px;color:#9a3412;font-size:19px;font-weight:800;line-height:1.4">${esc(setze(T.zahlen, { betrag, zeit: frist }))}</p>
      <p style="margin:0 0 20px;color:#475569;font-size:15px;line-height:1.5">${esc(T.danach)}</p>
      <a href="${esc(m.link)}" style="display:inline-block;background:#6366f1;color:#fff;padding:14px 28px;border-radius:8px;text-decoration:none;font-weight:700;font-size:15px">${esc(T.knopf)}</a>
    `,
  }
}
