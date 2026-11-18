import { supabase } from './supabase'

// Hat jemand auf der Unterschriften-Fläche gezeichnet?
export function istUnterschrieben(canvas) {
  if (!canvas) return false
  const daten = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data
  for (let i = 3; i < daten.length; i += 4) if (daten[i] !== 0) return true
  return false
}

// Antrags-HTML (dasselbe wie für den Druck) als A4-PDF rendern
async function htmlZuPdf(html) {
  const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([import('html2canvas'), import('jspdf')])

  // Ohne Druck-Skript in ein unsichtbares iframe in A4-Breite laden
  const frame = document.createElement('iframe')
  frame.setAttribute('aria-hidden', 'true')
  Object.assign(frame.style, { position: 'fixed', left: '-10000px', top: '0', width: '794px', height: '1123px', border: '0' })
  document.body.appendChild(frame)
  try {
    const doc = frame.contentDocument
    doc.open()
    doc.write(html.replace(/<script[\s\S]*?<\/script>/gi, ''))
    doc.close()
    await new Promise(r => (doc.readyState === 'complete' ? r() : frame.addEventListener('load', r, { once: true })))
    await Promise.all([...doc.images].map(img => (img.complete ? null : new Promise(r => { img.onload = img.onerror = r }))))
    if (doc.fonts?.ready) await doc.fonts.ready

    const optionen = { scale: 2, backgroundColor: '#ffffff', windowWidth: 794, useCORS: true }
    let canvas
    try {
      canvas = await html2canvas(doc.body, optionen)
      canvas.toDataURL('image/jpeg') // wirft, wenn ein Bild (Logo) ohne CORS die Fläche „verschmutzt“
    } catch {
      doc.querySelectorAll('img:not([src^="data:"])').forEach(img => img.remove())
      canvas = await html2canvas(doc.body, optionen)
    }

    // Auf A4-Seiten verteilen
    const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
    const seiteB = 210, seiteH = 297
    const pxProSeite = Math.floor(canvas.width * seiteH / seiteB)
    for (let y = 0, seite = 0; y < canvas.height; y += pxProSeite, seite++) {
      const teil = document.createElement('canvas')
      teil.width = canvas.width
      teil.height = Math.min(pxProSeite, canvas.height - y)
      const ctx = teil.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, teil.width, teil.height)
      ctx.drawImage(canvas, 0, -y)
      if (seite > 0) pdf.addPage()
      pdf.addImage(teil.toDataURL('image/jpeg', 0.9), 'JPEG', 0, 0, seiteB, teil.height * seiteB / teil.width)
    }
    return pdf.output('blob')
  } finally {
    frame.remove()
  }
}

// Unterschriebenen Antrag als PDF bei den Dokumenten des Mitglieds ablegen
// und das Mitglied per E-Mail benachrichtigen.
//   typ: 'aufnahmeformular' | 'vertrag' (Werte wie in mitglied_dateien)
export async function antragAblegen({ html, profilId, name, typ }) {
  const blob = await htmlZuPdf(html)
  const { data: { user } } = await supabase.auth.getUser()
  const datei = name.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-zA-Z0-9._-]+/g, '_')
  const pfad = `${profilId}/${Date.now()}_${datei}.pdf`

  const { error: upErr } = await supabase.storage.from('mitglied-dateien').upload(pfad, blob, { contentType: 'application/pdf' })
  if (upErr) throw upErr
  const { error: dbErr } = await supabase.from('mitglied_dateien').insert({
    profil_id: profilId, name, typ, bucket_pfad: pfad, hochgeladen_von: user?.id ?? null,
  })
  if (dbErr) throw dbErr

  supabase.functions.invoke('send-email', { body: { type: 'neues_dokument', profil_id: profilId, name, typ } }).catch(() => {})
}
