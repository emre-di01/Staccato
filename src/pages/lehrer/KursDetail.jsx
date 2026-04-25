import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }
const STATUS_FARBE = {
  anwesend:    { bg:'var(--success)', text:'#fff' },
  abwesend:    { bg:'var(--danger)',  text:'#fff' },
  entschuldigt:{ bg:'var(--warning)', text:'#fff' },
  zu_spaet:    { bg:'#f59e0b',        text:'#fff' },
}

// ─── Anwesenheit erfassen Modal ───────────────────────────────
function AnwesenheitModal({ stunde, schueler, onClose, onErfolg }) {
  const { profil } = useApp()
  const [stati, setStati] = useState(
    Object.fromEntries(schueler.map(s => [s.schueler_id, 'anwesend']))
  )
  const [laden, setLaden] = useState(false)

  // Bestehende Anwesenheit laden
  useEffect(() => {
    async function laden() {
      const { data } = await supabase.from('anwesenheit').select('*').eq('stunde_id', stunde.id)
      if (data?.length > 0) {
        setStati(Object.fromEntries(data.map(a => [a.schueler_id, a.status])))
      }
    }
    laden()
  }, [stunde.id])

  async function speichern() {
    setLaden(true)
    const payload = schueler.map(s => ({ id: s.schueler_id, status: stati[s.schueler_id] ?? 'anwesend' }))
    await supabase.rpc('anwesenheit_erfassen', { p_stunde_id: stunde.id, p_schueler: payload })
    onErfolg()
    onClose()
  }

  const beginn = new Date(stunde.beginn)

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:500, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>✅ Anwesenheit</h3>
            <div style={{ fontSize:13, color:'var(--text-3)', marginTop:4 }}>
              {beginn.toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })} · {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)' }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
          {schueler.map(s => (
            <div key={s.schueler_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)' }}>
              <div style={{ width:36, height:36, borderRadius:'50%', background:'var(--primary)', color:'var(--primary-fg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, fontWeight:800, flexShrink:0 }}>
                {s.profiles?.voller_name?.charAt(0)}
              </div>
              <span style={{ flex:1, fontSize:14, fontWeight:600, color:'var(--text)' }}>{s.profiles?.voller_name}</span>
              <div style={{ display:'flex', gap:4 }}>
                {['anwesend','abwesend','entschuldigt','zu_spaet'].map(st => (
                  <button key={st} onClick={() => setStati(prev => ({ ...prev, [s.schueler_id]: st }))}
                    style={{ padding:'4px 8px', borderRadius:6, border:`2px solid ${stati[s.schueler_id]===st ? STATUS_FARBE[st].bg : 'var(--border)'}`, background: stati[s.schueler_id]===st ? STATUS_FARBE[st].bg : 'transparent', color: stati[s.schueler_id]===st ? STATUS_FARBE[st].text : 'var(--text-3)', fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:700, transition:'all 0.1s' }}>
                    {st === 'anwesend' ? '✓' : st === 'abwesend' ? '✗' : st === 'entschuldigt' ? 'E' : 'S'}
                  </button>
                ))}
              </div>
            </div>
          ))}
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
          <button onClick={speichern} disabled={laden} style={s.btnPri}>
            {laden ? 'Speichere …' : '💾 Anwesenheit speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KursDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { profil } = useApp()
  const [kurs,     setKurs]     = useState(null)
  const [schueler, setSchueler] = useState([])
  const [stunden,  setStunden]  = useState([])
  const [laden,    setLaden]    = useState(true)
  const [aktiveTab, setAktiveTab] = useState('stunden')
  const [modal,    setModal]    = useState(null)

  useEffect(() => {
    async function ladeData() {
      const [k, sc, st] = await Promise.all([
        supabase.from('unterricht').select('*, instrumente(name_de, icon), raeume(name), unterricht_lehrer(lehrer_id, rolle, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name))').eq('id', id).single(),
        supabase.from('unterricht_schueler').select('*, profiles!unterricht_schueler_schueler_id_fkey(id, voller_name, geburtsdatum)').eq('unterricht_id', id).eq('status', 'aktiv'),
        supabase.from('stunden').select('*').eq('unterricht_id', id).order('beginn', { ascending: false }).limit(20),
      ])
      setKurs(k.data)
      setSchueler(sc.data ?? [])
      setStunden(st.data ?? [])
      setLaden(false)
    }
    ladeData()
  }, [id])

  if (laden) return <div style={{ padding:40, color:'var(--text-3)' }}>Laden …</div>
  if (!kurs)  return <div style={{ padding:40, color:'var(--danger)' }}>Kurs nicht gefunden.</div>

  const jetzt = new Date()
  const naechsteStunde = stunden.find(st => new Date(st.beginn) > jetzt && st.status === 'geplant')

  return (
    <div>
      {/* Header */}
      <button onClick={() => navigate('/lehrer/kurse')} style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 16px' }}>← Kurse</button>

      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', marginBottom:24, boxShadow:'var(--shadow)' }}>
        <div style={{ height:6, background: kurs.farbe ?? 'var(--primary)' }} />
        <div style={{ padding:'20px 24px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ fontSize:28 }}>{TYP_ICON[kurs.typ]}</span>
                <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text)' }}>{kurs.name}</h1>
              </div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:13, color:'var(--text-2)' }}>
                {kurs.instrumente && <span>{kurs.instrumente.icon} {kurs.instrumente.name_de}</span>}
                {kurs.wochentag   && <span>📅 {kurs.wochentag.toUpperCase()} {kurs.uhrzeit_von?.slice(0,5)}–{kurs.uhrzeit_bis?.slice(0,5)}</span>}
                {kurs.raeume      && <span>🏫 {kurs.raeume.name}</span>}
                <span>👥 {schueler.length} Schüler</span>
              </div>
            </div>
            <button onClick={() => navigate(`/lehrer/kurse/${id}/unterrichtsmodus`)}
              style={{ padding:'10px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--accent)', color:'var(--accent-fg)', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
              🎬 Unterrichtsmodus
            </button>
          </div>

          {/* Lehrer */}
          <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
            {kurs.unterricht_lehrer?.map(ul => (
              <span key={ul.lehrer_id} style={{ fontSize:12, padding:'3px 10px', borderRadius:99, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-2)' }}>
                👨‍🏫 {ul.profiles?.voller_name} {ul.rolle === 'hauptlehrer' ? '(Haupt)' : '(Co)'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'2px solid var(--border)' }}>
        {[['stunden','📅 Stunden'],['schueler','👥 Schüler'],['repertoire','🎼 Repertoire']].map(([key, label]) => (
          <button key={key} onClick={() => setAktiveTab(key)}
            style={{ padding:'10px 18px', background:'none', border:'none', fontSize:14, cursor:'pointer', fontFamily:'inherit', color: aktiveTab===key ? 'var(--text)' : 'var(--text-3)', fontWeight: aktiveTab===key ? 800 : 500, borderBottom:`2px solid ${aktiveTab===key ? 'var(--primary)' : 'transparent'}`, marginBottom:-2, transition:'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Stunden */}
      {aktiveTab === 'stunden' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {stunden.length === 0 ? <div style={s.leer}>Keine Stunden gefunden. Stunden im Admin-Bereich generieren.</div> :
           stunden.map(st => {
            const beginn   = new Date(st.beginn)
            const istVorbei = beginn < jetzt
            const istHeute  = beginn.toDateString() === jetzt.toDateString()
            return (
              <div key={st.id} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 18px', border:`1px solid ${istHeute ? 'var(--accent)' : 'var(--border)'}`, display:'flex', alignItems:'center', gap:14 }}>
                <div style={{ textAlign:'center', minWidth:48 }}>
                  <div style={{ fontSize:11, fontWeight:700, color: istHeute ? 'var(--accent)' : 'var(--text-3)', textTransform:'uppercase' }}>
                    {istHeute ? 'Heute' : beginn.toLocaleDateString('de-DE', { weekday:'short' })}
                  </div>
                  <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>
                    {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-3)' }}>
                    {beginn.toLocaleDateString('de-DE', { day:'numeric', month:'short' })}
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontSize:12, color:'var(--text-3)' }}>
                    {st.status === 'stattgefunden' ? '✅ Stattgefunden' : st.status === 'abgesagt' ? '❌ Abgesagt' : '⏳ Geplant'}
                  </div>
                  {st.hausaufgaben && <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>📝 {st.hausaufgaben}</div>}
                </div>
                {!istVorbei && st.status === 'geplant' && (
                  <button onClick={() => setModal({ typ:'anwesenheit', stunde: st })}
                    style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                    ✅ Anwesenheit
                  </button>
                )}
                {istVorbei && st.status === 'geplant' && (
                  <button onClick={() => setModal({ typ:'anwesenheit', stunde: st })}
                    style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                    ✅ Nachtragen
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Tab: Schüler */}
      {aktiveTab === 'schueler' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {schueler.length === 0 ? <div style={s.leer}>Keine aktiven Schüler.</div> :
           schueler.map(sc => (
            <div key={sc.schueler_id} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 18px', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:14 }}>
              <div style={{ width:40, height:40, borderRadius:'50%', background:'var(--primary)', color:'var(--primary-fg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, flexShrink:0 }}>
                {sc.profiles?.voller_name?.charAt(0)}
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{sc.profiles?.voller_name}</div>
                {sc.profiles?.geburtsdatum && (
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                    🎂 {new Date(sc.profiles.geburtsdatum).toLocaleDateString('de-DE')}
                  </div>
                )}
              </div>
              {sc.stimmgruppe && sc.stimmgruppe !== 'keine' && (
                <span style={{ fontSize:12, padding:'3px 10px', borderRadius:99, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-2)', textTransform:'capitalize' }}>
                  {sc.stimmgruppe}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab: Repertoire */}
      {aktiveTab === 'repertoire' && (
        <div style={{ textAlign:'center', padding:32 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🎼</div>
          <p style={{ color:'var(--text-3)', marginBottom:16 }}>Zum vollständigen Repertoire & Dateien-Bereich</p>
          <button onClick={() => navigate(`/lehrer/kurse/${id}/repertoire`)} style={s.btnPri}>
            🎼 Repertoire öffnen
          </button>
        </div>
      )}

      {modal?.typ === 'anwesenheit' && (
        <AnwesenheitModal
          stunde={modal.stunde}
          schueler={schueler}
          onClose={() => setModal(null)}
          onErfolg={() => {
            setStunden(prev => prev.map(st => st.id === modal.stunde.id ? { ...st, status: 'stattgefunden' } : st))
          }}
        />
      )}
    </div>
  )
}

const s = {
  leer:   { padding:'32px', textAlign:'center', color:'var(--text-3)', fontSize:13, background:'var(--surface)', borderRadius:'var(--radius)', border:'1px solid var(--border)' },
  btnPri: { padding:'10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek: { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
}
