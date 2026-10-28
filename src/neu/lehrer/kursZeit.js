// „Donnerstag · 19:00“ aus Wochentag-Enum und Uhrzeit des Kurses
const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const TAG_INDEX = { mo: 0, di: 1, mi: 2, do: 3, fr: 4, sa: 5, so: 6 }

export function kursZeit(kurs, lang = 'de') {
  if (!kurs?.wochentag || TAG_INDEX[kurs.wochentag] == null) return null
  // 1. Januar 2024 war ein Montag
  const tag = new Intl.DateTimeFormat(LOCALE[lang] ?? 'de-DE', { weekday: 'long', timeZone: 'UTC' })
    .format(new Date(Date.UTC(2024, 0, 1 + TAG_INDEX[kurs.wochentag])))
  const von = kurs.uhrzeit_von?.slice(0, 5)
  const bis = kurs.uhrzeit_bis?.slice(0, 5)
  return [tag, von && (bis ? `${von} – ${bis}` : von)].filter(Boolean).join(' · ')
}
