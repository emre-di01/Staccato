import { useEffect, useRef, useState } from 'react'
import QRCode from 'qrcode'
import { Music, FileText, Guitar, Play, FolderOpen, Maximize, Minimize, Minus, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { safeMarkdown } from '../../lib/markdown'
import { useApp } from '../../context/AppContext'
import LiedAngaben from '../LiedAngaben'
import { UI_CSS } from '../../ui'
import ChordPro from '../../components/stueck/ChordProRenderer'
import { NotenBeamer } from '../beamerNoten'

// Öffentliche Beamer-Anzeige (/beamer). Zeigt einen 4-stelligen Code; die Lehrkraft verbindet
// sich im Live-Unterricht damit und schickt per Broadcast `beamer-<code>` Stück + Ansicht.
// Solange verbunden, steht der Beitritts-Code des Live-Unterrichts (join_code) immer mit QR da.
const F = { bg: '#000000', karte: '#1C1C21', linie: '#2A2A30', text: '#F5F5F7', text2: '#A1A1AA', text3: '#8E8E96', akzent: '#FB923C', gruen: '#4ADE80' }
const ZEICHEN = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
const neuerCode = () => Array.from({ length: 4 }, () => ZEICHEN[Math.floor(Math.random() * ZEICHEN.length)]).join('')
const ANSICHTEN = {
  liedtext: [FileText, 'piece_lyrics'], akkorde: [Guitar, 'piece_chords'], noten: [Music, 'piece_notes_label'],
  youtube: [Play, 'nl_video'], dateiverwaltung: [FolderOpen, 'nl_dateien'],
}
const QR_FARBEN = { dark: '#000000', light: '#FFFFFF' }

function youtubeId(url) {
  const m = url?.match(/(?:youtu\.be\/|v=|embed\/|shorts\/)([\w-]{11})/)
  return m?.[1] ?? null
}

export default function NeuBeamer() {
  const { T } = useApp()
  const [code, setCode] = useState(neuerCode)
  const [qr, setQr] = useState('')
  const [liveQr, setLiveQr] = useState('')
  const [daten, setDaten] = useState(null)
  const [groesse, setGroesse] = useState(28)
  const [vollbild, setVollbild] = useState(false)
  const kanal = useRef(null)
  const notenBefehl = useRef(null)
  const joinCode = daten?.join_code
  const liveLink = joinCode ? `${window.location.origin}/session/${joinCode}` : ''

  useEffect(() => {
    QRCode.toDataURL(code, { width: 360, margin: 1, color: QR_FARBEN }).then(setQr)
  }, [code])

  useEffect(() => {
    if (liveLink) QRCode.toDataURL(liveLink, { width: 480, margin: 1, color: QR_FARBEN }).then(setLiveQr)
  }, [liveLink])

  useEffect(() => {
    const ch = supabase.channel(`beamer-${code}`)
      .on('broadcast', { event: 'state' }, ({ payload }) => {
        if (payload.status === 'beendet') { setDaten(null); setCode(neuerCode()); return }
        // Ältere Absender schicken den Beitritts-Code nicht jedes Mal mit → behalten
        setDaten(alt => ({ ...payload, join_code: payload.join_code ?? alt?.join_code }))
      })
      .on('broadcast', { event: 'font_size' }, ({ payload }) => { if (payload?.size) setGroesse(payload.size) })
      .on('broadcast', { event: 'noten_befehl' }, ({ payload }) => notenBefehl.current?.(payload))
      .subscribe()
    kanal.current = ch
    return () => { ch.unsubscribe(); kanal.current = null }
  }, [code])

  useEffect(() => {
    const wechsel = () => setVollbild(!!document.fullscreenElement)
    document.addEventListener('fullscreenchange', wechsel)
    return () => document.removeEventListener('fullscreenchange', wechsel)
  }, [])

  const senden = (event, payload) => kanal.current?.send({ type: 'broadcast', event, payload })
  const schrift = d => setGroesse(g => Math.min(60, Math.max(16, g + d)))
  function vollbildUmschalten() {
    if (document.fullscreenElement) document.exitFullscreen?.()
    else document.documentElement.requestFullscreen?.().catch(() => {})
  }

  const leiste = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
      {daten && ['liedtext', 'akkorde'].includes(daten.aktuelle_ansicht) && <>
        <button onClick={() => schrift(-4)} aria-label={T('nb_kleiner')} style={rundKnopf}><Minus size={20} aria-hidden="true" /></button>
        <button onClick={() => schrift(4)} aria-label={T('nb_groesser')} style={rundKnopf}><Plus size={20} aria-hidden="true" /></button>
      </>}
      {document.fullscreenEnabled && (
        <button onClick={vollbildUmschalten} aria-label={T(vollbild ? 'nb_vollbild_aus' : 'nb_vollbild')} style={rundKnopf}>
          {vollbild ? <Minimize size={20} aria-hidden="true" /> : <Maximize size={20} aria-hidden="true" />}
        </button>
      )}
    </div>
  )

  // ── Warten auf Verbindung ──
  if (!daten) return (
    <Huelle>
      <div style={{ position: 'fixed', top: 20, right: 24 }}>{leiste}</div>
      <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 'clamp(32px, 6vw, 96px)' }}>
          <div style={{ maxWidth: 520 }}>
            <Marke />
            <h1 style={{ margin: '28px 0 0', fontSize: 'clamp(32px, 4vw, 48px)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em' }}>{T('nb_titel')}</h1>
            <p style={{ margin: '14px 0 0', fontSize: 'clamp(18px, 1.8vw, 22px)', lineHeight: 1.5, color: F.text2 }}>{T('nb_anleitung')}</p>
            <div style={{ marginTop: 28, fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: F.text3 }}>{T('nb_code')}</div>
            <div aria-live="polite" style={{ marginTop: 6, fontSize: 'clamp(64px, 9vw, 112px)', lineHeight: 1, fontWeight: 800, letterSpacing: '0.16em', fontVariantNumeric: 'tabular-nums' }}>{code}</div>
            <div role="status" style={{ marginTop: 28, display: 'flex', alignItems: 'center', gap: 10, fontSize: 17, color: F.text2 }}>
              <span aria-hidden="true" className="nb-puls" style={{ width: 10, height: 10, borderRadius: 5, background: F.gruen }} />{T('nb_bereit')}
            </div>
          </div>
          {qr && (
            <div style={{ padding: 20, borderRadius: 28, background: '#FFFFFF' }}>
              <img src={qr} alt={`${T('nb_code')}: ${code}`} style={{ width: 'clamp(180px, 22vw, 280px)', height: 'auto', display: 'block' }} />
            </div>
          )}
        </div>
      </main>
    </Huelle>
  )

  // ── Verbunden ──
  const { stueck, aktuelle_ansicht: ansicht, signed_urls = [] } = daten
  const [Icon, labelKey] = ANSICHTEN[ansicht] ?? [Music, null]
  const yt = youtubeId(stueck?.youtube_url)
  const noten = signed_urls.filter(f => f.url)
  const leer = <Hinweis icon={Icon} text={T('nl_kein_inhalt')} />

  // Noch nichts gezeigt: Beitritts-Code groß in der Mitte
  if (!ansicht) return (
    <Huelle>
      <div style={{ position: 'fixed', top: 20, right: 24 }}>{leiste}</div>
      <main style={{ minHeight: '100dvh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24, boxSizing: 'border-box' }}>
        {joinCode ? (
          <div style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'center', gap: 'clamp(32px, 6vw, 96px)' }}>
            <div style={{ maxWidth: 560 }}>
              <Marke />
              <h1 style={{ margin: '28px 0 0', fontSize: 'clamp(32px, 4vw, 52px)', lineHeight: 1.1, fontWeight: 800, letterSpacing: '-0.02em' }}>{T('nb_mitmachen_titel')}</h1>
              <p style={{ margin: '14px 0 0', fontSize: 'clamp(18px, 1.8vw, 24px)', lineHeight: 1.5, color: F.text2 }}>{T('nb_mitmachen_text')}</p>
              <div style={{ marginTop: 28, fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: F.text3 }}>{T('nl_code')}</div>
              <div style={{ marginTop: 6, fontSize: 'clamp(64px, 9vw, 112px)', lineHeight: 1, fontWeight: 800, letterSpacing: '0.14em', fontVariantNumeric: 'tabular-nums' }}>{joinCode}</div>
            </div>
            {liveQr && (
              <div style={{ padding: 22, borderRadius: 28, background: '#FFFFFF' }}>
                <img src={liveQr} alt={`${T('nl_code')}: ${joinCode}`} style={{ width: 'clamp(220px, 28vw, 380px)', height: 'auto', display: 'block' }} />
              </div>
            )}
          </div>
        ) : <Hinweis icon={Music} text={T('nl_warte_auf_lehrkraft')} />}
      </main>
    </Huelle>
  )

  return (
    <Huelle voll>
      <header style={{ flexShrink: 0, padding: '16px clamp(24px, 4vw, 56px)', display: 'flex', alignItems: 'center', gap: 20, borderBottom: `1px solid ${F.linie}` }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          {labelKey && (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15, fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: F.akzent }}>
              <Icon size={18} aria-hidden="true" />{T(labelKey)}
            </div>
          )}
          <h1 style={{ margin: '4px 0 0', fontSize: 'clamp(26px, 3vw, 38px)', lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.01em', overflowWrap: 'anywhere' }}>{stueck?.titel ?? ''}</h1>
          {stueck?.komponist && <div style={{ marginTop: 2, fontSize: 19, color: F.text2 }}>{stueck.komponist}</div>}
          {stueck && <LiedAngaben stueck={stueck} style={{ marginTop: 8 }} />}
        </div>
        {leiste}
        {joinCode && liveQr ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <div style={{ textAlign: 'right' }}>
              <div style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.06em', textTransform: 'uppercase', color: F.text3 }}>{T('nb_mitmachen')}</div>
              <div style={{ fontSize: 30, fontWeight: 800, letterSpacing: '0.1em', fontVariantNumeric: 'tabular-nums' }}>{joinCode}</div>
            </div>
            <img src={liveQr} alt={`${T('nl_code')}: ${joinCode}`} style={{ width: 84, height: 84, borderRadius: 10, background: '#FFFFFF', padding: 4, boxSizing: 'border-box' }} />
          </div>
        ) : <Marke klein />}
      </header>

      {ansicht === 'noten' ? (
        <main style={{ flex: 1, minHeight: 0, padding: 12 }}>
          {noten.length ? <NotenBeamer key={noten.map(f => f.url).join('|')} dateien={noten} befehlRef={notenBefehl} senden={senden} /> : leer}
        </main>
      ) : (
        <main style={{ flex: 1, minHeight: 0, overflowY: 'auto', padding: '36px clamp(24px, 4vw, 56px) 64px' }}>
          {ansicht === 'liedtext' && (stueck?.liedtext
            ? <div style={{ maxWidth: 1000, margin: '0 auto', fontSize: groesse, lineHeight: 1.6, fontWeight: 600 }}>
                {stueck.liedtext_md !== false
                  ? <div className="n-lied-text" dangerouslySetInnerHTML={{ __html: safeMarkdown(stueck.liedtext) }} />
                  : <div style={{ whiteSpace: 'pre-wrap' }}>{stueck.liedtext}</div>}
              </div>
            : leer)}

          {ansicht === 'akkorde' && (stueck?.notizen
            ? <div style={{ maxWidth: 1000, margin: '0 auto', fontSize: groesse, overflowX: 'auto', '--text': F.text, '--text-2': F.text2, '--text-3': F.text2, '--primary': '#FDBA74', '--accent': '#FDBA74' }}>
                <ChordPro text={stueck.notizen} />
              </div>
            : leer)}

          {ansicht === 'youtube' && (yt
            ? <div style={{ maxWidth: 1400, margin: '0 auto', position: 'relative', paddingTop: '56.25%', borderRadius: 18, overflow: 'hidden', background: '#000000' }}>
                <iframe src={`https://www.youtube-nocookie.com/embed/${yt}`} title={stueck.titel} allow="encrypted-media; picture-in-picture" allowFullScreen style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', border: 'none' }} />
              </div>
            : leer)}

          {ansicht === 'dateiverwaltung' && leer}
        </main>
      )}
    </Huelle>
  )
}

function Marke({ klein }) {
  return (
    <div aria-hidden={klein || undefined} style={{ display: 'flex', alignItems: 'center', gap: 10, flexShrink: 0, opacity: klein ? 0.7 : 1 }}>
      <span style={{ width: klein ? 32 : 44, height: klein ? 32 : 44, borderRadius: klein ? 9 : 12, background: 'linear-gradient(150deg, #C2410C, #A3360A)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <Music size={klein ? 18 : 24} color="#FFFFFF" aria-hidden="true" />
      </span>
      {!klein && <span style={{ fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>Staccato</span>}
    </div>
  )
}

function Hinweis({ icon: Icon, text }) {
  return (
    <div style={{ maxWidth: 560, margin: '64px auto 0', padding: '40px 28px', borderRadius: 28, background: F.karte, textAlign: 'center' }}>
      <Icon size={40} color={F.akzent} aria-hidden="true" />
      <div style={{ marginTop: 14, fontSize: 22, fontWeight: 700, color: F.text2 }}>{text}</div>
    </div>
  )
}

// voll = feste Bildschirmhöhe (Kopf + Inhalt), sonst normal scrollende Seite
function Huelle({ children, voll }) {
  return (
    <div style={{ ...(voll ? { height: '100dvh', display: 'flex', flexDirection: 'column', overflow: 'hidden' } : { minHeight: '100dvh' }), background: F.bg, color: F.text, fontFamily: 'Inter, system-ui, sans-serif' }}>
      {children}
      <style>{UI_CSS + `
        .nb-puls { animation: nb-puls 2s ease-in-out infinite; }
        @keyframes nb-puls { 50% { opacity: .3 } }
        @media (prefers-reduced-motion: reduce) { .nb-puls { animation: none; } }
      `}</style>
    </div>
  )
}

const rundKnopf = { width: 48, height: 48, borderRadius: 24, border: 'none', background: F.karte, color: F.text, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }
