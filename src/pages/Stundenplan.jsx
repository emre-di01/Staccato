import { useState, useEffect, useRef, useCallback } from 'react'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { useIsMobile } from '../hooks/useWindowWidth'

function zeitInTZ(date, tz) {
  const fmt = new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: tz })
  const [h, m] = fmt.format(date).split(':').map(Number)
  return { h, m }
}

function zeitStr(date, tz) {
  return new Intl.DateTimeFormat('de-DE', { hour: '2-digit', minute: '2-digit', timeZone: tz }).format(date)
}

const STUNDEN_VON = 7
const STUNDEN_BIS = 22   // bis 22:00 Uhr
const SLOT_HOEHE  = 60   // px pro Stunde

const WOCHENTAGE      = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So']
const WOCHENTAGE_LANG = ['Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag','Sonntag']

const TYP_FARBE = {
  einzel:   '#3b82f6',
  gruppe:   '#8b5cf6',
  chor:     '#ec4899',
  ensemble: '#10b981',
}

const EVENT_TYP_FARBE = { konzert:'#f59e0b', vorspiel:'#8b5cf6', pruefung:'#ef4444', veranstaltung:'#10b981', vorstandssitzung:'#7c3aed', sonstiges:'#6b7280' }
const EVENT_TYP_ICON  = { konzert:'🎵', vorspiel:'🎤', pruefung:'📝', veranstaltung:'🎭', vorstandssitzung:'🏛', sonstiges:'📅' }

// ─── Hilfsfunktionen ─────────────────────────────────────────
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
  return datum.toDateString() === new Date().toDateString()
}

// ─── Termin Block ─────────────────────────────────────────────
function TerminBlock({ stunde, onClick, tz }) {
  const beginn = new Date(stunde.beginn)
  const ende   = stunde.ende ? new Date(stunde.ende) : new Date(beginn.getTime() + 60 * 60 * 1000)

  const { h, m } = zeitInTZ(beginn, tz)
  const startMin  = (h - STUNDEN_VON) * 60 + m
  const dauerMin  = (ende - beginn) / 60000
  const top       = (startMin / 60) * SLOT_HOEHE
  const hoehe     = Math.max((dauerMin / 60) * SLOT_HOEHE - 2, 20)
  const farbe     = stunde.unterricht?.farbe ?? TYP_FARBE[stunde.unterricht?.typ] ?? 'var(--primary)'
  const abgesagt  = stunde.status === 'abgesagt'

  return (
    <div onClick={() => onClick(stunde)}
      style={{ position:'absolute', top:top+1, left:2, right:2, height:hoehe,
        background: abgesagt ? 'var(--bg-3)' : farbe,
        borderRadius:6, padding:'3px 5px', cursor:'pointer', overflow:'hidden',
        opacity: abgesagt ? 0.5 : 1,
        borderLeft:`3px solid ${abgesagt ? 'var(--text-3)' : 'rgba(0,0,0,0.2)'}`,
        boxShadow:'0 1px 4px rgba(0,0,0,0.15)', userSelect:'none',
      }}>
      <div style={{ fontSize:11, fontWeight:700, color:'#fff', lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {stunde.unterricht?.name ?? 'Stunde'}
      </div>
      {hoehe > 32 && (
        <div style={{ fontSize:10, color:'rgba(255,255,255,0.8)', marginTop:2 }}>
          {zeitStr(beginn, tz)}–{zeitStr(ende, tz)}
        </div>
      )}
      {abgesagt && hoehe > 20 && (
        <div style={{ fontSize:9, color:'rgba(255,255,255,0.7)', marginTop:1 }}>❌</div>
      )}
    </div>
  )
}

// ─── Event Block ──────────────────────────────────────────────
function EventBlock({ event, onClick, tz }) {
  const beginn   = new Date(event.beginn)
  const ende     = event.ende ? new Date(event.ende) : new Date(beginn.getTime() + 60 * 60 * 1000)
  const { h, m } = zeitInTZ(beginn, tz)
  const startMin = (h - STUNDEN_VON) * 60 + m
  const dauerMin = (ende - beginn) / 60000
  const top      = (startMin / 60) * SLOT_HOEHE
  const hoehe    = Math.max((dauerMin / 60) * SLOT_HOEHE - 2, 20)
  const farbe    = EVENT_TYP_FARBE[event.typ] ?? '#6b7280'

  return (
    <div onClick={() => onClick(event)}
      style={{ position:'absolute', top:top+1, left:2, right:2, height:hoehe,
        background:`color-mix(in srgb, ${farbe} 25%, var(--surface))`,
        border:`1.5px solid ${farbe}`,
        borderRadius:6, padding:'3px 5px', cursor:'pointer', overflow:'hidden', zIndex:6,
        boxShadow:'0 1px 3px rgba(0,0,0,0.1)', userSelect:'none',
      }}>
      <div style={{ fontSize:11, fontWeight:700, color:farbe, lineHeight:1.2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
        {EVENT_TYP_ICON[event.typ]} {event.titel}
      </div>
      {hoehe > 32 && (
        <div style={{ fontSize:10, color:farbe, opacity:0.8, marginTop:2 }}>
          {zeitStr(beginn, tz)}–{zeitStr(ende, tz)}
        </div>
      )}
    </div>
  )
}

// ─── Detail Modal ─────────────────────────────────────────────
function DetailModal({ stunde, onClose, tz }) {
  const { T } = useApp()
  const beginn = new Date(stunde.beginn)
  const ende   = stunde.ende ? new Date(stunde.ende) : null
  const farbe  = stunde.unterricht?.farbe ?? TYP_FARBE[stunde.unterricht?.typ] ?? 'var(--primary)'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:1000, padding:'0' }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg) var(--radius-lg) 0 0', width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', overflow:'hidden', margin:'0 auto' }}>
        <div style={{ height:5, background:farbe }} />
        <div style={{ padding:'20px 24px 32px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:16 }}>
            <div>
              <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>{stunde.unterricht?.name}</h3>
              <span style={{ fontSize:11, padding:'2px 8px', borderRadius:99, background:'var(--bg-2)', color:'var(--text-3)', textTransform:'capitalize', marginTop:6, display:'inline-block' }}>
                {stunde.unterricht?.typ}
              </span>
            </div>
            <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--text-3)', padding:0, lineHeight:1 }}>✕</button>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <div style={{ display:'flex', gap:10, alignItems:'center', fontSize:14, color:'var(--text-2)' }}>
              <span style={{ fontSize:18 }}>📅</span>
              <div>
                <div style={{ fontWeight:600 }}>{beginn.toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })}</div>
                <div style={{ fontSize:13, color:'var(--text-3)' }}>
                  {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', timeZone: tz })} Uhr
                  {ende && ` – ${ende.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', timeZone: tz })} Uhr`}
                </div>
              </div>
            </div>
            {stunde.unterricht?.raeume && (
              <div style={{ display:'flex', gap:10, alignItems:'center', fontSize:14, color:'var(--text-2)' }}>
                <span style={{ fontSize:18 }}>🏫</span>
                <span>{stunde.unterricht.raeume.name}</span>
              </div>
            )}
            <div style={{ fontSize:14, fontWeight:700, color: stunde.status === 'abgesagt' ? 'var(--danger)' : stunde.status === 'stattgefunden' ? 'var(--success)' : 'var(--text-3)' }}>
              {stunde.status === 'stattgefunden' ? T('schedule_status_done') : stunde.status === 'abgesagt' ? T('schedule_status_cancelled') : T('schedule_status_planned')}
            </div>
            {stunde.notizen && (
              <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:13, color:'var(--text-2)' }}>
                📝 {stunde.notizen}
              </div>
            )}
            {stunde.hausaufgaben && (
              <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'10px 14px', fontSize:13, color:'var(--text-2)', border:'1px solid var(--accent)' }}>
                📚 <strong>{T('schedule_homework')}</strong> {stunde.hausaufgaben}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Event Detail Modal ───────────────────────────────────────
function EventDetailModal({ event, onClose, tz }) {
  const beginn = new Date(event.beginn)
  const ende   = event.ende ? new Date(event.ende) : null
  const farbe  = EVENT_TYP_FARBE[event.typ] ?? '#6b7280'

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:1000, display:'flex', alignItems:'flex-end', justifyContent:'center' }}
      onClick={onClose}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg) var(--radius-lg) 0 0', padding:'20px 24px 32px', width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', margin:'0 auto' }}
        onClick={e => e.stopPropagation()}>
        <div style={{ display:'flex', gap:12, alignItems:'flex-start', marginBottom:16 }}>
          <div style={{ width:4, borderRadius:99, alignSelf:'stretch', background:farbe, flexShrink:0 }} />
          <div style={{ flex:1 }}>
            <div style={{ fontSize:12, fontWeight:700, color:farbe, textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:4 }}>
              {EVENT_TYP_ICON[event.typ]} {event.typ}
            </div>
            <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>{event.titel}</h3>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--text-3)', padding:0, lineHeight:1 }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:8, fontSize:14, color:'var(--text-2)' }}>
          <div>📅 {beginn.toLocaleDateString('de-DE', { weekday:'long', day:'2-digit', month:'long', year:'numeric' })}</div>
          <div>🕐 {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', timeZone: tz })} Uhr
            {ende && ` – ${ende.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', timeZone: tz })} Uhr`}
          </div>
          {event.ort && <div>📍 {event.ort}</div>}
          {event.beschreibung && <div style={{ marginTop:4, color:'var(--text-3)', lineHeight:1.5 }}>{event.beschreibung}</div>}
          {event.oeffentlich && <div style={{ fontSize:12, color:'var(--accent)', fontWeight:600 }}>🌐 Öffentliche Veranstaltung</div>}
        </div>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function Stundenplan() {
  const { profil, rolle, T, zeitzone } = useApp()
  const location = useLocation()
  const tz = zeitzone || 'Europe/Berlin'
  const mob = useIsMobile()
  // Admin unter /lehrer/* → eigene Kurse wie ein Lehrer anzeigen
  const alsLehrer = rolle === 'lehrer' || location.pathname.startsWith('/lehrer')

  const [stunden,          setStunden]          = useState([])
  const [events,           setEvents]           = useState([])
  const [laden,            setLaden]            = useState(true)
  const [woche,            setWoche]            = useState(() => getMontag(new Date()))
  const [ansicht,          setAnsicht]          = useState(() => mob ? 'liste' : 'woche')
  const [ausgewaehlt,      setAusgewaehlt]      = useState(null)
  const [ausgewaehltEvent, setAusgewaehltEvent] = useState(null)

  const scrollRef = useRef(null)

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

    if (alsLehrer) {
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

    const { data: evData } = await supabase
      .from('events').select('*')
      .gte('beginn', von.toISOString())
      .lte('beginn', bis.toISOString())
      .order('beginn')
    setEvents(evData ?? [])
    setLaden(false)
  }, [profil, woche, rolle])

  useEffect(() => { ladeStunden() }, [ladeStunden])

  // Nach Laden zur aktuellen Zeit scrollen
  useEffect(() => {
    if (!laden && ansicht === 'woche' && scrollRef.current) {
      const jetzt = new Date()
      const min   = (jetzt.getHours() - STUNDEN_VON) * 60 + jetzt.getMinutes()
      const ziel  = Math.max(0, (min / 60) * SLOT_HOEHE - 80)
      scrollRef.current.scrollTop = ziel
    }
  }, [laden, ansicht])

  function wocheNavigieren(delta) {
    const neu = new Date(woche)
    neu.setDate(neu.getDate() + delta * 7)
    setWoche(getMontag(neu))
  }

  const stundenProTag = wocheTage.map(tag =>
    stunden.filter(st => new Date(st.beginn).toDateString() === tag.toDateString())
  )
  const eventsProTag = wocheTage.map(tag =>
    events.filter(ev => new Date(ev.beginn).toDateString() === tag.toDateString())
  )

  const zeitSlots    = Array.from({ length: STUNDEN_BIS - STUNDEN_VON + 1 }, (_, i) => STUNDEN_VON + i)
  const gesamtHoehe  = (STUNDEN_BIS - STUNDEN_VON) * SLOT_HOEHE

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16, flexWrap:'wrap', gap:10 }}>
        <h1 style={{ margin:0, fontSize: mob ? 22 : 26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' }}>
          📅 {T('schedule_title')}
        </h1>
        <div style={{ display:'flex', gap:6 }}>
          <button onClick={() => setAnsicht('woche')}
            style={{ ...s.filterBtn, ...(ansicht==='woche' ? s.filterBtnAktiv : {}) }}>
            {T('schedule_week_view')}
          </button>
          <button onClick={() => setAnsicht('liste')}
            style={{ ...s.filterBtn, ...(ansicht==='liste' ? s.filterBtnAktiv : {}) }}>
            {T('schedule_list_view')}
          </button>
        </div>
      </div>

      {/* Wochen-Navigation */}
      <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:16 }}>
        <button onClick={() => wocheNavigieren(-1)} style={s.navBtn}>‹</button>
        <div style={{ flex:1, textAlign:'center' }}>
          <span style={{ fontSize: mob ? 14 : 16, fontWeight:700, color:'var(--text)' }}>
            {formatDatum(wocheTage[0])} – {formatDatum(wocheTage[6])}
          </span>
        </div>
        <button onClick={() => wocheNavigieren(1)} style={s.navBtn}>›</button>
        <button onClick={() => setWoche(getMontag(new Date()))}
          style={{ ...s.navBtn, fontSize:12, padding:'6px 10px', width:'auto' }}>
          {T('schedule_today')}
        </button>
      </div>

      {laden ? (
        <div style={s.leer}>{T('schedule_loading')}</div>
      ) : ansicht === 'woche' ? (

        // ── WOCHENANSICHT ──────────────────────────────────────
        <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow)' }}>

          {/* Wochentag Header – sticky beim Scrollen des Grids */}
          <div style={{ display:'grid', gridTemplateColumns:`44px repeat(7, 1fr)`, borderBottom:'2px solid var(--border)', position:'sticky', top:0, zIndex:20, background:'var(--surface)' }}>
            <div style={{ borderRight:'1px solid var(--border)' }} />
            {wocheTage.map((tag, i) => (
              <div key={i} style={{
                padding: mob ? '8px 2px' : '10px 4px', textAlign:'center',
                borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                background: istHeute(tag) ? 'var(--bg-2)' : 'transparent',
              }}>
                <div style={{ fontSize:10, fontWeight:700, color: istHeute(tag) ? 'var(--accent)' : 'var(--text-3)', textTransform:'uppercase' }}>
                  {WOCHENTAGE[i]}
                </div>
                <div style={{ fontSize: mob ? 15 : 18, fontWeight:800, color: istHeute(tag) ? 'var(--accent)' : 'var(--text)', marginTop:1 }}>
                  {tag.getDate()}
                </div>
              </div>
            ))}
          </div>

          {/* Scrollbares Zeit-Grid – eigener Scroll, kein Seiten-Scroll */}
          <div ref={scrollRef}
            style={{ height: mob ? 'calc(100vh - 210px)' : 'calc(100vh - 260px)', overflowY:'scroll', position:'relative', WebkitOverflowScrolling:'touch' }}>
            <div style={{ display:'grid', gridTemplateColumns:`44px repeat(7, 1fr)`, height:gesamtHoehe, position:'relative' }}>

              {/* Zeitachse */}
              <div style={{ borderRight:'1px solid var(--border)', position:'relative', background:'var(--surface)', zIndex:1 }}>
                {zeitSlots.map(h => (
                  <div key={h} style={{ position:'absolute', top:(h - STUNDEN_VON) * SLOT_HOEHE - 8, left:0, right:0, textAlign:'right', paddingRight:5, fontSize:10, color:'var(--text-3)', fontWeight:600 }}>
                    {h < 10 ? '0' : ''}{h}:00
                  </div>
                ))}
              </div>

              {/* Tages-Spalten */}
              {wocheTage.map((tag, i) => (
                <div key={i} style={{
                  borderRight: i < 6 ? '1px solid var(--border)' : 'none',
                  position:'relative',
                  height: gesamtHoehe,
                  background: istHeute(tag) ? 'rgba(99,102,241,0.03)' : 'transparent',
                }}>
                  {/* Stunden-Linien */}
                  {zeitSlots.map(h => (
                    <div key={h} style={{ position:'absolute', top:(h - STUNDEN_VON) * SLOT_HOEHE, left:0, right:0, borderTop:'1px solid var(--border)', opacity:0.35 }} />
                  ))}
                  {/* Halbe Stunden – dünner */}
                  {zeitSlots.map(h => (
                    <div key={'h' + h} style={{ position:'absolute', top:(h - STUNDEN_VON) * SLOT_HOEHE + SLOT_HOEHE / 2, left:0, right:0, borderTop:'1px dashed var(--border)', opacity:0.2 }} />
                  ))}
                  {/* Termine */}
                  {stundenProTag[i].map(st => (
                    <TerminBlock key={st.id} stunde={st} onClick={setAusgewaehlt} tz={tz} />
                  ))}
                  {/* Events */}
                  {eventsProTag[i].map(ev => (
                    <EventBlock key={ev.id} event={ev} onClick={setAusgewaehltEvent} tz={tz} />
                  ))}
                  {/* Jetzt-Linie */}
                  {istHeute(tag) && (() => {
                    const jetzt = new Date()
                    const min = (jetzt.getHours() - STUNDEN_VON) * 60 + jetzt.getMinutes()
                    if (min < 0 || min > (STUNDEN_BIS - STUNDEN_VON) * 60) return null
                    return (
                      <div style={{ position:'absolute', top:(min / 60) * SLOT_HOEHE, left:0, right:0, height:2, background:'var(--danger)', zIndex:10, pointerEvents:'none' }}>
                        <div style={{ position:'absolute', left:-3, top:-4, width:8, height:8, borderRadius:'50%', background:'var(--danger)' }} />
                      </div>
                    )
                  })()}
                </div>
              ))}
            </div>
          </div>
        </div>

      ) : (

        // ── LISTENANSICHT ──────────────────────────────────────
        (() => {
          const alleTermine = [
            ...stunden.map(st => ({ ...st, _typ:'stunde' })),
            ...events.map(ev => ({ ...ev, _typ:'event' })),
          ].sort((a, b) => new Date(a.beginn) - new Date(b.beginn))

          if (alleTermine.length === 0) return <div style={s.leer}>{T('schedule_no_events')}</div>

          let letzterTag = null
          return (
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              {alleTermine.map(item => {
                const beginn = new Date(item.beginn)
                const tagKey = beginn.toDateString()
                const neuerTag = tagKey !== letzterTag
                letzterTag = tagKey

                const TagTrenner = neuerTag ? (
                  <div key={'tag-' + tagKey} style={{ padding:'10px 4px 4px', fontSize:12, fontWeight:800, color: istHeute(beginn) ? 'var(--accent)' : 'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                    {istHeute(beginn) ? `● ${T('schedule_today')}` : ''} {beginn.toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })}
                  </div>
                ) : null

                let Karte
                if (item._typ === 'event') {
                  const farbe = EVENT_TYP_FARBE[item.typ] ?? '#6b7280'
                  Karte = (
                    <div key={'ev-' + item.id} onClick={() => setAusgewaehltEvent(item)}
                      style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 16px', border:`1.5px solid ${istHeute(beginn) ? farbe : 'var(--border)'}`, display:'flex', gap:12, alignItems:'center', cursor:'pointer', boxShadow:'var(--shadow)' }}>
                      <div style={{ width:4, borderRadius:99, alignSelf:'stretch', background:farbe, flexShrink:0 }} />
                      <div style={{ textAlign:'center', minWidth:44 }}>
                        <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>
                          {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', timeZone: tz })}
                        </div>
                        {item.ende && <div style={{ fontSize:11, color:'var(--text-3)' }}>{new Date(item.ende).toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', timeZone: tz })}</div>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                          {EVENT_TYP_ICON[item.typ]} {item.titel}
                        </div>
                        {item.ort && <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>📍 {item.ort}</div>}
                      </div>
                      {item.oeffentlich && <span style={{ fontSize:11, color:'var(--accent)', fontWeight:700, flexShrink:0 }}>🌐</span>}
                    </div>
                  )
                } else {
                  const farbe = item.unterricht?.farbe ?? TYP_FARBE[item.unterricht?.typ] ?? 'var(--primary)'
                  const ende  = item.ende ? new Date(item.ende) : null
                  Karte = (
                    <div key={'st-' + item.id} onClick={() => setAusgewaehlt(item)}
                      style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 16px', border:`1.5px solid ${istHeute(beginn) ? 'var(--accent)' : 'var(--border)'}`, display:'flex', gap:12, alignItems:'center', cursor:'pointer', boxShadow:'var(--shadow)' }}>
                      <div style={{ width:4, borderRadius:99, alignSelf:'stretch', background:farbe, flexShrink:0 }} />
                      <div style={{ textAlign:'center', minWidth:44 }}>
                        <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>
                          {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', timeZone: tz })}
                        </div>
                        {ende && <div style={{ fontSize:11, color:'var(--text-3)' }}>{ende.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit', timeZone: tz })}</div>}
                      </div>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{item.unterricht?.name}</div>
                        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                          {item.unterricht?.raeume ? `🏫 ${item.unterricht.raeume.name}` : ''}
                        </div>
                      </div>
                      <span style={{ fontSize:13, fontWeight:700, flexShrink:0, color: item.status === 'abgesagt' ? 'var(--danger)' : item.status === 'stattgefunden' ? 'var(--success)' : 'var(--text-3)' }}>
                        {item.status === 'stattgefunden' ? '✅' : item.status === 'abgesagt' ? '❌' : '⏳'}
                      </span>
                    </div>
                  )
                }

                return [TagTrenner, Karte]
              })}
            </div>
          )
        })()
      )}

      {ausgewaehlt      && <DetailModal       stunde={ausgewaehlt}      onClose={() => setAusgewaehlt(null)}      tz={tz} />}
      {ausgewaehltEvent && <EventDetailModal  event={ausgewaehltEvent}  onClose={() => setAusgewaehltEvent(null)} tz={tz} />}
    </div>
  )
}

const s = {
  navBtn:        { background:'var(--surface)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', fontSize:18, cursor:'pointer', width:36, height:36, display:'flex', alignItems:'center', justifyContent:'center', fontFamily:'inherit', color:'var(--text-2)' },
  filterBtn:     { padding:'7px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--surface)', fontSize:13, cursor:'pointer', fontFamily:'inherit', color:'var(--text-2)' },
  filterBtnAktiv:{ background:'var(--primary)', color:'var(--primary-fg)', borderColor:'var(--primary)' },
  leer:          { padding:'64px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' },
}
