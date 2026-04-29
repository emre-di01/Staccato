import { useState, useEffect } from 'react'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }

function StatCard({ icon, label, value, color = 'var(--primary)', sub }) {
  return (
    <div style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
      padding: '20px 24px', border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)',
    }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500, marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: '-1px' }}>{value ?? '–'}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{ fontSize: 28 }}>{icon}</div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { profil, T } = useApp()
  const [tab, setTab] = useState('uebersicht')
  const [stats, setStats] = useState(null)
  const [vorstandStats, setVorstandStats] = useState(null)
  const [kurse, setKurse] = useState([])
  const [naechsteStunden, setNaechsteStunden] = useState([])
  const [laden, setLaden] = useState(true)
  const [kurseGeladen, setKurseGeladen] = useState(false)

  useEffect(() => {
    async function ladeStats() {
      const [{ data }, aufgabenRes, zieleRes, protokolleRes] = await Promise.all([
        supabase.rpc('dashboard_stats'),
        supabase.from('vorstand_aufgaben').select('status').eq('schule_id', profil?.schule_id ?? ''),
        supabase.from('vorstand_ziele').select('status').eq('schule_id', profil?.schule_id ?? ''),
        supabase.from('vorstand_protokolle').select('id', { count: 'exact', head: true }).eq('schule_id', profil?.schule_id ?? ''),
      ])
      setStats(data)
      const aufgaben = aufgabenRes.data ?? []
      setVorstandStats({
        aufgabenOffen:    aufgaben.filter(a => a.status === 'offen').length,
        aufgabenLaufend:  aufgaben.filter(a => a.status === 'in_bearbeitung').length,
        aufgabenErledigt: aufgaben.filter(a => a.status === 'erledigt').length,
        zieleGesamt:      (zieleRes.data ?? []).length,
        zieleErledigt:    (zieleRes.data ?? []).filter(z => z.status === 'erledigt').length,
        protokolle:       protokolleRes.count ?? 0,
      })
      setLaden(false)
    }
    if (profil?.schule_id) ladeStats()
  }, [profil])

  useEffect(() => {
    if (tab !== 'meine_kurse' || kurseGeladen || !profil?.id) return
    async function ladeKurse() {
      const { data: usRes } = await supabase
        .from('unterricht_schueler')
        .select('*, unterricht(*, instrumente(name_de, icon), raeume(name), unterricht_lehrer(lehrer_id))')
        .eq('schueler_id', profil.id)
        .eq('status', 'aktiv')

      const meineKurse = (usRes ?? []).map(u => u.unterricht).filter(Boolean)

      if (meineKurse.length > 0) {
        const alleIds = [...new Set(meineKurse.flatMap(k => (k.unterricht_lehrer ?? []).map(ul => ul.lehrer_id)))]
        if (alleIds.length > 0) {
          const { data: lp } = await supabase.from('profiles').select('id, voller_name').in('id', alleIds)
          const nameMap = Object.fromEntries((lp ?? []).map(p => [p.id, p]))
          meineKurse.forEach(k => {
            k.unterricht_lehrer = (k.unterricht_lehrer ?? []).map(ul => ({ ...ul, profiles: nameMap[ul.lehrer_id] ?? null }))
          })
        }

        const { data: st } = await supabase
          .from('stunden')
          .select('*, unterricht(name, typ)')
          .in('unterricht_id', meineKurse.map(k => k.id))
          .gte('beginn', new Date().toISOString())
          .eq('status', 'geplant')
          .order('beginn')
          .limit(5)
        setNaechsteStunden(st ?? [])
      }

      setKurse(meineKurse)
      setKurseGeladen(true)
    }
    ladeKurse()
  }, [tab, kurseGeladen, profil])

  const jetzt = new Date()
  const stunde = jetzt.getHours()
  const gruss = stunde < 12 ? '☀️ Guten Morgen' : stunde < 17 ? '👋 Guten Tag' : '🌙 Guten Abend'

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <div style={{ fontSize: 13, color: 'var(--text-3)', marginBottom: 4 }}>{gruss}</div>
        <h1 style={{ fontSize: 28, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px', margin: 0 }}>
          {profil?.voller_name}
        </h1>
      </div>

      {/* Tabs */}
      <div style={{ display: 'flex', gap: 4, marginBottom: 28, borderBottom: '2px solid var(--border)', paddingBottom: 0 }}>
        {[
          { key: 'uebersicht', label: '📊 Übersicht' },
          { key: 'meine_kurse', label: '🎵 Meine Kurse' },
        ].map(t => (
          <button key={t.key} onClick={() => setTab(t.key)} style={{
            padding: '10px 18px', border: 'none', background: 'none',
            fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
            color: tab === t.key ? 'var(--primary)' : 'var(--text-3)',
            borderBottom: `2px solid ${tab === t.key ? 'var(--primary)' : 'transparent'}`,
            marginBottom: -2, transition: 'all 0.15s',
          }}>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Übersicht */}
      {tab === 'uebersicht' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <StatCard icon="🎓" label={T('students_total')}  value={laden ? '…' : stats?.schueler_gesamt}   color="var(--accent)" />
            <StatCard icon="👨‍🏫" label={T('teachers_total')} value={laden ? '…' : stats?.lehrer_gesamt}    color="var(--primary)" />
            <StatCard icon="🎵" label={T('classes_active')}  value={laden ? '…' : stats?.unterricht_aktiv}  color="var(--success)" />
            <StatCard icon="📅" label={T('lessons_today')}   value={laden ? '…' : stats?.stunden_heute}     color="var(--warning)" />
            <StatCard icon="📊" label={T('attendance_rate')} value={laden ? '…' : stats?.anwesenheit_quote ? `${stats.anwesenheit_quote}%` : '–'} color="var(--accent)" />
            <StatCard icon="💰" label={T('revenue_month')}   value={laden ? '…' : stats?.einnahmen_monat ? `€${stats.einnahmen_monat}` : '€0'} color="var(--success)" />
            <StatCard icon="📋" label={T('prospects_open')}  value={laden ? '…' : stats?.interessenten}     color="var(--primary)" />
            <StatCard icon="📅" label={T('lessons_week')}    value={laden ? '…' : stats?.stunden_woche}     color="var(--text-2)" />
          </div>

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🎯 Vorstandsmodul
              <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', background: '#7c3aed18', padding: '2px 10px', borderRadius: 99 }}>Vorstand</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
              <StatCard icon="🔴" label="Offene Aufgaben"    value={laden ? '…' : vorstandStats?.aufgabenOffen}    color="var(--warning)" />
              <StatCard icon="🟡" label="In Bearbeitung"     value={laden ? '…' : vorstandStats?.aufgabenLaufend}  color="var(--accent)" />
              <StatCard icon="✅" label="Erledigte Aufgaben" value={laden ? '…' : vorstandStats?.aufgabenErledigt} color="var(--success)" />
              <StatCard icon="🎯" label="Ziele"
                value={laden ? '…' : vorstandStats ? `${vorstandStats.zieleErledigt}/${vorstandStats.zieleGesamt}` : '–'}
                sub={laden ? '' : vorstandStats?.zieleGesamt > 0 ? `${Math.round(vorstandStats.zieleErledigt / vorstandStats.zieleGesamt * 100)}% erledigt` : ''}
                color="#7c3aed" />
              <StatCard icon="📝" label="Protokolle" value={laden ? '…' : vorstandStats?.protokolle} color="#7c3aed" />
            </div>
          </div>

          {stats?.naechste_events?.length > 0 && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
                {T('upcoming_events')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.naechste_events.map(ev => (
                  <div key={ev.id} style={{
                    background: 'var(--surface)', borderRadius: 'var(--radius)',
                    padding: '14px 18px', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 14,
                  }}>
                    <div style={{ fontSize: 20 }}>
                      {ev.typ === 'konzert' ? '🎭' : ev.typ === 'vorspiel' ? '🎼' : ev.typ === 'pruefung' ? '📝' : '📅'}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{ev.titel}</div>
                      <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                        {new Date(ev.beginn).toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>
                    </div>
                    <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'var(--bg-2)', color: 'var(--text-3)', textTransform: 'capitalize' }}>
                      {T(`event_${ev.typ}`)}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      {/* Tab: Meine Kurse */}
      {tab === 'meine_kurse' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16, marginBottom: 32 }}>
            <StatCard icon="🎵" label={T('dash_my_courses')}   value={!kurseGeladen ? '…' : kurse.length}           color="var(--primary)" />
            <StatCard icon="📅" label={T('dash_next_lessons')} value={!kurseGeladen ? '…' : naechsteStunden.length}  color="var(--accent)" />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 24 }} className="dashboard-grid">
            {/* Kurse */}
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>{T('dash_my_courses')}</h2>
              {!kurseGeladen ? <div style={s.leer}>{T('loading')}</div> :
               kurse.length === 0 ? <div style={s.leer}>Keine Kurse zugewiesen.</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {kurse.map(k => (
                    <div key={k.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)' }}>
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

            {/* Nächste Stunden */}
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 14 }}>{T('dash_schedule')}</h2>
              {!kurseGeladen ? <div style={s.leer}>{T('loading')}</div> :
               naechsteStunden.length === 0 ? <div style={s.leer}>{T('dash_no_lessons')}</div> : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                  {naechsteStunden.map(st => {
                    const beginn = new Date(st.beginn)
                    const istHeute = beginn.toDateString() === jetzt.toDateString()
                    return (
                      <div key={st.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', border: `1px solid ${istHeute ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', gap: 12, alignItems: 'center' }}>
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
          </div>

          <style>{`
            @media (max-width: 768px) {
              .dashboard-grid { grid-template-columns: 1fr !important; }
            }
          `}</style>
        </>
      )}
    </div>
  )
}

const s = {
  leer: { padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
}
