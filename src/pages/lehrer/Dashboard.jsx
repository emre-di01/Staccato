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

export default function LehrerDashboard() {
  const { profil, T } = useApp()
  const navigate = useNavigate()
  const [kurse,         setKurse]         = useState([])
  const [naechsteStunden, setNaechsteStunden] = useState([])
  const [laden,         setLaden]         = useState(true)

  const jetzt = new Date()
  const stunde = jetzt.getHours()
  const gruss = stunde < 12 ? '☀️ Guten Morgen' : stunde < 17 ? '👋 Guten Tag' : '🌙 Guten Abend'

  useEffect(() => {
    if (!profil) return
    async function ladeData() {
      // Kurse des Lehrers laden
      const { data: ul } = await supabase
        .from('unterricht_lehrer')
        .select('rolle, unterricht(*, instrumente(name_de, icon), raeume(name), unterricht_schueler(schueler_id, status))')
        .eq('lehrer_id', profil.id)

      const meineKurse = (ul ?? []).map(u => ({ ...u.unterricht, meine_rolle: u.rolle }))
      setKurse(meineKurse)

      // Nächste Stunden laden
      const unterrichtIds = meineKurse.map(k => k.id)
      if (unterrichtIds.length > 0) {
        const { data: stunden } = await supabase
          .from('stunden')
          .select('*, unterricht(name, typ)')
          .in('unterricht_id', unterrichtIds)
          .gte('beginn', new Date().toISOString())
          .eq('status', 'geplant')
          .order('beginn')
          .limit(5)
        setNaechsteStunden(stunden ?? [])
      }

      setLaden(false)
    }
    ladeData()
  }, [profil])

  const aktiveSchueler = new Set(
    kurse.flatMap(k => (k.unterricht_schueler ?? []).filter(s => s.status === 'aktiv').map(s => s.schueler_id))
  ).size

  return (
    <div>
      <div style={{ marginBottom:32 }}>
        <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:4 }}>{gruss}</div>
        <h1 style={{ fontSize:28, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px', margin:0 }}>
          {profil?.voller_name}
        </h1>
      </div>

      {/* Stats */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:16, marginBottom:32 }}>
        <StatCard icon="🎵" label="Meine Kurse"      wert={laden ? '…' : kurse.length}         farbe="var(--primary)" />
        <StatCard icon="👥" label="Aktive Schüler"   wert={laden ? '…' : aktiveSchueler}        farbe="var(--accent)" />
        <StatCard icon="📅" label="Nächste Stunden"  wert={laden ? '…' : naechsteStunden.length} farbe="var(--success)" />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }} className="dashboard-grid">
        {/* Meine Kurse */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h2 style={{ fontSize:16, fontWeight:800, color:'var(--text)', margin:0 }}>🎵 Meine Kurse</h2>
            <button onClick={() => navigate('/lehrer/kurse')} style={s.linkBtn}>Alle →</button>
          </div>
          {laden ? <div style={s.leer}>Laden …</div> :
           kurse.length === 0 ? <div style={s.leer}>Noch keine Kurse zugeordnet.</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {kurse.slice(0, 4).map(k => (
                <div key={k.id} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 16px', border:'1px solid var(--border)', cursor:'pointer', transition:'box-shadow 0.15s' }}
                  onClick={() => navigate(`/lehrer/kurse/${k.id}`)}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ fontSize:20 }}>{TYP_ICON[k.typ]}</span>
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{k.name}</div>
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                        {k.instrumente?.icon} {k.instrumente?.name_de} ·
                        {' '}{k.unterricht_schueler?.filter(s => s.status==='aktiv').length ?? 0} Schüler
                        {k.wochentag && ` · ${k.wochentag.toUpperCase()} ${k.uhrzeit_von?.slice(0,5)}`}
                      </div>
                    </div>
                    {k.meine_rolle === 'hauptlehrer' && (
                      <span style={{ fontSize:10, color:'var(--accent)', fontWeight:700 }}>HAUPT</span>
                    )}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Nächste Stunden */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h2 style={{ fontSize:16, fontWeight:800, color:'var(--text)', margin:0 }}>📅 Nächste Stunden</h2>
          </div>
          {laden ? <div style={s.leer}>Laden …</div> :
           naechsteStunden.length === 0 ? <div style={s.leer}>Keine geplanten Stunden.</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {naechsteStunden.map(st => {
                const beginn = new Date(st.beginn)
                const istHeute = beginn.toDateString() === jetzt.toDateString()
                return (
                  <div key={st.id} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 16px', border:`1px solid ${istHeute ? 'var(--accent)' : 'var(--border)'}`, display:'flex', gap:14, alignItems:'center' }}>
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
                    {istHeute && (
                      <button onClick={() => navigate(`/lehrer/kurse/${st.unterricht_id}`)}
                        style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'none', background:'var(--accent)', color:'var(--accent-fg)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                        🎬 Starten
                      </button>
                    )}
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
  leer:    { padding:'24px', textAlign:'center', color:'var(--text-3)', fontSize:13, background:'var(--surface)', borderRadius:'var(--radius)', border:'1px solid var(--border)' },
  linkBtn: { background:'none', border:'none', color:'var(--accent)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
}
