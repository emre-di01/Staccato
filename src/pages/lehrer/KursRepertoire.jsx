import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

// ─── Stück anlegen Modal ──────────────────────────────────────
function NeuesStueckModal({ kursId, onClose, onErfolg }) {
  const { profil, T } = useApp()
  const [form, setForm] = useState({ titel:'', komponist:'', tonart:'', tempo:'', youtube_url:'' })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  async function speichern() {
    if (!form.titel) { setFehler(T('title_required')); return }
    setLaden(true)
    const { data: stueck, error } = await supabase.from('stuecke').insert({
      ...form, erstellt_von: profil.id,
    }).select().single()
    if (error) { setFehler(error.message); setLaden(false); return }

    // Stück dem Kurs zuordnen
    await supabase.from('unterricht_stuecke').insert({
      unterricht_id: kursId, stueck_id: stueck.id, status:'aktuell',
    })
    supabase.functions.invoke('send-email', {
      body: { type: 'new_piece', unterricht_id: kursId, stueck_id: stueck.id },
    }).catch(console.error)
    onErfolg(); onClose()
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitel}>🎵 Neues Stück</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {[
            { key:'titel',       label:'Titel *',       placeholder:'z.B. Ave Maria' },
            { key:'komponist',   label:'Komponist',     placeholder:'z.B. Schubert' },
            { key:'tonart',      label:'Tonart',        placeholder:'z.B. F-Dur' },
            { key:'tempo',       label:'Tempo',         placeholder:'z.B. Andante / 80 BPM' },
            { key:'youtube_url', label:'YouTube-Link',  placeholder:'https://youtube.com/...' },
          ].map(f => (
            <div key={f.key} style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>{f.label}</label>
              <input style={s.input} placeholder={f.placeholder} value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
            <button onClick={speichern} disabled={laden} style={s.btnPri}>
              {laden ? T('saving') : T('piece_create')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Allgemeine Datei hochladen Modal ─────────────────────────
function DateiUploadModal({ kursId, schuelerListe, onClose, onErfolg }) {
  const { profil, T } = useApp()
  const fileRef = useRef()
  const [form, setForm] = useState({ name:'', typ:'dokument', schueler_id:'' })
  const [datei, setDatei] = useState(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')

  async function hochladen() {
    if (!datei) { setFehler(T('dok_no_file')); return }
    setLaden(true)
    const sauberName = datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const bucket = form.schueler_id ? 'schueler-dateien' : 'kurs-dateien'
    const pfad   = form.schueler_id
      ? `${form.schueler_id}/${Date.now()}_${sauberName}`
      : `${kursId}/${Date.now()}_${sauberName}`

    const { error: sErr } = await supabase.storage.from(bucket).upload(pfad, datei)
    if (sErr) { setFehler(sErr.message); setLaden(false); return }

    const { error: dErr } = await supabase.from('dateien').insert({
      name: form.name || datei.name,
      bucket_pfad: pfad,
      typ: form.typ,
      unterricht_id: form.schueler_id ? null : kursId,
      schueler_id:   form.schueler_id || null,
      hochgeladen_von: profil.id,
    })
    if (dErr) setFehler(dErr.message)
    else { onErfolg(); onClose() }
    setLaden(false)
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitel}>📁 {T('upload')}</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Für wen */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>{T('upload_for_whom')}</label>
            <select style={s.input} value={form.schueler_id} onChange={e => setForm(f => ({ ...f, schueler_id: e.target.value }))}>
              <option value="">{T('upload_all_students')}</option>
              {schuelerListe.map(sc => <option key={sc.schueler_id} value={sc.schueler_id}>{sc.profiles?.voller_name}</option>)}
            </select>
          </div>
          {/* Datei */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>{T('file_label')}</label>
            <div style={{ border:'2px dashed var(--border)', borderRadius:'var(--radius)', padding:20, textAlign:'center', cursor:'pointer', background:'var(--bg-2)' }}
              onClick={() => fileRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); setDatei(e.dataTransfer.files[0]) }}>
              {datei ? <span style={{ color:'var(--text)', fontWeight:600 }}>📎 {datei.name}</span>
                     : <span style={{ color:'var(--text-3)' }}>{T('dok_choose_file')}</span>}
              <input ref={fileRef} type="file" hidden onChange={e => setDatei(e.target.files[0])} />
            </div>
          </div>
          {/* Name */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>{T('display_name_optional')}</label>
            <input style={s.input} placeholder={datei?.name ?? 'Dateiname'} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
            <button onClick={hochladen} disabled={laden} style={s.btnPri}>
              {laden ? T('dok_uploading') : T('dok_upload')}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function KursRepertoire() {
  const { id: kursId } = useParams()
  const navigate = useNavigate()
  const { rolle, profil, T } = useApp()
  const [kurs,      setKurs]      = useState(null)
  const [stuecke,   setStuecke]   = useState([])
  const [dateien,   setDateien]   = useState([])
  const [schueler,  setSchueler]  = useState([])
  const [laden,     setLaden]     = useState(true)
  const [tab,       setTab]       = useState('stuecke')
  const [suche,     setSuche]     = useState('')
  const [modal,     setModal]     = useState(null)

  const kannBearbeiten = rolle === 'admin' || rolle === 'lehrer'

  useEffect(() => { ladeData() }, [kursId])

  async function ladeData() {
    const [k, us, d, sc] = await Promise.all([
      supabase.from('unterricht').select('id, name, typ, farbe').eq('id', kursId).single(),
      supabase.from('unterricht_stuecke')
        .select('*, stuecke(*, stueck_dateien(typ))')
        .eq('unterricht_id', kursId)
        .order('reihenfolge'),
      supabase.from('dateien').select('*').eq('unterricht_id', kursId).order('hochgeladen_am', { ascending:false }),
      supabase.from('unterricht_schueler')
        .select('schueler_id, profiles!unterricht_schueler_schueler_id_fkey(voller_name)')
        .eq('unterricht_id', kursId).eq('status', 'aktiv'),
    ])
    setKurs(k.data)
    setStuecke(us.data ?? [])
    setDateien(d.data ?? [])
    setSchueler(sc.data ?? [])
    setLaden(false)
  }

  async function stueckEntfernen(unterrichtStueckId) {
    if (!confirm(T('piece_remove_confirm'))) return
    await supabase.from('unterricht_stuecke').delete().eq('unterricht_id', kursId).eq('stueck_id', unterrichtStueckId)
    setStuecke(prev => prev.filter(s => s.stueck_id !== unterrichtStueckId))
  }

  async function statusAendern(stueckId, status) {
    await supabase.from('unterricht_stuecke').update({ status }).eq('unterricht_id', kursId).eq('stueck_id', stueckId)
    setStuecke(prev => prev.map(s => s.stueck_id === stueckId ? { ...s, status } : s))
  }

  async function dateiLoeschen(datei) {
    if (!confirm(T('file_delete_confirm'))) return
    const bucket = datei.schueler_id ? 'schueler-dateien' : 'kurs-dateien'
    await supabase.storage.from(bucket).remove([datei.bucket_pfad])
    await supabase.from('dateien').delete().eq('id', datei.id)
    setDateien(prev => prev.filter(d => d.id !== datei.id))
  }

  async function dateiHerunterladen(datei) {
    const bucket = datei.schueler_id ? 'schueler-dateien' : 'kurs-dateien'
    const { data } = await supabase.storage.from(bucket).download(datei.bucket_pfad)
    if (data) {
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url; a.download = datei.name; a.click()
      URL.revokeObjectURL(url)
    }
  }

  const gefilterteStuecke = stuecke.filter(us =>
    us.stuecke?.titel?.toLowerCase().includes(suche.toLowerCase()) ||
    us.stuecke?.komponist?.toLowerCase().includes(suche.toLowerCase())
  )

  const STATUS_FARBE = {
    aktuell:      { bg:'var(--success)', text:'#fff' },
    geplant:      { bg:'var(--warning)', text:'#fff' },
    abgeschlossen:{ bg:'var(--bg-3)',    text:'var(--text-3)' },
  }

  if (laden) return <div style={{ padding:40, color:'var(--text-3)' }}>{T('loading')}</div>

  return (
    <div>
      {/* Header */}
      <button onClick={() => navigate(`/lehrer/kurse/${kursId}`)}
        style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 16px' }}>
        ← {kurs?.name}
      </button>

      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={s.h1}>{T('kursrep_title')}</h1>
          <p style={s.sub}>{stuecke.length} {T('repertoire').toLowerCase()} · {dateien.length} {T('files').toLowerCase()}</p>
        </div>
        {kannBearbeiten && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setModal('stueck')} style={s.btnPri}>+ Stück</button>
            <button onClick={() => setModal('datei')}  style={s.btnSek}>⬆ Datei</button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:20, borderBottom:'2px solid var(--border)' }}>
        {[['stuecke',`🎵 ${T('kurs_tab_repertoire').replace('🎼 ','')} (${stuecke.length})`],['dateien',`📁 ${T('files')} (${dateien.length})`]].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding:'10px 18px', background:'none', border:'none', fontSize:14, cursor:'pointer', fontFamily:'inherit', color: tab===k ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===k ? 800 : 500, borderBottom:`2px solid ${tab===k ? 'var(--primary)' : 'transparent'}`, marginBottom:-2 }}>
            {l}
          </button>
        ))}
      </div>

      {/* STÜCKE */}
      {tab === 'stuecke' && (
        <div>
          <input placeholder="🔍 Stück oder Komponist suchen …" value={suche} onChange={e => setSuche(e.target.value)}
            style={{ ...s.input, maxWidth:340, marginBottom:20 }} />

          {gefilterteStuecke.length === 0 ? (
            <div style={s.leer}>
              {kannBearbeiten ? T('kursrep_no_pieces') : T('repertoire_no_pieces')}
            </div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14 }}>
              {gefilterteStuecke.map(us => {
                const st = us.stuecke
                const typen = [...new Set((st.stueck_dateien ?? []).map(d => d.typ))]
                const sf = STATUS_FARBE[us.status] ?? STATUS_FARBE.aktuell
                return (
                  <div key={us.stueck_id} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', overflow:'hidden', cursor:'pointer', transition:'box-shadow 0.15s' }}
                    onClick={() => navigate(`/lehrer/kurse/${kursId}/repertoire/${us.stueck_id}`)}>
                    <div style={{ height:3, background: kurs?.farbe ?? 'var(--primary)' }} />
                    <div style={{ padding:'16px 18px' }}>
                      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:8, marginBottom:10 }}>
                        <div>
                          <div style={{ fontWeight:800, fontSize:15, color:'var(--text)', marginBottom:3 }}>{st.titel}</div>
                          {st.komponist && <div style={{ fontSize:12, color:'var(--text-3)' }}>{st.komponist}</div>}
                        </div>
                        <span style={{ fontSize:11, fontWeight:700, padding:'3px 8px', borderRadius:99, background:sf.bg, color:sf.text, whiteSpace:'nowrap', textTransform:'capitalize' }}>
                          {us.status}
                        </span>
                      </div>

                      {/* Meta */}
                      <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:12 }}>
                        {st.tonart && <span style={s.chip}>🎵 {st.tonart}</span>}
                        {st.tempo  && <span style={s.chip}>♩ {st.tempo}</span>}
                      </div>

                      {/* Medien-Icons */}
                      <div style={{ display:'flex', gap:6, alignItems:'center', justifyContent:'space-between' }}>
                        <div style={{ display:'flex', gap:4 }}>
                          {st.liedtext       && <span title="Liedtext" style={s.mediaIcon}>📝</span>}
                          {st.notizen        && <span title="Akkorde"  style={s.mediaIcon}>🎸</span>}
                          {typen.includes('noten')  && <span title="Noten"   style={s.mediaIcon}>📄</span>}
                          {typen.includes('audio')  && <span title="Audio"   style={s.mediaIcon}>🎵</span>}
                          {st.youtube_url    && <span title="YouTube" style={s.mediaIcon}>▶️</span>}
                        </div>
                        {kannBearbeiten && (
                          <div style={{ display:'flex', gap:4 }} onClick={e => e.stopPropagation()}>
                            <select value={us.status} onChange={e => statusAendern(us.stueck_id, e.target.value)}
                              style={{ ...s.input, width:'auto', fontSize:11, padding:'3px 8px' }}>
                              <option value="aktuell">{T('status_aktuell')}</option>
                              <option value="geplant">{T('status_geplant')}</option>
                              <option value="abgeschlossen">{T('status_fertig')}</option>
                            </select>
                            <button onClick={() => stueckEntfernen(us.stueck_id)} style={{ ...s.iconBtn, color:'var(--danger)' }} title="Entfernen">🗑</button>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* DATEIEN */}
      {tab === 'dateien' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {dateien.length === 0 ? (
            <div style={s.leer}>{kannBearbeiten ? 'Noch keine Dateien. Klick auf "⬆ Datei" um zu beginnen.' : 'Keine Dateien vorhanden.'}</div>
          ) : (
            dateien.map(d => {
              const sc = schueler.find(s => s.schueler_id === d.schueler_id)
              return (
                <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:'var(--radius)', background:'var(--surface)', border:'1px solid var(--border)', boxShadow:'var(--shadow)' }}>
                  <span style={{ fontSize:22 }}>
                    {d.typ === 'noten' ? '📄' : d.typ === 'audio' ? '🎵' : d.typ === 'akkorde' ? '🎸' : '📋'}
                  </span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{d.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                      {sc ? `👤 Nur für ${sc.profiles?.voller_name}` : '👥 Für alle Schüler'}
                      {' · '}{new Date(d.hochgeladen_am).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  <button onClick={() => dateiHerunterladen(d)}
                    style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    ⬇
                  </button>
                  {kannBearbeiten && (
                    <button onClick={() => dateiLoeschen(d)} style={{ ...s.iconBtn, color:'var(--danger)' }}>🗑</button>
                  )}
                </div>
              )
            })
          )}
        </div>
      )}

      {modal === 'stueck' && <NeuesStueckModal kursId={kursId} onClose={() => setModal(null)} onErfolg={ladeData} />}
      {modal === 'datei'  && <DateiUploadModal kursId={kursId} schuelerListe={schueler} onClose={() => setModal(null)} onErfolg={ladeData} />}
    </div>
  )
}

const s = {
  h1:          { margin:'0 0 4px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  sub:         { margin:0, color:'var(--text-3)', fontSize:14 },
  label:       { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  input:       { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%' },
  btnPri:      { padding:'10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek:      { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  iconBtn:     { background:'none', border:'none', fontSize:16, cursor:'pointer', color:'var(--text-3)', padding:4 },
  leer:        { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px dashed var(--border)' },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
  modal:       { background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:460, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 },
  modalTitel:  { margin:0, fontSize:18, fontWeight:800, color:'var(--text)' },
  chip:        { fontSize:12, padding:'2px 8px', borderRadius:99, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-3)' },
  mediaIcon:   { fontSize:16 },
}
