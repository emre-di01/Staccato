import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import OnboardingModal from '../../components/OnboardingModal'
import Hinweis from '../../components/Hinweis'
import { Skeleton, SkeletonStatCard, SkeletonList, SkeletonStyle } from '../../components/Skeleton'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }

function StatCard({ icon, label, wert, farbe = 'var(--primary)', onClick }) {
  const [hovered, setHovered] = useState(false)
  return (
    <div
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background:'var(--surface)', borderRadius:'var(--radius-lg)',
        padding:'20px 24px', border:'1px solid var(--border)',
        boxShadow: hovered ? 'var(--shadow-lg)' : 'var(--shadow)',
        cursor: onClick ? 'pointer' : 'default',
        transform: hovered && onClick ? 'translateY(-2px)' : 'none',
        transition:'transform 0.18s ease, box-shadow 0.18s ease',
        position:'relative', overflow:'hidden',
      }}
    >
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:farbe, borderRadius:'var(--radius-lg) var(--radius-lg) 0 0' }} />
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12 }}>
        <div>
          <div style={{ fontSize:13, color:'var(--text-3)', fontWeight:500, marginBottom:8 }}>{label}</div>
          <div style={{ fontSize:32, fontWeight:800, color:farbe, letterSpacing:'-1px' }}>{wert ?? '–'}</div>
        </div>
        <div style={{
          fontSize:22, width:46, height:46, display:'flex', alignItems:'center', justifyContent:'center',
          borderRadius:'var(--radius)', background:`color-mix(in srgb, ${farbe} 15%, var(--bg))`,
          flexShrink:0,
        }}>{icon}</div>
      </div>
    </div>
  )
}

export default function SchuelerDashboard() {
  const { profil, T } = useApp()
  const navigate = useNavigate()

  const jetzt = new Date()
  const stunde = jetzt.getHours()
  const gruss = stunde < 12 ? T('greeting_morning') : stunde < 17 ? T('greeting_day') : T('greeting_evening')

  const { data, isLoading: laden } = useQuery({
    queryKey: ['schueler-dashboard', profil?.id],
    enabled: !!profil?.id,
    queryFn: async () => {
      const { data: us } = await supabase
        .from('unterricht_schueler')
        .select('*, unterricht(*, instrumente(name_de, icon), raeume(name), unterricht_lehrer(lehrer_id))')
        .eq('schueler_id', profil.id)
        .eq('status', 'aktiv')

      const meineKurse = (us ?? []).map(u => u.unterricht).filter(Boolean)

      // Lehrernamen separat laden
      if (meineKurse.length > 0) {
        const alleIds = [...new Set(meineKurse.flatMap(k => (k.unterricht_lehrer ?? []).map(ul => ul.lehrer_id)))]
        if (alleIds.length > 0) {
          const { data: lp } = await supabase.from('profiles').select('id, voller_name').in('id', alleIds)
          const nameMap = Object.fromEntries((lp ?? []).map(p => [p.id, p]))
          meineKurse.forEach(k => {
            k.unterricht_lehrer = (k.unterricht_lehrer ?? []).map(ul => ({ ...ul, profiles: nameMap[ul.lehrer_id] ?? null }))
          })
        }
      }

      // Nächste Stunden
      let naechsteStunden = []
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
        naechsteStunden = st ?? []
      }

      const { data: anwData } = await supabase
        .from('anwesenheit')
        .select('status')
        .eq('schueler_id', profil.id)
      const anwGesamt = anwData?.length ?? 0
      const anwOk    = (anwData ?? []).filter(a => a.status === 'anwesend' || a.status === 'zu_spaet').length
      const anwesenheitsRate = anwGesamt >= 3 ? Math.round(100 * anwOk / anwGesamt) : null

      return { kurse: meineKurse, naechsteStunden, anwesenheitsRate }
    },
  })

  const kurse           = data?.kurse           ?? []
  const naechsteStunden = data?.naechsteStunden ?? []
  const anwesenheitsRate = data?.anwesenheitsRate ?? null

  return (
    <div>
      <OnboardingModal />
      <div style={{ marginBottom:20 }}>
        <div style={{ fontSize:13, color:'var(--text-3)', marginBottom:4 }}>{gruss}</div>
        <h1 style={{ fontSize:28, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px', margin:'0 0 12px' }}>
          {profil?.voller_name}
        </h1>
        <Hinweis text={T('hint_dash')} />
      </div>

      {/* Hero: nächste Stunde */}
      {!laden && naechsteStunden[0] && (() => {
        const st = naechsteStunden[0]
        const beginn = new Date(st.beginn)
        const morgen = new Date(jetzt); morgen.setDate(jetzt.getDate() + 1)
        const istHeute  = beginn.toDateString() === jetzt.toDateString()
        const istMorgen = beginn.toDateString() === morgen.toDateString()
        return (
          <div onClick={() => navigate('/schueler/stundenplan')} style={{
            background:'var(--primary)', borderRadius:'var(--radius-lg)',
            padding:'20px 24px', marginBottom:20, cursor:'pointer',
            boxShadow:'var(--shadow-lg)', position:'relative', overflow:'hidden',
          }}>
            <div style={{ fontSize:11, fontWeight:700, color:'rgba(255,255,255,0.75)', textTransform:'uppercase', letterSpacing:'0.09em', marginBottom:6 }}>
              {istHeute ? '🟢 Nächste Stunde – Heute' : istMorgen ? '📅 Nächste Stunde – Morgen' : `📅 ${beginn.toLocaleDateString('de-DE', { weekday:'long' })}`}
            </div>
            <div style={{ fontSize:22, fontWeight:800, color:'var(--primary-fg)', marginBottom:4 }}>{st.unterricht?.name}</div>
            <div style={{ fontSize:14, color:'rgba(255,255,255,0.85)' }}>
              {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr · {beginn.toLocaleDateString('de-DE', { day:'numeric', month:'long' })}
            </div>
          </div>
        )
      })()}

      <SkeletonStyle />
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(180px, 1fr))', gap:16, marginBottom:32 }}>
        {laden ? <><SkeletonStatCard /><SkeletonStatCard /></> : <>
        <StatCard icon="🎵" label={T('dash_my_courses')}   wert={kurse.length}          farbe="var(--primary)" onClick={() => navigate('/schueler/kurse')} />
        <StatCard icon="📅" label={T('dash_next_lessons')} wert={naechsteStunden.length} farbe="var(--accent)"  onClick={() => navigate('/schueler/stundenplan')} />
        {anwesenheitsRate !== null && (() => {
          const farbe = anwesenheitsRate >= 80 ? 'var(--success)' : anwesenheitsRate >= 60 ? 'var(--warning)' : 'var(--danger)'
          return (
            <div onClick={() => navigate('/schueler/kurse')} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'20px 24px', border:'1px solid var(--border)', boxShadow:'var(--shadow)', cursor:'pointer' }}>
              <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:10 }}>
                <div>
                  <div style={{ fontSize:13, color:'var(--text-3)', fontWeight:500, marginBottom:8 }}>Anwesenheit</div>
                  <div style={{ fontSize:32, fontWeight:800, color:farbe, letterSpacing:'-1px' }}>{anwesenheitsRate}%</div>
                </div>
                <span style={{ fontSize:28 }}>📊</span>
              </div>
              <div style={{ height:5, borderRadius:3, background:'var(--bg-2)', overflow:'hidden', marginBottom:8 }}>
                <div style={{ height:'100%', width:`${anwesenheitsRate}%`, borderRadius:3, background:farbe }} />
              </div>
              <Hinweis text={T('hint_dash_attendance')} style={{ marginBottom:0 }} />
            </div>
          )
        })()}
        </>}
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:24 }} className="dashboard-grid">
        {/* Kurse */}
        <div>
          <h2 style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:6 }}>{T('dash_my_courses')}</h2>
          <Hinweis text={T('hint_dash_courses')} style={{ marginBottom:14 }} />
          {laden ? <SkeletonList rows={3} /> :
           kurse.length === 0 ? <div style={s.leer}>{T('dash_no_courses')}</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {kurse.map(k => (
                <div key={k.id} onClick={() => navigate(`/schueler/kurse/${k.id}`)} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 16px', border:'1px solid var(--border)', boxShadow:'var(--shadow)', cursor:'pointer' }}>
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
          <h2 style={{ fontSize:16, fontWeight:800, color:'var(--text)', marginBottom:14 }}>{T('dash_schedule')}</h2>
          {laden ? <SkeletonList rows={3} /> :
           naechsteStunden.length === 0 ? <div style={s.leer}>{T('dash_no_lessons')}</div> : (
            <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
              {naechsteStunden.map(st => {
                const beginn  = new Date(st.beginn)
                const istHeute = beginn.toDateString() === jetzt.toDateString()
                return (
                  <div key={st.id} onClick={() => navigate('/schueler/stundenplan')} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 16px', border:`1px solid ${istHeute ? 'var(--accent)' : 'var(--border)'}`, display:'flex', gap:12, alignItems:'center', cursor:'pointer' }}>
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
