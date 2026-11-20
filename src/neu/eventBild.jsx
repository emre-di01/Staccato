// Titelbild für Veranstaltungen (Bucket event-bilder, Pfad <schule_id>/<event_id>/<zeit>.jpg)
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'

const BUCKET = 'event-bilder'
const MAX_KANTE = 1600

// Bild im Browser auf max. 1600 px verkleinern und als JPEG ablegen (Handyfotos sind sonst mehrere MB groß)
export async function bildVerkleinern(datei) {
  const bild = await createImageBitmap(datei)
  const faktor = Math.min(1, MAX_KANTE / Math.max(bild.width, bild.height))
  const cvs = document.createElement('canvas')
  cvs.width = Math.round(bild.width * faktor)
  cvs.height = Math.round(bild.height * faktor)
  const ctx = cvs.getContext('2d')
  ctx.fillStyle = '#FFFFFF'   // transparente PNGs nicht schwarz werden lassen
  ctx.fillRect(0, 0, cvs.width, cvs.height)
  ctx.drawImage(bild, 0, 0, cvs.width, cvs.height)
  bild.close?.()
  return new Promise((ok, fehler) => cvs.toBlob(b => b ? ok(b) : fehler(new Error('toBlob')), 'image/jpeg', 0.85))
}

export async function eventBildHochladen(schuleId, eventId, blob) {
  const pfad = `${schuleId}/${eventId}/${Date.now()}.jpg`
  const { error } = await supabase.storage.from(BUCKET).upload(pfad, blob, { contentType: 'image/jpeg' })
  if (error) throw error
  return pfad
}

export async function eventBildLoeschen(pfad) {
  if (pfad) await supabase.storage.from(BUCKET).remove([pfad])
}

export function useEventBildUrl(pfad) {
  return useQuery({
    queryKey: ['n-event-bild', pfad],
    enabled: !!pfad,
    staleTime: 50 * 60 * 1000,   // signierte URL gilt 1 h
    queryFn: async () => {
      const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(pfad, 3600)
      if (error) throw error
      return data.signedUrl
    },
  }).data
}

// Titelbild im Seitenverhältnis 16:9 (`ganz`: vollständig, z. B. Hochformat-Plakat); ohne Bild nichts rendern
export function EventBild({ pfad, radius = 14, ganz, style }) {
  const url = useEventBildUrl(pfad)
  if (!pfad) return null
  if (ganz) return (
    <div style={{ borderRadius: radius, overflow: 'hidden', background: 'var(--n-fill)', display: 'flex', justifyContent: 'center', minHeight: url ? 0 : 200, ...style }}>
      {url && <img src={url} alt="" style={{ maxWidth: '100%', maxHeight: 520, objectFit: 'contain', display: 'block' }} />}
    </div>
  )
  return (
    <div style={{ width: '100%', aspectRatio: '16 / 9', borderRadius: radius, overflow: 'hidden', background: 'var(--bg)', ...style }}>
      {url && <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </div>
  )
}

// Kleines quadratisches Vorschaubild für Listenzeilen
export function EventVorschau({ pfad, groesse = 40 }) {
  const url = useEventBildUrl(pfad)
  return (
    <span aria-hidden="true" style={{ width: groesse, height: groesse, flexShrink: 0, borderRadius: 10, overflow: 'hidden', background: 'var(--bg)', display: 'block' }}>
      {url && <img src={url} alt="" loading="lazy" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }} />}
    </span>
  )
}
