import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import QRCode from 'qrcode'
import { ChevronLeft, Hand, ThumbsUp, ThumbsDown, Heart, CircleHelp, MonitorUp, Copy, Check, Play } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { safeMarkdown } from '../../lib/markdown'
import { useApp } from '../../context/AppContext'
import { liedFarbe } from '../../ui'
import ChordPro from '../../components/stueck/ChordProRenderer'
import { useNeuLaden } from '../daten'
import { uhrzeit, tagKey } from '../zeit'

// Feste dunkle Farben: im Raum blendet nichts, unabhängig von hell/dunkel
const F = { bg: '#0B0B0D', karte: '#1C1C21', linie: '#2A2A30', text: '#F5F5F7', text2: '#A1A1AA', akzent: '#FB923C', gruen: '#4ADE80' }

const ANSICHTEN = [
  ['liedtext', 'piece_lyrics'], ['akkorde', 'piece_chords'], ['noten', 'piece_notes_label'], ['youtube', 'nl_video'], ['dateiverwaltung', 'nl_dateien'],
]
const REAKTIONEN = [
  ['hand_hoch', Hand, '#FBBF24', 'nl_r_meldung'], ['daumen_hoch', ThumbsUp, F.gruen, 'nl_r_passt'],
  ['verwirrung', CircleHelp, '#60A5FA', 'nl_r_unklar'], ['daumen_runter', ThumbsDown, '#F87171', 'nl_r_nein'], ['herz', Heart, '#F472B6', 'nl_r_herz'],
]

function hatAnsicht(st, a) {
  const typen = new Set((st?.stueck_dateien ?? []).map(d => d.typ))
  if (a === 'liedtext') return !!st?.liedtext
  if (a === 'akkorde') return !!st?.notizen || typen.has('akkorde')
  if (a === 'noten') return typen.has('noten')
  if (a === 'youtube') return !!st?.youtube_url
  return (st?.stueck_dateien ?? []).length > 0
}
const ersteAnsicht = st => ANSICHTEN.map(([a]) => a).find(a => hatAnsicht(st, a)) ?? 'liedtext'

export default function LehrerLive() {
  const { id: kursId } = useParams()
  const navigate = useNavigate()
  const { T, lang, zeitzone, toast } = useApp()
  const neuLaden = useNeuLaden()
  const [phase, setPhase] = useState('start')   // start | aktiv | beendet
  const [stundeId, setStundeId] = useState('')
  const [oeffentlich, setOeffentlich] = useState(false)
  const [session, setSession] = useState(null)
  const [qr, setQr] = useState('')
  const [teilnehmer, setTeilnehmer] = useState([])
  const [reaktionen, setReaktionen] = useState([])
  const [liveStueck, setLiveStueck] = useState(null)
  const [liveAnsicht, setLiveAnsicht] = useState(null)
  const [laden, setLaden] = useState(false)
  const [kopiert, setKopiert] = useState(false)
  const [beamerCode, setBeamerCode] = useState('')
  const [beamerAn, setBeamerAn] = useState(false)
  const [beamerEingabe, setBeamerEingabe] = useState(false)
  const [beamerSchrift, setBeamerSchrift] = useState(28)
  const [gestartet, setGestartet] = useState(null)
  const broadcastRef = useRef(null)
  const beamerRef = useRef(null)

  const { data } = useQuery({
    queryKey: ['nl-live', kursId],
    queryFn: async () => {
      const von = new Date(Date.now() - 86400000).toISOString()
      const bis = new Date(Date.now() + 86400000).toISOString()
      const [k, st, us, aktiv] = await Promise.all([
        supabase.from('unterricht').select('id, name').eq('id', kursId).single(),
        supabase.from('stunden').select('id, beginn, ende, status').eq('unterricht_id', kursId).gte('beginn', von).lte('beginn', bis).order('beginn'),
        supabase.from('unterricht_stuecke').select('status, reihenfolge, stuecke(id, titel, komponist, youtube_url, liedtext, liedtext_md, notizen, stueck_dateien(id, typ, name, bucket_pfad, stimme))').eq('unterricht_id', kursId),
        supabase.from('unterricht_sessions').select('id, join_code, aktuelles_stueck, aktuelle_ansicht, gestartet_am, oeffentlich, stunde_id').eq('unterricht_id', kursId).eq('status', 'aktiv').maybeSingle(),
      ])
      const heute = tagKey(new Date().toISOString(), zeitzone)
      const stuecke = (us.data ?? []).filter(u => u.stuecke && u.status !== 'archiviert' && u.status !== 'abgeschlossen')
        .sort((a, b) => (a.status === 'aktuell' ? 0 : 1) - (b.status === 'aktuell' ? 0 : 1) || (a.reihenfolge ?? 0) - (b.reihenfolge ?? 0))
        .map(u => u.stuecke)
      return {
        kurs: k.data,
        stunden: (st.data ?? []).filter(s => tagKey(s.beginn, zeitzone) === heute && s.status !== 'abgesagt'),
        stuecke,
        vorhanden: aktiv.data,
      }
    },
  })
  const stuecke = data?.stuecke ?? []
  const stunden = data?.stunden ?? []

  const gewaehlteStunde = stundeId || stunden[0]?.id || ''

  async function ladeTeilnehmer(sid) {
    const { data: tn } = await supabase.from('session_teilnehmer').select('id, profil_id, gast_name, profiles(voller_name)').eq('session_id', sid)
    setTeilnehmer(tn ?? [])
  }

  // Realtime: Teilnehmer und Reaktionen
  useEffect(() => {
    if (!session) return
    ladeTeilnehmer(session.id)
    const ch = supabase.channel(`session-lehrer-${session.id}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'session_teilnehmer', filter: `session_id=eq.${session.id}` }, () => ladeTeilnehmer(session.id))
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'session_reaktionen', filter: `session_id=eq.${session.id}` }, p => setReaktionen(prev => [p.new, ...prev].slice(0, 200)))
      .subscribe()
    const bc = supabase.channel(`session-live-${session.id}`).subscribe()
    broadcastRef.current = bc
    const sichtbar = () => document.visibilityState === 'visible' && ladeTeilnehmer(session.id)
    document.addEventListener('visibilitychange', sichtbar)
    return () => { ch.unsubscribe(); bc.unsubscribe(); document.removeEventListener('visibilitychange', sichtbar) }
  }, [session])

  // Laufzeit-Anzeige
  const [, setTick] = useState(0)
  useEffect(() => {
    if (phase !== 'aktiv') return
    const t = setInterval(() => setTick(n => n + 1), 30000)
    return () => clearInterval(t)
  }, [phase])

  async function aktivieren(s, start) {
    setQr(await QRCode.toDataURL(`${window.location.origin}/session/${s.join_code}`, { width: 320, margin: 1 }))
    setSession(s)
    setGestartet(start)
    setPhase('aktiv')
  }

  async function starten() {
    setLaden(true)
    const { data: d, error } = await supabase.rpc('session_starten', { p_unterricht_id: kursId, p_stunde_id: gewaehlteStunde || null, p_oeffentlich: oeffentlich })
    setLaden(false)
    if (error || !d?.[0]) { toast(error?.message ?? T('nl_live_fehler'), 'error'); return }
    await aktivieren({ id: d[0].session_id, join_code: d[0].join_code, stunde_id: gewaehlteStunde || null }, Date.now())
  }

  async function fortsetzen() {
    const v = data.vorhanden
    if (v.aktuelles_stueck) setLiveStueck(v.aktuelles_stueck)
    if (v.aktuelle_ansicht) setLiveAnsicht(v.aktuelle_ansicht)
    await aktivieren({ id: v.id, join_code: v.join_code, stunde_id: v.stunde_id }, new Date(v.gestartet_am).getTime())
  }

  async function zeigen(st, ansicht) {
    if (!session) return
    setLiveStueck(st.id); setLiveAnsicht(ansicht)
    await supabase.rpc('session_praesentation_wechseln', { p_session_id: session.id, p_ansicht: ansicht, p_stueck_id: st.id })
    broadcastRef.current?.send({ type: 'broadcast', event: 'state', payload: { aktuelles_stueck: st.id, aktuelle_ansicht: ansicht } })
    if (beamerRef.current) {
      const signed_urls = ansicht === 'noten'
        ? await Promise.all((st.stueck_dateien ?? []).filter(d => d.typ === 'noten').map(async d => {
          const { data: u } = await supabase.storage.from('stueck-dateien').createSignedUrl(d.bucket_pfad, 3600)
          return { stimme: d.stimme, url: u?.signedUrl ?? null }
        }))
        : []
      beamerRef.current.send({ type: 'broadcast', event: 'state', payload: {
        aktuelles_stueck: st.id, aktuelle_ansicht: ansicht, signed_urls,
        stueck: { titel: st.titel, komponist: st.komponist, liedtext: st.liedtext, notizen: st.notizen, youtube_url: st.youtube_url },
      } })
    }
  }

  function beamerVerbinden() {
    const code = beamerCode.trim().toUpperCase()
    if (code.length !== 4) return
    beamerRef.current?.unsubscribe()
    beamerRef.current = supabase.channel(`beamer-${code}`).subscribe()
    setBeamerAn(true); setBeamerEingabe(false)
    const st = stuecke.find(s => s.id === liveStueck)
    if (st && liveAnsicht) setTimeout(() => zeigen(st, liveAnsicht), 800)
  }

  function beamerSchriftAendern(d) {
    const neu = Math.min(60, Math.max(16, beamerSchrift + d))
    setBeamerSchrift(neu)
    beamerRef.current?.send({ type: 'broadcast', event: 'font_size', payload: { size: neu } })
  }

  async function beenden() {
    setLaden(true)
    broadcastRef.current?.send({ type: 'broadcast', event: 'state', payload: { status: 'beendet' } })
    beamerRef.current?.send({ type: 'broadcast', event: 'state', payload: { status: 'beendet' } })
    await supabase.rpc('session_beenden', { p_session_id: session.id })
    beamerRef.current?.unsubscribe(); beamerRef.current = null
    setLaden(false)
    setPhase('beendet')
    neuLaden('nl-stunden', 'nl-stunde', 'nl-kurs')
  }

  function kopieren() {
    navigator.clipboard?.writeText(`${window.location.origin}/session/${session.join_code}`)
    setKopiert(true); setTimeout(() => setKopiert(false), 2000)
  }

  const minuten = gestartet ? Math.max(0, Math.round((Date.now() - gestartet) / 60000)) : 0
  const aktuell = stuecke.find(s => s.id === liveStueck)
  const zaehle = typ => reaktionen.filter(r => r.typ === typ).length

  return (
    <div style={{ minHeight: '100dvh', background: F.bg, color: F.text, paddingBottom: 48 }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ padding: 'calc(10px + env(safe-area-inset-top, 0px)) 12px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          {phase === 'aktiv' ? <span /> : (
            <Link to={`/lehrer/kurse/${kursId}`} style={{ minHeight: 44, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 2, fontSize: 17, fontWeight: 600, color: F.akzent, textDecoration: 'none' }}>
              <ChevronLeft aria-hidden="true" size={24} />{data?.kurs?.name ?? T('nl_tab_kurse')}
            </Link>
          )}
          {phase === 'aktiv' && (
            <button onClick={beenden} disabled={laden} style={{ height: 44, padding: '0 18px', borderRadius: 12, border: 'none', background: F.linie, color: F.text, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>{T('nl_beenden')}</button>
          )}
        </div>

        <header style={{ padding: '8px 20px 0' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: F.akzent }}>
            {phase === 'aktiv' && <span aria-hidden="true" style={{ width: 9, height: 9, borderRadius: 5, background: '#EF4444' }} />}
            {phase === 'aktiv' ? T('nl_live_seit').replace('{n}', minuten) : phase === 'beendet' ? T('nl_live_beendet') : T('nl_live_unterricht')}
          </div>
          <h1 style={{ margin: '4px 0 0', fontSize: 30, lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em' }}>{data?.kurs?.name ?? ' '}</h1>
        </header>

        {phase === 'start' && (
          <section style={{ margin: '24px 20px 0', display: 'flex', flexDirection: 'column', gap: 16 }}>
            {data?.vorhanden && (
              <div style={{ padding: 18, borderRadius: 22, background: F.karte }}>
                <div style={{ fontSize: 18, fontWeight: 700 }}>{T('nl_live_laeuft_noch')}</div>
                <div style={{ marginTop: 4, fontSize: 16, color: F.text2 }}>{T('nl_code')}: {data.vorhanden.join_code}</div>
                <button onClick={fortsetzen} style={grossKnopf(F.akzent, '#111114')}>{T('nl_fortsetzen')}</button>
              </div>
            )}
            {stunden.length > 1 && (
              <label style={{ display: 'flex', flexDirection: 'column', gap: 8, fontSize: 16, fontWeight: 600, color: F.text2 }}>
                {T('nl_welche_stunde')}
                <select value={gewaehlteStunde} onChange={e => setStundeId(e.target.value)} style={{ minHeight: 52, padding: '0 14px', borderRadius: 14, border: `1.5px solid ${F.linie}`, background: F.karte, color: F.text, fontFamily: 'inherit', fontSize: 17 }}>
                  {stunden.map(s => <option key={s.id} value={s.id}>{uhrzeit(s.beginn, zeitzone, lang)} – {uhrzeit(s.ende, zeitzone, lang)}</option>)}
                </select>
              </label>
            )}
            {stunden.length === 0 && <div style={{ fontSize: 16, color: F.text2, lineHeight: 1.5 }}>{T('nl_live_ohne_stunde')}</div>}
            <button role="switch" aria-checked={oeffentlich} onClick={() => setOeffentlich(!oeffentlich)} style={{ display: 'flex', alignItems: 'center', gap: 14, padding: 16, borderRadius: 18, border: 'none', background: F.karte, color: F.text, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
              <span style={{ flex: 1 }}>
                <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{T('nl_gaeste_erlauben')}</span>
                <span style={{ display: 'block', fontSize: 15, color: F.text2, marginTop: 2 }}>{T('nl_gaeste_hinweis')}</span>
              </span>
              <span aria-hidden="true" style={{ width: 60, height: 36, borderRadius: 18, padding: 3, boxSizing: 'border-box', background: oeffentlich ? F.akzent : F.linie, display: 'flex', justifyContent: oeffentlich ? 'flex-end' : 'flex-start' }}>
                <span style={{ width: 30, height: 30, borderRadius: 15, background: '#FFFFFF' }} />
              </span>
            </button>
            <button onClick={starten} disabled={laden || !data} style={grossKnopf(F.akzent, '#111114')}>
              <Play aria-hidden="true" size={18} fill="currentColor" />{T('nl_unterricht_starten')}
            </button>
          </section>
        )}

        {phase === 'aktiv' && session && (
          <>
            <section style={{ margin: '20px 20px 0', padding: 18, borderRadius: 22, background: F.karte, display: 'flex', alignItems: 'center', gap: 18, flexWrap: 'wrap' }}>
              {qr && <img src={qr} alt={T('nl_qr_alt')} style={{ width: 120, height: 120, borderRadius: 12, background: '#FFFFFF' }} />}
              <div style={{ minWidth: 0, flex: 1 }}>
                <div style={{ fontSize: 15, color: F.text2 }}>{T('nl_beitreten_mit_code')}</div>
                <div style={{ fontSize: 34, fontWeight: 800, letterSpacing: '0.12em', fontVariantNumeric: 'tabular-nums' }}>{session.join_code}</div>
                <div style={{ marginTop: 4, fontSize: 16, fontWeight: 600, color: F.gruen }}>{T('nl_verbunden_n').replace('{n}', teilnehmer.length)}</div>
                <button onClick={kopieren} style={{ marginTop: 10, minHeight: 40, padding: '0 14px', borderRadius: 20, border: 'none', background: F.linie, color: F.text, fontFamily: 'inherit', fontSize: 15, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                  {kopiert ? <Check aria-hidden="true" size={16} /> : <Copy aria-hidden="true" size={16} />}{kopiert ? T('nl_kopiert') : T('nl_link_kopieren')}
                </button>
              </div>
            </section>

            <section style={{ margin: '24px 20px 0' }}>
              <div style={ueberschrift}>{T('nl_alle_sehen')}</div>
              {aktuell ? (
                <div style={{ marginTop: 10, padding: 18, borderRadius: 22, background: liedFarbe(aktuell.id) }}>
                  <div style={{ fontSize: 26, fontWeight: 800, letterSpacing: '-0.01em' }}>{aktuell.titel}</div>
                  {aktuell.komponist && <div style={{ fontSize: 16, color: 'rgba(255,255,255,0.78)' }}>{aktuell.komponist}</div>}
                  <div role="group" aria-label={T('nl_ansicht_fuer_alle')} style={{ marginTop: 16, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                    {ANSICHTEN.filter(([a]) => hatAnsicht(aktuell, a)).map(([a, label]) => (
                      <button key={a} onClick={() => zeigen(aktuell, a)} aria-pressed={liveAnsicht === a} style={{ minHeight: 44, padding: '0 16px', borderRadius: 22, border: 'none', background: liveAnsicht === a ? '#FFFFFF' : 'rgba(0,0,0,0.28)', color: liveAnsicht === a ? '#111114' : '#FFFFFF', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>{T(label)}</button>
                    ))}
                  </div>
                  {liveAnsicht === 'liedtext' && aktuell.liedtext && (
                    <div className="n-lied-text" style={{ marginTop: 18, fontSize: 18, lineHeight: 1.5, fontWeight: 600, ...(aktuell.liedtext_md === false ? { whiteSpace: 'pre-wrap' } : {}) }}
                      {...(aktuell.liedtext_md === false ? { children: aktuell.liedtext } : { dangerouslySetInnerHTML: { __html: safeMarkdown(aktuell.liedtext) } })} />
                  )}
                  {liveAnsicht === 'akkorde' && aktuell.notizen && (
                    <div style={{ marginTop: 18, overflowX: 'auto', '--text': '#FFFFFF', '--text-2': '#E8EEF2', '--text-3': '#E8EEF2', '--primary': '#FDBA74', '--accent': '#FDBA74' }}><ChordPro text={aktuell.notizen} /></div>
                  )}
                </div>
              ) : (
                <div style={{ marginTop: 10, padding: 18, borderRadius: 22, background: F.karte, fontSize: 17, color: F.text2 }}>{T('nl_noch_nichts_gezeigt')}</div>
              )}
            </section>

            <section style={{ margin: '24px 20px 0' }}>
              <div style={ueberschrift}>{T('nl_rueckmeldungen')}</div>
              <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(96px, 1fr))', gap: 10 }}>
                {REAKTIONEN.map(([typ, Icon, farbe, label]) => (
                  <div key={typ} style={{ padding: '14px 10px', borderRadius: 18, background: F.karte, textAlign: 'center' }}>
                    <Icon aria-hidden="true" size={26} color={farbe} />
                    <div style={{ fontSize: 24, fontWeight: 800 }}>{zaehle(typ)}</div>
                    <div style={{ fontSize: 14, color: F.text2 }}>{T(label)}</div>
                  </div>
                ))}
              </div>
            </section>

            {reaktionen.some(r => r.frage) && (
              <section style={{ margin: '24px 20px 0' }}>
                <div style={ueberschrift}>{T('nl_fragen')}</div>
                <div style={{ marginTop: 10, borderRadius: 18, background: F.karte, overflow: 'hidden' }}>
                  {reaktionen.filter(r => r.frage).slice(0, 10).map((r, i) => (
                    <div key={r.id} style={{ padding: '12px 16px', borderTop: i ? `1px solid ${F.linie}` : 'none' }}>
                      <div style={{ fontSize: 17, lineHeight: 1.4 }}>{r.frage}</div>
                      <div style={{ fontSize: 14, color: F.text2, marginTop: 2 }}>{teilnehmer.find(t => t.profil_id && t.profil_id === r.profil_id)?.profiles?.voller_name ?? r.gast_name ?? ''}</div>
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section style={{ margin: '24px 20px 0' }}>
              <div style={ueberschrift}>{aktuell ? T('nl_weitere_lieder') : T('n_tab_lieder')}</div>
              <div style={{ marginTop: 10, borderRadius: 18, background: F.karte, overflow: 'hidden' }}>
                {stuecke.filter(st => st.id !== liveStueck).map((st, i) => (
                  <button key={st.id} onClick={() => zeigen(st, ersteAnsicht(st))} style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 14, padding: '12px 16px', border: 'none', borderTop: i ? `1px solid ${F.linie}` : 'none', background: 'transparent', color: F.text, fontFamily: 'inherit', textAlign: 'left', cursor: 'pointer' }}>
                    <span aria-hidden="true" style={{ width: 40, height: 40, flexShrink: 0, borderRadius: 10, background: liedFarbe(st.id) }} />
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span style={{ display: 'block', fontSize: 17, fontWeight: 600 }}>{st.titel}</span>
                      {st.komponist && <span style={{ display: 'block', fontSize: 15, color: F.text2 }}>{st.komponist}</span>}
                    </span>
                    <span style={{ fontSize: 15, fontWeight: 700, color: F.akzent }}>{T('nl_zeigen')}</span>
                  </button>
                ))}
                {stuecke.length === 0 && <div style={{ padding: 18, fontSize: 16, color: F.text2 }}>{T('n_noch_keine_lieder')}</div>}
              </div>
            </section>

            {teilnehmer.length > 0 && (
              <section style={{ margin: '24px 20px 0' }}>
                <div style={ueberschrift}>{T('nl_verbunden')}</div>
                <div style={{ marginTop: 10, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {teilnehmer.map(t => (
                    <span key={t.id} style={{ padding: '8px 12px', borderRadius: 16, background: F.karte, fontSize: 15 }}>{t.profiles?.voller_name ?? t.gast_name ?? T('nl_gast')}</span>
                  ))}
                </div>
              </section>
            )}

            <section style={{ margin: '24px 20px 0', padding: 16, borderRadius: 18, background: F.karte }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
                <MonitorUp aria-hidden="true" size={22} />
                <span style={{ flex: 1, fontSize: 17, fontWeight: 600 }}>{beamerAn ? T('nl_beamer_verbunden') : T('nl_beamer')}</span>
                {beamerAn ? (
                  <span style={{ display: 'flex', gap: 8 }}>
                    <button onClick={() => beamerSchriftAendern(-4)} aria-label={T('n_schrift_kleiner')} style={kleinKnopf}>A−</button>
                    <button onClick={() => beamerSchriftAendern(4)} aria-label={T('n_schrift_groesser')} style={kleinKnopf}>A+</button>
                  </span>
                ) : !beamerEingabe && (
                  <button onClick={() => setBeamerEingabe(true)} style={kleinKnopf}>{T('nl_verbinden')}</button>
                )}
              </div>
              {beamerEingabe && !beamerAn && (
                <div style={{ marginTop: 12, display: 'flex', gap: 8 }}>
                  <input value={beamerCode} onChange={e => setBeamerCode(e.target.value.toUpperCase().slice(0, 4))} placeholder="ABCD" aria-label={T('nl_beamer_code')}
                    style={{ flex: 1, minHeight: 48, padding: '0 14px', borderRadius: 12, border: `1.5px solid ${F.linie}`, background: F.bg, color: F.text, fontFamily: 'inherit', fontSize: 20, letterSpacing: '0.2em', fontWeight: 700 }} />
                  <button onClick={beamerVerbinden} disabled={beamerCode.trim().length !== 4} style={kleinKnopf}>{T('nl_verbinden')}</button>
                </div>
              )}
              <div style={{ marginTop: 8, fontSize: 14, color: F.text2 }}>{T('nl_beamer_hinweis')}</div>
            </section>
          </>
        )}

        {phase === 'beendet' && (
          <section style={{ margin: '40px 20px 0', padding: '28px 22px', borderRadius: 24, background: F.karte, textAlign: 'center' }}>
            <span style={{ width: 64, height: 64, margin: '0 auto', borderRadius: 32, background: '#14532D', color: F.gruen, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <Check aria-hidden="true" size={32} strokeWidth={2.4} />
            </span>
            <div style={{ marginTop: 16, fontSize: 24, fontWeight: 800 }}>{T('nl_live_beendet')}</div>
            <div style={{ marginTop: 6, fontSize: 17, lineHeight: 1.45, color: F.text2 }}>
              {session?.stunde_id ? T('nl_live_beendet_text').replace('{n}', teilnehmer.filter(t => t.profil_id).length) : T('nl_live_beendet_ohne')}
            </div>
            {session?.stunde_id && (
              <button onClick={() => navigate(`/lehrer/stunde/${session.stunde_id}`, { state: { zurueck: { to: `/lehrer/kurse/${kursId}`, label: data?.kurs?.name } } })} style={grossKnopf(F.akzent, '#111114')}>{T('nl_stunde_abschliessen')}</button>
            )}
            <Link to={`/lehrer/kurse/${kursId}`} style={{ marginTop: 10, minHeight: 48, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 17, fontWeight: 600, color: F.akzent, textDecoration: 'none' }}>{T('nl_zurueck_zum_kurs')}</Link>
          </section>
        )}
      </div>
    </div>
  )
}

const ueberschrift = { fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: F.text2 }
const kleinKnopf = { minHeight: 44, padding: '0 16px', borderRadius: 12, border: 'none', background: F.linie, color: F.text, fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }
const grossKnopf = (bg, fg) => ({ marginTop: 18, width: '100%', height: 56, borderRadius: 16, border: 'none', background: bg, color: fg, fontFamily: 'inherit', fontSize: 18, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8 })
