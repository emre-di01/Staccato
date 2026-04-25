import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const STUNDEN_VON = 7
const STUNDEN_BIS = 21
const SLOT_HOEHE  = 56

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']

function getMontag(datum) {
  const d = new Date(datum)
  const tag = d.getDay()
  const diff = tag === 0 ? -6 : 1 - tag
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDatum(datum) {
  return datum.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}

function istHeute(datum) {
  return datum.toDateString() === new Date().toDateString()
}

// ─── Modal ────────────────────────────────────────────────────
function Modal({ titel, onClose, children }) {
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>{titel}</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

// ─── Raum anlegen / bearbeiten ────────────────────────────────
function RaumModal({ raum, onClose, onErfolg }) {
  const istNeu = !raum?.id
  const [form, setForm] = useState({
    name:        raum?.name        ?? '',
    kapazitaet:  raum?.kapazitaet  ?? 1,
    ausstattung: raum?.ausstattung?.join(', ') ?? '',
    farbe:       raum?.farbe       ?? '#3b82f6',
    notizen:     raum?.notizen     ?? '',
    aktiv:       raum?.aktiv       ?? true,
  })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  const FARBEN = ['#3b82f6','#8b5cf6','#ec4899','#10b981','#f59e0b','#ef4444','#6366f1','#14b8a6']

  async function speichern() {
    if (!form.name) { setFehler('Name ist erforderlich.'); return }
    setLaden(true)
    const payload = {
      ...form,
      ausstattung: form.ausstattung ? form.ausstattung.split(',').map(s => s.trim()).filter(Boolean) : [],
      kapazitaet: parseInt(form.kapazitaet) || 1,
    }
    const { error } = istNeu
      ? await supabase.from('raeume').insert(payload)
      : await supabase.from('raeume').update(payload).eq('id', raum.id)
    if (error) setFehler(error.message)
    else { onErfolg(); onClose() }
    setLaden(false)
  }

  return (
    <Modal titel={istNeu ? '+ Neuer Raum' : 'Raum bearbeiten'} onClose={onClose}>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6, gridColumn:'span 2' }}>
            <label style={s.label}>Raumname *</label>
            <input style={s.input} placeholder="z.B. Raum A, Flügel-Saal" value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Kapazität (Personen)</label>
            <input type="number" style={s.input} min={1} value={form.kapazitaet}
              onChange={e => setForm(f => ({ ...f, kapazitaet: e.target.value }))} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Farbe</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {FARBEN.map(f => (
                <button key={f} onClick={() => setForm(p => ({ ...p, farbe: f }))}
                  style={{ width:28, height:28, borderRadius:'50%', background:f, border:`3px solid ${form.farbe===f ? 'var(--text)' : 'transparent'}`, cursor:'pointer' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>Ausstattung (kommagetrennt)</label>
          <input style={s.input} placeholder="z.B. Flügel, Whiteboard, PA-Anlage" value={form.ausstattung}
            onChange={e => setForm(f => ({ ...f, ausstattung: e.target.value }))} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>Notizen</label>
          <textarea style={{ ...s.input, minHeight:60, resize:'vertical' }} value={form.notizen}
            onChange={e => setForm(f => ({ ...f, notizen: e.target.value }))} />
        </div>
        {!istNeu && (
          <div style={{ display:'flex', alignItems:'center', gap:8 }}>
            <input type="checkbox" id="aktiv" checked={form.aktiv} onChange={e => setForm(f => ({ ...f, aktiv: e.target.checked }))} />
            <label htmlFor="aktiv" style={{ fontSize:14, color:'var(--text-2)' }}>Raum aktiv</label>
          </div>
        )}
        {fehler && <p style={s.fehler}>{fehler}</p>}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
          <button onClick={speichern} disabled={laden} style={s.btnPri}>
            {laden ? 'Speichere …' : istNeu ? '+ Raum erstellen' : '💾 Speichern'}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Belegungsplan ────────────────────────────────────────────
function Belegungsplan({ raum, woche }) {
  const [stunden, setStunden] = useState([])
  const [laden,   setLaden]   = useState(true)
  const [detail,  setDetail]  = useState(null)

  const wocheTage = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(woche)
    d.setDate(d.getDate() + i)
    return d
  })

  useEffect(() => {
    async function ladeStunden() {
      setLaden(true)
      const von = new Date(woche); von.setHours(0,0,0,0)
      const bis = new Date(woche); bis.setDate(bis.getDate()+7); bis.setHours(23,59,59,999)

      const { data } = await supabase
        .from('stunden')
        .select('*, unterricht(id, name, typ, farbe)')
        .eq('raum_id', raum.id)
        .gte('beginn', von.toISOString())
        .lte('beginn', bis.toISOString())
        .neq('status', 'abgesagt')
        .order('beginn')

      setStunden(data ?? [])
      setLaden(false)
    }
    ladeStunden()
  }, [raum.id, woche])

  const stundenProTag = wocheTage.map(tag =>
    stunden.filter(st => new Date(st.beginn).toDateString() === tag.toDateString())
  )

  const zeitSlots = Array.from({ length: STUNDEN_BIS - STUNDEN_VON }, (_, i) => STUNDEN_VON + i)
  const gesamtHoehe = (STUNDEN_BIS - STUNDEN_VON) * SLOT_HOEHE

  if (laden) return <div style={{ padding:20, color:'var(--text-3)', fontSize:13 }}>Lade Belegung …</div>

  return (
    <div style={{ borderTop:'1px solid var(--border)', overflow:'auto' }}>
      {/* Wochentage Header */}
      <div style={{ display:'grid', gridTemplateColumns:`44px repeat(7, minmax(80px, 1fr))`, borderBottom:'1px solid var(--border)', position:'sticky', top:0, background:'var(--surface)', zIndex:1 }}>
        <div style={{ borderRight:'1px solid var(--border)' }} />
        {wocheTage.map((tag, i) => (
          <div key={i} style={{ padding:'8px 4px', textAlign:'center', borderRight: i<6 ? '1px solid var(--border)' : 'none', background: istHeute(tag) ? 'var(--bg-2)' : 'transparent' }}>
            <div style={{ fontSize:10, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase' }}>{WOCHENTAGE[i]}</div>
            <div style={{ fontSize:15, fontWeight:800, color: istHeute(tag) ? 'var(--accent)' : 'var(--text)' }}>{tag.getDate()}</div>
          </div>
        ))}
      </div>

      {/* Zeit-Grid */}
      <div style={{ display:'grid', gridTemplateColumns:`44px repeat(7, minmax(80px, 1fr))`, height: gesamtHoehe }}>
        {/* Zeitachse */}
        <div style={{ borderRight:'1px solid var(--border)', position:'relative' }}>
          {zeitSlots.map(h => (
            <div key={h} style={{ position:'absolute', top:(h-STUNDEN_VON)*SLOT_HOEHE - 8, left:0, right:0, textAlign:'right', paddingRight:4, fontSize:9, color:'var(--text-3)', fontWeight:600 }}>
              {h}:00
            </div>
          ))}
        </div>

        {/* Tages-Spalten */}
        {wocheTage.map((tag, i) => (
          <div key={i} style={{ borderRight: i<6 ? '1px solid var(--border)' : 'none', position:'relative', height: gesamtHoehe, background: istHeute(tag) ? 'rgba(99,102,241,0.02)' : 'transparent' }}>
            {zeitSlots.map(h => (
              <div key={h} style={{ position:'absolute', top:(h-STUNDEN_VON)*SLOT_HOEHE, left:0, right:0, borderTop:'1px solid var(--border)', opacity:0.3 }} />
            ))}
            {stundenProTag[i].map(st => {
              const beginn = new Date(st.beginn)
              const ende   = st.ende ? new Date(st.ende) : new Date(beginn.getTime() + 60*60*1000)
              const startMin = (beginn.getHours() - STUNDEN_VON) * 60 + beginn.getMinutes()
              const dauerMin = (ende - beginn) / 60000
              const top    = (startMin / 60) * SLOT_HOEHE
              const hoehe  = Math.max((dauerMin / 60) * SLOT_HOEHE - 2, 18)
              const farbe  = st.unterricht?.farbe ?? '#3b82f6'
              return (
                <div key={st.id} onClick={() => setDetail(st)}
                  style={{ position:'absolute', top:top+1, left:2, right:2, height:hoehe, background:farbe, borderRadius:5, padding:'3px 5px', cursor:'pointer', overflow:'hidden', boxShadow:'0 1px 3px rgba(0,0,0,0.2)' }}>
                  <div style={{ fontSize:10, fontWeight:700, color:'#fff', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                    {st.unterricht?.name}
                  </div>
                  {hoehe > 28 && (
                    <div style={{ fontSize:9, color:'rgba(255,255,255,0.8)', marginTop:1 }}>
                      {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}
                    </div>
                  )}
                </div>
              )
            })}
            {/* Jetzt-Linie */}
            {istHeute(tag) && (() => {
              const jetzt = new Date()
              const min = (jetzt.getHours() - STUNDEN_VON) * 60 + jetzt.getMinutes()
              if (min < 0 || min > (STUNDEN_BIS - STUNDEN_VON) * 60) return null
              return <div style={{ position:'absolute', top:(min/60)*SLOT_HOEHE, left:0, right:0, height:2, background:'var(--danger)', zIndex:5 }} />
            })()}
          </div>
        ))}
      </div>

      {/* Detail Modal */}
      {detail && (
        <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1001, padding:16 }}
          onClick={() => setDetail(null)}>
          <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'24px', maxWidth:360, width:'100%', boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}>
            <div style={{ display:'flex', justifyContent:'space-between', marginBottom:16 }}>
              <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'var(--text)' }}>{detail.unterricht?.name}</h3>
              <button onClick={() => setDetail(null)} style={s.iconBtn}>✕</button>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:13, color:'var(--text-2)' }}>
              <div>📅 {new Date(detail.beginn).toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })}</div>
              <div>🕐 {new Date(detail.beginn).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}
                {detail.ende && ` – ${new Date(detail.ende).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}`} Uhr
              </div>
              <div>🏫 {raum.name}</div>
              {detail.notizen && <div>📝 {detail.notizen}</div>}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function Raumverwaltung() {
  const { T } = useApp()
  const [raeume,       setRaeume]       = useState([])
  const [laden,        setLaden]        = useState(true)
  const [modal,        setModal]        = useState(null)
  const [aktiverRaum,  setAktiverRaum]  = useState(null)
  const [woche,        setWoche]        = useState(() => getMontag(new Date()))
  const [ansicht,      setAnsicht]      = useState('liste') // 'liste' | 'belegung'

  const ladeRaeume = useCallback(async () => {
    setLaden(true)
    const { data } = await supabase.from('raeume').select('*').order('name')
    setRaeume(data ?? [])
    if (data?.length > 0 && !aktiverRaum) setAktiverRaum(data[0])
    setLaden(false)
  }, [])

  useEffect(() => { ladeRaeume() }, [ladeRaeume])

  async function loeschen(raum) {
    if (!confirm(`„${raum.name}" wirklich löschen?`)) return
    await supabase.from('raeume').delete().eq('id', raum.id)
    ladeRaeume()
  }

  function wocheNavigieren(delta) {
    const neu = new Date(woche)
    neu.setDate(neu.getDate() + delta * 7)
    setWoche(getMontag(neu))
  }

  const wocheTage = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(woche)
    d.setDate(d.getDate() + i)
    return d
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={s.h1}>🏫 Raumverwaltung</h1>
          <p style={s.sub}>{raeume.length} Räume · {raeume.filter(r=>r.aktiv).length} aktiv</p>
        </div>
        <button onClick={() => setModal({ typ:'raum' })} style={s.btnPri}>+ Neuer Raum</button>
      </div>

      {/* Ansicht Toggle */}
      <div style={{ display:'flex', gap:6, marginBottom:20 }}>
        <button onClick={() => setAnsicht('liste')} style={{ ...s.filterBtn, ...(ansicht==='liste' ? s.filterBtnAktiv : {}) }}>
          ☰ Raumliste
        </button>
        <button onClick={() => setAnsicht('belegung')} style={{ ...s.filterBtn, ...(ansicht==='belegung' ? s.filterBtnAktiv : {}) }}>
          📅 Belegungsplan
        </button>
      </div>

      {laden ? <div style={s.leer}>Lade Räume …</div> : (

        ansicht === 'liste' ? (
          // ── RAUMLISTE ────────────────────────────────────────
          <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16 }}>
            {raeume.map(raum => (
              <div key={raum.id} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow)' }}>
                <div style={{ height:5, background: raum.farbe ?? '#3b82f6' }} />
                <div style={{ padding:'16px 20px' }}>
                  <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:12 }}>
                    <div>
                      <div style={{ fontSize:17, fontWeight:800, color:'var(--text)', marginBottom:4 }}>{raum.name}</div>
                      <div style={{ fontSize:13, color:'var(--text-3)' }}>
                        👥 max. {raum.kapazitaet} {raum.kapazitaet === 1 ? 'Person' : 'Personen'}
                      </div>
                    </div>
                    <span style={{ fontSize:11, fontWeight:700, color: raum.aktiv ? 'var(--success)' : 'var(--danger)' }}>
                      {raum.aktiv ? '● Aktiv' : '○ Inaktiv'}
                    </span>
                  </div>

                  {/* Ausstattung */}
                  {raum.ausstattung?.length > 0 && (
                    <div style={{ display:'flex', flexWrap:'wrap', gap:5, marginBottom:12 }}>
                      {raum.ausstattung.map((a, i) => (
                        <span key={i} style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-3)' }}>
                          {a}
                        </span>
                      ))}
                    </div>
                  )}

                  {raum.notizen && (
                    <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:12, fontStyle:'italic' }}>{raum.notizen}</div>
                  )}

                  <div style={{ display:'flex', gap:6 }}>
                    <button onClick={() => { setAktiverRaum(raum); setAnsicht('belegung') }}
                      style={{ ...s.btnKlein, background:'var(--primary)', color:'var(--primary-fg)', fontWeight:700 }}>
                      📅 Belegung
                    </button>
                    <button onClick={() => setModal({ typ:'raum', raum })} style={s.btnKlein}>✏️</button>
                    <button onClick={() => loeschen(raum)} style={{ ...s.btnKlein, color:'var(--danger)' }}>🗑</button>
                  </div>
                </div>
              </div>
            ))}
            {raeume.length === 0 && (
              <div style={{ ...s.leer, gridColumn:'1/-1' }}>Noch keine Räume. Klick auf "+ Neuer Raum".</div>
            )}
          </div>

        ) : (
          // ── BELEGUNGSPLAN ────────────────────────────────────
          <div>
            {/* Raum-Auswahl */}
            <div style={{ display:'flex', gap:8, marginBottom:16, flexWrap:'wrap', alignItems:'center' }}>
              <span style={{ fontSize:13, color:'var(--text-3)', fontWeight:600 }}>Raum:</span>
              {raeume.filter(r => r.aktiv).map(raum => (
                <button key={raum.id} onClick={() => setAktiverRaum(raum)}
                  style={{ padding:'6px 14px', borderRadius:99, border:`2px solid ${aktiverRaum?.id === raum.id ? raum.farbe : 'var(--border)'}`, background: aktiverRaum?.id === raum.id ? raum.farbe : 'var(--surface)', color: aktiverRaum?.id === raum.id ? '#fff' : 'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s' }}>
                  {raum.name}
                </button>
              ))}
            </div>

            {/* Wochen-Navigation */}
            <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:16 }}>
              <button onClick={() => wocheNavigieren(-1)} style={s.navBtn}>‹</button>
              <span style={{ flex:1, textAlign:'center', fontSize:15, fontWeight:700, color:'var(--text)' }}>
                {formatDatum(wocheTage[0])} – {formatDatum(wocheTage[6])}
              </span>
              <button onClick={() => wocheNavigieren(1)} style={s.navBtn}>›</button>
              <button onClick={() => setWoche(getMontag(new Date()))}
                style={{ ...s.navBtn, fontSize:12, padding:'6px 12px', width:'auto' }}>Heute</button>
            </div>

            {aktiverRaum ? (
              <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow)' }}>
                <div style={{ padding:'12px 20px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:10 }}>
                  <div style={{ width:14, height:14, borderRadius:'50%', background: aktiverRaum.farbe }} />
                  <span style={{ fontWeight:800, fontSize:15, color:'var(--text)' }}>{aktiverRaum.name}</span>
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>· max. {aktiverRaum.kapazitaet} Personen</span>
                  {aktiverRaum.ausstattung?.length > 0 && (
                    <span style={{ fontSize:12, color:'var(--text-3)' }}>· {aktiverRaum.ausstattung.join(', ')}</span>
                  )}
                </div>
                <Belegungsplan raum={aktiverRaum} woche={woche} />
              </div>
            ) : (
              <div style={s.leer}>Bitte einen Raum auswählen.</div>
            )}
          </div>
        )
      )}

      {modal?.typ === 'raum' && (
        <RaumModal raum={modal.raum} onClose={() => setModal(null)} onErfolg={ladeRaeume} />
      )}
    </div>
  )
}

const s = {
  h1:            { margin:'0 0 4px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  sub:           { margin:0, color:'var(--text-3)', fontSize:14 },
  label:         { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  input:         { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%' },
  btnPri:        { padding:'10px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnSek:        { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  btnKlein:      { padding:'6px 12px', borderRadius:'var(--radius)', border:'none', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:500 },
  iconBtn:       { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 },
  filterBtn:     { padding:'7px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--surface)', fontSize:13, cursor:'pointer', fontFamily:'inherit', color:'var(--text-2)' },
  filterBtnAktiv:{ background:'var(--primary)', color:'var(--primary-fg)', borderColor:'var(--primary)' },
  navBtn:        { background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', fontSize:18, cursor:'pointer', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', color:'var(--text-2)' },
  leer:          { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' },
  fehler:        { margin:0, color:'var(--danger)', fontSize:13 },
}
