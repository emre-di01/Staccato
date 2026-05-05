import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }

function StatCard({ icon, label, wert, farbe = 'var(--primary)', onClick }) {
  return (
    <div onClick={onClick} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'20px 24px', border:'1px solid var(--border)', boxShadow:'var(--shadow)', cursor: onClick ? 'pointer' : 'default' }}>
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

  const jetzt = new Date()
  const stunde = jetzt.getHours()
  const gruss = stunde < 12 ? T('greeting_morning') : stunde < 17 ? T('greeting_day') : T('greeting_evening')

  const { data, isLoading: laden } = useQuery({
    queryKey: ['lehrer-dashboard', profil?.id],
    enabled: !!profil?.id,
    queryFn: async () => {
      // Kurse des Lehrers laden
      const { data: ul } = await supabase
        .from('unterricht_lehrer')
        .select('rolle, unterricht(*, instrumente(name_de, icon), raeume(name), unterricht_schueler(schueler_id, status))')
        .eq('lehrer_id', profil.id)

      const meineKurse = (ul ?? []).map(u => ({ ...u.unterricht, meine_rolle: u.rolle }))

      // Nächste Stunden laden
      let naechsteStunden = []
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
        naechsteStunden = stunden ?? []
      }

      return { kurse: meineKurse, naechsteStunden }
    },
  })

  const kurse = data?.kurse ?? []
  const naechsteStunden = data?.naechsteStunden ?? []

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
        <StatCard icon="🎵" label={T('dash_my_courses')}      wert={laden ? '…' : kurse.length}          farbe="var(--primary)" onClick={() => navigate('/lehrer/kurse')} />
        <StatCard icon="👥" label={T('dash_active_students')} wert={laden ? '…' : aktiveSchueler}         farbe="var(--accent)"  onClick={() => navigate('/lehrer/schueler')} />
        <StatCard icon="📅" label={T('dash_next_lessons')}    wert={laden ? '…' : naechsteStunden.length} farbe="var(--success)" onClick={() => navigate('/lehrer/anwesenheit')} />
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }} className="dashboard-grid">
        {/* Meine Kurse */}
        <div>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:14 }}>
            <h2 style={{ fontSize:16, fontWeight:800, color:'var(--text)', margin:0 }}>{T('dash_my_courses')}</h2>
            <button onClick={() => navigate('/lehrer/kurse')} style={s.linkBtn}>{T('dash_all')}</button>
          </div>
          {laden ? <div style={s.leer}>{T('loading')}</div> :
           kurse.length === 0 ? <div style={s.leer}>{T('dash_no_courses')}</div> : (
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
            <h2 style={{ fontSize:16, fontWeight:800, color:'var(--text)', margin:0 }}>📅 {T('dash_next_lessons')}</h2>
          </div>
          {laden ? <div style={s.leer}>{T('loading')}</div> :
           naechsteStunden.length === 0 ? <div style={s.leer}>{T('dash_no_lessons')}</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {naechsteStunden.map(st => {
                const beginn = new Date(st.beginn)
                const istHeute = beginn.toDateString() === jetzt.toDateString()
                return (
                  <div key={st.id} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 16px', border:`1px solid ${istHeute ? 'var(--accent)' : 'var(--border)'}`, display:'flex', gap:14, alignItems:'center' }}>
                    <div style={{ textAlign:'center', minWidth:44 }}>
                      <div style={{ fontSize:11, fontWeight:700, color: istHeute ? 'var(--accent)' : 'var(--text-3)', textTransform:'uppercase' }}>
                        {istHeute ? T('dash_today') : beginn.toLocaleDateString('de-DE', { weekday:'short' })}
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
                        {T('dash_start')}
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
