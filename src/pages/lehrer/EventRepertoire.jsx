import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = { konzert: '🎵', vorspiel: '🎤', pruefung: '📝', veranstaltung: '🎭', vorstandssitzung: '🏛', sonstiges: '📅' }

// ─── Neues Stück anlegen ──────────────────────────────────────
function NeuesStueckModal({ eventId, onClose, onErfolg }) {
  const { profil } = useApp()
  const [form, setForm] = useState({ titel:'', komponist:'', tonart:'', tempo:'', youtube_url:'', interpret:'' })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  async function speichern() {
    if (!form.titel) { setFehler('Titel ist erforderlich.'); return }
    setLaden(true)
    const { data: stueck, error } = await supabase.from('stuecke').insert({
      titel: form.titel, komponist: form.komponist, tonart: form.tonart,
      tempo: form.tempo, youtube_url: form.youtube_url, erstellt_von: profil.id,
    }).select().single()
    if (error) { setFehler(error.message); setLaden(false); return }

    const maxReihenfolge = 0
    await supabase.from('event_stuecke').insert({
      event_id: eventId, stueck_id: stueck.id,
      interpret: form.interpret || null, reihenfolge: maxReihenfolge,
    })
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
            { key:'interpret',   label:'Interpret',     placeholder:'z.B. Schulchor, Klasse 5a' },
          ].map(f => (
            <div key={f.key} style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>{f.label}</label>
              <input style={s.input} placeholder={f.placeholder} value={form[f.key]}
                onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))} />
            </div>
          ))}
          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
            <button onClick={speichern} disabled={laden} style={s.btnPri}>
              {laden ? 'Speichere …' : '+ Stück erstellen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Bestehendes Stück verknüpfen ─────────────────────────────
function VorhandenesModal({ eventId, bereitsVerknuepft, onClose, onErfolg }) {
  const [alle,    setAlle]    = useState([])
  const [suche,   setSuche]   = useState('')
  const [gewählt, setGewählt] = useState('')
  const [interpret, setInterpret] = useState('')
  const [laden,   setLaden]   = useState(false)
  const [fehler,  setFehler]  = useState('')

  useEffect(() => {
    supabase.from('stuecke').select('id, titel, komponist').order('titel')
      .then(({ data }) => setAlle(data ?? []))
  }, [])

  const verfuegbar = alle.filter(st =>
    !bereitsVerknuepft.includes(st.id) &&
    (st.titel?.toLowerCase().includes(suche.toLowerCase()) ||
     st.komponist?.toLowerCase().includes(suche.toLowerCase()))
  )

  async function verknuepfen() {
    if (!gewählt) return
    setLaden(true)
    const { error } = await supabase.from('event_stuecke').insert({
      event_id: eventId, stueck_id: gewählt,
      interpret: interpret || null, reihenfolge: 0,
    })
    if (error) setFehler(error.message)
    else { onErfolg(); onClose() }
    setLaden(false)
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitel}>🔗 Stück verknüpfen</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <input style={s.input} placeholder="🔍 Stück oder Komponist suchen…" value={suche}
            onChange={e => { setSuche(e.target.value); setGewählt('') }} />
          <div style={{ maxHeight:240, overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
            {verfuegbar.length === 0
              ? <div style={{ color:'var(--text-3)', fontSize:13, textAlign:'center', padding:16 }}>Keine Stücke gefunden.</div>
              : verfuegbar.map(st => (
                <label key={st.id} style={{ display:'flex', gap:10, alignItems:'center', padding:'10px 12px', borderRadius:'var(--radius)', background: gewählt===st.id ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--bg-2)', border:`1.5px solid ${gewählt===st.id ? 'var(--primary)' : 'var(--border)'}`, cursor:'pointer' }}>
                  <input type="radio" name="stueck" value={st.id} checked={gewählt===st.id}
                    onChange={() => setGewählt(st.id)} style={{ accentColor:'var(--primary)' }} />
                  <div>
                    <div style={{ fontWeight:600, fontSize:14 }}>{st.titel}</div>
                    {st.komponist && <div style={{ fontSize:12, color:'var(--text-3)' }}>{st.komponist}</div>}
                  </div>
                </label>
              ))
            }
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Interpret (optional)</label>
            <input style={s.input} placeholder="z.B. Schulchor, Klasse 5a" value={interpret}
              onChange={e => setInterpret(e.target.value)} />
          </div>
          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
            <button onClick={verknuepfen} disabled={!gewählt || laden} style={s.btnPri}>
              {laden ? 'Verknüpfe …' : '🔗 Verknüpfen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function EventRepertoire() {
  const { id: eventId } = useParams()
  const navigate = useNavigate()
  const { rolle } = useApp()
  const [event,   setEvent]   = useState(null)
  const [stuecke, setStuecke] = useState([])
  const [laden,   setLaden]   = useState(true)
  const [suche,   setSuche]   = useState('')
  const [modal,   setModal]   = useState(null)
  const [editInterpret, setEditInterpret] = useState(null) // stueck_id being edited

  const kannBearbeiten = ['admin','superadmin','lehrer'].includes(rolle)
  const basis = rolle === 'admin' || rolle === 'superadmin' ? '/admin' : rolle === 'schueler' ? '/schueler' : '/lehrer'
  const repertoirePfad = `${basis}/events/${eventId}/repertoire`

  useEffect(() => { ladeData() }, [eventId])

  async function ladeData() {
    const [ev, es] = await Promise.all([
      supabase.from('events').select('*').eq('id', eventId).single(),
      supabase.from('event_stuecke')
        .select('*, stuecke(*, stueck_dateien(typ))')
        .eq('event_id', eventId)
        .order('reihenfolge'),
    ])
    setEvent(ev.data)
    setStuecke(es.data ?? [])
    setLaden(false)
  }

  async function stueckEntfernen(stueckId) {
    if (!confirm('Stück aus dieser Veranstaltung entfernen?')) return
    await supabase.from('event_stuecke').delete().eq('event_id', eventId).eq('stueck_id', stueckId)
    setStuecke(prev => prev.filter(s => s.stueck_id !== stueckId))
  }

  async function verschieben(idx, delta) {
    const neuArr = [...stuecke]
    const zielIdx = idx + delta
    if (zielIdx < 0 || zielIdx >= neuArr.length) return
    ;[neuArr[idx], neuArr[zielIdx]] = [neuArr[zielIdx], neuArr[idx]]
    setStuecke(neuArr)
    await Promise.all(neuArr.map((es, i) =>
      supabase.from('event_stuecke').update({ reihenfolge: i }).eq('event_id', eventId).eq('stueck_id', es.stueck_id)
    ))
  }

  async function interpretSpeichern(stueckId, interpret) {
    await supabase.from('event_stuecke').update({ interpret }).eq('event_id', eventId).eq('stueck_id', stueckId)
    setStuecke(prev => prev.map(s => s.stueck_id === stueckId ? { ...s, interpret } : s))
    setEditInterpret(null)
  }

  const gefiltert = stuecke.filter(es =>
    es.stuecke?.titel?.toLowerCase().includes(suche.toLowerCase()) ||
    es.stuecke?.komponist?.toLowerCase().includes(suche.toLowerCase()) ||
    es.interpret?.toLowerCase().includes(suche.toLowerCase())
  )

  const bereitsVerknuepft = stuecke.map(es => es.stueck_id)

  if (laden) return <div style={{ padding:40, color:'var(--text-3)' }}>Laden …</div>

  return (
    <div>
      <button onClick={() => navigate(`${basis}/events`)}
        style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 16px' }}>
        ← Veranstaltungen
      </button>

      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <div style={{ fontSize:12, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>
            {TYP_ICON[event?.typ]} {event?.typ} · {event?.beginn ? new Date(event.beginn).toLocaleDateString('de-DE') : ''}
          </div>
          <h1 style={s.h1}>🎼 {event?.titel}</h1>
          <p style={s.sub}>{stuecke.length} Stück{stuecke.length !== 1 ? 'e' : ''} im Programm</p>
        </div>
        {kannBearbeiten && (
          <div style={{ display:'flex', gap:8 }}>
            <button onClick={() => setModal('vorhanden')} style={s.btnSek}>🔗 Verknüpfen</button>
            <button onClick={() => setModal('neu')} style={s.btnPri}>+ Neues Stück</button>
          </div>
        )}
      </div>

      <input placeholder="🔍 Stück, Komponist oder Interpret suchen…" value={suche}
        onChange={e => setSuche(e.target.value)} style={{ ...s.input, maxWidth:380, marginBottom:20 }} />

      {gefiltert.length === 0 ? (
        <div style={s.leer}>
          {kannBearbeiten ? 'Noch kein Programm. Füge Stücke hinzu.' : 'Noch kein Programm für diese Veranstaltung.'}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {gefiltert.map((es, i) => {
            const st = es.stuecke
            const typen = [...new Set((st?.stueck_dateien ?? []).map(d => d.typ))]
            return (
              <div key={es.stueck_id}
                onClick={() => navigate(`${repertoirePfad}/${es.stueck_id}`)}
                style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', overflow:'hidden', cursor:'pointer', transition:'box-shadow 0.15s' }}>
                <div style={{ height:3, background:'var(--accent)' }} />
                <div style={{ padding:'14px 18px', display:'flex', gap:14, alignItems:'flex-start' }}>
                  {/* Reihenfolge + Sortier-Buttons */}
                  <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:2, flexShrink:0, marginTop:2 }}>
                    {kannBearbeiten && !suche ? (
                      <>
                        <button onClick={e => { e.stopPropagation(); verschieben(i, -1) }} disabled={i === 0}
                          style={{ background:'none', border:'none', cursor: i === 0 ? 'default' : 'pointer', color: i === 0 ? 'var(--border)' : 'var(--text-3)', fontSize:12, padding:'1px 4px', lineHeight:1, fontFamily:'inherit' }}>▲</button>
                        <div style={{ minWidth:24, height:24, borderRadius:'50%', background:'var(--bg-2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12, fontWeight:700, color:'var(--text-3)' }}>
                          {i + 1}
                        </div>
                        <button onClick={e => { e.stopPropagation(); verschieben(i, 1) }} disabled={i === gefiltert.length - 1}
                          style={{ background:'none', border:'none', cursor: i === gefiltert.length - 1 ? 'default' : 'pointer', color: i === gefiltert.length - 1 ? 'var(--border)' : 'var(--text-3)', fontSize:12, padding:'1px 4px', lineHeight:1, fontFamily:'inherit' }}>▼</button>
                      </>
                    ) : (
                      <div style={{ minWidth:28, height:28, borderRadius:'50%', background:'var(--bg-2)', border:'1px solid var(--border)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:13, fontWeight:700, color:'var(--text-3)' }}>
                        {i + 1}
                      </div>
                    )}
                  </div>

                  <div style={{ flex:1 }}>
                    <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', gap:8 }}>
                      <div>
                        <div style={{ fontWeight:800, fontSize:15, color:'var(--text)', marginBottom:2 }}>
                          {st?.titel}
                        </div>
                        {st?.komponist && <div style={{ fontSize:12, color:'var(--text-3)' }}>{st.komponist}</div>}
                      </div>
                      {kannBearbeiten && (
                        <button onClick={e => { e.stopPropagation(); stueckEntfernen(es.stueck_id) }}
                          style={{ ...s.iconBtn, color:'var(--danger)' }} title="Entfernen">🗑</button>
                      )}
                    </div>

                    {/* Meta */}
                    <div style={{ display:'flex', gap:8, flexWrap:'wrap', margin:'8px 0' }}>
                      {st?.tonart && <span style={s.chip}>🎵 {st.tonart}</span>}
                      {st?.tempo  && <span style={s.chip}>♩ {st.tempo}</span>}
                      {st?.liedtext       && <span style={s.chip}>📝 Text</span>}
                      {typen.includes('noten') && <span style={s.chip}>📄 Noten</span>}
                      {typen.includes('audio') && <span style={s.chip}>🎵 Audio</span>}
                      {st?.youtube_url    && <span style={s.chip}>▶️ YouTube</span>}
                    </div>

                    {/* Interpret */}
                    {editInterpret === es.stueck_id ? (
                      <div onClick={e => e.stopPropagation()}>
                        <InterpretEditor
                          initial={es.interpret ?? ''}
                          onSave={val => interpretSpeichern(es.stueck_id, val)}
                          onCancel={() => setEditInterpret(null)}
                        />
                      </div>
                    ) : (
                      <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                        <span style={{ fontSize:13, color: es.interpret ? 'var(--text-2)' : 'var(--text-3)' }}>
                          🎤 {es.interpret || (kannBearbeiten ? 'Kein Interpret angegeben' : '–')}
                        </span>
                        {kannBearbeiten && (
                          <button onClick={e => { e.stopPropagation(); setEditInterpret(es.stueck_id) }}
                            style={{ ...s.iconBtn, fontSize:12, color:'var(--text-3)' }}>✏️</button>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {modal === 'neu'       && <NeuesStueckModal  eventId={eventId} onClose={() => setModal(null)} onErfolg={ladeData} />}
      {modal === 'vorhanden' && <VorhandenesModal  eventId={eventId} bereitsVerknuepft={bereitsVerknuepft} onClose={() => setModal(null)} onErfolg={ladeData} />}
    </div>
  )
}

function InterpretEditor({ initial, onSave, onCancel }) {
  const [wert, setWert] = useState(initial)
  return (
    <div style={{ display:'flex', gap:8, alignItems:'center' }}>
      <input value={wert} onChange={e => setWert(e.target.value)} autoFocus
        placeholder="z.B. Schulchor, Klasse 5a"
        style={{ flex:1, padding:'6px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--primary)', fontSize:13, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)' }}
        onKeyDown={e => { if (e.key === 'Enter') onSave(wert); if (e.key === 'Escape') onCancel() }}
      />
      <button onClick={() => onSave(wert)} style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>✓</button>
      <button onClick={onCancel} style={{ padding:'6px 10px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>✕</button>
    </div>
  )
}

const s = {
  h1:          { margin:'0 0 4px', fontSize:24, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  sub:         { margin:0, color:'var(--text-3)', fontSize:14 },
  label:       { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  input:       { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%', boxSizing:'border-box' },
  btnPri:      { padding:'10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnSek:      { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  iconBtn:     { background:'none', border:'none', fontSize:16, cursor:'pointer', color:'var(--text-3)', padding:4 },
  leer:        { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px dashed var(--border)' },
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
  modal:       { background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 },
  modalTitel:  { margin:0, fontSize:18, fontWeight:800, color:'var(--text)' },
  chip:        { fontSize:11, padding:'2px 8px', borderRadius:99, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-3)' },
}
