import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }

function StatCard({ icon, label, wert, farbe = 'var(--primary)' }) {
  return (
    <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'20px 24px', border:'1px solid var(--border)', boxShadow:'var(--shadow)' }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
        <div>
          <div style={{ fontSize:13, color:'var(--text-3)', fontWeight:500, marginBottom:8 }}>{label}</div>
          <div style={{ fontSize:32, fontWeight:800, color:farbe, letterSpacing:'-1px' }}>{wert ?? '–'}</div>
        </div>
        <div style={{ fontSize:28 }}>{icon}</div>
      </div>
    </div>
  )
}

export default function SchuelerDashboard() {
  const { profil, T } = useApp()
  const navigate = useNavigate()
  const [kurse,          setKurse]          = useState([])
  const [naechsteStunden, setNaechsteStunden] = useState([])
  const [laden,          setLaden]          = useState(true)

  const jetzt = new Date()
  const stunde = jetzt.getHours()
  const gruss = stunde < 12 ? '☀️ Guten Morgen' : stunde < 17 ? '👋 Guten Tag' : '🌙 Guten Abend'

  useEffect(() => {
    if (!profil) return
    async function ladeData() {
      const { data: us } = await supabase
        .from('unterricht_schueler')
        .select('*, unterricht(*, instrumente(name_de, icon), raeume(name), unterricht_lehrer(lehrer_id, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name)))')
        .eq('schueler_id', profil.id)
        .eq('status', 'aktiv')

      const meineKurse = (us ?? []).map(u => u.unterricht)
      setKurse(meineKurse)

      // Nächste Stunden
      const ids = meineKurse.map(k => k.id)
      if (ids.length > 0) {
        const { data: st } = await supabase
          .from('stunden')
          .select('*, unterricht(name, typ)')
          .in('unterricht_id', ids)
          .gte('beginn', new Date().toISOString())
          .eq('status', 'geplant')
          .order('beginn')
          .limit(5)
        setNaechsteStunden(st ?? [])
      }
      setLaden(false)
    }
    ladeData()
  }, [profil])

  return (
    <div>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:4 }}>{gruss}</div>
        <h1 style={{ fontSize:28, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px', margin:0 }}>
          {profil?.voller_name}
        </h1>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:16, marginBottom:32 }}>
        <StatCard icon="🎵" label="Meine Kurse"     wert={laden ? '…' : kurse.length}          farbe="var(--primary)" />
        <StatCard icon="📅" label="Nächste Stunden" wert={laden ? '…' : naechsteStunden.length} farbe="var(--accent)" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }} className="dashboard-grid">
        {/* Kurse */}
        <div>
          <h2 style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:14 }}>🎵 Meine Kurse</h2>
          {laden ? <div style={s.leer}>Laden …</div> :
           kurse.length === 0 ? <div style={s.leer}>Noch keinem Kurs zugeordnet.</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {kurse.map(k => (
                <div key={k.id} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 16px', border:'1px solid var(--border)', boxShadow:'var(--shadow)' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:20 }}>{TYP_ICON[k.typ]}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{k.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                        {k.instrumente?.icon} {k.instrumente?.name_de}
                        {k.wochentag && ` · ${k.wochentag.toUpperCase()} ${k.uhrzeit_von?.slice(0,5)}`}
                      </div>
                      {k.unterricht_lehrer?.length > 0 && (
                        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                          👨‍🏫 {k.unterricht_lehrer.map(ul => ul.profiles?.voller_name).filter(Boolean).join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nächste Stunden */}
        <div>
          <h2 style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:14 }}>📅 Mein Stundenplan</h2>
          {laden ? <div style={s.leer}>Laden …</div> :
           naechsteStunden.length === 0 ? <div style={s.leer}>Keine geplanten Stunden.</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {naechsteStunden.map(st => {
                const beginn  = new Date(st.beginn)
                const istHeute = beginn.toDateString() === jetzt.toDateString()
                return (
                  <div key={st.id} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 16px', border:`1px solid ${istHeute ? 'var(--accent)' : 'var(--border)'}`, display:'flex', gap:12, alignItems:'center' }}>
                    <div style={{ textAlign:'center', minWidth:44 }}>
                      <div style={{ fontSize:11, fontWeight:700, color: istHeute ? 'var(--accent)' : 'var(--text-3)', textTransform:'uppercase' }}>
                        {istHeute ? 'Heute' : beginn.toLocaleDateString('de-DE', { weekday:'short' })}
                      </div>
                      <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>
                        {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}
                      </div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{st.unterricht?.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                        {beginn.toLocaleDateString('de-DE', { day:'numeric', month:'short' })}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>

      <style>{`
        @media (max-width: 768px) {
          .dashboard-grid { grid-template-columns: 1fr !important; }
        }
      `}</style>
    </div>
  )
}

const s = {
  leer: { padding:'24px', textAlign:'center', color:'var(--text-3)', fontSize:13, background:'var(--surface)', borderRadius:'var(--radius)', border:'1px solid var(--border)' },
}
