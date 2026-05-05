import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }

function StatCard({ icon, label, wert, farbe = 'var(--primary)', onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
      padding: '20px 24px', border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)', cursor: onClick ? 'pointer' : 'default',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500, marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color: farbe, letterSpacing: '-1px' }}>{wert ?? '–'}</div>
        </div>
        <div style={{ fontSize: 28 }}>{icon}</div>
      </div>
    </div>
  )
}

export default function VorstandDashboard() {
  const { profil, T } = useApp()
  const navigate = useNavigate()
  const jetzt = new Date()
  const stunde = jetzt.getHours()
  const gruss = stunde < 12 ? T('greeting_morning') : stunde < 17 ? T('greeting_day') : T('greeting_evening')

  const { data, isLoading: laden } = useQuery({
    queryKey: ['vorstand-dashboard', profil?.id],
    enabled: !!profil?.schule_id,
    queryFn: async () => {
      const [aufgabenRes, zieleRes, protokolleRes, sitzungRes, usRes] = await Promise.all([
        supabase.from('vorstand_aufgaben')
          .select('id', { count: 'exact', head: true })
          .eq('schule_id', profil.schule_id)
          .in('status', ['offen', 'in_bearbeitung']),
        supabase.from('vorstand_ziele')
          .select('id', { count: 'exact', head: true })
          .eq('schule_id', profil.schule_id),
        supabase.from('vorstand_protokolle')
          .select('id', { count: 'exact', head: true })
          .eq('schule_id', profil.schule_id),
        supabase.from('vorstand_protokolle')
          .select('id, titel, datum, sitzungstyp')
          .eq('schule_id', profil.schule_id)
          .gte('datum', new Date().toISOString().slice(0, 10))
          .order('datum')
          .limit(1),
        supabase.from('unterricht_schueler')
          .select('*, unterricht(*, instrumente(name_de, icon), raeume(name), unterricht_lehrer(lehrer_id))')
          .eq('schueler_id', profil.id)
          .eq('status', 'aktiv'),
      ])

      const vorstandStats = {
        offeneAufgaben: aufgabenRes.count ?? 0,
        ziele: zieleRes.count ?? 0,
        protokolle: protokolleRes.count ?? 0,
        naechsteSitzung: sitzungRes.data?.[0] ?? null,
      }

      const meineKurse = (usRes.data ?? []).map(u => u.unterricht).filter(Boolean)
      let naechsteStunden = []

      if (meineKurse.length > 0) {
        const alleIds = [...new Set(meineKurse.flatMap(k => (k.unterricht_lehrer ?? []).map(ul => ul.lehrer_id)))]
        if (alleIds.length > 0) {
          const { data: lp } = await supabase.from('profiles').select('id, voller_name').in('id', alleIds)
          const nameMap = Object.fromEntries((lp ?? []).map(p => [p.id, p]))
          meineKurse.forEach(k => {
            k.unterricht_lehrer = (k.unterricht_lehrer ?? []).map(ul => ({ ...ul, profiles: nameMap[ul.lehrer_id] ?? null }))
          })
        }

        const kursIds = meineKurse.map(k => k.id)
        const { data: st } = await supabase
          .from('stunden')
          .select('*, unterricht(name, typ)')
          .in('unterricht_id', kursIds)
          .gte('beginn', new Date().toISOString())
          .eq('status', 'geplant')
          .order('beginn')
          .limit(5)
        naechsteStunden = st ?? []
      }

      return { vorstandStats, kurse: meineKurse, naechsteStunden }
    },
  })

  const vorstandStats = data?.vorstandStats ?? { offeneAufgaben: 0, ziele: 0, protokolle: 0, naechsteSitzung: null }
  const kurse = data?.kurse ?? []
  const naechsteStunden = data?.naechsteStunden ?? []

  const TYP_LABEL = {
    vorstandssitzung: T('vorstand_typ_vorstandssitzung'),
    mitgliederversammlung: T('vorstand_typ_mitgliederversammlung'),
    sonstiges: T('vorstand_typ_sonstiges'),
  }

  return (
    <div>
      <div style={{ marginBottom: 32 }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>{gruss}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', margin: 0 }}>
          {profil?.voller_name}
        </h1>
      </div>

      {/* Vorstandsmodul KPIs */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Vorstandsmodul</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon="✅" label={T('vorstand_offene_aufgaben')} wert={laden ? '…' : vorstandStats.offeneAufgaben}
          farbe="var(--accent)" onClick={() => navigate('/vorstand/ziele')} />
        <StatCard icon="🎯" label={T('vorstand_ziele')} wert={laden ? '…' : vorstandStats.ziele}
          farbe="var(--primary)" onClick={() => navigate('/vorstand/ziele')} />
        <StatCard icon="📝" label={T('vorstand_protokolle')} wert={laden ? '…' : vorstandStats.protokolle}
          farbe="#7c3aed" onClick={() => navigate('/vorstand/protokolle')} />
      </div>

      {/* Schüler KPIs */}
      <h2 style={{ fontSize: 14, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 12 }}>Meine Kurse</h2>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
        <StatCard icon="🎵" label={T('dash_my_courses')}   wert={laden ? '…' : kurse.length}           farbe="var(--primary)" onClick={() => navigate('/vorstand/kurse')} />
        <StatCard icon="📅" label={T('dash_next_lessons')} wert={laden ? '…' : naechsteStunden.length}  farbe="var(--accent)"  onClick={() => navigate('/vorstand/stundenplan')} />
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="dashboard-grid">
        {/* Meine Kurse */}
        <div>
          <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>{T('dash_my_courses')}</h2>
          {laden ? <div style={s.leer}>{T('loading')}</div> :
           kurse.length === 0 ? <div style={s.leer}>{T('dash_no_courses')}</div> : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {kurse.map(k => (
                <div key={k.id} onClick={() => navigate(`/vorstand/kurse/${k.id}`)} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ fontSize: 20 }}>{TYP_ICON[k.typ]}</span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{k.name}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                        {k.instrumente?.icon} {k.instrumente?.name_de}
                        {k.wochentag && ` · ${k.wochentag.toUpperCase()} ${k.uhrzeit_von?.slice(0, 5)}`}
                      </div>
                      {k.unterricht_lehrer?.length > 0 && (
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
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

        {/* Rechte Spalte: Nächste Stunden + Nächste Sitzung */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>{T('dash_schedule')}</h2>
            {laden ? <div style={s.leer}>{T('loading')}</div> :
             naechsteStunden.length === 0 ? <div style={s.leer}>{T('dash_no_lessons')}</div> : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {naechsteStunden.map(st => {
                  const beginn = new Date(st.beginn)
                  const istHeute = beginn.toDateString() === jetzt.toDateString()
                  return (
                    <div key={st.id} onClick={() => navigate('/vorstand/stundenplan')} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', border: `1px solid ${istHeute ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
                      <div style={{ textAlign: 'center', minWidth: 44 }}>
                        <div style={{ fontSize: 11, fontWeight: 700, color: istHeute ? 'var(--accent)' : 'var(--text-3)', textTransform: 'uppercase' }}>
                          {istHeute ? T('dash_today') : beginn.toLocaleDateString('de-DE', { weekday: 'short' })}
                        </div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>
                          {beginn.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
                        </div>
                      </div>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{st.unterricht?.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                          {beginn.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })}
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          <div>
            <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>{T('vorstand_naechste_sitzung')}</h2>
            {laden ? (
              <div style={s.leer}>{T('loading')}</div>
            ) : vorstandStats.naechsteSitzung ? (
              <div onClick={() => navigate('/vorstand/events')} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '16px', border: '1px solid var(--accent)', boxShadow: 'var(--shadow)', cursor: 'pointer' }}>
                <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 6 }}>
                  {TYP_LABEL[vorstandStats.naechsteSitzung.sitzungstyp]}
                </div>
                <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{vorstandStats.naechsteSitzung.titel}</div>
                <div style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 6 }}>
                  📅 {new Date(vorstandStats.naechsteSitzung.datum).toLocaleDateString('de-DE', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                </div>
              </div>
            ) : (
              <div style={s.leer}>Keine geplanten Sitzungen.</div>
            )}
          </div>
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
  leer: { padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
}
