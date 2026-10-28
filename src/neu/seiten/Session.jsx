import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ThumbsUp, Heart, Hand, CircleHelp, ThumbsDown, Check, Radio, ChevronLeft, Send } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { safeMarkdown } from '../../lib/markdown'
import { useApp } from '../../context/AppContext'
import { startseiteNach } from '../../components/ProtectedRoute'
import { NEU_THEME } from '../../themes/themes'
import { liedFarbe, UI_CSS } from '../../ui'
import ChordPro from '../../components/stueck/ChordProRenderer'
import AkkordDateiAnzeige from '../../components/stueck/AkkordDateiAnzeige'
import PdfCard from '../../components/stueck/PdfCard'
import AudioPlayer from '../../components/stueck/AudioPlayer'
import { OeffnenButton, DownloadButton } from '../../components/stueck/FileButtons'

// Live-Unterricht aus Sicht der Teilnehmer (auch Gäste ohne Login). Logik wie bisher:
// session_beitreten → Realtime-Broadcast `session-live-<id>` → Stück laden.
const F = { bg: '#0B0B0D', karte: '#1C1C21', linie: '#2A2A30', text: '#F5F5F7', text2: '#A1A1AA', akzent: '#FB923C', gruen: '#4ADE80' }
const GROESSEN = [20, 25, 31]
const REAKTIONEN = [
  ['daumen_hoch', ThumbsUp, 'reaction_gut'], ['herz', Heart, 'reaction_super'], ['hand_hoch', Hand, 'reaction_frage'],
  ['verwirrung', CircleHelp, 'reaction_unklar'], ['daumen_runter', ThumbsDown, 'reaction_nochmal'],
]

function youtubeId(url) {
  const m = url?.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)
  return m?.[1] ?? null
}

export default function NeuSession() {
  const { code: urlCode } = useParams()
  const { session: authSession, profil, laden: authLaden, rolle, T } = useApp()
  const [phase, setPhase] = useState('eingabe')   // eingabe | verbinden | aktiv | beendet
  const [code, setCode] = useState((urlCode ?? '').toUpperCase())
  const [gastName, setGastName] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [ansicht, setAnsicht] = useState(null)
  const [stueck, setStueck] = useState(null)
  const [dateien, setDateien] = useState([])
  const [fehler, setFehler] = useState('')
  const [gesendet, setGesendet] = useState(false)
  const [frageOffen, setFrageOffen] = useState(false)
  const [frage, setFrage] = useState('')
  const [stufe, setStufe] = useState(0)
  const kanal = useRef(null)
  const istGast = !authLaden && !authSession

  useEffect(() => {
    if (urlCode && authSession && !authLaden && phase === 'eingabe') beitreten(urlCode)
  }, [urlCode, authSession, authLaden])

  useEffect(() => {
    if (!sessionId) return
    const ch = supabase.channel(`session-live-${sessionId}`)
      .on('broadcast', { event: 'state' }, async ({ payload }) => {
        if (payload.status === 'beendet') { setPhase('beendet'); return }
        setAnsicht(payload.aktuelle_ansicht)
        if (payload.aktuelles_stueck) await ladeStueck(payload.aktuelles_stueck)
        else setStueck(null)
      })
      .subscribe()
    kanal.current = ch
    return () => ch.unsubscribe()
  }, [sessionId])

  // Verpasstes nachholen, wenn die App aus dem Hintergrund zurückkommt
  useEffect(() => {
    if (phase !== 'aktiv' || !sessionId) return
    const sichtbar = () => document.visibilityState === 'visible' && abgleichen(sessionId)
    document.addEventListener('visibilitychange', sichtbar)
    return () => document.removeEventListener('visibilitychange', sichtbar)
  }, [phase, sessionId])

  async function abgleichen(sid) {
    const { data: s } = await supabase.from('unterricht_sessions').select('*').eq('id', sid).single()
    if (!s) return
    if (s.status === 'beendet') { setPhase('beendet'); return }
    setAnsicht(s.aktuelle_ansicht)
    if (s.aktuelles_stueck) await ladeStueck(s.aktuelles_stueck)
    else setStueck(null)
  }

  async function ladeStueck(id) {
    const [{ data: st }, { data: df }] = await Promise.all([
      supabase.from('stuecke').select('id, titel, komponist, youtube_url, liedtext, liedtext_md, notizen').eq('id', id).single(),
      supabase.from('stueck_dateien').select('*').eq('stueck_id', id).order('hochgeladen_am'),
    ])
    setStueck(st); setDateien(df ?? [])
  }

  async function beitreten(c) {
    const jc = (c ?? code).trim().toUpperCase()
    if (!jc) { setFehler(T('join_please_enter_code')); return }
    if (istGast && !gastName.trim()) { setFehler(T('join_please_enter_name')); return }
    setPhase('verbinden'); setFehler('')
    const { data, error } = await supabase.rpc('session_beitreten', { p_join_code: jc, p_gast_name: istGast ? gastName.trim() : null })
    if (error || !data) { setFehler(error?.message ?? T('session_not_found')); setPhase('eingabe'); return }
    setSessionId(data)
    await abgleichen(data)
    setPhase(p => (p === 'beendet' ? p : 'aktiv'))
  }

  async function reagieren(typ, text) {
    if (!sessionId) return
    await supabase.from('session_reaktionen').insert({
      session_id: sessionId, profil_id: profil?.id ?? null, gast_name: profil?.voller_name ?? (gastName.trim() || null), typ, frage: text || null,
    })
    setGesendet(true); setFrageOffen(false); setFrage('')
    setTimeout(() => setGesendet(false), 2500)
  }

  const zurueck = rolle ? startseiteNach(rolle) : '/login'
  const kopf = (
    <div style={{ padding: 'calc(10px + env(safe-area-inset-top, 0px)) 12px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
      <Link to={zurueck} style={{ minHeight: 44, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 2, fontSize: 17, fontWeight: 600, color: F.akzent, textDecoration: 'none' }}>
        <ChevronLeft aria-hidden="true" size={24} />{rolle ? T('n_tab_start') : T('login')}
      </Link>
      {phase === 'aktiv' && stueck && (
        <button onClick={() => setStufe(s => (s + 1) % 3)} aria-label={T('n_schrift_aendern')} style={{ height: 44, padding: '0 16px', borderRadius: 22, border: 'none', background: F.linie, color: F.text, fontFamily: 'inherit', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
          Aa · {[T('n_normal'), T('n_gross'), T('n_sehr_gross')][stufe]}
        </button>
      )}
    </div>
  )

  // ── Beitreten ──
  if (phase === 'eingabe' || phase === 'verbinden') {
    const automatisch = authLaden || (!istGast && urlCode && !fehler)
    return (
      <Huelle>
        {kopf}
        <div style={{ padding: '24px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: F.akzent }}>
            <Radio aria-hidden="true" size={18} />{T('nl_live_unterricht')}
          </div>
          <h1 style={{ margin: '6px 0 0', fontSize: 32, fontWeight: 800, letterSpacing: '-0.02em' }}>{automatisch || phase === 'verbinden' ? T('join_connecting') : T('n_live_beitreten')}</h1>
          {!automatisch && phase === 'eingabe' && (
            <form onSubmit={e => { e.preventDefault(); beitreten() }} style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 16 }}>
              <label style={labelStil}>{T('nl_code')}
                <input value={code} onChange={e => setCode(e.target.value.toUpperCase().slice(0, 6))} autoCapitalize="characters" autoComplete="off" inputMode="text"
                  style={{ ...feldStil, fontSize: 30, fontWeight: 800, letterSpacing: '0.2em', textAlign: 'center' }} placeholder="ABC123" />
              </label>
              {istGast && (
                <label style={labelStil}>{T('nl_dein_name')}
                  <input value={gastName} onChange={e => setGastName(e.target.value)} autoComplete="name" style={feldStil} />
                </label>
              )}
              {fehler && <div role="alert" style={{ fontSize: 16, color: '#F87171' }}>{fehler}</div>}
              <button type="submit" style={grossKnopf}>{T('n_live_beitreten')}</button>
            </form>
          )}
        </div>
      </Huelle>
    )
  }

  // ── Beendet ──
  if (phase === 'beendet') return (
    <Huelle>
      {kopf}
      <section style={{ margin: '40px 20px 0', padding: '28px 22px', borderRadius: 24, background: F.karte, textAlign: 'center' }}>
        <span style={{ width: 64, height: 64, margin: '0 auto', borderRadius: 32, background: '#14532D', color: F.gruen, display: 'flex', alignItems: 'center', justifyContent: 'center' }}><Check aria-hidden="true" size={32} strokeWidth={2.4} /></span>
        <div style={{ marginTop: 16, fontSize: 24, fontWeight: 800 }}>{T('nl_live_beendet')}</div>
        <div style={{ marginTop: 6, fontSize: 17, color: F.text2 }}>{T('nl_danke_fuers_mitmachen')}</div>
        <Link to={zurueck} style={{ ...grossKnopf, textDecoration: 'none' }}>{rolle ? T('n_tab_start') : T('login')}</Link>
      </section>
    </Huelle>
  )

  // ── Aktiv ──
  const typ = t => dateien.filter(d => d.typ === t)
  const yt = youtubeId(stueck?.youtube_url)
  const aufFarbe = { '--text': '#FFFFFF', '--text-2': '#E8EEF2', '--text-3': '#E8EEF2', '--accent': '#FDBA74', '--primary': '#FDBA74', '--surface': 'rgba(255,255,255,0.10)', '--bg-2': 'rgba(255,255,255,0.10)', '--border': 'rgba(255,255,255,0.25)' }
  const { globalCss, ...hell } = NEU_THEME.light  // eslint-disable-line no-unused-vars

  return (
    <Huelle unten={176}>
      {kopf}
      {!stueck ? (
        <section style={{ margin: '40px 20px 0', padding: '32px 22px', borderRadius: 24, background: F.karte, textAlign: 'center' }}>
          <Radio aria-hidden="true" size={36} color={F.akzent} />
          <div style={{ marginTop: 12, fontSize: 22, fontWeight: 800 }}>{T('nl_du_bist_dabei')}</div>
          <div style={{ marginTop: 6, fontSize: 17, color: F.text2, lineHeight: 1.5 }}>{T('nl_warte_auf_lehrkraft')}</div>
        </section>
      ) : (
        <div style={{ margin: '12px 12px 0', borderRadius: 24, background: liedFarbe(stueck.id), color: '#FFFFFF', paddingBottom: 24, ...aufFarbe }}>
          <header style={{ padding: '22px 20px 0' }}>
            <h1 style={{ margin: 0, fontSize: 28, lineHeight: 1.15, fontWeight: 800, overflowWrap: 'anywhere' }}>{stueck.titel}</h1>
            {stueck.komponist && <div style={{ marginTop: 4, fontSize: 17, color: '#E8EEF2' }}>{stueck.komponist}</div>}
          </header>
          <div style={{ padding: '20px 20px 0', fontSize: GROESSEN[stufe], lineHeight: 1.5, fontWeight: 600 }}>
            {ansicht === 'liedtext' && (stueck.liedtext
              ? (stueck.liedtext_md !== false
                ? <div className="n-lied-text" dangerouslySetInnerHTML={{ __html: safeMarkdown(stueck.liedtext) }} />
                : <div style={{ whiteSpace: 'pre-wrap' }}>{stueck.liedtext}</div>)
              : <Leer text={T('nl_kein_inhalt')} />)}
            {ansicht === 'akkorde' && (
              <div style={{ fontSize: GROESSEN[stufe] - 4, overflowX: 'auto' }}>
                {stueck.notizen && <ChordPro text={stueck.notizen} />}
                {typ('akkorde').map(d => <AkkordDateiAnzeige key={d.id} datei={d} />)}
                {!stueck.notizen && !typ('akkorde').length && <Leer text={T('nl_kein_inhalt')} />}
              </div>
            )}
            {ansicht === 'youtube' && (yt
              ? <div style={{ position: 'relative', paddingTop: '56.25%', borderRadius: 16, overflow: 'hidden' }}><iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title={stueck.titel} allow="encrypted-media; picture-in-picture" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} /></div>
              : <Leer text={T('nl_kein_inhalt')} />)}
          </div>
          {(ansicht === 'noten' || ansicht === 'dateiverwaltung') && (
            <div style={{ margin: '0 8px', padding: 16, borderRadius: 18, background: hell['--bg'], color: hell['--text'], display: 'flex', flexDirection: 'column', gap: 10, ...hell }}>
              {(ansicht === 'noten' ? typ('noten') : []).map(d => <PdfCard key={d.id} datei={d} />)}
              {ansicht === 'dateiverwaltung' && typ('audio').map(d => <AudioPlayer key={d.id} datei={d} />)}
              {ansicht === 'dateiverwaltung' && dateien.filter(d => d.typ !== 'audio').map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ flex: 1, minWidth: 140, fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{d.name}</span>
                  <OeffnenButton pfad={d.bucket_pfad} />
                  <DownloadButton datei={d} label="⬇" />
                </div>
              ))}
              {(ansicht === 'noten' ? typ('noten') : dateien).length === 0 && <div style={{ fontSize: 17 }}>{T('nl_kein_inhalt')}</div>}
            </div>
          )}
        </div>
      )}

      {/* Rückmeldung an die Lehrkraft */}
      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 10, padding: '12px 12px calc(14px + env(safe-area-inset-bottom, 0px))', background: 'rgba(11,11,13,0.92)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', borderTop: `1px solid ${F.linie}` }}>
        <div style={{ maxWidth: 760, margin: '0 auto' }}>
          {gesendet ? (
            <div role="status" style={{ minHeight: 64, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, fontSize: 18, fontWeight: 700, color: F.gruen }}><Check aria-hidden="true" size={22} />{T('nl_gesendet_ok')}</div>
          ) : frageOffen ? (
            <form onSubmit={e => { e.preventDefault(); if (frage.trim()) reagieren('hand_hoch', frage.trim()) }} style={{ display: 'flex', gap: 8 }}>
              <input autoFocus value={frage} onChange={e => setFrage(e.target.value)} aria-label={T('nl_deine_frage')} placeholder={T('nl_deine_frage')} style={{ ...feldStil, flex: 1, minHeight: 52 }} />
              <button type="submit" aria-label={T('nl_senden')} style={{ width: 52, height: 52, borderRadius: 14, border: 'none', background: F.akzent, color: '#111114', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}><Send size={20} /></button>
            </form>
          ) : (
            <>
              <div role="group" aria-label={T('nl_rueckmeldung_geben')} style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 6 }}>
                {REAKTIONEN.map(([t, Icon, label]) => (
                  <button key={t} onClick={() => reagieren(t)} style={{ minHeight: 64, borderRadius: 14, border: 'none', background: F.karte, color: F.text, fontFamily: 'inherit', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 4 }}>
                    <Icon aria-hidden="true" size={24} />{T(label)}
                  </button>
                ))}
              </div>
              <button onClick={() => setFrageOffen(true)} style={{ marginTop: 8, width: '100%', minHeight: 44, borderRadius: 12, border: 'none', background: 'transparent', color: F.akzent, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>{T('nl_frage_stellen')}</button>
            </>
          )}
        </div>
      </div>
    </Huelle>
  )
}

function Huelle({ children, unten = 48 }) {
  return (
    <div style={{ minHeight: '100dvh', background: F.bg, color: F.text, fontFamily: 'Inter, system-ui, sans-serif', paddingBottom: unten }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>{children}</div>
      <style>{UI_CSS}</style>
    </div>
  )
}

function Leer({ text }) {
  return <div style={{ fontSize: 17, fontWeight: 500, color: '#E8EEF2' }}>{text}</div>
}

const labelStil = { display: 'flex', flexDirection: 'column', gap: 8, fontSize: 16, fontWeight: 600, color: F.text2 }
const feldStil = { minHeight: 56, padding: '0 16px', borderRadius: 14, border: `1.5px solid ${F.linie}`, background: F.karte, color: F.text, fontFamily: 'inherit', fontSize: 18, outline: 'none', boxSizing: 'border-box' }
const grossKnopf = { marginTop: 8, width: '100%', height: 56, borderRadius: 16, border: 'none', background: F.akzent, color: '#111114', fontFamily: 'inherit', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
