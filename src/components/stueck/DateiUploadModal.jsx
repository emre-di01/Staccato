import { useState, useRef, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { s } from './stueckStyles'

const BILD_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp', 'image/gif', 'image/bmp', 'image/heic', 'image/heif']

function istBild(datei) {
  return BILD_MIME.includes(datei.type) || /\.(jpe?g|png|webp|gif|bmp|heic|heif)$/i.test(datei.name)
}

async function bildDataUrl(datei) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => resolve(e.target.result)
    reader.onerror = reject
    reader.readAsDataURL(datei)
  })
}

async function bilderNachPdf(bilder, basisName) {
  const { default: jsPDF } = await import('jspdf')
  const pdf = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' })

  for (let i = 0; i < bilder.length; i++) {
    const dataUrl = await bildDataUrl(bilder[i])
    const img = await new Promise((res, rej) => {
      const el = new Image()
      el.onload = () => res(el)
      el.onerror = rej
      el.src = dataUrl
    })

    // Canvas-Rendering normalisiert alle Formate (PNG-Transparenz → weißer Hintergrund, WEBP, etc.)
    const canvas = document.createElement('canvas')
    canvas.width = img.width
    canvas.height = img.height
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)
    const jpeg = canvas.toDataURL('image/jpeg', 0.92)

    if (i > 0) pdf.addPage()
    const pdfW = pdf.internal.pageSize.getWidth()
    const pdfH = pdf.internal.pageSize.getHeight()
    const ratio = img.width / img.height
    let w, h, x, y
    if (ratio > pdfW / pdfH) {
      w = pdfW; h = pdfW / ratio; x = 0; y = (pdfH - h) / 2
    } else {
      h = pdfH; w = pdfH * ratio; x = (pdfW - w) / 2; y = 0
    }
    pdf.addImage(jpeg, 'JPEG', x, y, w, h)
  }

  const blob = pdf.output('blob')
  const name = basisName.replace(/\.[^.]+$/, '') + '.pdf'
  return new File([blob], name, { type: 'application/pdf' })
}

export default function DateiUploadModal({ stueckId, onClose, onErfolg }) {
  const { profil, T } = useApp()
  const fileRef = useRef()
  const [form, setForm] = useState({ typ: 'noten', stimme: 'keine', name: '' })
  const [dateienListe, setDateienListe] = useState([])
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')
  const [konvertieren, setKonvertieren] = useState(false)

  const einzelDatei = dateienListe[0] ?? null
  const sindBilder  = dateienListe.length > 0 && dateienListe.every(istBild)
  const notenBilder = form.typ === 'noten' && sindBilder

  function onDateiWahl(files) {
    const liste = Array.from(files)
    setFehler('')
    if (form.typ === 'noten') {
      setDateienListe(liste)
    } else {
      setDateienListe(liste.slice(0, 1))
    }
  }

  function bildEntfernen(idx) {
    setDateienListe(prev => prev.filter((_, i) => i !== idx))
  }

  async function hochladen() {
    if (dateienListe.length === 0) { setFehler(T('dok_no_file')); return }
    setLaden(true)
    setFehler('')

    let dateiZuHochladen = einzelDatei

    if (notenBilder) {
      setKonvertieren(true)
      try {
        dateiZuHochladen = await bilderNachPdf(
          dateienListe,
          dateienListe.length === 1 ? einzelDatei.name : 'noten'
        )
      } catch {
        setFehler(T('conversion_failed'))
        setLaden(false); setKonvertieren(false); return
      }
      setKonvertieren(false)
    }

    if (dateiZuHochladen.size > 50 * 1024 * 1024) {
      setFehler(T('file_too_large').replace('{n}', 50))
      setLaden(false); return
    }

    const sauberName = dateiZuHochladen.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pfad = `${stueckId}/${form.typ}/${Date.now()}_${sauberName}`
    const { error: sErr } = await supabase.storage.from('stueck-dateien').upload(pfad, dateiZuHochladen)
    if (sErr) { setFehler(sErr.message); setLaden(false); return }
    const { error: dErr } = await supabase.from('stueck_dateien').insert({
      stueck_id: stueckId, typ: form.typ, stimme: form.stimme,
      name: form.name || dateiZuHochladen.name, bucket_pfad: pfad, hochgeladen_von: profil.id,
    })
    if (dErr) setFehler(dErr.message)
    else { onErfolg(); onClose() }
    setLaden(false)
  }

  const acceptAttr = form.typ === 'noten' ? '.pdf,image/*' : undefined

  return createPortal(
    <div className="modal-overlay" style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitel}>{T('modal_file_upload_title')}</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ ...s.modalBody, display:'flex', flexDirection:'column', gap:14 }}>

          {/* Typ */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>{T('file_type_label')}</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {[
                { key:'noten',    icon:'📄', label:T('file_type_noten_pdf') },
                { key:'musicxml', icon:'🎼', label:T('file_type_noten_xml') },
                { key:'akkorde',  icon:'🎸', label:T('piece_chords') },
                { key:'audio',    icon:'🎵', label:T('piece_audio') },
                { key:'dokument', icon:'📋', label:T('file_type_dokument') },
              ].map(t => (
                <button key={t.key} onClick={() => { setForm(f => ({ ...f, typ: t.key })); setDateienListe([]) }}
                  style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:`2px solid ${form.typ===t.key ? 'var(--accent)' : 'var(--border)'}`, background: form.typ===t.key ? 'var(--accent)' : 'var(--bg-2)', color: form.typ===t.key ? 'var(--accent-fg)' : 'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {/* Stimmgruppe */}
          {(form.typ === 'noten' || form.typ === 'audio') && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>{T('voice_group_label')}</label>
              <select style={s.input} value={form.stimme} onChange={e => setForm(f => ({ ...f, stimme: e.target.value }))}>
                <option value="keine">{T('voice_all_voices')}</option>
                <option value="sopran">{T('piece_voice_soprano')}</option>
                <option value="alt">{T('piece_voice_alto')}</option>
                <option value="tenor">{T('piece_voice_tenor')}</option>
                <option value="bass">{T('piece_voice_bass')}</option>
              </select>
            </div>
          )}

          {/* Datei-Auswahl */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>
              {T('file_label')}
              {form.typ === 'noten' && (
                <span style={{ marginLeft:8, fontSize:11, color:'var(--text-3)', fontWeight:400 }}>
                  {T('file_notes_help')}
                </span>
              )}
            </label>

            {/* Drop-Zone */}
            <div style={{ border:'2px dashed var(--border)', borderRadius:'var(--radius)', padding:24, textAlign:'center', cursor:'pointer', background:'var(--bg-2)' }}
              onClick={() => fileRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); onDateiWahl(e.dataTransfer.files) }}>
              {dateienListe.length > 0
                ? <span style={{ color:'var(--text)', fontWeight:600 }}>
                    📎 {dateienListe.length === 1 ? einzelDatei.name : T('n_files_selected').replace('{n}', dateienListe.length)}
                  </span>
                : <span style={{ color:'var(--text-3)' }}>{T('dok_choose_file')}</span>
              }
              <input ref={fileRef} type="file" hidden accept={acceptAttr}
                multiple={form.typ === 'noten'}
                onChange={e => onDateiWahl(e.target.files)} />
            </div>

            {/* Bild-Vorschau */}
            {notenBilder && (
              <div style={{ marginTop:4 }}>
                <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:8 }}>
                  <span style={{ fontSize:12, background:'var(--accent)', color:'var(--accent-fg)', padding:'2px 8px', borderRadius:99, fontWeight:700 }}>
                    {T('photos_to_pdf')}
                  </span>
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>
                    {dateienListe.length} {dateienListe.length > 1 ? T('photo_plural') : T('photo_singular')} · {T('photos_auto_convert')}
                  </span>
                  <button onClick={() => fileRef.current.click()}
                    style={{ marginLeft:'auto', fontSize:11, padding:'3px 8px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'var(--bg)', color:'var(--text-2)', cursor:'pointer', fontFamily:'inherit' }}>
                    {T('add_more_photos')}
                  </button>
                </div>
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  {dateienListe.map((b, i) => (
                    <BildVorschau key={i} datei={b} index={i} onEntfernen={() => bildEntfernen(i)} />
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Anzeigename */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>{T('display_name_optional')}</label>
            <input style={s.input}
              placeholder={notenBilder ? (einzelDatei?.name.replace(/\.[^.]+$/, '') ?? '') + '.pdf' : (einzelDatei?.name ?? 'z.B. Noten Sopran')}
              value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
            <button onClick={hochladen} disabled={laden} style={s.btnPri}>
              {konvertieren ? T('btn_converting') : laden ? T('dok_uploading') : notenBilder ? T('btn_convert_upload') : T('dok_upload')}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

function BildVorschau({ datei, index, onEntfernen }) {
  const [src, setSrc] = useState(null)
  useEffect(() => { bildDataUrl(datei).then(setSrc) }, [datei])
  return (
    <div style={{ position:'relative', flexShrink:0 }}>
      {src
        ? <img src={src} alt={`Seite ${index + 1}`}
            style={{ width:72, height:96, objectFit:'cover', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', display:'block' }} />
        : <div style={{ width:72, height:96, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-3)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:20 }}>📄</div>
      }
      <div style={{ position:'absolute', top:-6, right:-6 }}>
        <button onClick={onEntfernen}
          style={{ width:18, height:18, borderRadius:'50%', border:'none', background:'var(--danger)', color:'#fff', fontSize:10, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', padding:0, lineHeight:1 }}>
          ✕
        </button>
      </div>
      <div style={{ position:'absolute', bottom:2, left:2, right:2, textAlign:'center', fontSize:9, color:'rgba(255,255,255,0.8)', background:'rgba(0,0,0,0.5)', borderRadius:3, padding:'1px 2px' }}>
        S. {index + 1}
      </div>
    </div>
  )
}
