// Datums-/Zeitformatierung in der Zeitzone der Schule

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }

export function uhrzeit(iso, tz, lang = 'de') {
  return new Intl.DateTimeFormat(LOCALE[lang] ?? 'de-DE', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(new Date(iso))
}

// 'YYYY-MM-DD' des Zeitpunkts in der Schul-Zeitzone
export function tagKey(iso, tz) {
  return new Intl.DateTimeFormat('en-CA', { year: 'numeric', month: '2-digit', day: '2-digit', timeZone: tz }).format(new Date(iso))
}

function tageAbstand(iso, tz) {
  const a = new Date(tagKey(new Date().toISOString(), tz) + 'T00:00:00Z')
  const b = new Date(tagKey(iso, tz) + 'T00:00:00Z')
  return Math.round((b - a) / 86400000)
}

// „Heute“, „Morgen“, „Gestern“ oder „Do., 5. Nov.“ (in anderen Jahren mit Jahreszahl)
export function tagLabel(iso, tz, lang, T) {
  const d = tageAbstand(iso, tz)
  if (d === 0) return T('n_heute')
  if (d === 1) return T('n_morgen')
  if (d === -1) return T('n_gestern')
  const anderesJahr = tagKey(iso, tz).slice(0, 4) !== tagKey(new Date().toISOString(), tz).slice(0, 4)
  return new Intl.DateTimeFormat(LOCALE[lang] ?? 'de-DE', { weekday: 'short', day: 'numeric', month: 'short', ...(anderesJahr ? { year: 'numeric' } : {}), timeZone: tz }).format(new Date(iso))
}

// Gruppen für die Terminliste: Heute, Morgen, Diese Woche, dann Monat
export function gruppenLabel(iso, tz, lang, T) {
  const d = tageAbstand(iso, tz)
  if (d <= 0) return T('n_heute')
  if (d === 1) return T('n_morgen')
  if (d < 7) return T('n_diese_woche')
  return new Intl.DateTimeFormat(LOCALE[lang] ?? 'de-DE', { month: 'long', year: 'numeric', timeZone: tz }).format(new Date(iso))
}

export function wochentagKurz(iso, tz, lang) {
  return new Intl.DateTimeFormat(LOCALE[lang] ?? 'de-DE', { weekday: 'short', timeZone: tz }).format(new Date(iso)).replace('.', '').toUpperCase()
}

export function tagDesMonats(iso, tz) {
  return new Intl.DateTimeFormat('de-DE', { day: 'numeric', timeZone: tz }).format(new Date(iso))
}

export function datumLang(tz, lang) {
  return new Intl.DateTimeFormat(LOCALE[lang] ?? 'de-DE', { weekday: 'long', day: 'numeric', month: 'long', timeZone: tz }).format(new Date())
}

export function stundeDerSchule(tz) {
  return parseInt(new Intl.DateTimeFormat('de-DE', { hour: 'numeric', hour12: false, timeZone: tz }).format(new Date()), 10)
}

// Datum 'YYYY-MM-DD' + Uhrzeit 'HH:MM' in der Schul-Zeitzone → ISO (UTC)
export function schulZeitZuIso(datum, zeit, tz) {
  const [j, m, t] = datum.split('-').map(Number)
  const [h, min] = zeit.split(':').map(Number)
  const wunsch = Date.UTC(j, m - 1, t, h, min)
  const versatz = ms => {
    const p = Object.fromEntries(new Intl.DateTimeFormat('en-US', { timeZone: tz, hourCycle: 'h23', year: 'numeric', month: 'numeric', day: 'numeric', hour: 'numeric', minute: 'numeric' })
      .formatToParts(new Date(ms)).map(x => [x.type, x.value]))
    return Date.UTC(+p.year, p.month - 1, +p.day, +p.hour, +p.minute) - ms
  }
  let ms = wunsch - versatz(wunsch)
  ms = wunsch - versatz(ms)   // zweiter Schritt für Tage mit Zeitumstellung
  return new Date(ms).toISOString()
}
