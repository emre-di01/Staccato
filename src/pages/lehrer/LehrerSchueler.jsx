import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import Avatar from '../../components/Avatar'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }
const STATUS_INFO = {
  anwesend:    { icon:'✅', farbe:'var(--success)' },
  abwesend:    { icon:'❌', farbe:'var(--danger)' },
  entschuldigt:{ icon:'📝', farbe:'var(--warning)' },
  zu_spaet:    { icon:'⏰', farbe:'#f59e0b' },
}

// ─── Detail-Panel ──────────────────────────────────────────────
function DetailPanel({ eintrag, onClose }) {
  const { T } = useApp()
  const { profile, kurse } = eintrag
  const [detail, setDetail] = useState(null)
  const [laden,  setLaden]  = useState(true)

  useEffect(() => {
    async function ladeDetail() {
      const kursIds = kurse.map(k => k.id)

      const [stundenRes, anwesenheitRes] = await Promise.all([
        supabase.from('stunden')
          .select('id, beginn, ende, status, notizen, hausaufgaben, unterricht_id, unterricht(name, farbe, typ)')
          .in('unterricht_id', kursIds)
          .eq('status', 'stattgefunden')
          .order('beginn', { ascending: false })
          .limit(50),
        supabase.from('anwesenheit')
          .select('stunde_id, status')
          .eq('schueler_id', profile.id),
      ])

      const stunden     = stundenRes.data  ?? []
      const anwesenheit = anwesenheitRes.data ?? []
      const awMap       = Object.fromEntries(anwesenheit.map(a => [a.stunde_id, a.status]))

      // Anwesenheitsrate pro Kurs
      const statsProKurs = {}
      for (const k of kurse) {
        const kStunden = stunden.filter(st => st.unterricht_id === k.id)
        const anwesend = kStunden.filter(st => awMap[st.id] === 'anwesend').length
        statsProKurs[k.id] = { gesamt: kStunden.length, anwesend, quote: kStunden.length > 0 ? Math.round((anwesend / kStunden.length) * 100) : null }
      }

      // Letzte 10 Stunden mit Status
      const letzte = stunden.slice(0, 10).map(st => ({ ...st, awStatus: awMap[st.id] ?? null }))

      setDetail({ statsProKurs, letzte })
      setLaden(false)
    }
    ladeDetail()
  }, [profile.id, kurse])

  const alter = profile.geburtsdatum
    ? Math.floor((Date.now() - new Date(profile.geburtsdatum)) / (365.25 * 24 * 3600 * 1000))
    : null

  return (
    <>
      {/* Overlay */}
      <div style={{ position:'fixed', inset:0, zIndex:200, background:'rgba(0,0,0,0.4)' }} onClick={onClose} />

      {/* Panel */}
      <div style={{
        position:'fixed', top:0, right:0, bottom:0, zIndex:201,
        width: '100%', maxWidth: 440,
        background:'var(--surface)', borderLeft:'1px solid var(--border)',
        display:'flex', flexDirection:'column',
        boxShadow:'-4px 0 24px rgba(0,0,0,0.15)',
        overflowY:'auto',
      }}>
        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'center', gap:14, flexShrink:0, position:'sticky', top:0, background:'var(--surface)', zIndex:1 }}>
          <Avatar name={profile.voller_name} avatarUrl={profile.avatar_url} size={52} />
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:18, color:'var(--text)' }}>{profile.voller_name}</div>
            {alter !== null && (
              <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{alter} {T('years_old')}</div>
            )}
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--text-3)', padding:4 }}>✕</button>
        </div>

        <div style={{ padding:'20px 24px', display:'flex', flexDirection:'column', gap:24 }}>

          {/* Kontakt */}
          {(profile.geburtsdatum || profile.telefon || profile.adresse) && (
            <section>
              <div style={s.sectionTitle}>{T('contact')}</div>
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                {profile.geburtsdatum && (
                  <div style={s.infoRow}>
                    <span style={s.infoIcon}>🎂</span>
                    <span>{new Date(profile.geburtsdatum).toLocaleDateString('de-DE')}</span>
                  </div>
                )}
                {profile.telefon && (
                  <div style={s.infoRow}>
                    <span style={s.infoIcon}>📞</span>
                    <a href={`tel:${profile.telefon}`} style={{ color:'var(--primary)', textDecoration:'none' }}>{profile.telefon}</a>
                  </div>
                )}
                {profile.adresse && (
                  <div style={s.infoRow}>
                    <span style={s.infoIcon}>📍</span>
                    <span>{profile.adresse}</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {/* Kurse + Anwesenheit */}
          <section>
            <div style={s.sectionTitle}>{T('courses')}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {kurse.map(k => {
                const stats = detail?.statsProKurs[k.id]
                const quoteColor = !stats || stats.quote === null ? 'var(--text-3)'
                  : stats.quote >= 80 ? 'var(--success)'
                  : stats.quote >= 60 ? 'var(--warning)'
                  : 'var(--danger)'
                return (
                  <div key={k.id} style={{ padding:'12px 14px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <div style={{ width:3, height:20, borderRadius:2, background: k.farbe ?? 'var(--primary)', flexShrink:0 }} />
                      <span style={{ fontSize:14 }}>{TYP_ICON[k.typ]}</span>
                      <span style={{ fontWeight:700, fontSize:14, color:'var(--text)', flex:1 }}>{k.name}</span>
                      {k.stimmgruppe && k.stimmgruppe !== 'keine' && (
                        <span style={{ fontSize:11, padding:'2px 7px', borderRadius:99, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text-3)', textTransform:'capitalize' }}>{k.stimmgruppe}</span>
                      )}
                    </div>
                    {stats && stats.gesamt > 0 && (
                      <div style={{ marginTop:8, display:'flex', alignItems:'center', gap:8 }}>
                        <div style={{ flex:1, height:5, borderRadius:99, background:'var(--border)', overflow:'hidden' }}>
                          <div style={{ height:'100%', borderRadius:99, background: quoteColor, width:`${stats.quote}%`, transition:'width 0.4s' }} />
                        </div>
                        <span style={{ fontSize:12, fontWeight:700, color: quoteColor, minWidth:36, textAlign:'right' }}>
                          {laden ? '…' : `${stats.quote}%`}
                        </span>
                        <span style={{ fontSize:11, color:'var(--text-3)' }}>
                          {laden ? '' : `${stats.anwesend}/${stats.gesamt}`}
                        </span>
                      </div>
                    )}
                    {stats && stats.gesamt === 0 && !laden && (
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:6 }}>{T('no_lessons_entered')}</div>
                    )}
                  </div>
                )
              })}
            </div>
          </section>

          {/* Letzte Stunden */}
          <section>
            <div style={s.sectionTitle}>{T('last_lessons')}</div>
            {laden ? (
              <div style={{ color:'var(--text-3)', fontSize:13 }}>{T('loading')}</div>
            ) : !detail?.letzte.length ? (
              <div style={{ color:'var(--text-3)', fontSize:13 }}>{T('no_lessons_brief')}</div>
            ) : (
              <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
                {detail.letzte.map(st => {
                  const aw = st.awStatus ? STATUS_INFO[st.awStatus] : null
                  const datum = new Date(st.beginn)
                  return (
                    <div key={st.id} style={{ padding:'10px 14px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)' }}>
                      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom: (st.notizen || st.hausaufgaben) ? 8 : 0 }}>
                        <div style={{ width:3, height:16, borderRadius:2, background: st.unterricht?.farbe ?? 'var(--primary)', flexShrink:0 }} />
                        <span style={{ fontSize:12, color:'var(--text-3)', minWidth:0, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {st.unterricht?.name} · {datum.toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit' })}
                        </span>
                        {aw && (
                          <span style={{ fontSize:13, flexShrink:0 }} title={st.awStatus}>{aw.icon}</span>
                        )}
                        {!aw && (
                          <span style={{ fontSize:11, color:'var(--text-3)', flexShrink:0 }}>–</span>
                        )}
                      </div>
                      {st.hausaufgaben && (
                        <div style={{ fontSize:12, color:'var(--text-2)', marginTop:4 }}>
                          <span style={{ color:'var(--text-3)', marginRight:4 }}>📚</span>{st.hausaufgaben}
                        </div>
                      )}
                      {st.notizen && (
                        <div style={{ fontSize:12, color:'var(--text-2)', marginTop:4 }}>
                          <span style={{ color:'var(--text-3)', marginRight:4 }}>📝</span>{st.notizen}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            )}
          </section>

        </div>
      </div>
    </>
  )
}

// ─── Hauptseite ────────────────────────────────────────────────
export default function LehrerSchueler() {
  const { profil, T } = useApp()
  const [schueler,  setSchueler]  = useState([])
  const [laden,     setLaden]     = useState(true)
  const [suche,       setSuche]       = useState('')
  const [typFilter,   setTypFilter]   = useState('alle')
  const [ausgewaehlt, setAusgewaehlt] = useState(null)

  useEffect(() => {
    if (!profil) return
    async function ladeSchueler() {
      let rows = []

      if (profil.rolle === 'admin' || profil.rolle === 'superadmin') {
        const { data } = await supabase
          .from('unterricht')
          .select('id, name, typ, farbe, unterricht_schueler(schueler_id, status, stimmgruppe, profiles!unterricht_schueler_schueler_id_fkey(id, voller_name, geburtsdatum, telefon, adresse, avatar_url))')
          .order('name')
        rows = (data ?? []).flatMap(k =>
          (k.unterricht_schueler ?? [])
            .filter(us => us.status === 'aktiv')
            .map(us => ({ kurs: { id: k.id, name: k.name, typ: k.typ, farbe: k.farbe }, ...us }))
        )
      } else {
        const { data } = await supabase
          .from('unterricht_lehrer')
          .select('unterricht(id, name, typ, farbe, unterricht_schueler(schueler_id, status, stimmgruppe, profiles!unterricht_schueler_schueler_id_fkey(id, voller_name, geburtsdatum, telefon, adresse, avatar_url)))')
          .eq('lehrer_id', profil.id)
        rows = (data ?? []).flatMap(ul =>
          (ul.unterricht?.unterricht_schueler ?? [])
            .filter(us => us.status === 'aktiv')
            .map(us => ({ kurs: { id: ul.unterricht.id, name: ul.unterricht.name, typ: ul.unterricht.typ, farbe: ul.unterricht.farbe }, ...us }))
        )
      }

      const map = {}
      for (const row of rows) {
        const pid = row.profiles?.id
        if (!pid) continue
        if (!map[pid]) map[pid] = { profile: row.profiles, kurse: [] }
        map[pid].kurse.push({ ...row.kurs, stimmgruppe: row.stimmgruppe })
      }

      setSchueler(Object.values(map).sort((a, b) => a.profile.voller_name.localeCompare(b.profile.voller_name)))
      setLaden(false)
    }
    ladeSchueler()
  }, [profil])

  const gefiltert = schueler.filter(s => {
    const nameOk = s.profile.voller_name?.toLowerCase().includes(suche.toLowerCase())
    const typOk  = typFilter === 'alle' || s.kurse.some(k => k.typ === typFilter)
    return nameOk && typOk
  })

  return (
    <div>
      <h1 style={s.h1}>👥 {T('my_students')}</h1>
      <p style={s.sub}>{schueler.length} {T('schueler')}{schueler.length !== gefiltert.length ? ` · ${gefiltert.length} ${T('filtered')}` : ''}</p>

      <div style={{ display:'flex', flexWrap:'wrap', gap:10, alignItems:'center', marginBottom:16 }}>
        <input
          style={{ ...s.suche, marginBottom:0, flex:'1 1 200px' }}
          placeholder={T('schueler_search')}
          value={suche}
          onChange={e => setSuche(e.target.value)}
        />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {[['alle', T('filter_all')], ['einzel', '🎵 Einzel'], ['gruppe', '👥 Gruppe'], ['chor', '🎼 Chor'], ['ensemble', '🎻 Ensemble']].map(([val, label]) => (
            <button key={val} onClick={() => setTypFilter(val)} style={{
              padding:'7px 12px', borderRadius:99, border:'1.5px solid', fontSize:12, fontWeight:600,
              cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s', whiteSpace:'nowrap',
              borderColor: typFilter===val ? 'var(--primary)' : 'var(--border)',
              background:  typFilter===val ? 'var(--primary)' : 'transparent',
              color:       typFilter===val ? 'var(--primary-fg)' : 'var(--text-3)',
            }}>{label}</button>
          ))}
        </div>
      </div>

      {laden ? (
        <div style={s.leer}>{T('loading')}</div>
      ) : gefiltert.length === 0 ? (
        <div style={s.leer}>{suche ? T('no_results') : T('kurs_no_students')}</div>
      ) : (
        <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(280px, 1fr))', gap:14, marginTop:24 }}>
          {gefiltert.map(eintrag => {
            const { profile, kurse } = eintrag
            return (
              <div key={profile.id} style={{ ...s.karte, cursor:'pointer' }}
                onClick={() => setAusgewaehlt(eintrag)}>
                <div style={{ display:'flex', alignItems:'center', gap:14, marginBottom:12 }}>
                  <Avatar name={profile.voller_name} avatarUrl={profile.avatar_url} size={44} />
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:15, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{profile.voller_name}</div>
                    {profile.geburtsdatum && (
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                        🎂 {new Date(profile.geburtsdatum).toLocaleDateString('de-DE')}
                      </div>
                    )}
                    {profile.telefon && (
                      <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                        📞 {profile.telefon}
                      </div>
                    )}
                  </div>
                  <span style={{ fontSize:16, color:'var(--text-3)', flexShrink:0 }}>›</span>
                </div>

                <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                  {kurse.map(k => (
                    <div key={k.id} style={{ display:'flex', alignItems:'center', gap:8, padding:'6px 10px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)' }}>
                      <div style={{ width:3, height:20, borderRadius:2, background: k.farbe ?? 'var(--primary)', flexShrink:0 }} />
                      <span style={{ fontSize:13 }}>{TYP_ICON[k.typ]}</span>
                      <span style={{ fontSize:13, fontWeight:600, color:'var(--text-2)', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{k.name}</span>
                      {k.stimmgruppe && k.stimmgruppe !== 'keine' && (
                        <span style={{ fontSize:11, padding:'2px 7px', borderRadius:99, background:'var(--surface)', border:'1px solid var(--border)', color:'var(--text-3)', textTransform:'capitalize', flexShrink:0 }}>
                          {k.stimmgruppe}
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )
          })}
        </div>
      )}

      {ausgewaehlt && (
        <DetailPanel eintrag={ausgewaehlt} onClose={() => setAusgewaehlt(null)} />
      )}
    </div>
  )
}

const s = {
  h1:          { fontSize:26, fontWeight:800, color:'var(--text)', marginBottom:6, letterSpacing:'-0.5px' },
  sub:         { fontSize:14, color:'var(--text-3)', marginBottom:20 },
  suche:       { width:'100%', maxWidth:360, padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--surface)', color:'var(--text)', fontSize:14, fontFamily:'inherit', outline:'none', boxSizing:'border-box' },
  leer:        { marginTop:40, padding:48, textAlign:'center', background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'2px dashed var(--border)', color:'var(--text-3)', fontSize:14 },
  karte:       { background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', padding:'16px 18px', boxShadow:'var(--shadow)', transition:'box-shadow 0.15s' },
  sectionTitle:{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.08em', marginBottom:10 },
  infoRow:     { display:'flex', alignItems:'flex-start', gap:8, fontSize:13, color:'var(--text-2)' },
  infoIcon:    { fontSize:14, flexShrink:0, marginTop:1 },
}
