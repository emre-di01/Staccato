const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']

const BEVORZUGE_B = new Set(['F','Bb','Eb','Ab','Db','Gb'])

export function noteIndex(note) {
  const i = SHARP.indexOf(note)
  return i >= 0 ? i : FLAT.indexOf(note)
}

export function transponiereAkkord(akkord, ht) {
  if (!ht) return akkord
  const m = akkord.match(/^([A-G][#b]?)(.*)$/)
  if (!m) return akkord
  const [, root, suffix] = m
  const idx = noteIndex(root)
  if (idx < 0) return akkord
  const neuIdx = ((idx + ht) % 12 + 12) % 12
  const neuRoot = BEVORZUGE_B.has(FLAT[neuIdx]) ? FLAT[neuIdx] : SHARP[neuIdx]
  return neuRoot + suffix
}

export function transponiereText(text, ht) {
  if (!ht || !text) return text
  return text.replace(/\[([^\]]+)\]/g, (_, ak) => '[' + transponiereAkkord(ak, ht) + ']')
}

export function aktuelleTonartenInfo(text, ht) {
  const match = text?.match(/\[([A-G][#b]?[^/\]]*)\]/)
  if (!match) return null
  const transponiert = transponiereAkkord(match[1].replace(/[^A-Ga-g#b].*/, ''), ht)
  return `${transponiert} (${ht >= 0 ? '+' : ''}${ht} HT)`
}

export function youtubeId(url) {
  return url?.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1]
}

export function dateiIcon(name = '') {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['pdf'].includes(ext)) return '📄'
  if (['mp3','wav','ogg','m4a','aac','flac'].includes(ext)) return '🎵'
  if (['mp4','mov','avi','webm'].includes(ext)) return '🎬'
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼'
  if (['zip','rar','7z'].includes(ext)) return '🗜'
  return '📎'
}
