import { useState, useEffect, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'
import { SlidingTabs } from '../../components/SlidingTabs'

function useCountUp(target, duration = 700) {
  const [val, setVal] = useState(0)
  const rafRef = useRef(null)
  const prevRef = useRef(0)
  useEffect(() => {
    if (typeof target !== 'number' || isNaN(target)) return
    const from = prevRef.current
    prevRef.current = target
    const start = performance.now()
    const tick = now => {
      const t = Math.min((now - start) / duration, 1)
      const eased = 1 - Math.pow(1 - t, 3)
      setVal(Math.round(from + (target - from) * eased))
      if (t < 1) rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [target, duration])
  return val
}

const TYP_ICON    = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }
const ROLLE_LABEL = { schueler: 'Schüler', lehrer: 'Lehrer', admin: 'Admin', superadmin: 'Superadmin', eltern: 'Eltern', vorstand: 'Vorstand' }

function StatCard({ icon, label, value, color = 'var(--primary)', sub, onClick }) {
  const [hovered, setHovered] = useState(false)
  const counted = useCountUp(typeof value === 'number' ? value : 0)
  const display = typeof value === 'number' ? counted : value
  return (
    <div
      className="stagger-item"
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        padding: '20px 24px', border: '1px solid var(--border)',
        boxShadow: hovered ? 'var(--shadow-lg)' : 'var(--shadow)',
        cursor: onClick ? 'pointer' : 'default',
        transform: hovered && onClick ? 'translateY(-2px)' : 'none',
        transition: 'transform 0.18s ease, box-shadow 0.18s ease',
        position: 'relative', overflow: 'hidden',
      }}
    >
      <div style={{ position:'absolute', top:0, left:0, right:0, height:3, background:color, borderRadius:'var(--radius-lg) var(--radius-lg) 0 0' }} />
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 }}>
        <div>
          <div style={{ fontSize: 13, color: 'var(--text-3)', fontWeight: 500, marginBottom: 8 }}>{label}</div>
          <div style={{ fontSize: 32, fontWeight: 800, color, letterSpacing: '-1px' }}>{display ?? '–'}</div>
          {sub && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{sub}</div>}
        </div>
        <div style={{
          fontSize: 22, width: 46, height: 46, display: 'flex', alignItems: 'center', justifyContent: 'center',
          borderRadius: 'var(--radius)', background: `color-mix(in srgb, ${color} 15%, var(--bg))`,
          flexShrink: 0,
        }}>{icon}</div>
      </div>
    </div>
  )
}

export default function AdminDashboard() {
  const { profil, schule, setSchule, T } = useApp()
  const navigate = useNavigate()
  const [tab, setTab] = useState('uebersicht')
  const [stats, setStats] = useState(null)
  const [vorstandStats, setVorstandStats] = useState(null)
  const [inventarWert, setInventarWert] = useState(null)
  const [kurse, setKurse] = useState([])
  const [naechsteStunden, setNaechsteStunden] = useState([])
  const [laden, setLaden] = useState(true)
  const [kurseGeladen,  setKurseGeladen]  = useState(false)
  const [geburtstage,   setGeburtstage]   = useState([])

  useEffect(() => {
    async function ladeStats() {
      const [{ data }, aufgabenRes, zieleRes, protokolleRes, inventarRes, gebRes] = await Promise.all([
        supabase.rpc('dashboard_stats', { p_schule_id: profil?.schule_id }),
        supabase.from('vorstand_aufgaben').select('status').eq('schule_id', profil?.schule_id ?? ''),
        supabase.from('vorstand_ziele').select('status').eq('schule_id', profil?.schule_id ?? ''),
        supabase.from('vorstand_protokolle').select('id', { count: 'exact', head: true }).eq('schule_id', profil?.schule_id ?? ''),
        supabase.from('inventar').select('anschaffungswert').eq('schule_id', profil?.schule_id ?? ''),
        supabase.from('profiles').select('id, voller_name, geburtsdatum, rolle').eq('schule_id', profil?.schule_id ?? '').eq('aktiv', true).not('geburtsdatum', 'is', null),
      ])
      setStats(data)
      setInventarWert((inventarRes.data ?? []).reduce((s, i) => s + (Number(i.anschaffungswert) || 0), 0))
      const aufgaben = aufgabenRes.data ?? []
      setVorstandStats({
        aufgabenOffen:    aufgaben.filter(a => a.status === 'offen').length,
        aufgabenLaufend:  aufgaben.filter(a => a.status === 'in_bearbeitung').length,
        aufgabenErledigt: aufgaben.filter(a => a.status === 'erledigt').length,
        zieleGesamt:      (zieleRes.data ?? []).length,
        zieleErledigt:    (zieleRes.data ?? []).filter(z => z.status === 'erledigt').length,
        protokolle:       protokolleRes.count ?? 0,
      })
      const heute0 = new Date(); heute0.setHours(0, 0, 0, 0)
      const baldig = (gebRes.data ?? []).filter(p => {
        const geb = new Date(p.geburtsdatum)
        let diesJahr = new Date(heute0.getFullYear(), geb.getMonth(), geb.getDate())
        if (diesJahr < heute0) diesJahr.setFullYear(diesJahr.getFullYear() + 1)
        return Math.round((diesJahr - heute0) / 86400000) <= 7
      }).sort((a, b) => {
        const gebA = new Date(a.geburtsdatum), gebB = new Date(b.geburtsdatum)
        let dA = new Date(heute0.getFullYear(), gebA.getMonth(), gebA.getDate())
        let dB = new Date(heute0.getFullYear(), gebB.getMonth(), gebB.getDate())
        if (dA < heute0) dA.setFullYear(dA.getFullYear() + 1)
        if (dB < heute0) dB.setFullYear(dB.getFullYear() + 1)
        return dA - dB
      })
      setGeburtstage(baldig)
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
      <div style={{ marginBottom: 28 }}>
        <SlidingTabs
          active={tab}
          onChange={setTab}
          tabs={[
            { key: 'uebersicht', label: '📊 Übersicht' },
            { key: 'meine_kurse', label: '🎵 Meine Kurse' },
            { key: 'einstellungen', label: '⚙️ Einstellungen' },
          ]}
        />
      </div>

      {/* Tab: Übersicht */}
      {tab === 'uebersicht' && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
            <StatCard icon="🎓" label={T('students_total')}  value={laden ? '…' : stats?.schueler_gesamt}   color="var(--accent)"   onClick={() => navigate('/admin/mitglieder')} />
            <StatCard icon="👨‍🏫" label={T('teachers_total')} value={laden ? '…' : stats?.lehrer_gesamt}    color="var(--primary)"  onClick={() => navigate('/admin/mitglieder')} />
            <StatCard icon="🎵" label={T('classes_active')}  value={laden ? '…' : stats?.unterricht_aktiv}  color="var(--success)"  onClick={() => navigate('/admin/kurse')} />
            <StatCard icon="📅" label={T('lessons_today')}   value={laden ? '…' : stats?.stunden_heute}     color="var(--warning)"  onClick={() => navigate('/admin/stundenplan')} />
            <StatCard icon="📊" label={T('attendance_rate')} value={laden ? '…' : stats?.anwesenheit_quote ? `${stats.anwesenheit_quote}%` : '–'} color="var(--accent)" onClick={() => navigate('/admin/stundenplan')} />
            <StatCard icon="💰" label={T('revenue_month')}   value={laden ? '…' : stats?.einnahmen_monat ? `€${stats.einnahmen_monat}` : '€0'} color="var(--success)" />
            <StatCard icon="📋" label={T('prospects_open')}  value={laden ? '…' : stats?.interessenten}     color="var(--primary)"  onClick={() => navigate('/admin/interessenten')} />
            <StatCard icon="📅" label={T('lessons_week')}    value={laden ? '…' : stats?.stunden_woche}     color="var(--text-2)"   onClick={() => navigate('/admin/stundenplan')} />
            <StatCard icon="📦" label="Inventarwert"         value={laden || inventarWert === null ? '…' : inventarWert.toLocaleString('de-DE', { style:'currency', currency:'EUR', maximumFractionDigits:0 })} color="var(--text-2)" onClick={() => navigate('/admin/inventar')} />
          </div>

          <div style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8 }}>
              🎯 Vorstandsmodul
              <span style={{ fontSize: 12, fontWeight: 600, color: '#7c3aed', background: '#7c3aed18', padding: '2px 10px', borderRadius: 99 }}>Vorstand</span>
            </h2>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 16 }}>
              <StatCard icon="🔴" label="Offene Aufgaben"    value={laden ? '…' : vorstandStats?.aufgabenOffen}    color="var(--warning)" onClick={() => navigate('/vorstand/ziele')} />
              <StatCard icon="🟡" label="In Bearbeitung"     value={laden ? '…' : vorstandStats?.aufgabenLaufend}  color="var(--accent)"  onClick={() => navigate('/vorstand/ziele')} />
              <StatCard icon="✅" label="Erledigte Aufgaben" value={laden ? '…' : vorstandStats?.aufgabenErledigt} color="var(--success)" onClick={() => navigate('/vorstand/ziele')} />
              <StatCard icon="🎯" label="Ziele"
                value={laden ? '…' : vorstandStats ? `${vorstandStats.zieleErledigt}/${vorstandStats.zieleGesamt}` : '–'}
                sub={laden ? '' : (() => { const total = (vorstandStats?.aufgabenOffen ?? 0) + (vorstandStats?.aufgabenLaufend ?? 0) + (vorstandStats?.aufgabenErledigt ?? 0); return total > 0 ? `${Math.round((vorstandStats?.aufgabenErledigt ?? 0) / total * 100)}% Aufgaben erledigt` : '' })()}
                color="#7c3aed" onClick={() => navigate('/vorstand/ziele')} />
              <StatCard icon="📝" label="Protokolle" value={laden ? '…' : vorstandStats?.protokolle} color="#7c3aed" onClick={() => navigate('/vorstand/protokolle')} />
            </div>
          </div>

          {geburtstage.length > 0 && (
            <div style={{ marginBottom: 32 }}>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>🎂 Anstehende Geburtstage</h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {geburtstage.map(p => {
                  const geb = new Date(p.geburtsdatum)
                  const heute0 = new Date(); heute0.setHours(0, 0, 0, 0)
                  let diesJahr = new Date(heute0.getFullYear(), geb.getMonth(), geb.getDate())
                  if (diesJahr < heute0) diesJahr.setFullYear(diesJahr.getFullYear() + 1)
                  const diffTage = Math.round((diesJahr - heute0) / 86400000)
                  const alter    = diesJahr.getFullYear() - geb.getFullYear()
                  return (
                    <div key={p.id} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '12px 16px', border: `1px solid ${diffTage === 0 ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', alignItems: 'center', gap: 12 }}>
                      <span style={{ fontSize: 22 }}>{diffTage === 0 ? '🥳' : '🎂'}</span>
                      <div style={{ flex: 1 }}>
                        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{p.voller_name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                          {diffTage === 0 ? 'Heute' : diffTage === 1 ? 'Morgen' : `In ${diffTage} Tagen`} · wird {alter}
                        </div>
                      </div>
                      <span style={{ fontSize: 11, padding: '3px 10px', borderRadius: 99, background: 'var(--bg-2)', color: 'var(--text-3)', border: '1px solid var(--border)' }}>
                        {ROLLE_LABEL[p.rolle] ?? p.rolle}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {stats?.naechste_events?.length > 0 && (
            <div>
              <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text)', marginBottom: 16 }}>
                {T('upcoming_events')}
              </h2>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {stats.naechste_events.map(ev => (
                  <div key={ev.id} onClick={() => navigate('/admin/events')} style={{
                    background: 'var(--surface)', borderRadius: 'var(--radius)',
                    padding: '14px 18px', border: '1px solid var(--border)',
                    display: 'flex', alignItems: 'center', gap: 14, cursor: 'pointer',
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
            <StatCard icon="🎵" label={T('dash_my_courses')}   value={!kurseGeladen ? '…' : kurse.length}           color="var(--primary)" onClick={() => navigate('/lehrer/kurse')} />
            <StatCard icon="📅" label={T('dash_next_lessons')} value={!kurseGeladen ? '…' : naechsteStunden.length}  color="var(--accent)"  onClick={() => navigate('/lehrer/anwesenheit')} />
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
                      <div key={st.id} onClick={() => navigate('/admin/stundenplan')} style={{ background: 'var(--surface)', borderRadius: 'var(--radius)', padding: '14px 16px', border: `1px solid ${istHeute ? 'var(--accent)' : 'var(--border)'}`, display: 'flex', gap: 12, alignItems: 'center', cursor: 'pointer' }}>
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

      {/* Tab: Einstellungen */}
      {tab === 'einstellungen' && (
        <SchulEinstellungen schule={schule} schuleId={profil?.schule_id} onGespeichert={setSchule} />
      )}
    </div>
  )
}

function SchulEinstellungen({ schule, schuleId, onGespeichert }) {
  const { T } = useApp()
  const [form, setForm] = useState({
    name:             schule?.name             ?? '',
    logo_url:         schule?.logo_url         ?? '',
    website:          schule?.website          ?? '',
    email:            schule?.email            ?? '',
    telefon:          schule?.telefon          ?? '',
    adresse:          schule?.adresse          ?? '',
    inventar_prefix:  schule?.inventar_prefix  ?? '',
    kuendigungsfrist: schule?.kuendigungsfrist ?? '',
  })
  const [speichern, setSpeichern] = useState(false)
  const [erfolg,    setErfolg]    = useState(false)

  async function speichernFn() {
    setSpeichern(true)
    const payload = {
      name:            form.name.trim()            || schule?.name,
      logo_url:        form.logo_url.trim()        || null,
      website:         form.website.trim()         || null,
      email:           form.email.trim()           || null,
      telefon:         form.telefon.trim()         || null,
      adresse:         form.adresse.trim()         || null,
      inventar_prefix:  form.inventar_prefix.trim().toUpperCase() || 'INV',
      kuendigungsfrist: form.kuendigungsfrist.trim() || null,
    }
    await supabase.from('schulen').update(payload).eq('id', schuleId)
    onGespeichert(s => ({ ...s, ...payload }))
    setSpeichern(false)
    setErfolg(true)
    setTimeout(() => setErfolg(false), 2500)
  }

  function feld(label, key, type = 'text', placeholder = '') {
    return (
      <div>
        <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>{label}</label>
        <input type={type} value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))}
          placeholder={placeholder}
          style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 560 }}>
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 24 }}>{T('settings_school_title')}</h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {feld(T('settings_school_name'), 'name', 'text', 'Meine Musikschule')}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
            {T('settings_logo_url')} <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>({T('settings_logo_hint')})</span>
          </label>
          <input type="url" value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
            placeholder="https://beispiel.de/logo.png"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
          {form.logo_url && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={form.logo_url} alt={T('settings_logo_url')}
                style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)', padding: 4, background: '#fff' }}
                onError={e => { e.target.style.display = 'none' }} />
              <button onClick={() => setForm(f => ({ ...f, logo_url: '' }))}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                {T('settings_logo_remove')}
              </button>
            </div>
          )}
        </div>
        {feld('Website', 'website', 'url', 'https://...')}
        {feld(T('email'), 'email', 'email', 'info@musikschule.de')}
        {feld(T('profile_phone'), 'telefon', 'tel', '+49 ...')}
        {feld(T('profile_address'), 'adresse', 'text', 'Musterstraße 1, 12345 Stadt')}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
            {T('settings_inventar_prefix')} <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>({T('settings_inventar_prefix_hint')})</span>
          </label>
          <input value={form.inventar_prefix} maxLength={8}
            onChange={e => setForm(f => ({ ...f, inventar_prefix: e.target.value.toUpperCase() }))}
            placeholder="INV"
            style={{ width: 120, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'monospace', outline: 'none', letterSpacing: '0.05em' }} />
        </div>
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
            Kündigungsfrist <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(erscheint auf Formularen)</span>
          </label>
          <input value={form.kuendigungsfrist}
            onChange={e => setForm(f => ({ ...f, kuendigungsfrist: e.target.value }))}
            placeholder="z.B. 4 Wochen zum Monatsende"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', paddingTop: 4 }}>
          {erfolg && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{T('settings_saved')}</span>}
          <button onClick={speichernFn} disabled={speichern}
            style={{ padding: '9px 22px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg, #fff)', fontSize: 14, fontWeight: 700, cursor: speichern ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: speichern ? 0.7 : 1 }}>
            {speichern ? `${T('save')} …` : `💾 ${T('save')}`}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  leer: { padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
}
