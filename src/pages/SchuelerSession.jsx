import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { safeMarkdown } from '../lib/markdown'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import { startseiteNach } from '../components/ProtectedRoute'

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

const REAKTION_TYPEN = [
  { typ: 'daumen_hoch',   emoji: '👍', label: 'Gut' },
  { typ: 'herz',          emoji: '❤️', label: 'Super' },
  { typ: 'hand_hoch',     emoji: '✋', label: 'Frage' },
  { typ: 'verwirrung',    emoji: '😕', label: 'Unklar' },
  { typ: 'daumen_runter', emoji: '👎', label: 'Nochmal' },
]

const ANSICHT_INFO = {
  noten:           { icon: '📄', label: 'Noten' },
  liedtext:        { icon: '📝', label: 'Liedtext' },
  akkorde:         { icon: '🎸', label: 'Akkorde' },
  youtube:         { icon: '▶️', label: 'Video' },
  dateiverwaltung: { icon: '📂', label: 'Dateien' },
}

function getYouTubeId(url) {
  const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?]+)/)
  return m?.[1] ?? ''
}

function PdfInline({ pfad }) {
  const [url, setUrl] = useState(null)
  const [laden, setLaden] = useState(true)
  useEffect(() => {
    supabase.storage.from('stueck-dateien').createSignedUrl(pfad, 86400)
      .then(({ data }) => { setUrl(data?.signedUrl ?? null); setLaden(false) })
  }, [pfad])
  if (laden) return <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-3)' }}>Lädt …</div>
  if (!url)  return <div style={{ padding: 24, textAlign: 'center', color: 'var(--danger)', fontSize: 13 }}>Datei nicht verfügbar</div>
  return (
    <div>
      <iframe src={url + '#view=FitH&toolbar=0'} style={{ width: '100%', height: '85vh', border: 'none', borderRadius: 'var(--radius)', display: 'block' }} title="Noten" />
      <a href={url} target="_blank" rel="noreferrer" style={{ display: 'block', marginTop: 8, textAlign: 'center', fontSize: 13, color: 'var(--primary)', fontWeight: 600 }}>↗ In neuem Tab öffnen</a>
    </div>
  )
}

function PlatzhalterBox({ info }) {
  return (
    <div style={{ padding: '40px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: 14 }}>
      <div style={{ fontSize: 32, marginBottom: 8 }}>{info.icon}</div>
      Dein Lehrer zeigt: <strong style={{ color: 'var(--text)' }}>{info.label}</strong>
    </div>
  )
}

function DateiZeile({ datei }) {
  const [laden, setLaden] = useState(false)
  async function oeffnen() {
    setLaden(true)
    const { data } = await supabase.storage.from('stueck-dateien').createSignedUrl(datei.bucket_pfad, 86400)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    setLaden(false)
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '14px 16px', borderRadius: 'var(--radius)', background: 'var(--surface)', border: '1px solid var(--border)' }}>
      <span style={{ fontSize: 24 }}>📎</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{datei.name}</div>
        {datei.stimme && datei.stimme !== 'keine' && <div style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'capitalize' }}>Stimme: {datei.stimme}</div>}
      </div>
      <button onClick={oeffnen} disabled={laden} style={{ padding: '8px 14px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
        {laden ? '…' : '↗ Öffnen'}
      </button>
    </div>
  )
}

function AkkordText({ pfad }) {
  const [text, setText] = useState(null)
  useEffect(() => {
    supabase.storage.from('stueck-dateien').download(pfad)
      .then(({ data }) => data?.text().then(setText))
  }, [pfad])
  if (!text) return <div style={{ padding: 16, color: 'var(--text-3)', fontSize: 13 }}>Lädt …</div>
  return (
    <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--border)', overflowX: 'auto' }}>
      <ChordPro text={text} />
    </div>
  )
}

export default function SchuelerSession() {
  const { code: urlCode } = useParams()
  const navigate = useNavigate()
  const { session: authSession, profil, laden: authLaden, rolle, T } = useApp()

  const [phase, setPhase] = useState('eingabe') // eingabe | verbinden | aktiv | beendet
  const [code, setCode] = useState((urlCode ?? '').toUpperCase())
  const [gastName, setGastName] = useState('')
  const [sessionId, setSessionId] = useState(null)
  const [sessionState, setSessionState] = useState(null)
  const [stueck, setStueck] = useState(null)
  const [fehler, setFehler] = useState('')
  const [dateien, setDateien] = useState([])
  const [reaktionGesendet, setReaktionGesendet] = useState(false)
  const [zeigeFrageEingabe, setZeigeFrageEingabe] = useState(false)
  const [frageText, setFrageText] = useState('')
  const [liedtextGroesse, setLiedtextGroesse] = useState(15)
  const [refreshing,      setRefreshing]      = useState(false)
  const channelRef = useRef(null)

  const istGast = !authLaden && !authSession

  // Auto-join wenn Code in URL — nur im Eingabe-Zustand, damit ein
  // Token-Refresh in AppContext keinen laufenden Session-Screen abbricht.
  // Für Gäste kein Auto-join – sie müssen erst ihren Namen eingeben.
  useEffect(() => {
    if (urlCode && authSession && !authLaden && phase === 'eingabe') beitreten(urlCode)
  }, [urlCode, authSession, authLaden])

  // Verpasste Realtime-Updates nachholen wenn App aus dem Hintergrund zurückkommt
  useEffect(() => {
    if (phase !== 'aktiv' || !sessionId) return
    async function sync() {
      const { data: sess } = await supabase
        .from('unterricht_sessions').select('*').eq('id', sessionId).single()
      if (!sess) return
      if (sess.status === 'beendet') { setPhase('beendet'); return }
      setSessionState(sess)
      if (sess.aktuelles_stueck) await ladeStueck(sess.aktuelles_stueck)
      else setStueck(null)
    }
    function handleVisibility() {
      if (document.visibilityState === 'visible') sync()
    }
    document.addEventListener('visibilitychange', handleVisibility)
    return () => document.removeEventListener('visibilitychange', handleVisibility)
  }, [phase, sessionId])

  // Realtime: Session-Updates verfolgen (Broadcast funktioniert auch für Gäste ohne Login)
  useEffect(() => {
    if (!sessionId) return
    const ch = supabase.channel(`session-live-${sessionId}`)
      .on('broadcast', { event: 'state' }, async ({ payload }) => {
        if (payload.status === 'beendet') { setPhase('beendet'); return }
        setSessionState(prev => prev ? { ...prev, aktuelles_stueck: payload.aktuelles_stueck, aktuelle_ansicht: payload.aktuelle_ansicht } : prev)
        if (payload.aktuelles_stueck) await ladeStueck(payload.aktuelles_stueck)
        else setStueck(null)
      })
      .subscribe()
    channelRef.current = ch
    return () => ch.unsubscribe()
  }, [sessionId])

  async function ladeStueck(stueckId) {
    const [{ data: st }, { data: df }] = await Promise.all([
      supabase.from('stuecke').select('id, titel, komponist, youtube_url, liedtext, liedtext_md, notizen').eq('id', stueckId).single(),
      supabase.from('stueck_dateien').select('id, typ, name, bucket_pfad, stimme').eq('stueck_id', stueckId).order('hochgeladen_am'),
    ])
    setStueck(st)
    setDateien(df ?? [])
  }

  async function beitreten(joinCode) {
    const trimmed = (joinCode ?? code).trim().toUpperCase()
    if (!trimmed) { setFehler('Bitte Code eingeben.'); return }
    if (istGast && !gastName.trim()) { setFehler('Bitte gib deinen Namen ein.'); return }
    setPhase('verbinden'); setFehler('')
    const { data, error } = await supabase.rpc('session_beitreten', {
      p_join_code: trimmed,
      p_gast_name: istGast ? gastName.trim() : null,
    })
    if (error || !data) {
      setFehler(error?.message ?? 'Session nicht gefunden oder bereits beendet.')
      setPhase('eingabe'); return
    }
    setSessionId(data)
    const { data: sess } = await supabase
      .from('unterricht_sessions')
      .select('*')
      .eq('id', data)
      .single()
    setSessionState(sess)
    if (sess?.aktuelles_stueck) await ladeStueck(sess.aktuelles_stueck)
    setPhase('aktiv')
  }

  async function refresh() {
    if (!sessionId) return
    setRefreshing(true)
    const { data: sess } = await supabase
      .from('unterricht_sessions').select('*').eq('id', sessionId).single()
    if (sess) {
      if (sess.status === 'beendet') { setPhase('beendet'); setRefreshing(false); return }
      setSessionState(sess)
      if (sess.aktuelles_stueck) await ladeStueck(sess.aktuelles_stueck)
      else setStueck(null)
    }
    setRefreshing(false)
  }

  async function reaktionSenden(typ, frage) {
    if (!sessionId) return
    await supabase.from('session_reaktionen').insert({
      session_id: sessionId,
      profil_id: profil?.id ?? null,
      gast_name: profil?.voller_name ?? (gastName.trim() || null),
      typ,
      frage: frage || null,
    })
    setReaktionGesendet(true)
    setZeigeFrageEingabe(false)
    setFrageText('')
    setTimeout(() => setReaktionGesendet(false), 2500)
  }

  // ── EINGABE / VERBINDEN ────────────────────────────────────────
  if (phase === 'eingabe' || phase === 'verbinden') {
    // Eingeloggte User mit URL-Code joinen automatisch — kein Formular zeigen
    const autoJoining = !authLaden && !istGast && urlCode
    if (authLaden || autoJoining) return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', fontFamily: "'Outfit', 'DM Sans', sans-serif" }}>
        <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
        <div style={{ fontSize: 16, color: 'var(--text-3)', fontWeight: 600 }}>{T('join_connecting')}</div>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');`}</style>
      </div>
    )
    return (
      <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', 'DM Sans', sans-serif" }}>
        <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            {rolle && <button onClick={() => navigate(startseiteNach(rolle))} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: '4px 8px' }}>← Dashboard</button>}
            <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>♩ Staccato</div>
          </div>
          {istGast && (
            <button onClick={() => navigate('/login')} style={{ background: 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', fontSize: 12, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: '6px 12px' }}>
              Einloggen
            </button>
          )}
        </div>
        <div style={{ ...s.center, flex: 1 }}>
          <div style={{ fontSize: 48, marginBottom: 16 }}>🎬</div>
          <h2 style={s.h2}>{T('join_title')}</h2>
          <p style={{ color: 'var(--text-3)', marginBottom: 24, textAlign: 'center', fontSize: 14 }}>
            {istGast ? 'Gib den Session-Code und deinen Namen ein.' : T('join_sub')}
          </p>
          {istGast && (
            <input
              value={gastName}
              onChange={e => setGastName(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && beitreten(code)}
              placeholder="Dein Name"
              maxLength={50}
              style={{ ...s.input, marginBottom: 10 }}
            />
          )}
          <input
            value={code}
            onChange={e => setCode(e.target.value.toUpperCase())}
            onKeyDown={e => e.key === 'Enter' && beitreten(code)}
            placeholder="ABC123"
            maxLength={6}
            style={{ ...s.input, textAlign: 'center', fontSize: 32, fontFamily: 'monospace', fontWeight: 900, letterSpacing: '0.25em', marginBottom: 12 }}
          />
          {fehler && <div style={s.fehler}>{fehler}</div>}
          <button onClick={() => beitreten(code)} disabled={phase === 'verbinden'} style={{ ...s.btnPri, width: '100%', fontSize: 16, padding: 14 }}>
            {phase === 'verbinden' ? T('join_connecting') : T('join_btn')}
          </button>
        </div>
        <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');`}</style>
      </div>
    )
  }

  // ── BEENDET ────────────────────────────────────────────────────
  if (phase === 'beendet') return (
    <div style={{ minHeight: '100vh', background: 'var(--bg)', display: 'flex', flexDirection: 'column', fontFamily: "'Outfit', sans-serif" }}>
      <div style={{ padding: '16px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', gap: 8 }}>
        {rolle && <button onClick={() => navigate(startseiteNach(rolle))} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: '4px 8px' }}>← Dashboard</button>}
        <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--primary)' }}>♩ Staccato</div>
      </div>
      <div style={{ ...s.center, flex: 1 }}>
        <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
        <h2 style={s.h2}>{T('session_ended_title')}</h2>
        <p style={{ color: 'var(--text-3)', marginBottom: 24, textAlign: 'center' }}>
          {T('join_session_ended')}
        </p>
        {istGast
          ? <button onClick={() => navigate('/login')} style={s.btnPri}>→ Einloggen</button>
          : <button onClick={() => navigate('/')} style={s.btnPri}>→ {T('dashboard')}</button>
        }
      </div>
    </div>
  )

  // ── AKTIV ──────────────────────────────────────────────────────
  const ansicht = sessionState?.aktuelle_ansicht
  const ansichtInfo = ANSICHT_INFO[ansicht] ?? { icon: '🎵', label: 'Präsentation' }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)', fontFamily: "'Outfit', 'DM Sans', sans-serif" }}>
      {/* Header */}
      <div style={{ padding: '12px 20px', background: 'var(--surface)', borderBottom: '1px solid var(--border)', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, zIndex: 10 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {rolle && <button onClick={() => navigate(startseiteNach(rolle))} style={{ background: 'none', border: 'none', fontSize: 13, color: 'var(--text-3)', cursor: 'pointer', fontFamily: 'inherit', fontWeight: 600, padding: '4px 8px' }}>← Dashboard</button>}
          <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--primary)' }}>♩ Staccato</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button onClick={refresh} disabled={refreshing} style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: 18, color: 'var(--text-3)', padding: '4px 6px', lineHeight: 1 }} title="Aktualisieren">
            {refreshing ? '…' : '↻'}
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11, color: '#16a34a', fontWeight: 700 }}>
            <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 1.5s infinite' }} />
            {T('join_live')}
          </div>
        </div>
      </div>

      {/* Inhalt */}
      <div style={{ flex: 1, padding: '20px', overflowY: 'auto', paddingBottom: 100 }}>
        {stueck ? (
          <>
            {/* Stück-Info */}
            <div style={{ marginBottom: 16 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
                {ansichtInfo.icon} {ansichtInfo.label}
              </div>
              <h2 style={{ margin: '0 0 4px', fontSize: 22, fontWeight: 800, color: 'var(--text)' }}>{stueck.titel}</h2>
              {stueck.komponist && <div style={{ fontSize: 14, color: 'var(--text-3)' }}>🎼 {stueck.komponist}</div>}
            </div>

            {/* Inhalt nach Ansichtstyp */}
            {ansicht === 'liedtext' && (
              stueck.liedtext
                ? <>
                    <div style={{ display: 'flex', gap: 6, marginBottom: 10, justifyContent: 'flex-end', alignItems: 'center' }}>
                      {[13, 16, 20].map(gr => (
                        <button key={gr} onClick={() => setLiedtextGroesse(gr)}
                          style={{ padding: '4px 10px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: liedtextGroesse === gr ? 'var(--primary)' : 'var(--bg-2)', color: liedtextGroesse === gr ? 'var(--primary-fg)' : 'var(--text-2)', fontSize: gr - 2, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit' }}>
                          A
                        </button>
                      ))}
                    </div>
                    {stueck.liedtext_md !== false
                      ? <div dangerouslySetInnerHTML={{ __html: safeMarkdown(stueck.liedtext) }} style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--border)', fontSize: liedtextGroesse, lineHeight: 1.8, color: 'var(--text)' }} />
                      : <pre style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--border)', fontSize: liedtextGroesse, lineHeight: 1.8, color: 'var(--text)', whiteSpace: 'pre-wrap', margin: 0, fontFamily: 'Georgia, serif', wordBreak: 'break-word' }}>{stueck.liedtext}</pre>
                    }
                  </>
                : <PlatzhalterBox info={ansichtInfo} />
            )}

            {ansicht === 'akkorde' && (
              stueck.notizen
                ? <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', padding: 20, border: '1px solid var(--border)', overflowX: 'auto' }}><ChordPro text={stueck.notizen} /></div>
                : dateien.filter(d => d.typ === 'akkorde').length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{dateien.filter(d => d.typ === 'akkorde').map(d => <AkkordText key={d.id} pfad={d.bucket_pfad} />)}</div>
                  : <PlatzhalterBox info={ansichtInfo} />
            )}

            {ansicht === 'noten' && (
              istGast
                ? <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
                    <div>Noten sind nur für eingeloggte Schüler verfügbar.</div>
                    <button onClick={() => navigate('/login')} style={{ ...s.btnPri, marginTop: 16, fontSize: 13 }}>Einloggen</button>
                  </div>
                : dateien.filter(d => d.typ === 'noten').length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
                      {dateien.filter(d => d.typ === 'noten').map(d => (
                        <div key={d.id}>
                          {d.stimme && d.stimme !== 'keine' && (
                            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', marginBottom: 6, textTransform: 'capitalize' }}>Stimme: {d.stimme}</div>
                          )}
                          <PdfInline pfad={d.bucket_pfad} />
                        </div>
                      ))}
                    </div>
                  : <PlatzhalterBox info={ansichtInfo} />
            )}

            {ansicht === 'youtube' && (
              stueck.youtube_url
                ? <div style={{ position: 'relative', paddingBottom: '56.25%', background: '#000', borderRadius: 'var(--radius-lg)', overflow: 'hidden' }}>
                    <iframe src={`https://www.youtube.com/embed/${getYouTubeId(stueck.youtube_url)}`} style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }} frameBorder="0" allowFullScreen allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" />
                  </div>
                : <PlatzhalterBox info={ansichtInfo} />
            )}

            {ansicht === 'dateiverwaltung' && (
              istGast
                ? <div style={{ padding: '32px 24px', textAlign: 'center', background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', color: 'var(--text-3)', fontSize: 14 }}>
                    <div style={{ fontSize: 32, marginBottom: 8 }}>🔒</div>
                    <div>Datei-Downloads sind nur für eingeloggte Schüler verfügbar.</div>
                    <button onClick={() => navigate('/login')} style={{ ...s.btnPri, marginTop: 16, fontSize: 13 }}>Einloggen</button>
                  </div>
                : dateien.length > 0
                  ? <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                      {dateien.map(d => (
                        <DateiZeile key={d.id} datei={d} />
                      ))}
                    </div>
                  : <PlatzhalterBox info={ansichtInfo} />
            )}
          </>
        ) : (
          <div style={{ padding: '64px 24px', textAlign: 'center', color: 'var(--text-3)' }}>
            <div style={{ fontSize: 48, marginBottom: 12 }}>⏳</div>
            <div style={{ fontSize: 15, fontWeight: 600 }}>{T('join_waiting_teacher')}</div>
            <div style={{ fontSize: 12, marginTop: 6 }}>{T('join_lesson_starting')}</div>
          </div>
        )}
      </div>

      {/* Frage-Eingabe (erscheint wenn ✋ gedrückt) */}
      {zeigeFrageEingabe && (
        <div style={{ padding: '12px 16px', background: 'var(--surface)', borderTop: '1px solid var(--border)' }}>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={frageText}
              onChange={e => setFrageText(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && frageText.trim() && reaktionSenden('hand_hoch', frageText)}
              placeholder={T('join_your_question')}
              autoFocus
              style={{ ...s.input, flex: 1 }}
            />
            <button onClick={() => frageText.trim() && reaktionSenden('hand_hoch', frageText)} style={s.btnPri}>
              {T('join_send')}
            </button>
            <button onClick={() => { setZeigeFrageEingabe(false); setFrageText('') }} style={s.btnSek}>
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Reaktions-Leiste */}
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '12px 16px 28px', background: 'var(--surface)', borderTop: '2px solid var(--border)' }}>
        {reaktionGesendet ? (
          <div style={{ textAlign: 'center', fontSize: 15, color: 'var(--primary)', fontWeight: 700, padding: 8 }}>
            {T('join_reaction_sent')}
          </div>
        ) : (
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center' }}>
            {REAKTION_TYPEN.map(({ typ, emoji, label }) => (
              <button key={typ}
                onClick={() => typ === 'hand_hoch' ? setZeigeFrageEingabe(v => !v) : reaktionSenden(typ)}
                style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, background: zeigeFrageEingabe && typ === 'hand_hoch' ? 'var(--bg-2)' : 'none', border: '1.5px solid var(--border)', borderRadius: 'var(--radius)', padding: '10px 14px', cursor: 'pointer', fontFamily: 'inherit', flex: 1, maxWidth: 72 }}>
                <span style={{ fontSize: 26 }}>{emoji}</span>
                <span style={{ fontSize: 10, color: 'var(--text-3)', fontWeight: 600 }}>{label}</span>
              </button>
            ))}
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )
}

const s = {
  center: { display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: 24, maxWidth: 380, margin: '0 auto', width: '100%' },
  h2:     { margin: '0 0 8px', fontSize: 22, fontWeight: 800, color: 'var(--text)' },
  input:  { padding: '12px 16px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', width: '100%', boxSizing: 'border-box' },
  btnPri: { padding: '12px 20px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', whiteSpace: 'nowrap' },
  btnSek: { padding: '10px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  fehler: { padding: '10px 14px', borderRadius: 'var(--radius)', background: '#fee2e2', color: 'var(--danger)', fontWeight: 600, fontSize: 13, marginBottom: 12, width: '100%', boxSizing: 'border-box', textAlign: 'center' },
}
