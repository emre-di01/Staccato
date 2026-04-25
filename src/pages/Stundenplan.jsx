import { useState, useEffect, useCallback } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'

const STUNDEN_VON = 7   // Anzeige ab 7 Uhr
const STUNDEN_BIS = 21  // Anzeige bis 21 Uhr
const SLOT_HOEHE  = 60  // px pro Stunde

const WOCHENTAGE = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const WOCHENTAGE_LANG = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag']

const TYP_FARBE = {
  einzel:   '#3b82f6',
  gruppe:   '#8b5cf6',
  chor:     '#ec4899',
  ensemble: '#10b981',
}

// ─── Datum Hilfsfunktionen ────────────────────────────────────

function getMontag(datum) {
  const d = new Date(datum)
  const tag = d.getDay()
  const diff = tag === 0 ? -6 : 1 - tag
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}

function formatDatum(datum) {
  return datum.toLocaleDateString('de-DE', { day: 'numeric', month: 'short' })
}

function istHeute(datum) {
  const h = new Date()
  return datum.toDateString() === h.toDateString()
}

// ─── Termin Block ─────────────────────────────────────────────

function TerminBlock({ stunde, onClick }) {
  const beginn = new Date(stunde.beginn)
  const ende   = stunde.ende ? new Date(stunde.ende) : new Date(beginn.getTime() + 60 * 60 * 1000)

  const startMinuten = (beginn.getHours() - STUNDEN_VON) * 60 + beginn.getMinutes()
  const dauerMinuten = (ende - beginn) / 60000
  const top    = (startMinuten / 60) * SLOT_HOEHE
  const hoehe  = Math.max((dauerMinuten / 60) * SLOT_HOEHE - 2, 20)
  const farbe  = stunde.unterricht?.farbe ?? TYP_FARBE[stunde.unterricht?.typ] ?? 'var(--primary)'

  const istAbgesagt = stunde.status === 'abgesagt'

  return (
    <div onClick={() => onClick(stunde)}
      style={{
        position: 'absolute',
        top: top + 1,
        left: 2,
        right: 2,
        height: hoehe,
        background: istAbgesagt ? 'var(--bg-3)' : farbe,
        borderRadius: 6,
        padding: '4px 6px',
        cursor: 'pointer',
        overflow: 'hidden',
        opacity: istAbgesagt ? 0.5 : 1,
        borderLeft: `3px solid ${istAbgesagt ? 'var(--text-3)' : 'rgba(0,0,0,0.2)'}`,
        transition: 'opacity 0.15s, transform 0.15s',
        boxShadow: '0 1px 4px rgba(0,0,0,0.15)',
      }}>
      <div style={{ fontSize: 11, fontWeight: 700, color: '#fff', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {stunde.unterricht?.name ?? 'Stunde'}
      </div>
      {hoehe > 32 && (
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', marginTop: 2 }}>
          {beginn.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
          {' – '}
          {ende.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' })}
        </div>
      )}
      {istAbgesagt && hoehe > 20 && (
        <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 1 }}>❌ Abgesagt</div>
      )}
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────

function DetailModal({ stunde, onClose }) {
  const beginn = new Date(stunde.beginn)
  const ende   = stunde.ende ? new Date(stunde.ende) : null
  const farbe  = stunde.unterricht?.farbe ?? TYP_FARBE[stunde.unterricht?.typ] ?? 'var(--primary)'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:400, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', overflow:'hidden' }}>
        <div style={{ height:6, background: farbe }} />
        <div style={{ padding:'20px 24px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>{stunde.unterricht?.name}</h3>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:'var(--bg-2)', color:'var(--text-3)', textTransform:'capitalize', marginTop:6, display:'inline-block' }}>
                {stunde.unterricht?.typ}
              </span>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', fontSize:20, cursor:'pointer', color:'var(--text-3)' }}>✕</button>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', gap:10, alignItems:'center', fontSize:14, color:'var(--text-2)' }}>
              <span style={{ fontSize:18 }}>📅</span>
              <div>
                <div style={{ fontWeight:600 }}>
                  {beginn.toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })}
                </div>
                <div style={{ fontSize:13, color:'var(--text-3)' }}>
                  {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr
                  {ende && ` – ${ende.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr`}
                </div>
              </div>
            </div>

            {stunde.unterricht?.raeume && (
              <div style={{ display:'flex', gap:10, alignItems:'center', fontSize:14, color:'var(--text-2)' }}>
                <span style={{ fontSize:18 }}>🏫</span>
                <span>{stunde.unterricht.raeume.name}</span>
              </div>
            )}

            <div style={{ display:'flex', gap:6, alignItems:'center' }}>
              <span style={{ fontSize:14, fontWeight:700, color: stunde.status === 'abgesagt' ? 'var(--danger)' : stunde.status === 'stattgefunden' ? 'var(--success)' : 'var(--text-3)' }}>
                {stunde.status === 'stattgefunden' ? '✅ Stattgefunden' : stunde.status === 'abgesagt' ? '❌ Abgesagt' : '⏳ Geplant'}
              </span>
            </div>

            {stunde.notizen && (
              <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:13, color:'var(--text-2)' }}>
                📝 {stunde.notizen}
              </div>
            )}

            {stunde.hausaufgaben && (
              <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:13, color:'var(--text-2)', border:'1px solid var(--accent)' }}>
                📚 <strong>Hausaufgaben:</strong> {stunde.hausaufgaben}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────

export default function Stundenplan() {
  const { profil, rolle } = useApp()
  const [stunden,    setStunden]    = useState([])
  const [laden,      setLaden]      = useState(true)
  const [woche,      setWoche]      = useState(() => getMontag(new Date()))
  const [ansicht,    setAnsicht]    = useState('woche') // 'woche' | 'liste'
  const [ausgewaehlt, setAusgewaehlt] = useState(null)

  const wocheTage = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(woche)
    d.setDate(d.getDate() + i)
    return d
  })

  const ladeStunden = useCallback(async () => {
    if (!profil) return
    setLaden(true)

    const von = new Date(woche)
    von.setHours(0, 0, 0, 0)
    const bis = new Date(woche)
    bis.setDate(bis.getDate() + 7)
    bis.setHours(23, 59, 59, 999)

    let query = supabase
      .from('stunden')
      .select('*, unterricht(id, name, typ, farbe, raeume(name), unterricht_lehrer(lehrer_id, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name)))')
      .gte('beginn', von.toISOString())
      .lte('beginn', bis.toISOString())
      .order('beginn')

    // Filter je nach Rolle
    if (rolle === 'lehrer') {
      const { data: ul } = await supabase.from('unterricht_lehrer').select('unterricht_id').eq('lehrer_id', profil.id)
      const ids = (ul ?? []).map(u => u.unterricht_id)
      if (ids.length === 0) { setStunden([]); setLaden(false); return }
      query = query.in('unterricht_id', ids)
    } else if (rolle === 'schueler') {
      const { data: us } = await supabase.from('unterricht_schueler').select('unterricht_id').eq('schueler_id', profil.id).eq('status', 'aktiv')
      const ids = (us ?? []).map(u => u.unterricht_id)
      if (ids.length === 0) { setStunden([]); setLaden(false); return }
      query = query.in('unterricht_id', ids)
    } else if (rolle === 'eltern') {
      const { data: kinder } = await supabase.from('eltern_schueler').select('schueler_id').eq('eltern_id', profil.id)
      const kinderIds = (kinder ?? []).map(k => k.schueler_id)
      if (kinderIds.length === 0) { setStunden([]); setLaden(false); return }
      const { data: us } = await supabase.from('unterricht_schueler').select('unterricht_id').in('schueler_id', kinderIds).eq('status', 'aktiv')
      const ids = (us ?? []).map(u => u.unterricht_id)
      if (ids.length === 0) { setStunden([]); setLaden(false); return }
      query = query.in('unterricht_id', ids)
    }

    const { data } = await query
    setStunden(data ?? [])
    setLaden(false)
  }, [profil, woche, rolle])

  useEffect(() => { ladeStunden() }, [ladeStunden])

  function wocheNavigieren(delta) {
    const neu = new Date(woche)
    neu.setDate(neu.getDate() + delta * 7)
    setWoche(getMontag(neu))
  }

  const stundenProTag = wocheTage.map(tag =>
    stunden.filter(st => {
      const b = new Date(st.beginn)
      return b.toDateString() === tag.toDateString()
    })
  )

  const zeitSlots = Array.from({ length: STUNDEN_BIS - STUNDEN_VON }, (_, i) => STUNDEN_VON + i)

  const gesamtHoehe = (STUNDEN_BIS - STUNDEN_VON) * SLOT_HOEHE

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <h1 style={{ margin:0, fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' }}>
          📅 Stundenplan
        </h1>
        <div style={{ display:'flex', gap:8, alignItems:'center' }}>
          <div style={{ display:'flex', gap:4 }}>
            <button onClick={() => setAnsicht('woche')}
              style={{ ...s.filterBtn, ...(ansicht==='woche' ? s.filterBtnAktiv : {}) }}>
              ◫ Woche
            </button>
            <button onClick={() => setAnsicht('liste')}
              style={{ ...s.filterBtn, ...(ansicht==='liste' ? s.filterBtnAktiv : {}) }}>
              ☰ Liste
            </button>
          </div>
        </div>
      </div>

      {/* Wochen-Navigation */}
      <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:20 }}>
        <button onClick={() => wocheNavigieren(-1)} style={s.navBtn}>‹</button>
        <div style={{ flex:1, textAlign:'center' }}>
          <span style={{ fontSize:16, fontWeight:700, color:'var(--text)' }}>
            {formatDatum(wocheTage[0])} – {formatDatum(wocheTage[6])}
          </span>
        </div>
        <button onClick={() => wocheNavigieren(1)} style={s.navBtn}>›</button>
        <button onClick={() => setWoche(getMontag(new Date()))}
          style={{ ...s.navBtn, fontSize:12, padding:'6px 12px', width:'auto' }}>
          Heute
        </button>
      </div>

      {laden ? (
        <div style={s.leer}>Lade Stundenplan …</div>
      ) : ansicht === 'woche' ? (

        // ── WOCHENANSICHT ──────────────────────────────────────
        <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow)' }}>
          {/* Wochentag Header */}
          <div style={{ display:'grid', gridTemplateColumns:`48px repeat(7, 1fr)`, borderBottom:'1px solid var(--border)' }}>
            <div style={{ borderRight:'1px solid var(--border)' }} />
            {wocheTage.map((tag, i) => (
              <div key={i} style={{
                padding:'10px 4px', textAlign:'center',
                borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                background: istHeute(tag) ? 'var(--bg-2)' : 'transparent',
              }}>
                <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase' }}>
                  {WOCHENTAGE[i]}
                </div>
                <div style={{ fontSize:18, fontWeight:800, color: istHeute(tag) ? 'var(--accent)' : 'var(--text)', marginTop:2 }}>
                  {tag.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Zeit-Grid */}
          <div style={{ display:'grid', gridTemplateColumns:`48px repeat(7, 1fr)`, height: gesamtHoehe, overflowY:'auto', position:'relative' }}>
            {/* Zeitachse */}
            <div style={{ borderRight:'1px solid var(--border)', position:'relative' }}>
              {zeitSlots.map(h => (
                <div key={h} style={{ position:'absolute', top: (h - STUNDEN_VON) * SLOT_HOEHE - 8, left:0, right:0, textAlign:'right', paddingRight:6, fontSize:10, color:'var(--text-3)', fontWeight:600 }}>
                  {h}:00
                </div>
              ))}
            </div>

            {/* Tages-Spalten */}
            {wocheTage.map((tag, i) => (
              <div key={i} style={{
                borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                position:'relative',
                height: gesamtHoehe,
                background: istHeute(tag) ? 'rgba(var(--accent-rgb, 99, 102, 241), 0.03)' : 'transparent',
              }}>
                {/* Stunden-Linien */}
                {zeitSlots.map(h => (
                  <div key={h} style={{ position:'absolute', top: (h - STUNDEN_VON) * SLOT_HOEHE, left:0, right:0, borderTop:'1px solid var(--border)', opacity:0.4 }} />
                ))}
                {/* Termine */}
                {stundenProTag[i].map(st => (
                  <TerminBlock key={st.id} stunde={st} onClick={setAusgewaehlt} />
                ))}
                {/* Jetzt-Linie */}
                {istHeute(tag) && (() => {
                  const jetzt = new Date()
                  const min = (jetzt.getHours() - STUNDEN_VON) * 60 + jetzt.getMinutes()
                  if (min < 0 || min > (STUNDEN_BIS - STUNDEN_VON) * 60) return null
                  return (
                    <div style={{ position:'absolute', top: (min / 60) * SLOT_HOEHE, left:0, right:0, height:2, background:'var(--danger)', zIndex:10 }}>
                      <div style={{ position:'absolute', left:-4, top:-4, width:10, height:10, borderRadius:'50%', background:'var(--danger)' }} />
                    </div>
                  )
                })()}
              </div>
            ))}
          </div>
        </div>

      ) : (

        // ── LISTENANSICHT ──────────────────────────────────────
        <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
          {stunden.length === 0 ? (
            <div style={s.leer}>Keine Stunden in dieser Woche.</div>
          ) : stunden.map(st => {
            const beginn = new Date(st.beginn)
            const ende   = st.ende ? new Date(st.ende) : null
            const farbe  = st.unterricht?.farbe ?? TYP_FARBE[st.unterricht?.typ] ?? 'var(--primary)'
            const heute  = istHeute(beginn)
            return (
              <div key={st.id} onClick={() => setAusgewaehlt(st)}
                style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 18px', border:`1px solid ${heute ? 'var(--accent)' : 'var(--border)'}`, display:'flex', gap:14, alignItems:'center', cursor:'pointer', boxShadow:'var(--shadow)' }}>
                <div style={{ width:4, borderRadius:99, alignSelf:'stretch', background: farbe, flexShrink:0 }} />
                <div style={{ textAlign:'center', minWidth:52 }}>
                  <div style={{ fontSize:11, fontWeight:700, color: heute ? 'var(--accent)' : 'var(--text-3)', textTransform:'uppercase' }}>
                    {WOCHENTAGE[beginn.getDay() === 0 ? 6 : beginn.getDay() - 1]}
                  </div>
                  <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>
                    {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}
                  </div>
                  <div style={{ fontSize:11, color:'var(--text-3)' }}>
                    {formatDatum(beginn)}
                  </div>
                </div>
                <div style={{ flex:1 }}>
                  <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{st.unterricht?.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2, display:'flex', gap:10 }}>
                    {ende && `bis ${ende.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr`}
                    {st.unterricht?.raeume && `· 🏫 ${st.unterricht.raeume.name}`}
                  </div>
                </div>
                <span style={{ fontSize:11, fontWeight:700, color: st.status === 'abgesagt' ? 'var(--danger)' : st.status === 'stattgefunden' ? 'var(--success)' : 'var(--text-3)', whiteSpace:'nowrap' }}>
                  {st.status === 'stattgefunden' ? '✅' : st.status === 'abgesagt' ? '❌' : '⏳'}
                </span>
              </div>
            )
          })}
        </div>
      )}

      {ausgewaehlt && <DetailModal stunde={ausgewaehlt} onClose={() => setAusgewaehlt(null)} />}
    </div>
  )
}

const s = {
  navBtn:        { background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', fontSize:18, cursor:'pointer', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', color:'var(--text-2)' },
  filterBtn:     { padding:'7px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--surface)', fontSize:13, cursor:'pointer', fontFamily:'inherit', color:'var(--text-2)' },
  filterBtnAktiv:{ background:'var(--primary)', color:'var(--primary-fg)', borderColor:'var(--primary)' },
  leer:          { padding:'64px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' },
}
