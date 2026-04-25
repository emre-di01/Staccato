import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }

export default function SchuelerKurse() {
  const { profil } = useApp()
  const navigate   = useNavigate()
  const [kurse, setKurse] = useState([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    if (!profil) return
    async function ladeData() {
      const { data } = await supabase
        .from('unterricht_schueler')
        .select('*, unterricht(*, instrumente(name_de, icon), raeume(name), unterricht_lehrer(lehrer_id, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name)))')
        .eq('schueler_id', profil.id)
        .eq('status', 'aktiv')
      setKurse((data ?? []).map(u => u.unterricht))
      setLaden(false)
    }
    ladeData()
  }, [profil])

  if (laden) return <div style={{ padding:40, color:'var(--text-3)' }}>Laden …</div>

  return (
    <div>
      <h1 style={s.h1}>🎵 Meine Kurse</h1>
      <p style={s.sub}>{kurse.length} Kurse</p>

      {kurse.length === 0 ? (
        <div style={s.leer}>Du bist noch keinem Kurs zugeordnet.</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:16, marginTop:24 }}>
          {kurse.map(k => (
            <div key={k.id} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', overflow:'hidden', cursor:'pointer' }}
              onClick={() => navigate(`/schueler/kurse/${k.id}`)}>
              <div style={{ height:4, background: k.farbe ?? 'var(--primary)' }} />
              <div style={{ padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:10 }}>
                  <span style={{ fontSize:24 }}>{TYP_ICON[k.typ]}</span>
                  <div>
                    <div style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>{k.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                      {k.instrumente?.icon} {k.instrumente?.name_de}
                    </div>
                  </div>
                </div>
                <div style={{ display:'flex', flexDirection:'column', gap:5, fontSize:13, color:'var(--text-2)' }}>
                  {k.wochentag && <span>📅 {k.wochentag.toUpperCase()} {k.uhrzeit_von?.slice(0,5)}–{k.uhrzeit_bis?.slice(0,5)}</span>}
                  {k.raeume    && <span>🏫 {k.raeume.name}</span>}
                  {k.unterricht_lehrer?.length > 0 && (
                    <span>👨‍🏫 {k.unterricht_lehrer.map(ul => ul.profiles?.voller_name).filter(Boolean).join(', ')}</span>
                  )}
                </div>
                <div style={{ marginTop:14 }}>
                  <span style={{ fontSize:13, padding:'6px 14px', borderRadius:'var(--radius)', background:'var(--primary)', color:'var(--primary-fg)', fontWeight:700 }}>
                    Öffnen →
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

const s = {
  h1:   { margin:'0 0 4px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  sub:  { margin:0, color:'var(--text-3)', fontSize:14 },
  leer: { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', marginTop:24 },
}
