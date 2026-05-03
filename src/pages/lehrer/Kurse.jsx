import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }

export default function LehrerKurse() {
  const { profil } = useApp()
  const navigate   = useNavigate()
  const [kurse, setKurse] = useState([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    if (!profil) return
    async function laden() {
      // Immer nach eigenem profil.id filtern – auch Admins, die als Lehrer tätig sind
      const { data } = await supabase
        .from('unterricht_lehrer')
        .select('rolle, unterricht(*, instrumente(name_de, icon), raeume(name), unterricht_schueler(schueler_id, status), unterricht_lehrer(lehrer_id, rolle, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name)))')
        .eq('lehrer_id', profil.id)
      const meineKurse = (data ?? []).map(u => ({ ...u.unterricht, meine_rolle: u.rolle }))

      setKurse(meineKurse)
      setLaden(false)
    }
    laden()
  }, [profil])

  return (
    <div>
      <h1 style={s.h1}>🎵 Meine Kurse</h1>
      <p style={s.sub}>{kurse.length} Kurse</p>

      {laden ? <div style={s.leer}>Laden …</div> :
       kurse.length === 0 ? <div style={s.leer}>Noch keine Kurse zugeordnet.</div> : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(300px, 1fr))', gap:16, marginTop:24 }}>
          {kurse.map(k => (
            <div key={k.id} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', boxShadow:'var(--shadow)', overflow:'hidden', cursor:'pointer', transition:'box-shadow 0.15s' }}
              onClick={() => navigate(`/lehrer/kurse/${k.id}`)}>
              <div style={{ height:4, background: k.farbe ?? 'var(--primary)' }} />
              <div style={{ padding:'16px 20px' }}>
                <div style={{ display:'flex', alignItems:'flex-start', gap:10, marginBottom:12 }}>
                  <span style={{ fontSize:24 }}>{TYP_ICON[k.typ]}</span>
                  <div style={{ flex:1 }}>
                    <div style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>{k.name}</div>
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                      {k.instrumente?.icon} {k.instrumente?.name_de}
                      {k.meine_rolle === 'hauptlehrer' && <span style={{ marginLeft:8, color:'var(--accent)', fontWeight:700 }}>HAUPTLEHRER</span>}
                      {k.meine_rolle === 'co_lehrer'   && <span style={{ marginLeft:8, color:'var(--text-3)', fontWeight:700 }}>CO-LEHRER</span>}
                    </div>
                  </div>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:5, marginBottom:14 }}>
                  {k.wochentag && (
                    <div style={{ fontSize:13, color:'var(--text-2)' }}>
                      📅 {k.wochentag.toUpperCase()} · {k.uhrzeit_von?.slice(0,5)} – {k.uhrzeit_bis?.slice(0,5)}
                    </div>
                  )}
                  {k.raeume && <div style={{ fontSize:13, color:'var(--text-2)' }}>🏫 {k.raeume.name}</div>}
                  <div style={{ fontSize:13, color:'var(--text-2)' }}>
                    👥 {k.unterricht_schueler?.filter(s => s.status === 'aktiv').length ?? 0} Schüler
                  </div>
                </div>

                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={e => { e.stopPropagation(); navigate(`/lehrer/kurse/${k.id}`) }}
                    style={s.btnPri}>📋 Details</button>
                  <button onClick={e => { e.stopPropagation(); navigate(`/lehrer/kurse/${k.id}/unterrichtsmodus`) }}
                    style={s.btnAkzent}>🎬 Unterrichtsmodus</button>
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
  h1:       { margin:'0 0 4px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  sub:      { margin:'0 0 0', color:'var(--text-3)', fontSize:14 },
  leer:     { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', marginTop:24 },
  btnPri:   { padding:'7px 14px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnAkzent:{ padding:'7px 14px', borderRadius:'var(--radius)', border:'none', background:'var(--accent)', color:'var(--accent-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
}
