import { useState, useRef, useEffect } from 'react'
import { Upload, FileText, X, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Blatt, Feld, Knopf, FehlerText, eingabeStil } from '../../ui'
import { istBild, bildDataUrl, bilderNachPdf } from '../../components/stueck/DateiUploadModal'

// Datei zu einem Lied hochladen. Logik wie DateiUploadModal: mehrere Fotos von Noten werden zu einem PDF.
const TYPEN = [
  ['noten', 'file_type_noten_pdf'],
  ['musicxml', 'file_type_noten_xml'],
  ['akkorde', 'piece_chords'],
  ['audio', 'piece_audio'],
  ['dokument', 'file_type_dokument'],
]

export default function DateiHochladenBlatt({ stueckId, onClose, onErfolg }) {
  const { profil, T } = useApp()
  const fileRef = useRef()
  const [form, setForm] = useState({ typ: 'noten', stimme: 'keine', name: '' })
  const [dateien, setDateien] = useState([])
  const [sendet, setSendet] = useState(false)
  const [konvertiert, setKonvertiert] = useState(false)
  const [fehler, setFehler] = useState('')

  const einzel = dateien[0] ?? null
  const notenBilder = form.typ === 'noten' && dateien.length > 0 && dateien.every(istBild)

  function waehlen(files) {
    const liste = Array.from(files)
    setFehler('')
    setDateien(form.typ === 'noten' ? liste : liste.slice(0, 1))
  }

  async function hochladen() {
    if (dateien.length === 0) { setFehler(T('dok_no_file')); return }
    setSendet(true)
    setFehler('')
    let datei = einzel
    if (notenBilder) {
      setKonvertiert(true)
      try {
        datei = await bilderNachPdf(dateien, dateien.length === 1 ? einzel.name : 'noten')
      } catch {
        setFehler(T('conversion_failed'))
        setSendet(false); setKonvertiert(false); return
      }
      setKonvertiert(false)
    }
    if (datei.size > 50 * 1024 * 1024) {
      setFehler(T('file_too_large').replace('{n}', 50))
      setSendet(false); return
    }
    const sauberName = datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pfad = `${stueckId}/${form.typ}/${Date.now()}_${sauberName}`
    const { error: sErr } = await supabase.storage.from('stueck-dateien').upload(pfad, datei)
    if (sErr) { setFehler(sErr.message); setSendet(false); return }
    const { error: dErr } = await supabase.from('stueck_dateien').insert({
      stueck_id: stueckId, typ: form.typ, stimme: form.stimme,
      name: form.name || datei.name, bucket_pfad: pfad, hochgeladen_von: profil.id,
    })
    if (dErr) setFehler(dErr.message)
    else { onErfolg(); onClose() }
    setSendet(false)
  }

  return (
    <Blatt titel={T('nb_datei_hochladen')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('file_type_label')}>
          <select value={form.typ} onChange={e => { setForm(f => ({ ...f, typ: e.target.value })); setDateien([]) }} style={eingabeStil}>
            {TYPEN.map(([key, label]) => <option key={key} value={key}>{T(label)}</option>)}
          </select>
        </Feld>

        {(form.typ === 'noten' || form.typ === 'audio') && (
          <Feld label={T('voice_group_label')}>
            <select value={form.stimme} onChange={e => setForm(f => ({ ...f, stimme: e.target.value }))} style={eingabeStil}>
              <option value="keine">{T('voice_all_voices')}</option>
              <option value="sopran">{T('piece_voice_soprano')}</option>
              <option value="alt">{T('piece_voice_alto')}</option>
              <option value="tenor">{T('piece_voice_tenor')}</option>
              <option value="bass">{T('piece_voice_bass')}</option>
            </select>
          </Feld>
        )}

        <div>
          <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{T('file_label')}</div>
          <button type="button" onClick={() => fileRef.current.click()}
            onDragOver={e => e.preventDefault()} onDrop={e => { e.preventDefault(); waehlen(e.dataTransfer.files) }}
            style={{ width: '100%', minHeight: 120, padding: 20, borderRadius: 18, border: '2px dashed var(--n-fill-2)', background: 'var(--n-fill)', color: 'var(--text)', fontFamily: 'inherit', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8 }}>
            {dateien.length > 0 ? (
              <>
                <FileText aria-hidden="true" size={28} color="var(--primary)" />
                <span style={{ fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>
                  {dateien.length === 1 ? einzel.name : T('n_files_selected').replace('{n}', dateien.length)}
                </span>
                <span style={{ fontSize: 15, color: 'var(--text-2)' }}>{T('nb_andere_datei')}</span>
              </>
            ) : (
              <>
                <Upload aria-hidden="true" size={28} color="var(--primary)" />
                <span style={{ fontSize: 17, fontWeight: 600 }}>{T('nb_datei_waehlen')}</span>
                {form.typ === 'noten' && <span style={{ fontSize: 15, color: 'var(--text-2)' }}>{T('file_notes_help')}</span>}
              </>
            )}
          </button>
          <input ref={fileRef} type="file" hidden accept={form.typ === 'noten' ? '.pdf,image/*' : undefined}
            multiple={form.typ === 'noten'} onChange={e => waehlen(e.target.files)} />
        </div>

        {notenBilder && (
          <div>
            <p style={{ margin: '0 0 10px', fontSize: 16, lineHeight: 1.45, color: 'var(--text-2)' }}>
              {T('nb_fotos_werden_pdf').replace('{n}', dateien.length)}
            </p>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              {dateien.map((b, i) => <BildVorschau key={i} datei={b} index={i} onEntfernen={() => setDateien(d => d.filter((_, j) => j !== i))} />)}
              <button type="button" onClick={() => fileRef.current.click()} aria-label={T('nb_weitere_fotos')}
                style={{ width: 72, height: 96, borderRadius: 12, border: '2px dashed var(--n-fill-2)', background: 'none', color: 'var(--primary)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <Plus size={24} />
              </button>
            </div>
          </div>
        )}

        <Feld label={T('display_name_optional')}>
          <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))}
            placeholder={notenBilder ? (einzel?.name.replace(/\.[^.]+$/, '') ?? '') + '.pdf' : (einzel?.name ?? '')} style={eingabeStil} />
        </Feld>

        {fehler && <FehlerText>{fehler}</FehlerText>}
        <Knopf voll icon={Upload} onClick={hochladen} disabled={sendet}>
          {konvertiert ? T('nb_wird_umgewandelt') : sendet ? T('nb_wird_hochgeladen') : T('nb_hochladen')}
        </Knopf>
      </div>
    </Blatt>
  )
}

function BildVorschau({ datei, index, onEntfernen }) {
  const { T } = useApp()
  const [src, setSrc] = useState(null)
  useEffect(() => { bildDataUrl(datei).then(setSrc) }, [datei])
  const seite = T('nb_seite_n').replace('{n}', index + 1)
  return (
    <div style={{ position: 'relative', flexShrink: 0 }}>
      {src
        ? <img src={src} alt={seite} style={{ width: 72, height: 96, objectFit: 'cover', borderRadius: 12, display: 'block', background: 'var(--n-fill)' }} />
        : <div style={{ width: 72, height: 96, borderRadius: 12, background: 'var(--n-fill)' }} />}
      <button type="button" onClick={onEntfernen} aria-label={`${seite}: ${T('delete')}`}
        style={{ position: 'absolute', top: -10, right: -10, width: 32, height: 32, borderRadius: 16, border: '2px solid var(--bg)', background: 'var(--danger)', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 0 }}>
        <X size={16} />
      </button>
    </div>
  )
}
