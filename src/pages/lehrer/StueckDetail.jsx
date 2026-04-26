import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

// ─── ChordPro Renderer ────────────────────────────────────────
function ChordPro({ text }) {
  if (!text) return null
  return (
    <div style={{ fontFamily:'monospace', fontSize:14, lineHeight:2, color:'var(--text)' }}>
      {text.split('\n').map((zeile, i) => {
        const teile = zeile.split(/(\[[^\]]+\])/)
        return (
          <div key={i} style={{ minHeight:'1.5em' }}>
            {teile.map((t, j) =>
              t.startsWith('[') && t.endsWith(']')
                ? <strong key={j} style={{ color:'var(--accent)', marginRight:2, fontSize:12 }}>{t.slice(1,-1)}</strong>
                : <span key={j}>{t}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── PDF Viewer ───────────────────────────────────────────────
function PdfViewer({ datei }) {
  const [url, setUrl] = useState(null)
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    supabase.storage.from('stueck-dateien').createSignedUrl(datei.bucket_pfad, 3600)
      .then(({ data }) => { setUrl(data?.signedUrl); setLaden(false) })
  }, [datei.bucket_pfad])

  if (laden) return <div style={s.leer}>PDF wird geladen …</div>
  if (!url)  return <div style={s.leer}>PDF konnte nicht geladen werden.</div>

  return (
    <iframe src={url} style={{ width:'100%', height:600, borderRadius:'var(--radius)', border:'1px solid var(--border)' }} title={datei.name} />
  )
}

// ─── Audio Player ─────────────────────────────────────────────
function AudioPlayer({ datei }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    supabase.storage.from('stueck-dateien').createSignedUrl(datei.bucket_pfad, 3600)
      .then(({ data }) => setUrl(data?.signedUrl))
  }, [datei.bucket_pfad])

  return (
    <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'16px 20px', border:'1px solid var(--border)' }}>
      <div style={{ fontWeight:600, fontSize:14, color:'var(--text)', marginBottom:10 }}>
        🎵 {datei.name}
        {datei.stimme && datei.stimme !== 'keine' && <span style={{ marginLeft:8, fontSize:11, color:'var(--text-3)', textTransform:'capitalize' }}>({datei.stimme})</span>}
      </div>
      {url
        ? <audio controls src={url} style={{ width:'100%' }} />
        : <div style={{ color:'var(--text-3)', fontSize:13 }}>Lade Audio …</div>
      }
    </div>
  )
}

// ─── YouTube ID extrahieren ───────────────────────────────────
function youtubeId(url) {
  return url?.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1]
}

// ─── Upload Modal (für Lehrer) ────────────────────────────────
function DateiUploadModal({ stueckId, onClose, onErfolg }) {
  const { profil } = useApp()
  const fileRef = useRef()
  const [form, setForm] = useState({ typ: 'noten', stimme: 'keine', name: '' })
  const [datei, setDatei] = useState(null)
  const [progress, setProgress] = useState(0)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')

  async function hochladen() {
    if (!datei) { setFehler('Bitte eine Datei wählen.'); return }
    setLaden(true)
    // Dateinamen bereinigen - keine Sonderzeichen
    const sauberName = datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pfad = `${stueckId}/${form.typ}/${Date.now()}_${sauberName}`
    const { error: sErr } = await supabase.storage.from('stueck-dateien').upload(pfad, datei)
    if (sErr) { setFehler(sErr.message); setLaden(false); return }

    const { error: dErr } = await supabase.from('stueck_dateien').insert({
      stueck_id: stueckId,
      typ: form.typ,
      stimme: form.stimme,
      name: form.name || datei.name,
      bucket_pfad: pfad,
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
          <h3 style={s.modalTitel}>📎 Datei hochladen</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          {/* Typ */}
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Dateityp</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {[
                { key:'noten',    icon:'📄', label:'Noten' },
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

          {/* Stimme (nur bei Noten/Audio) */}
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

          {/* Datei */}
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

          {/* Name */}
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
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function StueckDetail() {
  const { kursId, stueckId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { rolle } = useApp()

  const istEvent = location.pathname.includes('/events/')
  const backPfad = istEvent
    ? `/${location.pathname.split('/')[1]}/events/${kursId}/repertoire`
    : `/lehrer/kurse/${kursId}/repertoire`
  const [stueck,  setStueck]  = useState(null)
  const [dateien, setDateien] = useState([])
  const [laden,   setLaden]   = useState(true)
  const [tab,     setTab]     = useState('text')
  const [filterStimme, setFilterStimme] = useState('alle')
  const [bearbeiteText, setBearbeiteText] = useState(false)
  const [modal,   setModal]   = useState(null)

  const kannBearbeiten = rolle === 'admin' || rolle === 'superadmin' || rolle === 'lehrer'
  const [textGroesse,   setTextGroesse]   = useState(16)
  const [vollbild,      setVollbild]      = useState(false)

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') setVollbild(false) }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => { ladeData() }, [stueckId])

  async function ladeData() {
    const [st, d] = await Promise.all([
      supabase.from('stuecke').select('*').eq('id', stueckId).single(),
      supabase.from('stueck_dateien').select('*').eq('stueck_id', stueckId).order('hochgeladen_am'),
    ])
    setStueck(st.data)
    setDateien(d.data ?? [])
    setLaden(false)
  }

  async function textSpeichern(neuerText, neueAkkorde) {
    await supabase.from('stuecke').update({ liedtext: neuerText, notizen: neueAkkorde }).eq('id', stueckId)
    setStueck(s => ({ ...s, liedtext: neuerText, notizen: neueAkkorde }))
    setBearbeiteText(false)
  }

  async function dateiLoeschen(dateiId, pfad) {
    if (!confirm('Datei wirklich löschen?')) return
    await supabase.storage.from('stueck-dateien').remove([pfad])
    await supabase.from('stueck_dateien').delete().eq('id', dateiId)
    setDateien(prev => prev.filter(d => d.id !== dateiId))
  }

  if (laden) return <div style={{ padding:40, color:'var(--text-3)' }}>Laden …</div>
  if (!stueck) return <div style={{ padding:40, color:'var(--danger)' }}>Stück nicht gefunden.</div>

  const gefilterteDateien = dateien.filter(d =>
    filterStimme === 'alle' || d.stimme === filterStimme || d.stimme === 'keine'
  )
  const notenDateien  = gefilterteDateien.filter(d => d.typ === 'noten')
  const audioDateien  = gefilterteDateien.filter(d => d.typ === 'audio')
  const akkordDateien = gefilterteDateien.filter(d => d.typ === 'akkorde')
  const dokumente     = gefilterteDateien.filter(d => d.typ === 'dokument' || d.typ === 'sonstiges')

  // Tabs die wirklich Inhalt haben
  const tabs = [
    { id:'text',    label:'📝 Liedtext',  zeigen: !!stueck.liedtext || kannBearbeiten },
    { id:'akkorde', label:'🎸 Akkorde',   zeigen: akkordDateien.length > 0 || (kannBearbeiten && !!stueck.notizen) },
    { id:'noten',   label:'📄 Noten',     zeigen: notenDateien.length > 0 },
    { id:'audio',   label:'🎵 Audio',     zeigen: audioDateien.length > 0 },
    { id:'youtube', label:'▶️ Video',     zeigen: !!stueck.youtube_url },
    { id:'dateien', label:'📁 Dateien',   zeigen: dokumente.length > 0 || kannBearbeiten },
  ].filter(t => t.zeigen)

  return (
    <div>
      {/* Zurück */}
      <button onClick={() => navigate(backPfad)}
        style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 16px' }}>
        ← Repertoire
      </button>

      {/* Header */}
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'24px', border:'1px solid var(--border)', marginBottom:24, boxShadow:'var(--shadow)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
          <div>
            <h1 style={{ margin:'0 0 6px', fontSize:24, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' }}>{stueck.titel}</h1>
            <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:13, color:'var(--text-2)' }}>
              {stueck.komponist && <span>🎼 {stueck.komponist}</span>}
              {stueck.tonart    && <span>🎵 {stueck.tonart}</span>}
              {stueck.tempo     && <span>♩ {stueck.tempo}</span>}
            </div>
          </div>
          {kannBearbeiten && (
            <button onClick={() => setModal('upload')} style={s.btnPri}>⬆ Datei hochladen</button>
          )}
        </div>

        {/* Stimmen-Filter */}
        <div style={{ display:'flex', gap:6, marginTop:16, flexWrap:'wrap' }}>
          {['alle','sopran','alt','tenor','bass'].map(st => (
            <button key={st} onClick={() => setFilterStimme(st)}
              style={{ padding:'4px 12px', borderRadius:99, border:'1.5px solid var(--border)', background: filterStimme===st ? 'var(--primary)' : 'var(--bg-2)', color: filterStimme===st ? 'var(--primary-fg)' : 'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
              {st === 'alle' ? 'Alle Stimmen' : st}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <div style={{ display:'flex', gap:2, marginBottom:20, borderBottom:'2px solid var(--border)', overflowX:'auto' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding:'10px 16px', background:'none', border:'none', fontSize:14, cursor:'pointer', fontFamily:'inherit', color: tab===t.id ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===t.id ? 800 : 500, borderBottom:`2px solid ${tab===t.id ? 'var(--primary)' : 'transparent'}`, marginBottom:-2, whiteSpace:'nowrap' }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab Inhalt */}
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:28, border:'1px solid var(--border)', boxShadow:'var(--shadow)' }}>

        {/* LIEDTEXT */}
        {tab === 'text' && (
          <div>
            {bearbeiteText && kannBearbeiten ? (
              <LiedtextBearbeiten stueck={stueck} onSpeichern={textSpeichern} onAbbrechen={() => setBearbeiteText(false)} />
            ) : stueck.liedtext ? (
              <>
                {/* Toolbar */}
                <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
                  <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:600 }}>Größe:</span>
                  {[12, 16, 20, 26, 34, 44].map(gr => (
                    <button key={gr} onClick={() => setTextGroesse(gr)}
                      style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:`1.5px solid ${textGroesse===gr ? 'var(--primary)' : 'var(--border)'}`, background: textGroesse===gr ? 'var(--primary)' : 'var(--bg-2)', color: textGroesse===gr ? 'var(--primary-fg)' : 'var(--text-2)', fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                      {gr}
                    </button>
                  ))}
                  <div style={{ flex:1 }} />
                  <button onClick={() => setVollbild(true)}
                    style={{ padding:'8px 16px', borderRadius:'var(--radius)', border:'none', background:'var(--accent)', color:'var(--accent-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', minHeight:40 }}>
                    ⛶ Vollbild
                  </button>
                  {kannBearbeiten && (
                    <button onClick={() => setBearbeiteText(true)} style={s.btnSek}>✏️ Bearbeiten</button>
                  )}
                </div>

                {/* Text */}
                <pre style={{ fontFamily:'Georgia, serif', fontSize:textGroesse, lineHeight:1.9, color:'var(--text)', whiteSpace:'pre-wrap', margin:0, transition:'font-size 0.2s' }}>
                  {stueck.liedtext}
                </pre>
              </>
            ) : kannBearbeiten ? (
              <div style={{ textAlign:'center', padding:32 }}>
                <p style={{ color:'var(--text-3)', marginBottom:16 }}>Noch kein Liedtext vorhanden.</p>
                <button onClick={() => setBearbeiteText(true)} style={s.btnPri}>+ Liedtext hinzufügen</button>
              </div>
            ) : (
              <div style={s.leer}>Kein Liedtext vorhanden.</div>
            )}
          </div>
        )}

        {/* AKKORDE */}
        {tab === 'akkorde' && (
          <div>
            {/* Inline Akkorde aus notizen-Feld */}
            {stueck.notizen && (
              <div style={{ marginBottom:24 }}>
                <div style={s.sectionLabel}>Akkorde</div>
                <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'16px 20px', marginTop:8 }}>
                  <ChordPro text={stueck.notizen} />
                </div>
                {kannBearbeiten && <button onClick={() => setBearbeiteText(true)} style={{ ...s.btnSek, marginTop:10, fontSize:12 }}>✏️ Bearbeiten</button>}
              </div>
            )}
            {/* ChordPro Dateien */}
            {akkordDateien.map(d => (
              <div key={d.id} style={{ marginBottom:20 }}>
                <div style={s.sectionLabel}>{d.name}</div>
                <AkkordDateiAnzeige key={d.id} datei={d} kannLoeschen={kannBearbeiten} onLoeschen={() => dateiLoeschen(d.id, d.bucket_pfad)} />
              </div>
            ))}
            {!stueck.notizen && akkordDateien.length === 0 && (
              <div style={s.leer}>Keine Akkorde vorhanden.</div>
            )}
          </div>
        )}

        {/* NOTEN */}
        {tab === 'noten' && (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {notenDateien.map(d => (
              <div key={d.id}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <div style={s.sectionLabel}>
                    📄 {d.name} {d.stimme !== 'keine' && <span style={{ color:'var(--text-3)', textTransform:'capitalize' }}>({d.stimme})</span>}
                  </div>
                  {kannBearbeiten && (
                    <button onClick={() => dateiLoeschen(d.id, d.bucket_pfad)} style={{ ...s.iconBtn, color:'var(--danger)' }}>🗑</button>
                  )}
                </div>
                <PdfViewer datei={d} />
              </div>
            ))}
          </div>
        )}

        {/* AUDIO */}
        {tab === 'audio' && (
          <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
            {audioDateien.map(d => (
              <div key={d.id} style={{ position:'relative' }}>
                <AudioPlayer datei={d} />
                {kannBearbeiten && (
                  <button onClick={() => dateiLoeschen(d.id, d.bucket_pfad)}
                    style={{ position:'absolute', top:12, right:12, background:'none', border:'none', fontSize:16, cursor:'pointer', color:'var(--danger)' }}>🗑</button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* YOUTUBE */}
        {tab === 'youtube' && stueck.youtube_url && (
          <div>
            <iframe
              width="100%" height={window.innerWidth < 768 ? 220 : 420}
              src={`https://www.youtube.com/embed/${youtubeId(stueck.youtube_url)}`}
              title="YouTube" frameBorder="0"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
              allowFullScreen style={{ borderRadius:'var(--radius)' }}
            />
          </div>
        )}

        {/* DATEIEN */}
        {tab === 'dateien' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {dokumente.length === 0 ? (
              <div style={s.leer}>Keine allgemeinen Dateien.</div>
            ) : (
              dokumente.map(d => (
                <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)' }}>
                  <span style={{ fontSize:20 }}>📋</span>
                  <span style={{ flex:1, fontSize:14, fontWeight:600, color:'var(--text)' }}>{d.name}</span>
                  <DownloadButton datei={d} />
                  {kannBearbeiten && (
                    <button onClick={() => dateiLoeschen(d.id, d.bucket_pfad)} style={{ ...s.iconBtn, color:'var(--danger)' }}>🗑</button>
                  )}
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {modal === 'upload' && (
        <DateiUploadModal stueckId={stueckId} onClose={() => setModal(null)} onErfolg={ladeData} />
      )}

      {/* Vollbild Modus - Mobile optimiert */}
      {vollbild && stueck?.liedtext && (
        <div style={{ position:'fixed', inset:0, background:'#111', zIndex:2000, display:'flex', flexDirection:'column' }}>

          {/* Header */}
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'rgba(255,255,255,0.06)', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stueck.titel}</div>
              {stueck.komponist && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>{stueck.komponist}</div>}
            </div>
            <button onClick={() => setVollbild(false)}
              style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', padding:'8px 16px', borderRadius:8, flexShrink:0 }}>
              ✕
            </button>
          </div>

          {/* Text */}
          <div style={{ flex:1, overflowY:'auto', padding:'32px 24px', WebkitOverflowScrolling:'touch' }}>
            <pre style={{
              fontFamily:'Georgia, serif',
              fontSize: textGroesse,
              lineHeight: 1.9,
              color: '#fff',
              whiteSpace: 'pre-wrap',
              margin: '0 auto',
              maxWidth: 700,
              transition: 'font-size 0.15s',
            }}>
              {stueck.liedtext}
            </pre>
          </div>

          {/* Footer - Zoom Controls */}
          <div style={{ padding:'12px 16px', background:'rgba(255,255,255,0.06)', borderTop:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}>
            {/* Mobile: große Buttons */}
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button onClick={() => setTextGroesse(g => Math.max(10, g - 2))}
                style={{ width:48, height:48, borderRadius:10, background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', fontSize:20, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
                A−
              </button>
              <input type="range" min={10} max={80} value={textGroesse}
                onChange={e => setTextGroesse(Number(e.target.value))}
                style={{ flex:1, accentColor:'white', height:6, cursor:'pointer' }} />
              <button onClick={() => setTextGroesse(g => Math.min(80, g + 2))}
                style={{ width:48, height:48, borderRadius:10, background:'rgba(255,255,255,0.1)', border:'none, color:#fff', fontSize:20, cursor:'pointer', fontFamily:'inherit', flexShrink:0, color:'#fff' }}>
                A+
              </button>
              <span style={{ color:'rgba(255,255,255,0.4)', fontSize:12, minWidth:32, textAlign:'center' }}>{textGroesse}px</span>
            </div>
          </div>

          <style>{`
            @media (min-width: 769px) {
              .vollbild-text { padding: 48px 10vw !important; }
            }
          `}</style>
        </div>
      )}
    </div>
  )
}

const svBtn = {
  background:'rgba(255,255,255,0.1)', border:'none', color:'#fff',
  fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit',
  padding:'6px 12px', borderRadius:8,
}

// ─── Akkord Datei Anzeige ─────────────────────────────────────
function AkkordDateiAnzeige({ datei, kannLoeschen, onLoeschen }) {
  const [text, setText] = useState(null)
  useEffect(() => {
    supabase.storage.from('stueck-dateien').download(datei.bucket_pfad)
      .then(({ data }) => data?.text().then(setText))
  }, [datei.bucket_pfad])
  return (
    <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'16px 20px', border:'1px solid var(--border)', position:'relative' }}>
      {text ? <ChordPro text={text} /> : <span style={{ color:'var(--text-3)' }}>Laden …</span>}
      {kannLoeschen && (
        <button onClick={onLoeschen} style={{ position:'absolute', top:10, right:10, background:'none', border:'none', fontSize:16, cursor:'pointer', color:'var(--danger)' }}>🗑</button>
      )}
    </div>
  )
}

// ─── Download Button ──────────────────────────────────────────
function DownloadButton({ datei }) {
  const [laden, setLaden] = useState(false)
  async function herunterladen() {
    setLaden(true)
    const { data } = await supabase.storage.from('stueck-dateien').download(datei.bucket_pfad)
    if (data) {
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url; a.download = datei.name; a.click()
      URL.revokeObjectURL(url)
    }
    setLaden(false)
  }
  return (
    <button onClick={herunterladen} disabled={laden}
      style={{ padding:'5px 12px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:12, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
      {laden ? '…' : '⬇'}
    </button>
  )
}

// ─── Liedtext / Akkorde Bearbeiten ────────────────────────────
function LiedtextBearbeiten({ stueck, onSpeichern, onAbbrechen }) {
  const [text,   setText]   = useState(stueck.liedtext ?? '')
  const [akkorde, setAkkorde] = useState(stueck.notizen ?? '')
  const [tab, setTab] = useState('text')

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', gap:4, borderBottom:'2px solid var(--border)', marginBottom:4 }}>
        {[['text','📝 Liedtext'],['akkorde','🎸 Akkorde (ChordPro)']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding:'8px 14px', background:'none', border:'none', fontSize:13, cursor:'pointer', fontFamily:'inherit', color: tab===k ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===k ? 700 : 400, borderBottom:`2px solid ${tab===k ? 'var(--primary)' : 'transparent'}`, marginBottom:-2 }}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'text' ? (
        <textarea value={text} onChange={e => setText(e.target.value)}
          style={{ ...s.input, minHeight:300, fontFamily:'Georgia, serif', fontSize:15, lineHeight:1.9, resize:'vertical' }}
          placeholder="Liedtext hier eingeben …" />
      ) : (
        <>
          <textarea value={akkorde} onChange={e => setAkkorde(e.target.value)}
            style={{ ...s.input, minHeight:200, fontFamily:'monospace', fontSize:14, lineHeight:2, resize:'vertical' }}
            placeholder="[Am]Hallo [C]Welt" />
          <div style={{ fontSize:12, color:'var(--text-3)' }}>Format: [Akkord] vor dem Wort, z.B. [Am]Text [G]weiter</div>
          {akkorde && (
            <div>
              <div style={s.sectionLabel}>Vorschau</div>
              <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'12px 16px', marginTop:6 }}>
                <ChordPro text={akkorde} />
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onAbbrechen} style={s.btnSek}>Abbrechen</button>
        <button onClick={() => onSpeichern(text, akkorde)} style={s.btnPri}>💾 Speichern</button>
      </div>
    </div>
  )
}

const s = {
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
  modal:       { background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 },
  modalTitel:  { margin:0, fontSize:18, fontWeight:800, color:'var(--text)' },
  iconBtn:     { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 },
  label:       { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  sectionLabel:{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 },
  input:       { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%' },
  btnPri:      { padding:'10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek:      { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  leer:        { padding:'32px', textAlign:'center', color:'var(--text-3)', fontSize:13, background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px dashed var(--border)' },
}
