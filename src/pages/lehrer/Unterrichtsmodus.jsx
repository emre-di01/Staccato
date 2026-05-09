import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { safeMarkdown } from '../../lib/markdown'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { useIsMobile } from '../../hooks/useWindowWidth'
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
    supabase.storage.from('stueck-dateien').createSignedUrl(pfad, 86400)
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
  const mob = useIsMobile()

  const [phase, setPhase] = useState('start') // start | lobby | aktiv | beendet
  const [kurs, setKurs] = useState(null)
  const [stunden, setStunden] = useState([])
  const [gewaehlteStunde, setGewaehlteStunde] = useState('')
  const [oeffentlich, setOeffentlich] = useState(false)
  const [session, setSession] = useState(null)
  const [vorhandeneSession, setVorhandeneSession] = useState(null)
  const [qrUrl, setQrUrl] = useState('')
  const [teilnehmer, setTeilnehmer] = useState([])
  const [reaktionen, setReaktionen] = useState([])
  const [stuecke, setStuecke] = useState([])
  const [vorschauStueckId, setVorschauStueckId] = useState(null)
  const [vorschauAnsicht, setVorschauAnsicht] = useState('noten')
  const [liveStueckId, setLiveStueckId] = useState(null)
  const [liveAnsicht, setLiveAnsicht] = useState('noten')
  const [laden, setLaden] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [fehler, setFehler] = useState('')
  const [mdModus, setMdModusState] = useState(() => localStorage.getItem('staccato_liedtext_md') !== 'false')
  function setMdModus(val) { localStorage.setItem('staccato_liedtext_md', String(val)); setMdModusState(val) }
  const channelRef = useRef(null)
  const broadcastRef = useRef(null)

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

      const { data: aktiv } = await supabase
        .from('unterricht_sessions')
        .select('id, join_code, aktuelles_stueck, aktuelle_ansicht, gestartet_am, oeffentlich')
        .eq('unterricht_id', kursId)
        .eq('status', 'aktiv')
        .maybeSingle()
      if (aktiv) setVorhandeneSession(aktiv)
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

    const bc = supabase.channel(`session-live-${session.id}`).subscribe()
    broadcastRef.current = bc

    return () => { ch.unsubscribe(); bc.unsubscribe() }
  }, [session])

  async function ladeTeilnehmer(sessionId) {
    const { data } = await supabase
      .from('session_teilnehmer')
      .select('id, profil_id, gast_name, beigetreten_am, profiles(voller_name)')
      .eq('session_id', sessionId)
    setTeilnehmer(data ?? [])
  }

  async function refresh() {
    if (!session) return
    setRefreshing(true)
    await ladeTeilnehmer(session.id)
    setRefreshing(false)
  }

  async function sessionStarten() {
    setLaden(true); setFehler('')
    const { data, error } = await supabase.rpc('session_starten', {
      p_unterricht_id: kursId,
      p_stunde_id: gewaehlteStunde || null,
      p_oeffentlich: oeffentlich,
    })
    if (error || !data?.[0]) {
      setFehler(error?.message ?? 'Fehler beim Starten'); setLaden(false); return
    }
    const { session_id, join_code } = data[0]
    const joinUrl = `${window.location.origin}/session/${join_code}`
    const qr = await QRCode.toDataURL(joinUrl, { width: 240, margin: 2 })
    setQrUrl(qr)
    setSession({ id: session_id, join_code, oeffentlich })
    setPhase('lobby')
    setLaden(false)
  }

  async function sessionFortsetzen() {
    if (!vorhandeneSession) return
    setLaden(true); setFehler('')
    const joinUrl = `${window.location.origin}/session/${vorhandeneSession.join_code}`
    const qr = await QRCode.toDataURL(joinUrl, { width: 240, margin: 2 })
    setQrUrl(qr)
    setSession({ id: vorhandeneSession.id, join_code: vorhandeneSession.join_code, oeffentlich: vorhandeneSession.oeffentlich ?? false })
    if (vorhandeneSession.aktuelles_stueck) {
      setVorschauStueckId(vorhandeneSession.aktuelles_stueck)
      setLiveStueckId(vorhandeneSession.aktuelles_stueck)
    }
    if (vorhandeneSession.aktuelle_ansicht) {
      setVorschauAnsicht(vorhandeneSession.aktuelle_ansicht)
      setLiveAnsicht(vorhandeneSession.aktuelle_ansicht)
    }
    setVorhandeneSession(null)
    setPhase('aktiv')
    setLaden(false)
  }

  async function sessionBeenden() {
    if (!session) return
    setLaden(true)
    broadcastRef.current?.send({ type: 'broadcast', event: 'state', payload: { status: 'beendet' } })
    await supabase.rpc('session_beenden', { p_session_id: session.id })
    channelRef.current?.unsubscribe()
    broadcastRef.current?.unsubscribe()
    setPhase('beendet')
    setLaden(false)
  }

  function wechsleVorschau(ansicht, stueckId) {
    if (stueckId) setVorschauStueckId(stueckId)
    setVorschauAnsicht(ansicht)
  }

  async function teilen() {
    if (!session || !vorschauStueckId) return
    setLaden(true)
    await supabase.rpc('session_praesentation_wechseln', {
      p_session_id: session.id,
      p_ansicht: vorschauAnsicht,
      p_stueck_id: vorschauStueckId,
    })
    broadcastRef.current?.send({
      type: 'broadcast', event: 'state',
      payload: { aktuelles_stueck: vorschauStueckId, aktuelle_ansicht: vorschauAnsicht },
    })
    setLiveStueckId(vorschauStueckId)
    setLiveAnsicht(vorschauAnsicht)
    setLaden(false)
  }

  function defaultAnsicht(st) {
    if (st.stueck_dateien?.some(d => d.typ === 'noten')) return 'noten'
    if (st.liedtext) return 'liedtext'
    if (st.stueck_dateien?.some(d => d.typ === 'akkorde')) return 'akkorde'
    if (st.youtube_url) return 'youtube'
    return 'dateiverwaltung'
  }

  const vorschauStueck = stuecke.find(s => s.id === vorschauStueckId)
  const bereitsLive = vorschauStueckId === liveStueckId && vorschauAnsicht === liveAnsicht

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

      <div style={s.card}>
        <div style={s.label}>Sichtbarkeit</div>
        <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer', fontSize: 14, color: 'var(--text)' }}>
          <div
            onClick={() => setOeffentlich(v => !v)}
            style={{
              width: 40, height: 22, borderRadius: 11, background: oeffentlich ? 'var(--primary)' : 'var(--border)',
              position: 'relative', transition: 'background 0.2s', cursor: 'pointer', flexShrink: 0,
            }}
          >
            <div style={{
              position: 'absolute', top: 3, left: oeffentlich ? 21 : 3,
              width: 16, height: 16, borderRadius: '50%', background: '#fff',
              transition: 'left 0.2s', boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
            }} />
          </div>
          <span>
            {oeffentlich ? '🌐 Öffentlich – ohne Login beitreten' : '🔒 Privat – nur mit Staccato-Login'}
          </span>
        </label>
        {oeffentlich && (
          <div style={{ marginTop: 8, fontSize: 12, color: 'var(--text-3)', paddingLeft: 50 }}>
            Gäste können über den QR-Code / Link beitreten und ihren Namen eingeben.
          </div>
        )}
      </div>

      {fehler && <div style={s.fehler}>{fehler}</div>}

      {vorhandeneSession && (
        <div style={{ ...s.card, border: '2px solid var(--primary)', marginBottom: 12 }}>
          <div style={{ fontWeight: 800, fontSize: 14, color: 'var(--primary)', marginBottom: 6 }}>
            ⚡ Aktive Session läuft noch
          </div>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 12 }}>
            Code: <strong style={{ fontFamily: 'monospace', letterSpacing: '0.1em' }}>{vorhandeneSession.join_code}</strong>
            <span style={{ marginLeft: 10, color: 'var(--text-3)', fontSize: 12 }}>
              (gestartet {new Date(vorhandeneSession.gestartet_am).toLocaleTimeString('de', { hour: '2-digit', minute: '2-digit' })} Uhr)
            </span>
          </div>
          <button onClick={sessionFortsetzen} disabled={laden} style={{ ...s.btnPri, width: '100%' }}>
            {laden ? '…' : 'Session fortsetzen'}
          </button>
        </div>
      )}

      <button onClick={sessionStarten} disabled={laden} style={{ ...s.btnPri, width: '100%', fontSize: 16, padding: 14, background: vorhandeneSession ? 'var(--surface)' : undefined, color: vorhandeneSession ? 'var(--text-2)' : undefined, border: vorhandeneSession ? '1.5px solid var(--border)' : 'none' }}>
        {laden ? T('session_starting') : vorhandeneSession ? 'Neue Session starten (alte beenden)' : T('session_starten_btn')}
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
        <div style={{ display: 'flex', gap: 8 }}>
          <button onClick={refresh} disabled={refreshing} style={s.btnSek} title="Teilnehmerliste aktualisieren">
            {refreshing ? '…' : '↻'}
          </button>
          <button onClick={sessionBeenden} style={s.btnDanger}>{T('session_cancel')}</button>
        </div>
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
          {session?.oeffentlich && (
            <div style={{ marginTop: 10, fontSize: 11, fontWeight: 700, color: 'var(--primary)', background: 'color-mix(in srgb, var(--primary) 12%, transparent)', borderRadius: 6, padding: '4px 8px', display: 'inline-block' }}>
              🌐 Öffentlich – ohne Login
            </div>
          )}
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
              <span key={t.id ?? t.profil_id} style={s.chip}>
                {t.profiles?.voller_name ?? t.gast_name ?? 'Gast'}
                {!t.profil_id && <span style={{ opacity: 0.6, fontSize: 10 }}> (Gast)</span>}
              </span>
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
          <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2, display: 'flex', alignItems: 'center', gap: 8 }}>
            <span>{teilnehmer.length} Schüler · Code: <strong style={{ color: 'var(--primary)', fontFamily: 'monospace', fontSize: 13 }}>{session?.join_code}</strong></span>
            {session?.oeffentlich && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)' }}>🌐 Öffentlich</span>}
            {liveStueckId
              ? <span style={{ fontSize: 11, fontWeight: 700, color: '#16a34a', display: 'flex', alignItems: 'center', gap: 3 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  Live: {stuecke.find(s => s.id === liveStueckId)?.titel} · {liveAnsicht}
                </span>
              : <span style={{ fontSize: 11, color: 'var(--text-3)' }}>Noch nichts geteilt</span>
            }
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {Object.entries(REAKTION).map(([typ, emoji]) => {
            const n = reaktionen.filter(r => r.typ === typ).length
            return n > 0 ? <span key={typ} style={{ fontSize: 13, fontWeight: 700 }}>{emoji} {n}</span> : null
          })}
          <button onClick={refresh} disabled={refreshing} style={s.btnSek} title="Teilnehmerliste aktualisieren">
            {refreshing ? '…' : '↻'}
          </button>
          <button onClick={sessionBeenden} disabled={laden} style={s.btnDanger}>{T('session_end_btn')}</button>
        </div>
      </div>

      {mob ? (
        /* ── MOBILE LAYOUT ──────────────────────────────────── */
        <div style={{ display: 'flex', flexDirection: 'column', flex: 1, minHeight: 0, gap: 10, paddingBottom: 80 }}>

          {/* Stücke: horizontale Pill-Leiste */}
          <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
            <div style={{ display: 'flex', gap: 8, paddingBottom: 4 }}>
              {stuecke.length === 0 && <span style={{ fontSize: 12, color: 'var(--text-3)' }}>Keine Stücke im Kurs.</span>}
              {stuecke.map(st => {
                const istVorschau = vorschauStueckId === st.id
                const istLive = liveStueckId === st.id
                return (
                  <button key={st.id} onClick={() => wechsleVorschau(defaultAnsicht(st), st.id)}
                    style={{
                      padding: '8px 14px', borderRadius: 99, whiteSpace: 'nowrap', flexShrink: 0,
                      border: `2px solid ${istVorschau ? 'var(--primary)' : istLive ? '#22c55e' : 'var(--border)'}`,
                      background: istVorschau ? 'var(--primary)' : 'var(--surface)',
                      color: istVorschau ? 'var(--primary-fg)' : 'var(--text)',
                      cursor: 'pointer', fontFamily: 'inherit', fontSize: 13, fontWeight: 700,
                    }}>
                    {istLive ? '● ' : ''}{st.titel}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Ansicht-Buttons: horizontal scrollbar */}
          {vorschauStueck && (
            <div style={{ overflowX: 'auto', WebkitOverflowScrolling: 'touch' }}>
              <div style={{ display: 'flex', gap: 6, paddingBottom: 4 }}>
                {Object.entries(ANSICHT).map(([key, { icon, label }]) => {
                  const hatInhalt =
                    key === 'noten'    ? vorschauStueck.stueck_dateien?.some(d => d.typ === 'noten') :
                    key === 'liedtext' ? !!vorschauStueck.liedtext :
                    key === 'akkorde'  ? (vorschauStueck.stueck_dateien?.some(d => d.typ === 'akkorde') || !!vorschauStueck.notizen) :
                    key === 'youtube'  ? !!vorschauStueck.youtube_url : true
                  const istAktiv = vorschauAnsicht === key
                  return (
                    <button key={key} onClick={() => hatInhalt && wechsleVorschau(key)}
                      style={{
                        padding: '7px 12px', borderRadius: 'var(--radius)', fontFamily: 'inherit', whiteSpace: 'nowrap', flexShrink: 0,
                        border: `2px solid ${istAktiv ? 'var(--primary)' : 'var(--border)'}`,
                        background: istAktiv ? 'var(--primary)' : 'var(--surface)',
                        color: istAktiv ? 'var(--primary-fg)' : (hatInhalt ? 'var(--text-2)' : 'var(--text-3)'),
                        fontSize: 13, fontWeight: 600, cursor: hatInhalt ? 'pointer' : 'default', opacity: hatInhalt ? 1 : 0.4,
                      }}>
                      {icon} {label}
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {/* Inhalt-Vorschau */}
          {vorschauStueck ? (
            <div style={{ ...s.card, flex: 1, overflowY: 'auto', marginBottom: 0 }}>
              {vorschauAnsicht === 'liedtext' && (
                vorschauStueck.liedtext
                  ? <>
                      <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
                        <div style={{ display:'flex', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', overflow:'hidden' }}>
                          <button onClick={() => setMdModus(true)}  style={{ padding:'3px 9px', background: mdModus  ? 'var(--primary)' : 'var(--bg-2)', color: mdModus  ? 'var(--primary-fg, #fff)' : 'var(--text-3)', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>MD</button>
                          <button onClick={() => setMdModus(false)} style={{ padding:'3px 9px', background: !mdModus ? 'var(--primary)' : 'var(--bg-2)', color: !mdModus ? 'var(--primary-fg, #fff)' : 'var(--text-3)', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Plain</button>
                        </div>
                      </div>
                      {mdModus
                        ? <div dangerouslySetInnerHTML={{ __html: safeMarkdown(vorschauStueck.liedtext) }} style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '14px 16px', fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }} />
                        : <pre style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '14px 16px', fontSize: 14, lineHeight: 1.8, color: 'var(--text)', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'Georgia, serif', wordBreak: 'break-word' }}>{vorschauStueck.liedtext}</pre>
                      }
                    </>
                  : <VorschauPlatzhalter ansicht={vorschauAnsicht} />
              )}
              {vorschauAnsicht === 'akkorde' && (
                vorschauStueck.notizen
                  ? <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '14px 16px', overflowX: 'auto' }}><ChordPro text={vorschauStueck.notizen} /></div>
                  : <VorschauPlatzhalter ansicht={vorschauAnsicht} />
              )}
              {vorschauAnsicht === 'noten' && (
                vorschauStueck.stueck_dateien?.filter(d => d.typ === 'noten').length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                      {vorschauStueck.stueck_dateien.filter(d => d.typ === 'noten').map(d => (
                        <div key={d.id}>
                          {d.stimme && d.stimme !== 'keine' && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4, textTransform: 'capitalize' }}>Stimme: {d.stimme}</div>}
                          <PdfInline pfad={d.bucket_pfad} />
                        </div>
                      ))}
                    </div>
                  : <VorschauPlatzhalter ansicht={vorschauAnsicht} />
              )}
              {vorschauAnsicht === 'youtube' && (
                vorschauStueck.youtube_url
                  ? <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                      <iframe src={`https://www.youtube.com/embed/${getYouTubeId(vorschauStueck.youtube_url)}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} frameBorder="0" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                    </div>
                  : <VorschauPlatzhalter ansicht={vorschauAnsicht} />
              )}
              {vorschauAnsicht === 'dateiverwaltung' && (
                vorschauStueck.stueck_dateien?.length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {vorschauStueck.stueck_dateien.map(d => (
                        <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 13 }}>
                          <span>📎</span>
                          <span style={{ flex: 1, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                          <span style={{ color: 'var(--text-3)', textTransform: 'capitalize', fontSize: 11 }}>{d.typ}</span>
                        </div>
                      ))}
                    </div>
                  : <VorschauPlatzhalter ansicht={vorschauAnsicht} />
              )}
            </div>
          ) : (
            <div style={{ padding: '32px 20px', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '2px dashed var(--border)', color: 'var(--text-3)', fontSize: 14, textAlign: 'center' }}>
              {T('session_select_piece')}
            </div>
          )}

          {/* Reaktionen kompakt */}
          {reaktionen.length > 0 && (
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', padding: '8px 12px', background: 'var(--surface)', borderRadius: 'var(--radius)', border: '1px solid var(--border)' }}>
              {Object.entries(REAKTION).map(([typ, emoji]) => {
                const n = reaktionen.filter(r => r.typ === typ).length
                return n > 0 ? <span key={typ} style={{ fontSize: 13, fontWeight: 700 }}>{emoji} {n}</span> : null
              })}
            </div>
          )}

          {/* Sticky Bottom: Teilen-Button */}
          {vorschauStueck && (
            <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: 'var(--surface)', borderTop: '2px solid var(--border)', zIndex: 50 }}>
              <button onClick={teilen} disabled={laden || bereitsLive}
                style={{
                  width: '100%', padding: '14px', borderRadius: 'var(--radius)', border: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 800, cursor: bereitsLive ? 'default' : 'pointer',
                  background: bereitsLive ? 'rgba(34,197,94,0.12)' : 'var(--primary)',
                  color: bereitsLive ? '#16a34a' : 'var(--primary-fg)',
                }}>
                {laden ? '…' : bereitsLive ? '✓ Bereits live' : '▶ Jetzt teilen'}
              </button>
            </div>
          )}
        </div>

      ) : (
        /* ── DESKTOP LAYOUT ─────────────────────────────────── */
        <div style={{ display: 'flex', gap: 16, flex: 1, minHeight: 0 }}>
          {/* Stück-Liste */}
          <div style={{ width: 210, minWidth: 210, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={s.label}>{T('session_pieces_label')} ({stuecke.length})</div>
            {stuecke.length === 0 && (
              <div style={{ fontSize: 12, color: 'var(--text-3)', padding: '8px 0' }}>Keine Stücke im Kurs.</div>
            )}
            {stuecke.map(st => {
              const istVorschau = vorschauStueckId === st.id
              const istLive = liveStueckId === st.id
              return (
                <button key={st.id} onClick={() => wechsleVorschau(defaultAnsicht(st), st.id)}
                  style={{
                    padding: '10px 12px', borderRadius: 'var(--radius)', textAlign: 'left',
                    border: `2px solid ${istVorschau ? 'var(--primary)' : istLive ? '#22c55e' : 'var(--border)'}`,
                    background: istVorschau ? 'var(--primary)' : 'var(--surface)',
                    color: istVorschau ? 'var(--primary-fg)' : 'var(--text)',
                    cursor: 'pointer', fontFamily: 'inherit', transition: 'all 0.15s',
                  }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 4 }}>
                    <div style={{ fontWeight: 700, fontSize: 13 }}>{st.titel}</div>
                    {istLive && !istVorschau && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: '#16a34a', background: 'rgba(34,197,94,0.12)', borderRadius: 4, padding: '2px 5px', flexShrink: 0, marginTop: 1 }}>LIVE</span>
                    )}
                    {istLive && istVorschau && (
                      <span style={{ fontSize: 9, fontWeight: 800, color: 'var(--primary-fg)', opacity: 0.75, flexShrink: 0, marginTop: 1 }}>● LIVE</span>
                    )}
                  </div>
                  {st.komponist && <div style={{ fontSize: 11, opacity: 0.75, marginTop: 2 }}>{st.komponist}</div>}
                </button>
              )
            })}
          </div>

          {/* Haupt-Bereich */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0, gap: 12 }}>
            {/* Ansicht-Auswahl */}
            {vorschauStueck ? (
              <div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginBottom: 8 }}>
                  <strong style={{ color: 'var(--text)' }}>{vorschauStueck.titel}</strong> – Vorschau (nur für dich)
                </div>
                <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                  {Object.entries(ANSICHT).map(([key, { icon, label }]) => {
                    const hatInhalt =
                      key === 'noten'    ? vorschauStueck.stueck_dateien?.some(d => d.typ === 'noten') :
                      key === 'liedtext' ? !!vorschauStueck.liedtext :
                      key === 'akkorde'  ? (vorschauStueck.stueck_dateien?.some(d => d.typ === 'akkorde') || !!vorschauStueck.notizen) :
                      key === 'youtube'  ? !!vorschauStueck.youtube_url : true
                    const istAktiv = vorschauAnsicht === key
                    return (
                      <button key={key} onClick={() => hatInhalt && wechsleVorschau(key)}
                        style={{
                          padding: '8px 14px', borderRadius: 'var(--radius)', fontFamily: 'inherit',
                          border: `2px solid ${istAktiv ? 'var(--primary)' : 'var(--border)'}`,
                          background: istAktiv ? 'var(--primary)' : 'var(--surface)',
                          color: istAktiv ? 'var(--primary-fg)' : (hatInhalt ? 'var(--text-2)' : 'var(--text-3)'),
                          fontSize: 13, fontWeight: 600, cursor: hatInhalt ? 'pointer' : 'default', opacity: hatInhalt ? 1 : 0.4,
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

            {/* Vorschau: Lehrer-Staging (privat) */}
            {vorschauStueck && (
              <div style={{ ...s.card, flex: 1, overflowY: 'auto', marginBottom: 0, display: 'flex', flexDirection: 'column', gap: 0 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <span style={s.label}>Vorschau</span>
                  <button onClick={teilen} disabled={laden || bereitsLive}
                    style={{
                      padding: '7px 16px', borderRadius: 'var(--radius)', border: 'none', fontFamily: 'inherit', fontSize: 13, fontWeight: 700, cursor: bereitsLive ? 'default' : 'pointer',
                      background: bereitsLive ? 'rgba(34,197,94,0.12)' : 'var(--primary)',
                      color: bereitsLive ? '#16a34a' : 'var(--primary-fg)',
                      transition: 'all 0.2s',
                    }}>
                    {laden ? '…' : bereitsLive ? '✓ Bereits live' : '▶ Jetzt teilen'}
                  </button>
                </div>

                {vorschauAnsicht === 'liedtext' && (
                  vorschauStueck.liedtext
                    ? <>
                        <div style={{ display:'flex', justifyContent:'flex-end', marginBottom:8 }}>
                          <div style={{ display:'flex', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', overflow:'hidden' }}>
                            <button onClick={() => setMdModus(true)}  style={{ padding:'3px 9px', background: mdModus  ? 'var(--primary)' : 'var(--bg-2)', color: mdModus  ? 'var(--primary-fg, #fff)' : 'var(--text-3)', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>MD</button>
                            <button onClick={() => setMdModus(false)} style={{ padding:'3px 9px', background: !mdModus ? 'var(--primary)' : 'var(--bg-2)', color: !mdModus ? 'var(--primary-fg, #fff)' : 'var(--text-3)', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Plain</button>
                          </div>
                        </div>
                        {mdModus
                          ? <div dangerouslySetInnerHTML={{ __html: safeMarkdown(vorschauStueck.liedtext) }} style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '14px 16px', fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }} />
                          : <pre style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '14px 16px', fontSize: 14, lineHeight: 1.8, color: 'var(--text)', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'Georgia, serif', wordBreak: 'break-word' }}>{vorschauStueck.liedtext}</pre>
                        }
                      </>
                    : <VorschauPlatzhalter ansicht={vorschauAnsicht} />
                )}
                {vorschauAnsicht === 'akkorde' && (
                  vorschauStueck.notizen
                    ? <div style={{ background: 'var(--bg-2)', borderRadius: 'var(--radius)', padding: '14px 16px', overflowX: 'auto' }}><ChordPro text={vorschauStueck.notizen} /></div>
                    : <VorschauPlatzhalter ansicht={vorschauAnsicht} />
                )}
                {vorschauAnsicht === 'noten' && (
                  vorschauStueck.stueck_dateien?.filter(d => d.typ === 'noten').length > 0
                    ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        {vorschauStueck.stueck_dateien.filter(d => d.typ === 'noten').map(d => (
                          <div key={d.id}>
                            {d.stimme && d.stimme !== 'keine' && <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 4, textTransform: 'capitalize' }}>Stimme: {d.stimme}</div>}
                            <PdfInline pfad={d.bucket_pfad} />
                          </div>
                        ))}
                      </div>
                    : <VorschauPlatzhalter ansicht={vorschauAnsicht} />
                )}
                {vorschauAnsicht === 'youtube' && (
                  vorschauStueck.youtube_url
                    ? <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000', borderRadius: 'var(--radius)', overflow: 'hidden' }}>
                        <iframe src={`https://www.youtube.com/embed/${getYouTubeId(vorschauStueck.youtube_url)}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} frameBorder="0" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                      </div>
                    : <VorschauPlatzhalter ansicht={vorschauAnsicht} />
                )}
                {vorschauAnsicht === 'dateiverwaltung' && (
                  vorschauStueck.stueck_dateien?.length > 0
                    ? <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                        {vorschauStueck.stueck_dateien.map(d => (
                          <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--bg-2)', border: '1px solid var(--border)', fontSize: 13 }}>
                            <span>📎</span>
                            <span style={{ flex: 1, fontWeight: 600, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</span>
                            <span style={{ color: 'var(--text-3)', textTransform: 'capitalize', fontSize: 11 }}>{d.typ}</span>
                          </div>
                        ))}
                      </div>
                    : <VorschauPlatzhalter ansicht={vorschauAnsicht} />
                )}
              </div>
            )}

            {/* Live-Reaktionen */}
            <div style={{ ...s.card, maxHeight: vorschauStueck ? 200 : undefined, flex: vorschauStueck ? undefined : 1, overflowY: 'auto', marginBottom: 0 }}>
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
      )}
    </div>
  )
}

const s = {
  h1:       { margin: '0 0 20px', fontSize: 24, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' },
  card:     { background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: '16px 20px', border: '1px solid var(--border)', boxShadow: 'var(--shadow)', marginBottom: 16 },
  label:    { fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 8, display: 'block' },
  input:    { padding: '10px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box', marginTop: 8 },
  btnPri:   { padding: '12px 24px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  btnSek:   { padding: '10px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 15, cursor: 'pointer', fontFamily: 'inherit' },
  btnDanger:{ padding: '10px 18px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--danger)', color: '#fff', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' },
  fehler:   { padding: '12px 16px', borderRadius: 'var(--radius)', background: '#fee2e2', color: 'var(--danger)', fontWeight: 600, fontSize: 14, marginBottom: 16 },
  chip:     { fontSize: 12, padding: '4px 10px', borderRadius: 99, background: 'var(--bg-2)', border: '1px solid var(--border)', color: 'var(--text-2)', fontWeight: 600 },
  back:     { background: 'none', border: 'none', cursor: 'pointer', color: 'var(--text-3)', fontSize: 13, padding: '4px 0', fontFamily: 'inherit', marginBottom: 16, display: 'block' },
}
