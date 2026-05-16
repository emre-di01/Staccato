import { useState, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { s } from './stueckStyles'

export default function DateiUploadModal({ stueckId, onClose, onErfolg }) {
  const { profil, T } = useApp()
  const fileRef = useRef()
  const [form, setForm] = useState({ typ: 'noten', stimme: 'keine', name: '' })
  const [datei, setDatei] = useState(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')

  async function hochladen() {
    if (!datei) { setFehler('Bitte eine Datei wählen.'); return }
    if (datei.size > 50 * 1024 * 1024) { setFehler(T('file_too_large').replace('{n}', 50)); return }
    setLaden(true)
    const sauberName = datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pfad = `${stueckId}/${form.typ}/${Date.now()}_${sauberName}`
    const { error: sErr } = await supabase.storage.from('stueck-dateien').upload(pfad, datei)
    if (sErr) { setFehler(sErr.message); setLaden(false); return }
    const { error: dErr } = await supabase.from('stueck_dateien').insert({
      stueck_id: stueckId, typ: form.typ, stimme: form.stimme,
      name: form.name || datei.name, bucket_pfad: pfad, hochgeladen_von: profil.id,
    })
    if (dErr) setFehler(dErr.message)
    else { onErfolg(); onClose() }
    setLaden(false)
  }

  return createPortal(
    <div className="modal-overlay" style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitel}>📎 Datei hochladen</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ ...s.modalBody, display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Dateityp</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {[
                { key:'noten',    icon:'📄', label:'Noten (PDF)' },
                { key:'musicxml', icon:'🎼', label:'Noten (XML)' },
                { key:'akkorde',  icon:'🎸', label:'Akkorde' },
                { key:'audio',    icon:'🎵', label:'Audio' },
                { key:'dokument', icon:'📋', label:'Dokument' },
              ].map(t => (
                <button key={t.key} onClick={() => setForm(f => ({ ...f, typ: t.key }))}
                  style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:`2px solid ${form.typ===t.key ? 'var(--accent)' : 'var(--border)'}`, background: form.typ===t.key ? 'var(--accent)' : 'var(--bg-2)', color: form.typ===t.key ? 'var(--accent-fg)' : 'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {(form.typ === 'noten' || form.typ === 'audio') && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>Stimmgruppe</label>
              <select style={s.input} value={form.stimme} onChange={e => setForm(f => ({ ...f, stimme: e.target.value }))}>
                <option value="keine">Alle Stimmen</option>
                <option value="sopran">Sopran</option>
                <option value="alt">Alt</option>
                <option value="tenor">Tenor</option>
                <option value="bass">Bass</option>
              </select>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Datei</label>
            <div style={{ border:'2px dashed var(--border)', borderRadius:'var(--radius)', padding:24, textAlign:'center', cursor:'pointer', background:'var(--bg-2)' }}
              onClick={() => fileRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); setDatei(e.dataTransfer.files[0]) }}>
              {datei
                ? <span style={{ color:'var(--text)', fontWeight:600 }}>📎 {datei.name}</span>
                : <span style={{ color:'var(--text-3)' }}>Klicken oder Datei hierher ziehen</span>
              }
              <input ref={fileRef} type="file" hidden onChange={e => setDatei(e.target.files[0])} />
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Anzeigename (optional)</label>
            <input style={s.input} placeholder={datei?.name ?? 'z.B. Noten Sopran'} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
            <button onClick={hochladen} disabled={laden} style={s.btnPri}>
              {laden ? 'Hochladen …' : '⬆ Hochladen'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}
