import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const STATUS_INFO = {
  anwesend:    { icon:'✅', label:'Anwesend',     farbe:'var(--success)' },
  abwesend:    { icon:'❌', label:'Abwesend',     farbe:'var(--danger)' },
  entschuldigt:{ icon:'📝', label:'Entschuldigt', farbe:'var(--warning)' },
  zu_spaet:    { icon:'⏰', label:'Zu spät',      farbe:'#f59e0b' },
}

export default function SchuelerAnwesenheit() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { profil } = useApp()
  const [kurs,       setKurs]       = useState(null)
  const [anwesenheit, setAnwesenheit] = useState([])
  const [stunden,    setStunden]    = useState([])
  const [laden,      setLaden]      = useState(true)

  useEffect(() => {
    if (!profil) return
    async function ladeData() {
      const [k, st] = await Promise.all([
        supabase.from('unterricht').select('id, name, typ, farbe').eq('id', id).single(),
        supabase.from('stunden').select('id, beginn, ende, status').eq('unterricht_id', id)
          .eq('status', 'stattgefunden').order('beginn', { ascending: false }),
      ])
      setKurs(k.data)
      setStunden(st.data ?? [])

      if (st.data?.length > 0) {
        const stundenIds = st.data.map(s => s.id)
        const { data: aw } = await supabase.from('anwesenheit').select('*')
          .eq('schueler_id', profil.id).in('stunde_id', stundenIds)
        setAnwesenheit(aw ?? [])
      }
      setLaden(false)
    }
    ladeData()
  }, [id, profil])

  if (laden) return <div style={{ padding:40, color:'var(--text-3)' }}>Laden …</div>
  if (!kurs)  return <div style={{ padding:40, color:'var(--danger)' }}>Kurs nicht gefunden.</div>

  const anwesenheitMap = Object.fromEntries(anwesenheit.map(a => [a.stunde_id, a]))

  // Statistiken
  const gesamt      = stunden.length
  const anwesend    = anwesenheit.filter(a => a.status === 'anwesend').length
  const abwesend    = anwesenheit.filter(a => a.status === 'abwesend').length
  const entschuldigt= anwesenheit.filter(a => a.status === 'entschuldigt').length
  const quote       = gesamt > 0 ? Math.round((anwesend / gesamt) * 100) : null

  return (
    <div>
      <button onClick={() => navigate(`/schueler/kurse/${id}`)}
        style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 16px' }}>
        ← {kurs.name}
      </button>

      <h1 style={s.h1}>✅ Meine Anwesenheit</h1>
      <p style={{ ...s.sub, marginBottom:24 }}>{kurs.name}</p>

      {/* Statistiken */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:12, marginBottom:28 }}>
        {[
          { label:'Stunden gesamt', wert: gesamt, farbe:'var(--text-2)' },
          { label:'Anwesend', wert: anwesend, farbe:'var(--success)' },
          { label:'Abwesend', wert: abwesend, farbe:'var(--danger)' },
          { label:'Entschuldigt', wert: entschuldigt, farbe:'var(--warning)' },
          { label:'Anwesenheitsquote', wert: quote !== null ? `${quote}%` : '–', farbe: quote >= 80 ? 'var(--success)' : quote >= 60 ? 'var(--warning)' : 'var(--danger)' },
        ].map(stat => (
          <div key={stat.label} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'16px', border:'1px solid var(--border)', boxShadow:'var(--shadow)' }}>
            <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, marginBottom:6 }}>{stat.label}</div>
            <div style={{ fontSize:26, fontWeight:800, color:stat.farbe }}>{stat.wert}</div>
          </div>
        ))}
      </div>

      {/* Anwesenheitsliste */}
      {stunden.length === 0 ? (
        <div style={s.leer}>Noch keine Stunden stattgefunden.</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {stunden.map(st => {
            const aw     = anwesenheitMap[st.id]
            const status = aw?.status ?? 'nicht erfasst'
            const info   = STATUS_INFO[status]
            const beginn = new Date(st.beginn)

            return (
              <div key={st.id} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 18px', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:14, boxShadow:'var(--shadow)' }}>
                <div style={{ textAlign:'center', minWidth:52 }}>
                  <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase' }}>
                    {beginn.toLocaleDateString('de-DE', { weekday:'short' })}
                  </div>
                  <div style={{ fontSize:16, fontWeight:800, color:'var(--text)' }}>
                    {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-3)' }}>
                    {beginn.toLocaleDateString('de-DE', { day:'numeric', month:'short' })}
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  {aw?.notiz && (
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>📝 {aw.notiz}</div>
                  )}
                </div>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  {info ? (
                    <span style={{ fontSize:13, fontWeight:700, color:info.farbe, display:'flex', alignItems:'center', gap:4 }}>
                      {info.icon} {info.label}
                    </span>
                  ) : (
                    <span style={{ fontSize:12, color:'var(--text-3)' }}>Nicht erfasst</span>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

const s = {
  h1:   { margin:'0 0 4px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  sub:  { margin:0, color:'var(--text-3)', fontSize:14 },
  leer: { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' },
}
