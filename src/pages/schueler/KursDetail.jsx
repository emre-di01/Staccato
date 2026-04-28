import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }

// ─── Audio Player ─────────────────────────────────────────────
function AudioPlayer({ datei }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    supabase.storage.from('stueck-dateien').createSignedUrl(datei.bucket_pfad, 3600)
      .then(({ data }) => setUrl(data?.signedUrl))
  }, [datei.bucket_pfad])
  return (
    <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'12px 16px', border:'1px solid var(--border)' }}>
      <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', marginBottom:8 }}>🎵 {datei.name}</div>
      {url ? <audio controls src={url} style={{ width:'100%' }} /> : <span style={{ color:'var(--text-3)', fontSize:12 }}>…</span>}
    </div>
  )
}

// ─── ChordPro Renderer ────────────────────────────────────────
function ChordPro({ text }) {
  if (!text) return null
  return (
    <div style={{ fontFamily:'monospace', fontSize:14, lineHeight:2, color:'var(--text)' }}>
      {text.split('\n').map((zeile, i) => {
        const teile = zeile.split(/(\[[^\]]+\])/)
        return (
          <div key={i} style={{ minHeight:'1.5em' }}>
            {teile.map((t, j) =>
              t.startsWith('[') && t.endsWith(']')
                ? <strong key={j} style={{ color:'var(--accent)', marginRight:2, fontSize:12 }}>{t.slice(1,-1)}</strong>
                : <span key={j}>{t}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Stück Detail Modal ───────────────────────────────────────
function StueckModal({ stueck, onClose }) {
  const [dateien, setDateien] = useState([])
  const [tab,     setTab]     = useState('text')
  const [laden,   setLaden]   = useState(true)

  useEffect(() => {
    supabase.from('stueck_dateien').select('*').eq('stueck_id', stueck.id).order('hochgeladen_am')
      .then(({ data }) => { setDateien(data ?? []); setLaden(false) })
  }, [stueck.id])

  const notenDateien  = dateien.filter(d => d.typ === 'noten')
  const audioDateien  = dateien.filter(d => d.typ === 'audio')
  const akkordDateien = dateien.filter(d => d.typ === 'akkorde')

  const tabs = [
    { id:'text',    label:'📝 Text',    zeigen: !!stueck.liedtext },
    { id:'akkorde', label:'🎸 Akkorde', zeigen: !!stueck.notizen || akkordDateien.length > 0 },
    { id:'noten',   label:'📄 Noten',   zeigen: notenDateien.length > 0 },
    { id:'audio',   label:'🎵 Audio',   zeigen: audioDateien.length > 0 },
    { id:'youtube', label:'▶️ Video',   zeigen: !!stueck.youtube_url },
  ].filter(t => t.zeigen)

  function youtubeId(url) { return url?.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1] }

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.6)', display:'flex', alignItems:'flex-end', justifyContent:'center', zIndex:1000, padding:0 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg) var(--radius-lg) 0 0', width:'100%', maxWidth:700, maxHeight:'85vh', overflow:'hidden', display:'flex', flexDirection:'column', boxShadow:'var(--shadow-lg)' }}>

        {/* Header */}
        <div style={{ padding:'20px 24px', borderBottom:'1px solid var(--border)', display:'flex', alignItems:'flex-start', justifyContent:'space-between' }}>
          <div>
            <h2 style={{ margin:0, fontSize:20, fontWeight:800, color:'var(--text)' }}>{stueck.titel}</h2>
            <div style={{ fontSize:13, color:'var(--text-3)', marginTop:4, display:'flex', gap:12, flexWrap:'wrap' }}>
              {stueck.komponist && <span>🎼 {stueck.komponist}</span>}
              {stueck.tonart    && <span>🎵 {stueck.tonart}</span>}
              {stueck.tempo     && <span>♩ {stueck.tempo}</span>}
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:22, cursor:'pointer', color:'var(--text-3)', padding:4 }}>✕</button>
        </div>

        {/* Tabs */}
        {tabs.length > 0 && (
          <div style={{ display:'flex', gap:2, borderBottom:'2px solid var(--border)', padding:'0 16px', overflowX:'auto' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding:'10px 14px', background:'none', border:'none', fontSize:13, cursor:'pointer', fontFamily:'inherit', color: tab===t.id ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===t.id ? 800 : 500, borderBottom:`2px solid ${tab===t.id ? 'var(--primary)' : 'transparent'}`, marginBottom:-2, whiteSpace:'nowrap' }}>
                {t.label}
              </button>
            ))}
          </div>
        )}

        {/* Inhalt */}
        <div style={{ flex:1, overflowY:'auto', padding:24 }}>
          {laden ? <div style={{ color:'var(--text-3)' }}>…</div> : (
            <>
              {tab === 'text' && (
                <pre style={{ fontFamily:'Georgia, serif', fontSize:15, lineHeight:1.9, color:'var(--text)', whiteSpace:'pre-wrap', margin:0 }}>
                  {stueck.liedtext}
                </pre>
              )}
              {tab === 'akkorde' && (
                <div>
                  {stueck.notizen && (
                    <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'16px 20px', marginBottom:16 }}>
                      <ChordPro text={stueck.notizen} />
                    </div>
                  )}
                  {akkordDateien.map(d => <AkkordAnzeige key={d.id} datei={d} />)}
                </div>
              )}
              {tab === 'noten' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {notenDateien.map(d => <PdfViewer key={d.id} datei={d} />)}
                </div>
              )}
              {tab === 'audio' && (
                <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
                  {audioDateien.map(d => <AudioPlayer key={d.id} datei={d} />)}
                </div>
              )}
              {tab === 'youtube' && stueck.youtube_url && (
                <iframe width="100%" height={300}
                  src={`https://www.youtube.com/embed/${youtubeId(stueck.youtube_url)}`}
                  title="YouTube" frameBorder="0" allowFullScreen
                  style={{ borderRadius:'var(--radius)' }} />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}

function AkkordAnzeige({ datei }) {
  const [text, setText] = useState(null)
  useEffect(() => {
    supabase.storage.from('stueck-dateien').download(datei.bucket_pfad)
      .then(({ data }) => data?.text().then(setText))
  }, [datei.bucket_pfad])
  return (
    <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'16px', border:'1px solid var(--border)', marginBottom:12 }}>
      <div style={{ fontWeight:600, fontSize:12, color:'var(--text-3)', marginBottom:8 }}>{datei.name}</div>
      {text ? <ChordPro text={text} /> : <span style={{ color:'var(--text-3)' }}>Laden …</span>}
    </div>
  )
}

function PdfViewer({ datei }) {
  const [url, setUrl] = useState(null)
  useEffect(() => {
    supabase.storage.from('stueck-dateien').createSignedUrl(datei.bucket_pfad, 3600)
      .then(({ data }) => setUrl(data?.signedUrl))
  }, [datei.bucket_pfad])
  return (
    <div>
      <div style={{ fontWeight:600, fontSize:13, color:'var(--text)', marginBottom:8 }}>
        📄 {datei.name} {datei.stimme !== 'keine' && <span style={{ color:'var(--text-3)', textTransform:'capitalize' }}>({datei.stimme})</span>}
      </div>
      {url
        ? <iframe src={url} style={{ width:'100%', height:500, borderRadius:'var(--radius)', border:'1px solid var(--border)' }} title={datei.name} />
        : <div style={{ color:'var(--text-3)', fontSize:13 }}>Lädt …</div>
      }
    </div>
  )
}

// ─── Schüler Anwesenheits-Übersicht ──────────────────────────
function SchuelerAnwesenheit({ profil, kursId, stunden }) {
  const { T } = useApp()
  const [anwesenheiten, setAnwesenheiten] = useState([])
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    async function ladeData() {
      const stundenIds = stunden.filter(s => s.status === 'stattgefunden').map(s => s.id)
      if (stundenIds.length === 0) { setLaden(false); return }
      const { data } = await supabase.from('anwesenheit')
        .select('*, stunden(beginn)')
        .eq('schueler_id', profil.id)
        .in('stunde_id', stundenIds)
        .order('stunde_id')
      setAnwesenheiten(data ?? [])
      setLaden(false)
    }
    ladeData()
  }, [profil?.id, stunden])

  const stattgefunden = stunden.filter(s => s.status === 'stattgefunden')
  const anwesend = anwesenheiten.filter(a => a.status === 'anwesend' || a.status === 'zu_spaet').length
  const quote = stattgefunden.length > 0 ? Math.round(100 * anwesend / stattgefunden.length) : null

  const STATUS_ICON = { anwesend:'✅', abwesend:'❌', entschuldigt:'🟡', zu_spaet:'⏰' }

  if (laden) return <div style={{ padding:20, color:'var(--text-3)' }}>{T('loading')}</div>
  if (stattgefunden.length === 0) return <div style={s.leer}>{T('attendance_none_held')}</div>

  return (
    <div>
      {/* Statistik */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(140px, 1fr))', gap:12, marginBottom:20 }}>
        {[
          { label: T('attendance_total_lessons'), wert: stattgefunden.length, farbe:'var(--primary)' },
          { label: T('present'), wert: anwesend, farbe:'var(--success)' },
          { label: T('attendance_rate_label'), wert: quote !== null ? `${quote}%` : '–', farbe: quote >= 80 ? 'var(--success)' : quote >= 60 ? 'var(--warning)' : 'var(--danger)' },
        ].map(item => (
          <div key={item.label} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 16px', border:'1px solid var(--border)', boxShadow:'var(--shadow)' }}>
            <div style={{ fontSize:11, color:'var(--text-3)', fontWeight:600, marginBottom:6 }}>{item.label}</div>
            <div style={{ fontSize:24, fontWeight:800, color: item.farbe }}>{item.wert}</div>
          </div>
        ))}
      </div>

      {/* Liste */}
      <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
        {stattgefunden.map(st => {
          const anw = anwesenheiten.find(a => a.stunde_id === st.id)
          const beginn = new Date(st.beginn)
          return (
            <div key={st.id} style={{ display:'flex', alignItems:'center', gap:14, padding:'12px 16px', borderRadius:'var(--radius)', background:'var(--surface)', border:'1px solid var(--border)' }}>
              <div style={{ textAlign:'center', minWidth:44 }}>
                <div style={{ fontSize:11, color:'var(--text-3)', textTransform:'uppercase', fontWeight:700 }}>
                  {beginn.toLocaleDateString('de-DE', { weekday:'short' })}
                </div>
                <div style={{ fontSize:16, fontWeight:800, color:'var(--text)' }}>
                  {beginn.toLocaleDateString('de-DE', { day:'numeric', month:'short' })}
                </div>
              </div>
              <div style={{ flex:1 }}>
                <div style={{ fontSize:13, color:'var(--text-2)' }}>
                  {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr
                </div>
                {anw?.notiz && <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>📝 {anw.notiz}</div>}
              </div>
              <div style={{ textAlign:'right' }}>
                <span style={{ fontSize:16 }}>{anw ? STATUS_ICON[anw.status] : '–'}</span>
                {anw && <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>{T(anw.status === 'zu_spaet' ? 'late' : anw.status === 'entschuldigt' ? 'excused' : anw.status === 'abwesend' ? 'absent' : 'present')}</div>}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function SchuelerKursDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { profil, T } = useApp()
  const [kurs,     setKurs]     = useState(null)
  const [stuecke,  setStuecke]  = useState([])
  const [dateien,  setDateien]  = useState([])
  const [stunden,  setStunden]  = useState([])
  const [laden,    setLaden]    = useState(true)
  const [tab,      setTab]      = useState('stunden')
  const [stueckModal,   setStueckModal]   = useState(null)
  const [anwesenheiten, setAnwesenheiten] = useState({})

  useEffect(() => {
    if (!profil) return
    async function ladeData() {
      const [k, us, d, st] = await Promise.all([
        supabase.from('unterricht').select('*, instrumente(name_de, icon), raeume(name), unterricht_lehrer(lehrer_id, rolle, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name))').eq('id', id).single(),
        supabase.from('unterricht_stuecke').select('*, stuecke(*, stueck_dateien(typ))').eq('unterricht_id', id).order('reihenfolge'),
        // Kurs-Dateien + eigene Schüler-Dateien
        supabase.from('dateien').select('*')
          .or(`unterricht_id.eq.${id},schueler_id.eq.${profil.id}`)
          .order('hochgeladen_am', { ascending: false }),
        supabase.from('stunden').select('*').eq('unterricht_id', id).order('beginn').gte('beginn', new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()).limit(20),
      ])
      setKurs(k.data)
      setStuecke(us.data ?? [])
      setDateien(d.data ?? [])
      const stundenListe = st.data ?? []
      setStunden(stundenListe)

      // Eigene Anwesenheitseinträge laden
      if (stundenListe.length > 0) {
        const { data: anw } = await supabase
          .from('anwesenheit')
          .select('*')
          .eq('schueler_id', profil.id)
          .in('stunde_id', stundenListe.map(s => s.id))
        const anwMap = Object.fromEntries((anw ?? []).map(a => [a.stunde_id, a]))
        setAnwesenheiten(anwMap)
      }
      setLaden(false)
    }
    ladeData()
  }, [id, profil])

  async function stundeAbsagen(stunde) {
    const vorhanden = anwesenheiten[stunde.id]
    if (vorhanden) {
      await supabase.from('anwesenheit').delete().eq('id', vorhanden.id)
      setAnwesenheiten(prev => { const n = { ...prev }; delete n[stunde.id]; return n })
    } else {
      const { error } = await supabase.from('anwesenheit').insert({
        stunde_id: stunde.id, schueler_id: profil.id, status: 'entschuldigt',
      })
      if (!error) setAnwesenheiten(prev => ({ ...prev, [stunde.id]: { stunde_id: stunde.id, schueler_id: profil.id, status: 'entschuldigt' } }))
    }
  }

  async function dateiHerunterladen(datei) {
    const bucket = datei.schueler_id ? 'schueler-dateien' : 'kurs-dateien'
    const { data } = await supabase.storage.from(bucket).download(datei.bucket_pfad)
    if (data) {
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url; a.download = datei.name; a.click()
      URL.revokeObjectURL(url)
    }
  }

  if (laden) return <div style={{ padding:40, color:'var(--text-3)' }}>{T('loading')}</div>
  if (!kurs)  return <div style={{ padding:40, color:'var(--danger)' }}>{T('kurs_not_found')}</div>

  const jetzt = new Date()

  return (
    <div>
      <button onClick={() => navigate('/schueler/stundenplan')}
        style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 16px' }}>
        ← {T('back')}
      </button>

      {/* Header */}
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', marginBottom:24, boxShadow:'var(--shadow)' }}>
        <div style={{ height:6, background: kurs.farbe ?? 'var(--primary)' }} />
        <div style={{ padding:'20px 24px' }}>
          <div style={{ display:'flex', alignItems:'center', gap:12, marginBottom:8 }}>
            <span style={{ fontSize:28 }}>{TYP_ICON[kurs.typ]}</span>
            <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text)' }}>{kurs.name}</h1>
          </div>
          <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:13, color:'var(--text-2)' }}>
            {kurs.instrumente && <span>{kurs.instrumente.icon} {kurs.instrumente.name_de}</span>}
            {kurs.wochentag   && <span>📅 {kurs.wochentag.toUpperCase()} {kurs.uhrzeit_von?.slice(0,5)}–{kurs.uhrzeit_bis?.slice(0,5)}</span>}
            {kurs.raeume      && <span>🏫 {kurs.raeume.name}</span>}
          </div>
          {kurs.unterricht_lehrer?.length > 0 && (
            <div style={{ marginTop:8, display:'flex', gap:8, flexWrap:'wrap' }}>
              {kurs.unterricht_lehrer.map(ul => (
                <span key={ul.lehrer_id} style={{ fontSize:12, padding:'3px 10px', borderRadius:99, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-2)' }}>
                  👨‍🏫 {ul.profiles?.voller_name}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:2, marginBottom:20, borderBottom:'2px solid var(--border)', overflowX:'auto' }}>
        {[
          ['stunden',     `📅 ${T('schedule_title')}`],
          ['anwesenheit', T('kurs_tab_attendance')],
          ['repertoire',  `🎼 ${T('repertoire_title')} (${stuecke.length})`],
          ['dateien',     `📁 ${T('files')} (${dateien.length})`],
        ].map(([k, l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding:'10px 16px', background:'none', border:'none', fontSize:14, cursor:'pointer', fontFamily:'inherit', color: tab===k ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===k ? 800 : 500, borderBottom:`2px solid ${tab===k ? 'var(--primary)' : 'transparent'}`, marginBottom:-2, whiteSpace:'nowrap' }}>
            {l}
          </button>
        ))}
      </div>

      {/* STUNDENPLAN */}
      {tab === 'stunden' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {stunden.length === 0 ? (
            <div style={s.leer}>{T('kurs_no_lessons_found')}</div>
          ) : stunden.map(st => {
            const beginn      = new Date(st.beginn)
            const istHeute    = beginn.toDateString() === jetzt.toDateString()
            const anw         = anwesenheiten[st.id]
            const istAbgesagt = anw?.status === 'entschuldigt'
            const kannAbsagen = st.status === 'geplant' && beginn > jetzt
            return (
                  <div key={st.id} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 18px', border:`1px solid ${istHeute ? 'var(--accent)' : istAbgesagt ? 'var(--warning)' : 'var(--border)'}`, display:'flex', gap:14, alignItems:'center' }}>
                    <div style={{ textAlign:'center', minWidth:52 }}>
                      <div style={{ fontSize:11, fontWeight:700, color: istHeute ? 'var(--accent)' : 'var(--text-3)', textTransform:'uppercase' }}>
                        {istHeute ? T('dash_today') : beginn.toLocaleDateString('de-DE', { weekday:'short' })}
                      </div>
                      <div style={{ fontSize:18, fontWeight:800, color:'var(--text)' }}>
                        {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}
                      </div>
                      <div style={{ fontSize:11, color:'var(--text-3)' }}>
                        {beginn.toLocaleDateString('de-DE', { day:'numeric', month:'short' })}
                      </div>
                    </div>
                    <div style={{ flex:1 }}>
                      <div style={{ fontSize:12, color: st.status === 'abgesagt' ? 'var(--danger)' : st.status === 'stattgefunden' ? 'var(--success)' : istAbgesagt ? 'var(--warning)' : 'var(--text-3)' }}>
                        {st.status === 'stattgefunden' ? T('kurs_status_done') : st.status === 'abgesagt' ? T('kurs_status_cancelled') : istAbgesagt ? `🟡 ${T('excused')}` : T('kurs_status_planned')}
                      </div>
                      {st.hausaufgaben && (
                        <div style={{ fontSize:13, color:'var(--text-2)', marginTop:4, background:'var(--bg-2)', padding:'6px 10px', borderRadius:8 }}>
                          📝 {st.hausaufgaben}
                        </div>
                      )}
                    </div>
                    {kannAbsagen && (
                      <button onClick={() => stundeAbsagen(st)}
                        style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:`1.5px solid ${istAbgesagt ? 'var(--warning)' : 'var(--border)'}`, background: istAbgesagt ? 'var(--warning)' : 'var(--bg-2)', color: istAbgesagt ? '#fff' : 'var(--text-2)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                        {istAbgesagt ? T('lesson_excuse_undo') : T('lesson_excuse')}
                      </button>
                    )}
                  </div>
            )
          })}
        </div>
      )}

      {/* ANWESENHEIT */}
      {tab === 'anwesenheit' && (
        <SchuelerAnwesenheit profil={profil} kursId={id} stunden={stunden} />
      )}

      {/* REPERTOIRE */}
      {tab === 'repertoire' && (
        <div>
          {stuecke.length === 0 ? (
            <div style={s.leer}>{T('repertoire_no_pieces')}</div>
          ) : (
            <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(240px, 1fr))', gap:12 }}>
              {stuecke.map(us => {
                const st = us.stuecke
                const typen = [...new Set((st.stueck_dateien ?? []).map(d => d.typ))]
                return (
                  <div key={us.stueck_id} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', padding:'16px', cursor:'pointer', boxShadow:'var(--shadow)', transition:'box-shadow 0.15s' }}
                    onClick={() => setStueckModal(st)}>
                    <div style={{ fontWeight:800, fontSize:15, color:'var(--text)', marginBottom:4 }}>{st.titel}</div>
                    {st.komponist && <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:10 }}>{st.komponist}</div>}
                    <div style={{ display:'flex', gap:4, marginBottom:10 }}>
                      {st.tonart && <span style={s.chip}>🎵 {st.tonart}</span>}
                      {st.tempo  && <span style={s.chip}>♩ {st.tempo}</span>}
                    </div>
                    <div style={{ display:'flex', gap:4 }}>
                      {st.liedtext              && <span title="Liedtext" style={s.mediaIcon}>📝</span>}
                      {st.notizen               && <span title="Akkorde"  style={s.mediaIcon}>🎸</span>}
                      {typen.includes('noten')  && <span title="Noten"    style={s.mediaIcon}>📄</span>}
                      {typen.includes('audio')  && <span title="Audio"    style={s.mediaIcon}>🎵</span>}
                      {st.youtube_url           && <span title="YouTube"  style={s.mediaIcon}>▶️</span>}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      )}

      {/* DATEIEN */}
      {tab === 'dateien' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {dateien.length === 0 ? (
            <div style={s.leer}>{T('no_data')}</div>
          ) : dateien.map(d => (
            <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px', borderRadius:'var(--radius)', background:'var(--surface)', border:'1px solid var(--border)', boxShadow:'var(--shadow)' }}>
              <span style={{ fontSize:22 }}>
                {d.typ === 'noten' ? '📄' : d.typ === 'audio' ? '🎵' : d.typ === 'akkorde' ? '🎸' : '📋'}
              </span>
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{d.name}</div>
                <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                  {d.schueler_id ? T('file_only_for_you') : T('file_for_all')}
                  {' · '}{new Date(d.hochgeladen_am).toLocaleDateString('de-DE')}
                </div>
              </div>
              <button onClick={() => dateiHerunterladen(d)}
                style={{ padding:'7px 14px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                ⬇ {T('download')}
              </button>
            </div>
          ))}
        </div>
      )}

      {stueckModal && <StueckModal stueck={stueckModal} onClose={() => setStueckModal(null)} />}
    </div>
  )
}

const s = {
  leer:      { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' },
  chip:      { fontSize:12, padding:'2px 8px', borderRadius:99, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-3)' },
  mediaIcon: { fontSize:16 },
}
