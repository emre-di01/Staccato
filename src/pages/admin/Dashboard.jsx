import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { supabase } from '../../lib/supabase'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }

function StatCard({ icon, label, value, color = 'var(--primary)', sub, onClick }) {
  return (
    <div onClick={onClick} style={{
      background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
      padding: '20px 24px', border: '1px solid var(--border)',
      boxShadow: 'var(--shadow)', cursor: onClick ? 'pointer' : 'default',
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
  const { profil, schule, setSchule, T } = useApp()
  const navigate = useNavigate()
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
          { key: 'einstellungen', label: '⚙️ Einstellungen' },
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
            <StatCard icon="🎓" label={T('students_total')}  value={laden ? '…' : stats?.schueler_gesamt}   color="var(--accent)"   onClick={() => navigate('/admin/mitglieder')} />
            <StatCard icon="👨‍🏫" label={T('teachers_total')} value={laden ? '…' : stats?.lehrer_gesamt}    color="var(--primary)"  onClick={() => navigate('/admin/mitglieder')} />
            <StatCard icon="🎵" label={T('classes_active')}  value={laden ? '…' : stats?.unterricht_aktiv}  color="var(--success)"  onClick={() => navigate('/admin/kurse')} />
            <StatCard icon="📅" label={T('lessons_today')}   value={laden ? '…' : stats?.stunden_heute}     color="var(--warning)"  onClick={() => navigate('/admin/stundenplan')} />
            <StatCard icon="📊" label={T('attendance_rate')} value={laden ? '…' : stats?.anwesenheit_quote ? `${stats.anwesenheit_quote}%` : '–'} color="var(--accent)" onClick={() => navigate('/admin/stundenplan')} />
            <StatCard icon="💰" label={T('revenue_month')}   value={laden ? '…' : stats?.einnahmen_monat ? `€${stats.einnahmen_monat}` : '€0'} color="var(--success)" />
            <StatCard icon="📋" label={T('prospects_open')}  value={laden ? '…' : stats?.interessenten}     color="var(--primary)"  onClick={() => navigate('/admin/interessenten')} />
            <StatCard icon="📅" label={T('lessons_week')}    value={laden ? '…' : stats?.stunden_woche}     color="var(--text-2)"   onClick={() => navigate('/admin/stundenplan')} />
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
                sub={laden ? '' : vorstandStats?.zieleGesamt > 0 ? `${Math.round(vorstandStats.zieleErledigt / vorstandStats.zieleGesamt * 100)}% erledigt` : ''}
                color="#7c3aed" onClick={() => navigate('/vorstand/ziele')} />
              <StatCard icon="📝" label="Protokolle" value={laden ? '…' : vorstandStats?.protokolle} color="#7c3aed" onClick={() => navigate('/vorstand/protokolle')} />
            </div>
          </div>

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
  const [form, setForm] = useState({
    name:             schule?.name             ?? '',
    logo_url:         schule?.logo_url         ?? '',
    website:          schule?.website          ?? '',
    email:            schule?.email            ?? '',
    telefon:          schule?.telefon          ?? '',
    adresse:          schule?.adresse          ?? '',
    inventar_prefix:  schule?.inventar_prefix  ?? '',
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
      inventar_prefix: form.inventar_prefix.trim().toUpperCase() || 'INV',
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
      <h2 style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)', marginBottom: 24 }}>Schuleinstellungen</h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {feld('Schulname', 'name', 'text', 'Meine Musikschule')}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 }}>
            Logo-URL <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(wird in PDF-Exporten verwendet)</span>
          </label>
          <input type="url" value={form.logo_url} onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
            placeholder="https://beispiel.de/logo.png"
            style={{ width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' }} />
          {form.logo_url && (
            <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
              <img src={form.logo_url} alt="Logo-Vorschau"
                style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)', padding: 4, background: '#fff' }}
                onError={e => { e.target.style.display = 'none' }} />
              <button onClick={() => setForm(f => ({ ...f, logo_url: '' }))}
                style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                ✕ entfernen
              </button>
            </div>
          )}
        </div>
        {feld('Website', 'website', 'url', 'https://...')}
        {feld('E-Mail', 'email', 'email', 'info@musikschule.de')}
        {feld('Telefon', 'telefon', 'tel', '+49 ...')}
        {feld('Adresse', 'adresse', 'text', 'Musterstraße 1, 12345 Stadt')}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 4 }}>
            Inventar-Präfix <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(z.B. TMD → TMD001, TMD002 …)</span>
          </label>
          <input value={form.inventar_prefix} maxLength={8}
            onChange={e => setForm(f => ({ ...f, inventar_prefix: e.target.value.toUpperCase() }))}
            placeholder="INV"
            style={{ width: 120, boxSizing: 'border-box', padding: '9px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'monospace', outline: 'none', letterSpacing: '0.05em' }} />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, justifyContent: 'flex-end', paddingTop: 4 }}>
          {erfolg && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>✓ Gespeichert</span>}
          <button onClick={speichernFn} disabled={speichern}
            style={{ padding: '9px 22px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg, #fff)', fontSize: 14, fontWeight: 700, cursor: speichern ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: speichern ? 0.7 : 1 }}>
            {speichern ? 'Speichern …' : '💾 Speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

const s = {
  leer: { padding: '24px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13, background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' },
}
