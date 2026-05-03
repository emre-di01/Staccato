import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { marked } from 'marked'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import QRCode from 'qrcode'

function getYouTubeId(url) {
  const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?]+)/)
  return m?.[1] ?? ''
}

function ChordPro({ text }) {
  if (!text) return null
  return (
    <div style={{ fontFamily: 'monospace', fontSize: 14, lineHeight: 2, color: 'var(--text)' }}>
      {text.split('\n').map((zeile, i) => {
        const teile = zeile.split(/(\[[^\]]+\])/)
        return (
          <div key={i} style={{ minHeight: '1.5em' }}>
            {teile.map((t, j) =>
              t.startsWith('[') && t.endsWith(']')
                ? <strong key={j} style={{ color: 'var(--accent)', marginRight: 2, fontSize: 12 }}>{t.slice(1, -1)}</strong>
                : <span key={j}>{t}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function PdfInline({ pfad }) {
  const [url, setUrl] = useState(null)
  const [laden, setLaden] = useState(true)
  useEffect(() => {
    supabase.storage.from('stueck-dateien').createSignedUrl(pfad, 3600)
      .then(({ data }) => { setUrl(data?.signedUrl ?? null); setLaden(false) })
  }, [pfad])
  if (laden) return <div style={{ padding: 16, textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>Lädt …</div>
  if (!url)  return <div style={{ padding: 16, textAlign: 'center', color: 'var(--danger)', fontSize: 13 }}>Nicht verfügbar</div>
  return (
    <div>
      <iframe src={url} style={{ width: '100%', height: 480, border: 'none', borderRadius: 'var(--radius)', display: 'block' }} title="Noten" />
      <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--primary)', fontWeight: 600, textAlign: 'right' }}>↗ In neuem Tab öffnen</a>
    </div>
  )
}

const REAKTION = {
  daumen_hoch:   '👍',
  daumen_runter: '👎',
  hand_hoch:     '✋',
  herz:          '❤️',
  verwirrung:    '😕',
}

const ANSICHT = {
  noten:           { icon: '📄', label: 'Noten' },
  liedtext:        { icon: '📝', label: 'Liedtext' },
  akkorde:         { icon: '🎸', label: 'Akkorde' },
  youtube:         { icon: '▶️', label: 'YouTube' },
  dateiverwaltung: { icon: '📂', label: 'Dateien' },
}

function VorschauPlatzhalter({ ansicht }) {
  const info = ANSICHT[ansicht] ?? { icon: '🎵', label: ansicht }
  return (
    <div style={{ padding: '24px 16px', textAlign: 'center', color: 'var(--text-3)', fontSize: 13 }}>
      <div style={{ fontSize: 24, marginBottom: 6 }}>{info.icon}</div>
      Kein Inhalt für <strong>{info.label}</strong>
    </div>
  )
}

export default function Unterrichtsmodus() {
  const { id: kursId } = useParams()
  const navigate = useNavigate()
  const { profil, T } = useApp()

  const [phase, setPhase] = useState('start') // start | lobby | aktiv | beendet
  const [kurs, setKurs] = useState(null)
  const [stunden, setStunden] = useState([])
  const [gewaehlteStunde, setGewaehlteStunde] = useState('')
  const [session, setSession] = useState(null)
  const [qrUrl, setQrUrl] = useState('')
  const [teilnehmer, setTeilnehmer] = useState([])
  const [reaktionen, setReaktionen] = useState([])
  const [stuecke, setStuecke] = useState([])
  const [aktiveStueckId, setAktiveStueckId] = useState(null)
  const [aktiveAnsicht, setAktiveAnsicht] = useState('noten')
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')
  const channelRef = useRef(null)

  useEffect(() => {
    async function init() {
      const { data: k } = await supabase
        .from('unterricht')
        .select('id, name, typ, instrumente(name_de, icon)')
        .eq('id', kursId)
        .single()
      setKurs(k)

      const heute = new Date().toISOString().slice(0, 10)
      const { data: h } = await supabase
        .from('stunden')
        .select('id, beginn, ende')
        .eq('unterricht_id', kursId)
        .gte('beginn', `${heute}T00:00:00`)
        .lte('beginn', `${heute}T23:59:59`)
        .order('beginn')
      setStunden(h ?? [])
      if (h?.length > 0) setGewaehlteStunde(h[0].id)

      const { data: us } = await supabase
        .from('unterricht_stuecke')
        .select('stuecke(id, titel, komponist, youtube_url, liedtext, notizen, stueck_dateien(id, typ, name, bucket_pfad, stimme))')
        .eq('unterricht_id', kursId)
      setStuecke((us ?? []).map(u => u.stuecke).filter(Boolean))
    }
    init()
  }, [kursId])

  // Verpasste Realtime-Updates nachholen wenn App aus dem Hintergrund zurückkommt
  useEffect(() => {
    if (!session) return
    function handleVisibility() {
      if (document.visibilityState === 'visible') ladeTeilnehmer(session.id)
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [session])

  useEffect(() => {
    if (!session) return
    ladeTeilnehmer(session.id)
    const ch = supabase.channel(`session-lehrer-${session.id}`)
      .on('postgres_changes', {
        event: '*', schema: 'public', table: 'session_teilnehmer',
        filter: `session_id=eq.${session.id}`,
      }, () => ladeTeilnehmer(session.id))
      .on('postgres_changes', {
        event: 'INSERT', schema: 'public', table: 'session_reaktionen',
        filter: `session_id=eq.${session.id}`,
      }, payload => setReaktionen(prev => [payload.new, ...prev].slice(0, 100)))
      .subscribe()
    channelRef.current = ch
    return () => ch.unsubscribe()
  }, [session])

  async function ladeTeilnehmer(sessionId) {
    const { data } = await supabase
      .from('session_teilnehmer')
      .select('profil_id, beigetreten_am, profiles(voller_name)')
      .eq('session_id', sessionId)
    setTeilnehmer(data ?? [])
  }

  async function sessionStarten() {
    setLaden(true); setFehler('')
    const { data, error } = await supabase.rpc('session_starten', {
      p_unterricht_id: kursId,
      p_stunde_id: gewaehlteStunde || null,
    })
    if (error || !data?.[0]) {
      setFehler(error?.message ?? 'Fehler beim Starten'); setLaden(false); return
    }
    const { session_id, join_code } = data[0]
    const joinUrl = `${window.location.origin}/session/${join_code}`
    const qr = await QRCode.toDataURL(joinUrl, { width: 240, margin: 2 })
    setQrUrl(qr)
    setSession({ id: session_id, join_code })
    setPhase('lobby')
    setLaden(false)
  }

  async function sessionBeenden() {
    if (!session) return
    setLaden(true)
    await supabase.rpc('session_beenden', { p_session_id: session.id })
    channelRef.current?.unsubscribe()
    setPhase('beendet')
    setLaden(false)
  }

  async function wechsleAnsicht(ansicht, stueckId) {
    if (!session) return
    const zielStueck = stueckId ?? aktiveStueckId
    await supabase.rpc('session_praesentation_wechseln', {
      p_session_id: session.id,
      p_ansicht: ansicht,
      p_stueck_id: zielStueck ?? null,
    })
    setAktiveAnsicht(ansicht)
    if (stueckId) setAktiveStueckId(stueckId)
  }

  function defaultAnsicht(st) {
    if (st.stueck_dateien?.some(d => d.typ === 'noten')) return 'noten'
    if (st.liedtext) return 'liedtext'
    if (st.stueck_dateien?.some(d => d.typ === 'akkorde')) return 'akkorde'
    if (st.youtube_url) return 'youtube'
    return 'dateiverwaltung'
  }

  const aktivStueck = stuecke.find(s => s.id === aktiveStueckId)

  // ── START ──────────────────────────────────────────────────────
  if (phase === 'start') return (
    <div style={{ maxWidth: 520 }}>
      <button onClick={() => navigate(`/lehrer/kurse/${kursId}`)} style={s.back}>← {T('back')}</button>
      <h1 style={s.h1}>{T('teaching_mode_start')}</h1>

      {kurs && (
        <div style={s.card}>
          <div style={{ fontWeight: 800, fontSize: 17, color: 'var(--text)', marginBottom: 4 }}>{kurs.name}</div>
          <div style={{ fontSize: 13, color: 'var(--text-3)' }}>{kurs.instrumente?.icon} {kurs.instrumente?.name_de}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>{stuecke.length} Stücke im Repertoire</div>
        </div>
      )}

      {stunden.length > 0 && (
        <div style={s.card}>
          <div style={s.label}>{T('session_stunde_label')}</div>
          <select style={s.input} value={gewaehlteStunde} onChange={e => setGewaehlteStunde(e.target.value)}>
            <option value="">{T('session_stunde_keine')}</option>
            {stunden.map(st => (
              <option key={st.id} value={st.id}>
                {new Date(st.beginn).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}–
                {new Date(st.ende).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} Uhr
              </option>
            ))}
          </select>
        </div>
      )}

      {fehler && <div style={s.fehler}>{fehler}</div>}

      <button onClick={sessionStarten} disabled={laden} style={{ ...s.btnPri, width: '100%', fontSize: 16, padding: 14 }}>
        {laden ? T('session_starting') : T('session_starten_btn')}
      </button>
    </div>
  )

  // ── BEENDET ────────────────────────────────────────────────────
  if (phase === 'beendet') return (
    <div style={{ maxWidth: 440, textAlign: 'center', padding: '48px 24px', margin: '0 auto' }}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
      <h2 style={{ margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{T('session_ended_title')}</h2>
      <p style={{ color: 'var(--text-3)', fontSize: 14, marginBottom: 8 }}>
        {T('session_ended_attendance').replace('{n}', teilnehmer.length)}
      </p>
      {reaktionen.length > 0 && (
        <p style={{ color: 'var(--text-3)', fontSize: 13, marginBottom: 24 }}>
          {Object.entries(REAKTION).map(([typ, emoji]) => {
            const n = reaktionen.filter(r => r.typ === typ).length
            return n > 0 ? `${emoji} ${n}` : null
          }).filter(Boolean).join('  ')}
        </p>
      )}
      <button onClick={() => navigate(`/lehrer/kurse/${kursId}`)} style={s.btnPri}>{T('session_back_to_course')}</button>
    </div>
  )

  // ── LOBBY ──────────────────────────────────────────────────────
  if (phase === 'lobby') return (
    <div style={{ maxWidth: 640 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ margin: 0, fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{T('session_lobby_title')}</h1>
        <button onClick={sessionBeenden} style={s.btnDanger}>{T('session_cancel')}</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
        <div style={{ ...s.card, textAlign: 'center', marginBottom: 0 }}>
          <div style={s.label}>{T('session_qr_label')}</div>
          {qrUrl && <img src={qrUrl} alt="QR Code" style={{ width: 160, height: 160, marginTop: 12 }} />}
        </div>
        <div style={{ ...s.card, textAlign: 'center', display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', marginBottom: 0 }}>
          <div style={s.label}>{T('session_code_label')}</div>
          <div style={{ fontSize: 38, fontWeight: 900, letterSpacing: '0.15em', color: 'var(--primary)', marginTop: 12, fontFamily: 'monospace' }}>
            {session?.join_code}
          </div>
          <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
            {window.location.origin}/session/...
          </div>
        </div>
      </div>

      <div style={s.card}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
          <div style={s.label}>{T('session_participants_label')} ({teilnehmer.length})</div>
          <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
        </div>
        {teilnehmer.length === 0 ? (
          <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0', textAlign: 'center' }}>{T('session_waiting_students')}</div>
        ) : (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {teilnehmer.map(t => (
              <span key={t.profil_id} style={s.chip}>{t.profiles?.voller_name ?? 'Gast'}</span>
            ))}
          </div>
        )}
      </div>

      <button onClick={() => setPhase('aktiv')} style={{ ...s.btnPri, width: '100%', fontSize: 15, padding: 14 }}>
        {T('session_begin_btn')}
      </button>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }`}</style>
    </div>
  )

  // ── AKTIV ──────────────────────────────────────────────────────
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: 'calc(100vh - 130px)' }}>
      {/* Top Bar */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', paddingBottom: 14, marginBottom: 14, borderBottom: '1px solid var(--border)' }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 800, color: 'var(--text)' }}>🎬 {kurs?.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
            {teilnehmer.length} Schüler · Code:{' '}
            <strong style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 13 }}>{session?.join_code}</strong>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {Object.entries(REAKTION).map(([typ, emoji]) => {
            const n = reaktionen.filter(r => r.typ === typ).length
            return n > 0 ? <span key={typ} style={{ fontSize: 13, fontWeight: 700 }}>{emoji} {n}</span> : null
          })}
          <button onClick={sessionBeenden} disabled={laden} style={s.btnDanger}>{T('session_end_btn')}</button>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
        {/* Stück-Liste */}
        <div style={{ width: 210, minWidth: 210, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={s.label}>{T('session_pieces_label')} ({stuecke.length})</div>
          {stuecke.length === 0 && (
            <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Keine Stücke im Kurs.</div>
          )}
          {stuecke.map(st => (
            <button key={st.id} onClick={() => wechsleAnsicht(defaultAnsicht(st), st.id)}
              style={{
                padding: '10px 12px', borderRadius: 'var(--radius)', textAlign: 'left',
                border: `2px solid ${aktiveStueckId === st.id ? 'var(--primary)' : 'var(--border)'}`,
                background: aktiveStueckId === st.id ? 'var(--primary)' : 'var(--surface)',
                color: aktiveStueckId === st.id ? 'var(--primary-fg)' : 'var(--text)',
                cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
              }}>
              <div style={{ fontWeight: 700, fontSize: 13 }}>{st.titel}</div>
              {st.komponist && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{st.komponist}</div>}
            </button>
          ))}
        </div>

        {/* Haupt-Bereich */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 12 }}>
          {/* Ansicht-Auswahl */}
          {aktivStueck ? (
            <div>
              <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                <strong style={{ color: 'var(--text)' }}>{aktivStueck.titel}</strong> – {T('session_view_for_students')}
              </div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {Object.entries(ANSICHT).map(([key, { icon, label }]) => {
                  const hatInhalt =
                    key === 'noten'    ? aktivStueck.stueck_dateien?.some(d => d.typ === 'noten') :
                    key === 'liedtext' ? !!aktivStueck.liedtext :
                    key === 'akkorde'  ? (aktivStueck.stueck_dateien?.some(d => d.typ === 'akkorde') || !!aktivStueck.notizen) :
                    key === 'youtube'  ? !!aktivStueck.youtube_url : true
                  return (
                    <button key={key}
                      onClick={() => hatInhalt && wechsleAnsicht(key)}
                      style={{
                        padding: '8px 14px', borderRadius: 'var(--radius)', fontFamily: 'inherit',
                        border: `2px solid ${aktiveAnsicht === key ? 'var(--primary)' : 'var(--border)'}`,
                        background: aktiveAnsicht === key ? 'var(--primary)' : 'var(--surface)',
                        color: aktiveAnsicht === key ? 'var(--primary-fg)' : (hatInhalt ? 'var(--text-2)' : 'var(--text-3)'),
                        fontSize: 13, fontWeight: 600, cursor: hatInhalt ? 'pointer' : 'default',
                        opacity: hatInhalt ? 1 : 0.4,
                      }}>
                      {icon} {label}
                    </button>
                  )
                })}
              </div>
            </div>
          ) : (
            <div style={{ padding: '20px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border)', color: 'var(--text-3)', fontSize: 14, textAlign: 'center' }}>
              {T('session_select_piece')}
            </div>
          )}

          {/* Vorschau: was Schüler gerade sehen */}
          {aktivStueck && (
            <div style={{ ...s.card, flex: 1, overflowY: 'auto', marginBottom: 0 }}>
              <div style={s.label}>{T('session_preview_label')}</div>

              {aktiveAnsicht === 'liedtext' && (
                aktivStueck.liedtext
                  ? <div dangerouslySetInnerHTML={{ __html: marked.parse(aktivStueck.liedtext) }} style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '14px 16px', fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }} />
                  : <VorschauPlatzhalter ansicht={aktiveAnsicht} />
              )}

              {aktiveAnsicht === 'akkorde' && (
                aktivStueck.notizen
                  ? <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '14px 16px', overflowX: 'auto' }}>
                      <ChordPro text={aktivStueck.notizen} />
                    </div>
                  : <VorschauPlatzhalter ansicht={aktiveAnsicht} />
              )}

              {aktiveAnsicht === 'noten' && (
                aktivStueck.stueck_dateien?.filter(d => d.typ === 'noten').length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {aktivStueck.stueck_dateien.filter(d => d.typ === 'noten').map(d => (
                        <div key={d.id}>
                          {d.stimme && d.stimme !== 'keine' && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4, textTransform: 'capitalize' }}>Stimme: {d.stimme}</div>}
                          <PdfInline pfad={d.bucket_pfad} />
                        </div>
                      ))}
                    </div>
                  : <VorschauPlatzhalter ansicht={aktiveAnsicht} />
              )}

              {aktiveAnsicht === 'youtube' && (
                aktivStueck.youtube_url
                  ? <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                      <iframe src={`https://www.youtube.com/embed/${getYouTubeId(aktivStueck.youtube_url)}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} frameBorder="0" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                    </div>
                  : <VorschauPlatzhalter ansicht={aktiveAnsicht} />
              )}

              {aktiveAnsicht === 'dateiverwaltung' && (
                aktivStueck.stueck_dateien?.length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {aktivStueck.stueck_dateien.map(d => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 13 }}>
                          <span>📎</span>
                          <span style={{ flex: 1, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                          <span style={{ color: 'var(--text-3)', textTransform: 'capitalize', fontSize: 11 }}>{d.typ}</span>
                        </div>
                      ))}
                    </div>
                  : <VorschauPlatzhalter ansicht={aktiveAnsicht} />
              )}
            </div>
          )}

          {/* Live-Reaktionen */}
          <div style={{ ...s.card, maxHeight: aktivStueck ? 200 : undefined, flex: aktivStueck ? undefined : 1, overflowY: 'auto', marginBottom: 0 }}>
            <div style={s.label}>{T('session_reactions_label')}</div>
            {reaktionen.length === 0 ? (
              <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '16px 0', textAlign: 'center' }}>
                {T('session_no_reactions')}
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {reaktionen.slice(0, 30).map(r => (
                  <div key={r.id} style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '7px 10px', borderRadius: 'var(--radius)', background: 'var(--bg-2)', fontSize: 13 }}>
                    <span style={{ fontSize: 18 }}>{REAKTION[r.typ]}</span>
                    <span style={{ fontWeight: 600, color: 'var(--text)' }}>{r.gast_name ?? 'Schüler'}</span>
                    {r.frage && <span style={{ color: 'var(--text-2)', flex: 1, fontStyle: 'italic' }}>„{r.frage}"</span>}
                    <span style={{ fontSize: 11, color: 'var(--text-3)', marginLeft: 'auto' }}>
                      {new Date(r.erstellt_am).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const s = {
  h1:       { margin: '0 0 20px', fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' },
  card:     { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: 16 },
  label:    { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' },
  input:    { padding: '10px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box', marginTop: 8 },
  btnPri:   { padding: '12px 24px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger:{ padding: '10px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  fehler:   { padding: '12px 16px', borderRadius: 'var(--radius)', background: '#fee2e2', color: 'var(--danger)', fontWeight: 600, fontSize: 14, marginBottom: 16 },
  chip:     { fontSize: 12, padding: '4px 10px', borderRadius: 99, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: 600 },
  back:     { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13, padding: '4px 0', fontFamily: 'inherit', marginBottom: 16, display: 'block' },
}
