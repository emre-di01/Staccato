import { useState, useEffect, useRef } from 'react'
import { supabase } from '../lib/supabase'
import { safeMarkdown } from '../lib/markdown'
import QRCode from 'qrcode'

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function genCode() {
  return Array.from({ length: 4 }, () => CHARS[Math.floor(Math.random() * CHARS.length)]).join('')
}

function getYouTubeId(url) {
  const m = url?.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([^&\n?]+)/)
  return m?.[1] ?? ''
}

function ChordProBeamer({ text, fontSize }) {
  if (!text) return null
  return (
    <div style={{ fontFamily: 'monospace', fontSize, lineHeight: 2.2, color: '#e2e8f0' }}>
      {text.split('\n').map((zeile, i) => {
        const teile = zeile.split(/(\[[^\]]+\])/)
        return (
          <div key={i} style={{ minHeight: '1.5em' }}>
            {teile.map((t, j) =>
              t.startsWith('[') && t.endsWith(']')
                ? <strong key={j} style={{ color: '#93c5fd', marginRight: 4, fontSize: fontSize * 0.82 }}>{t.slice(1, -1)}</strong>
                : <span key={j}>{t}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

function FontControls({ size, setSize }) {
  return (
    <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
      <button onClick={() => setSize(s => Math.max(16, s - 4))}
        style={btnStyle}>A−</button>
      <button onClick={() => setSize(s => Math.min(60, s + 4))}
        style={btnStyle}>A+</button>
    </div>
  )
}

const btnStyle = {
  background: 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.15)',
  color: '#94a3b8', borderRadius: 8, padding: '6px 12px', fontSize: 13,
  fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit',
}

export default function BeamerDisplay() {
  const [code, setCode] = useState(() => genCode())
  const [qrUrl, setQrUrl] = useState('')
  const [phase, setPhase] = useState('warten')
  const [payload, setPayload] = useState(null)
  const [fontSize, setFontSize] = useState(28)
  const channelRef = useRef(null)

  useEffect(() => {
    QRCode.toDataURL(code, {
      width: 220, margin: 2,
      color: { dark: '#0f172a', light: '#f8fafc' },
    }).then(setQrUrl)
  }, [code])

  useEffect(() => {
    const ch = supabase.channel(`beamer-${code}`)
      .on('broadcast', { event: 'state' }, ({ payload: p }) => {
        if (p.status === 'beendet') {
          setCode(genCode())
          setPhase('warten')
          setPayload(null)
          return
        }
        setPayload(p)
        setPhase('aktiv')
      })
      .on('broadcast', { event: 'font_size' }, ({ payload: p }) => {
        if (p?.size) setFontSize(p.size)
      })
      .subscribe()
    channelRef.current = ch
    return () => ch.unsubscribe()
  }, [code])

  // ── WARTEN ─────────────────────────────────────────────────────
  if (phase === 'warten') return (
    <div style={{
      minHeight: '100vh', background: '#0f172a', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Outfit', 'DM Sans', sans-serif", gap: 0,
    }}>
      <div style={{ fontSize: 22, fontWeight: 800, color: '#94a3b8', marginBottom: 32, letterSpacing: '0.05em' }}>
        ♩ Staccato · Beamer
      </div>

      {qrUrl && (
        <div style={{ background: '#f8fafc', borderRadius: 16, padding: 16, marginBottom: 28, boxShadow: '0 4px 32px rgba(0,0,0,0.5)' }}>
          <img src={qrUrl} alt="Beamer Code QR" style={{ width: 180, height: 180, display: 'block' }} />
        </div>
      )}

      <div style={{ fontSize: 14, color: '#64748b', marginBottom: 10, letterSpacing: '0.08em', textTransform: 'uppercase', fontWeight: 700 }}>
        Beamer-Code
      </div>
      <div style={{
        fontSize: 72, fontWeight: 900, fontFamily: 'monospace',
        letterSpacing: '0.2em', color: '#f1f5f9',
        textShadow: '0 0 40px rgba(148,163,184,0.3)',
        marginBottom: 28,
      }}>
        {code}
      </div>

      <div style={{ fontSize: 15, color: '#475569', textAlign: 'center', lineHeight: 1.7 }}>
        Gib diesen Code im Unterrichtsmodus ein<br />
        um diesen Bildschirm zu verbinden.
      </div>

      <div style={{ marginTop: 48, display: 'flex', alignItems: 'center', gap: 8, color: '#334155', fontSize: 13 }}>
        <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#22c55e', display: 'inline-block', animation: 'pulse 2s infinite' }} />
        Bereit
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800;900&display=swap');
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }
      `}</style>
    </div>
  )

  // ── AKTIV ──────────────────────────────────────────────────────
  const { stueck, aktuelle_ansicht: ansicht, signed_urls = [] } = payload ?? {}

  const ANSICHT_LABEL = {
    liedtext: { icon: '📝', label: 'Liedtext' },
    akkorde:  { icon: '🎸', label: 'Akkorde' },
    noten:    { icon: '📄', label: 'Noten' },
    youtube:  { icon: '▶️', label: 'Video' },
    dateiverwaltung: { icon: '📂', label: 'Dateien' },
  }
  const ansichtInfo = ANSICHT_LABEL[ansicht] ?? { icon: '🎵', label: '' }

  return (
    <div style={{
      minHeight: '100vh', background: '#0f172a', display: 'flex',
      flexDirection: 'column', fontFamily: "'Outfit', 'DM Sans', sans-serif",
    }}>
      {/* Header */}
      <div style={{
        padding: '20px 36px', display: 'flex', alignItems: 'center',
        justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.06)',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: 13, color: '#475569', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 4 }}>
            {ansichtInfo.icon} {ansichtInfo.label}
          </div>
          <div style={{ fontSize: 32, fontWeight: 900, color: '#f1f5f9', letterSpacing: '-0.5px' }}>
            {stueck?.titel ?? ''}
          </div>
          {stueck?.komponist && (
            <div style={{ fontSize: 16, color: '#64748b', marginTop: 4 }}>🎼 {stueck.komponist}</div>
          )}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 10 }}>
          {(ansicht === 'liedtext' || ansicht === 'akkorde') && (
            <FontControls size={fontSize} setSize={setFontSize} />
          )}
          <div style={{ fontSize: 11, color: '#334155', fontWeight: 700, letterSpacing: '0.06em' }}>♩ STACCATO</div>
        </div>
      </div>

      {/* Inhalt */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '32px 48px', paddingBottom: 48 }}>

        {ansicht === 'liedtext' && (
          stueck?.liedtext
            ? <div
                dangerouslySetInnerHTML={{ __html: safeMarkdown(stueck.liedtext) }}
                style={{
                  fontSize, lineHeight: 1.85, color: '#e2e8f0',
                  maxWidth: 900, margin: '0 auto', pointerEvents: 'none',
                }}
              />
            : <Platzhalter info={ansichtInfo} />
        )}

        {ansicht === 'akkorde' && (
          stueck?.notizen
            ? <div style={{ maxWidth: 900, margin: '0 auto' }}>
                <ChordProBeamer text={stueck.notizen} fontSize={fontSize} />
              </div>
            : <Platzhalter info={ansichtInfo} />
        )}

        {ansicht === 'noten' && (
          signed_urls.length > 0
            ? <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>
                {signed_urls.filter(f => f.url).map((f, i) => (
                  <div key={i}>
                    {f.stimme && f.stimme !== 'keine' && (
                      <div style={{ fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8, textTransform: 'capitalize', letterSpacing: '0.06em' }}>
                        Stimme: {f.stimme}
                      </div>
                    )}
                    {/* pointerEvents:none verhindert dass der PDF-Toolbar neue Tabs öffnet */}
                    <div style={{ pointerEvents: 'none' }}>
                      <iframe
                        src={f.url + '#view=FitH&toolbar=0&navpanes=0&scrollbar=0'}
                        style={{ width: '100%', height: '80vh', border: 'none', borderRadius: 12, display: 'block' }}
                        title={`Noten ${i + 1}`}
                      />
                    </div>
                  </div>
                ))}
              </div>
            : <Platzhalter info={ansichtInfo} />
        )}

        {ansicht === 'youtube' && (
          stueck?.youtube_url
            ? <div style={{ pointerEvents: 'none', position: 'relative', paddingBottom: '56.25%', background: '#000', borderRadius: 12, overflow: 'hidden', maxWidth: 1200, margin: '0 auto' }}>
                <iframe
                  src={`https://www.youtube.com/embed/${getYouTubeId(stueck.youtube_url)}?autoplay=0`}
                  style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%' }}
                  frameBorder="0"
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                />
              </div>
            : <Platzhalter info={ansichtInfo} />
        )}

        {ansicht === 'dateiverwaltung' && <Platzhalter info={ansichtInfo} />}

        {!ansicht && (
          <div style={{ textAlign: 'center', color: '#334155', paddingTop: 80 }}>
            <div style={{ fontSize: 48, marginBottom: 16 }}>⏳</div>
            <div style={{ fontSize: 20, fontWeight: 600 }}>Warte auf Lehrer …</div>
          </div>
        )}
      </div>

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;700;800;900&display=swap');
        * { box-sizing: border-box; }
        .beamer-md h2 { font-size: 1.3em; color: #94a3b8; margin: 1.2em 0 0.4em; }
        .beamer-md h3 { font-size: 1.1em; color: #64748b; margin: 1em 0 0.3em; }
        .beamer-md p  { margin: 0.3em 0; }
        .beamer-md hr { border: none; border-top: 1px solid rgba(255,255,255,0.08); margin: 1em 0; }
        .beamer-md blockquote { border-left: 3px solid #3b82f6; margin: 0.5em 0 0.5em 8px; padding-left: 14px; color: #94a3b8; }
        .beamer-md strong { color: #f1f5f9; }
      `}</style>
    </div>
  )
}

function Platzhalter({ info }) {
  return (
    <div style={{ textAlign: 'center', color: '#334155', paddingTop: 80 }}>
      <div style={{ fontSize: 40, marginBottom: 12 }}>{info.icon}</div>
      <div style={{ fontSize: 18, fontWeight: 600 }}>{info.label}</div>
      <div style={{ fontSize: 14, color: '#1e293b', marginTop: 8 }}>Kein Inhalt verfügbar</div>
    </div>
  )
}
