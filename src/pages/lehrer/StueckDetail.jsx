import { useState, useEffect, useRef, useMemo, lazy, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useWindowWidth'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { safeMarkdown } from '../../lib/markdown'
import { transponiereAkkord, transponiereText, aktuelleTonartenInfo, youtubeId, dateiIcon } from '../../lib/akkordeUtils'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const AudioTranskribierenModal = lazy(() => import('../../components/AudioTranskribierenModal'))
const FotoOCRModal = lazy(() => import('../../components/FotoOCRModal'))

// ─── Chord Player ─────────────────────────────────────────────
const NOTEN_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]

const CHORD_INTERVALS = [
  ['dim7', [0,3,6,9]],
  ['maj7', [0,4,7,11]],
  ['sus4', [0,5,7]],
  ['sus2', [0,2,7]],
  ['dim',  [0,3,6]],
  ['aug',  [0,4,8]],
  ['m7',   [0,3,7,10]],
  ['7',    [0,4,7,10]],
  ['m',    [0,3,7]],
  ['',     [0,4,7]],
]

function akkordZuNoten(name) {
  let root, suffix
  if (name.length > 1 && name[1] === '#') {
    root = name.slice(0, 2); suffix = name.slice(2)
  } else {
    root = name[0]; suffix = name.slice(1)
  }
  const ri = NOTEN_NAMES.indexOf(root)
  if (ri === -1) return []
  for (const [s, iv] of CHORD_INTERVALS) {
    if (suffix === s) {
      return iv.map(i => NOTEN_NAMES[(ri + i) % 12] + (3 + Math.floor((ri + i) / 12)))
    }
  }
  return []
}

function ChordPlayer({ notizen, tempo, takt }) {
  const [laeuft,   setLaeuft]   = useState(false)
  const [aktIdx,   setAktIdx]   = useState(-1)
  const [geladen,  setGeladen]  = useState(false)
  const synthRef   = useRef(null)
  const timerRefs  = useRef([])
  const ToneRef    = useRef(null)

  const akkorde = useMemo(() => {
    if (!notizen) return []
    return [...notizen.matchAll(/\[([^\]]+)\]/g)].map(m => m[1])
  }, [notizen])

  const bpm = Math.max(40, Math.min(300, parseInt(tempo) || 120))
  const zaehler = parseInt((takt || '4/4').split('/')[0]) || 4
  const secPerMeasure = (zaehler / bpm) * 60

  async function toggleAbspielen() {
    if (laeuft) { stoppen(); return }
    if (akkorde.length === 0) return

    if (!ToneRef.current) {
      ToneRef.current = await import('tone')
      setGeladen(true)
    }
    const Tone = ToneRef.current
    await Tone.start()

    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 1.5 },
        volume: -8,
      }).toDestination()
    }

    const synth    = synthRef.current
    const noteDur  = secPerMeasure * 0.88
    const startNow = Tone.now() + 0.05

    akkorde.forEach((name, i) => {
      const t     = startNow + i * secPerMeasure
      const noten = akkordZuNoten(name)
      if (noten.length) synth.triggerAttackRelease(noten, noteDur, t)
    })

    // UI-Tracking mit setTimeout
    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = akkorde.map((_, i) =>
      setTimeout(() => setAktIdx(i), 50 + i * secPerMeasure * 1000)
    )
    timerRefs.current.push(
      setTimeout(() => { setLaeuft(false); setAktIdx(-1) }, 50 + akkorde.length * secPerMeasure * 1000)
    )

    setLaeuft(true)
    setAktIdx(0)
  }

  function stoppen() {
    timerRefs.current.forEach(clearTimeout)
    synthRef.current?.releaseAll?.()
    setLaeuft(false)
    setAktIdx(-1)
  }

  useEffect(() => () => stoppen(), [])

  if (akkorde.length === 0) return null

  const aktAkkord = akkorde[aktIdx]

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px solid var(--border)', marginBottom:16, flexWrap:'wrap' }}>
      <button
        onClick={toggleAbspielen}
        style={{ width:36, height:36, borderRadius:'50%', border:'none', background:'var(--primary)', color:'#fff', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {laeuft ? '⏸' : '▶'}
      </button>
      <div style={{ fontSize:13, color:'var(--text-2)', flex:1 }}>
        {laeuft
          ? <><span style={{ fontWeight:800, color:'var(--primary)', fontSize:15 }}>{aktAkkord}</span><span style={{ color:'var(--text-3)', marginLeft:6 }}>{aktIdx + 1} / {akkorde.length}</span></>
          : <span>{akkorde.length} Akkorde · {bpm} BPM · {takt || '4/4'}</span>
        }
      </div>
      {laeuft && (
        <button onClick={stoppen} style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          ■ Stop
        </button>
      )}
    </div>
  )
}

// ─── Spotify Suche ────────────────────────────────────────────
const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL

const SPOTIFY_HEADERS = {
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
}

async function spotifySuchen(q) {
  const res = await fetch(`${SUPABASE_URL}/functions/v1/spotify-suche?q=${encodeURIComponent(q)}`, {
    headers: SPOTIFY_HEADERS,
  })
  const data = await res.json()
  return data.tracks ?? []
}

function spotifyTrackId(url) {
  return url?.match(/track\/([A-Za-z0-9]+)/)?.[1] ?? null
}

function SpotifyModal({ titelVorschlag, onUebernehmen, onSchliessen }) {
  const [query,      setQuery]      = useState(titelVorschlag ?? '')
  const [ergebnisse, setErgebnisse] = useState([])
  const [laden,      setLaden]      = useState(false)
  const [fehler,     setFehler]     = useState('')
  const [gewaehlter, setGewaehlter] = useState(null)

  async function suchen() {
    if (!query.trim()) return
    setLaden(true); setFehler(''); setErgebnisse([]); setGewaehlter(null)
    try {
      const tracks = await spotifySuchen(query)
      setErgebnisse(tracks)
      if (tracks.length === 0) setFehler('Keine Ergebnisse gefunden.')
    } catch { setFehler('Fehler bei der Suche.') }
    setLaden(false)
  }

  const ms = {
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
    box:     { background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, maxWidth:500, width:'100%', maxHeight:'85vh', display:'flex', flexDirection:'column', gap:14, boxShadow:'var(--shadow-lg)', overflow:'hidden' },
    input:   { padding:'9px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', outline:'none', flex:1 },
    track:   (aktiv) => ({ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'var(--radius)', border:`1.5px solid ${aktiv ? 'var(--primary)' : 'var(--border)'}`, background: aktiv ? 'color-mix(in srgb, var(--primary) 8%, var(--bg-2))' : 'var(--bg-2)', cursor:'pointer' }),
    btnPri:  { padding:'9px 20px', borderRadius:'var(--radius)', border:'none', background:'#1DB954', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
    btnSek:  { padding:'9px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  }

  return createPortal(
    <div style={ms.overlay} onClick={e => e.target === e.currentTarget && onSchliessen()}>
      <div style={ms.box}>
        <div style={{ fontSize:17, fontWeight:800, color:'var(--text)', flexShrink:0 }}>🟢 Spotify-Song verknüpfen</div>

        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <input style={ms.input} value={query} onChange={e => setQuery(e.target.value)}
            placeholder="Titel oder Interpret …"
            onKeyDown={e => e.key === 'Enter' && suchen()} autoFocus />
          <button onClick={suchen} disabled={laden}
            style={{ ...ms.btnPri, padding:'9px 16px', opacity: laden ? 0.6 : 1 }}>
            {laden ? '…' : '🔍'}
          </button>
        </div>

        {fehler && <div style={{ fontSize:13, color:'var(--danger)', flexShrink:0 }}>{fehler}</div>}

        {ergebnisse.length > 0 && (
          <div style={{ overflowY:'auto', display:'flex', flexDirection:'column', gap:6 }}>
            {ergebnisse.map(t => (
              <div key={t.id} onClick={() => setGewaehlter(t)} style={ms.track(gewaehlter?.id === t.id)}>
                {t.cover
                  ? <img src={t.cover} alt="" style={{ width:40, height:40, borderRadius:4, flexShrink:0 }} />
                  : <div style={{ width:40, height:40, borderRadius:4, background:'var(--border)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🎵</div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.name}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.artist}{t.album ? ` · ${t.album}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onSchliessen} style={ms.btnSek}>Abbrechen</button>
          <button disabled={!gewaehlter}
            onClick={() => { onUebernehmen(`https://open.spotify.com/track/${gewaehlter.id}`); onSchliessen() }}
            style={{ ...ms.btnPri, opacity: !gewaehlter ? 0.4 : 1 }}>
            Verknüpfen
          </button>
        </div>
      </div>
    </div>,
    document.body
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

// ─── Signed URL holen ─────────────────────────────────────────
async function getSignedUrl(pfad) {
  const { data } = await supabase.storage.from('stueck-dateien').createSignedUrl(pfad, 86400)
  return data?.signedUrl ?? null
}

// ─── Download-Button ─────────────────────────────────────────
function DownloadButton({ datei, label = '⬇ Herunterladen', full = false }) {
  const [laden, setLaden] = useState(false)
  async function herunterladen() {
    setLaden(true)
    const { data } = await supabase.storage.from('stueck-dateien').download(datei.bucket_pfad)
    if (data) {
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url; a.download = datei.name; a.click()
      URL.revokeObjectURL(url)
    }
    setLaden(false)
  }
  return (
    <button onClick={herunterladen} disabled={laden}
      style={{ padding:'9px 16px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', ...(full ? { width:'100%' } : {}) }}>
      {laden ? '…' : label}
    </button>
  )
}

// ─── Im Browser öffnen ────────────────────────────────────────
function OeffnenButton({ pfad }) {
  const [laden, setLaden] = useState(false)
  async function oeffnen() {
    setLaden(true)
    const url = await getSignedUrl(pfad)
    if (url) window.open(url, '_blank')
    setLaden(false)
  }
  return (
    <button onClick={oeffnen} disabled={laden}
      style={{ padding:'9px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
      {laden ? '…' : '↗ Öffnen'}
    </button>
  )
}

// ─── PDF Viewer (Canvas-basiert, kein Browser-Viewer-Zoom) ────
function PdfViewer({ url }) {
  const [seiten, setSeiten] = useState([])
  const [laden,  setLaden]  = useState(true)
  const [fehler, setFehler] = useState(null)

  useEffect(() => {
    if (!url) return
    let abgebrochen = false
    setSeiten([]); setLaden(true); setFehler(null)

    async function render() {
      try {
        const pdfjsLib = await import('pdfjs-dist')
        pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).href
        const pdf = await pdfjsLib.getDocument({ url }).promise
        if (abgebrochen) return

        const breite = Math.min(window.innerWidth - 32, 1200)
        const dpr    = Math.min(window.devicePixelRatio || 1, 2)
        const liste  = []

        for (let i = 1; i <= pdf.numPages; i++) {
          if (abgebrochen) return
          const page  = await pdf.getPage(i)
          const basis = page.getViewport({ scale: 1 })
          const vp    = page.getViewport({ scale: (breite / basis.width) * dpr })

          const canvas = document.createElement('canvas')
          canvas.width  = vp.width
          canvas.height = vp.height
          await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise

          liste.push({ src: canvas.toDataURL(), w: breite, h: vp.height / dpr })
          if (!abgebrochen) { setSeiten([...liste]); if (i === 1) setLaden(false) }
        }
        if (!abgebrochen) setLaden(false)
      } catch {
        if (!abgebrochen) { setFehler('PDF konnte nicht gerendert werden.'); setLaden(false) }
      }
    }

    render()
    return () => { abgebrochen = true }
  }, [url])

  return (
    <div style={{ flex:1, overflowY:'auto', background:'#1a1a1a', display:'flex', flexDirection:'column', alignItems:'center', gap:16, padding:'20px 16px', minHeight:0 }}>
      {laden && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:14, padding:40 }}>Lädt …</div>}
      {fehler && <div style={{ color:'#f87171', fontSize:14, padding:40 }}>{fehler}</div>}
      {seiten.map((s, i) => (
        <img key={i} src={s.src} alt={`Seite ${i + 1}`}
          style={{ width:s.w, height:s.h, display:'block', borderRadius:6, boxShadow:'0 4px 20px rgba(0,0,0,0.6)' }} />
      ))}
    </div>
  )
}

// ─── PDF Card ─────────────────────────────────────────────────
function PdfCard({ datei, kannLoeschen, onLoeschen }) {
  const [url, setUrl] = useState(null)
  const [modal, setModal] = useState(false)

  async function vorschauOeffnen() {
    if (!url) setUrl(await getSignedUrl(datei.bucket_pfad))
    setModal(true)
  }

  useEffect(() => {
    if (!modal) return
    function onKey(e) { if (e.key === 'Escape') setModal(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [modal])

  return (
    <>
      <div style={{ borderRadius:'var(--radius)', border:'1px solid var(--border)', overflow:'hidden', background:'var(--bg-2)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px' }}>
          <span style={{ fontSize:24, flexShrink:0 }}>📄</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{datei.name}</div>
            {datei.stimme && datei.stimme !== 'keine' && (
              <span style={{ fontSize:11, color:'var(--text-3)', textTransform:'capitalize', marginTop:2, display:'block' }}>Stimme: {datei.stimme}</span>
            )}
          </div>
          <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
            <button onClick={vorschauOeffnen}
              style={{ padding:'7px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              👁 Vorschau
            </button>
            <OeffnenButton pfad={datei.bucket_pfad} />
            <DownloadButton datei={datei} label="⬇" />
            {kannLoeschen && (
              <button onClick={onLoeschen} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--danger)', padding:4 }}>🗑</button>
            )}
          </div>
        </div>
      </div>

      {modal && createPortal(
        <div style={{ position:'fixed', inset:0, background:'#000', zIndex:2000, display:'flex', flexDirection:'column' }}>
          {/* PDF — canvas-basiert, fit-to-width */}
          <PdfViewer url={url} />
          {/* Steuerleiste unten — immer erreichbar */}
          <div style={{
            display:'flex', alignItems:'center', gap:10, padding:'10px 16px',
            paddingBottom:'calc(10px + env(safe-area-inset-bottom, 0px))',
            background:'rgba(15,15,15,0.95)', borderTop:'1px solid rgba(255,255,255,0.1)',
            flexShrink:0,
          }}>
            <span style={{ fontSize:16, flexShrink:0 }}>📄</span>
            <div style={{ flex:1, fontWeight:600, fontSize:13, color:'#ccc', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{datei.name}</div>
            {url && (
              <a href={url} target="_blank" rel="noreferrer"
                style={{ padding:'8px 14px', borderRadius:8, background:'rgba(255,255,255,0.1)', border:'1px solid rgba(255,255,255,0.15)', color:'#fff', fontSize:13, fontWeight:600, textDecoration:'none', flexShrink:0 }}>
                ↗ Öffnen
              </a>
            )}
            <DownloadButton datei={datei} label="⬇" />
            <button onClick={() => setModal(false)}
              style={{ padding:'8px 18px', borderRadius:8, background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0 }}>
              ✕
            </button>
          </div>
        </div>,
        document.body
      )}
    </>
  )
}

// ─── Audio Player ─────────────────────────────────────────────
function AudioPlayer({ datei, kannLoeschen, onLoeschen }) {
  const [url, setUrl] = useState(null)

  async function ladeUrl() {
    if (url) return
    const { data } = await supabase.storage.from('stueck-dateien').createSignedUrl(datei.bucket_pfad, 86400)
    if (data?.signedUrl) setUrl(data.signedUrl)
  }

  return (
    <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px solid var(--border)', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px' }}>
        <span style={{ fontSize:22, flexShrink:0 }}>🎵</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{datei.name}</div>
          {datei.stimme && datei.stimme !== 'keine' && (
            <span style={{ fontSize:11, color:'var(--text-3)', textTransform:'capitalize' }}>Stimme: {datei.stimme}</span>
          )}
        </div>
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          <DownloadButton datei={datei} label="⬇" />
          {kannLoeschen && (
            <button onClick={onLoeschen} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--danger)', padding:4 }}>🗑</button>
          )}
        </div>
      </div>
      <div style={{ padding:'0 16px 14px' }}>
        {url
          ? <audio controls src={url} style={{ width:'100%' }} />
          : <button onClick={ladeUrl} style={{ fontSize:13, padding:'7px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text-2)', cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>▶ Abspielen</button>
        }
      </div>
    </div>
  )
}

// ─── Upload Modal ─────────────────────────────────────────────
function DateiUploadModal({ stueckId, onClose, onErfolg }) {
  const { profil, T } = useApp()
  const fileRef = useRef()
  const [form, setForm] = useState({ typ: 'noten', stimme: 'keine', name: '' })
  const [datei, setDatei] = useState(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')

  async function hochladen() {
    if (!datei) { setFehler('Bitte eine Datei wählen.'); return }
    if (datei.size > 50 * 1024 * 1024) { setFehler(T('file_too_large').replace('{n}', 50)); return }
    setLaden(true)
    const sauberName = datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pfad = `${stueckId}/${form.typ}/${Date.now()}_${sauberName}`
    const { error: sErr } = await supabase.storage.from('stueck-dateien').upload(pfad, datei)
    if (sErr) { setFehler(sErr.message); setLaden(false); return }
    const { error: dErr } = await supabase.from('stueck_dateien').insert({
      stueck_id: stueckId, typ: form.typ, stimme: form.stimme,
      name: form.name || datei.name, bucket_pfad: pfad, hochgeladen_von: profil.id,
    })
    if (dErr) setFehler(dErr.message)
    else { onErfolg(); onClose() }
    setLaden(false)
  }

  return createPortal(
    <div className="modal-overlay" style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitel}>📎 Datei hochladen</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ ...s.modalBody, display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Dateityp</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {[
                { key:'noten',    icon:'📄', label:'Noten' },
                { key:'akkorde',  icon:'🎸', label:'Akkorde' },
                { key:'audio',    icon:'🎵', label:'Audio' },
                { key:'dokument', icon:'📋', label:'Dokument' },
              ].map(t => (
                <button key={t.key} onClick={() => setForm(f => ({ ...f, typ: t.key }))}
                  style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:`2px solid ${form.typ===t.key ? 'var(--accent)' : 'var(--border)'}`, background: form.typ===t.key ? 'var(--accent)' : 'var(--bg-2)', color: form.typ===t.key ? 'var(--accent-fg)' : 'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {(form.typ === 'noten' || form.typ === 'audio') && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>Stimmgruppe</label>
              <select style={s.input} value={form.stimme} onChange={e => setForm(f => ({ ...f, stimme: e.target.value }))}>
                <option value="keine">Alle Stimmen</option>
                <option value="sopran">Sopran</option>
                <option value="alt">Alt</option>
                <option value="tenor">Tenor</option>
                <option value="bass">Bass</option>
              </select>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Datei</label>
            <div style={{ border:'2px dashed var(--border)', borderRadius:'var(--radius)', padding:24, textAlign:'center', cursor:'pointer', background:'var(--bg-2)' }}
              onClick={() => fileRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); setDatei(e.dataTransfer.files[0]) }}>
              {datei
                ? <span style={{ color:'var(--text)', fontWeight:600 }}>📎 {datei.name}</span>
                : <span style={{ color:'var(--text-3)' }}>Klicken oder Datei hierher ziehen</span>
              }
              <input ref={fileRef} type="file" hidden onChange={e => setDatei(e.target.files[0])} />
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Anzeigename (optional)</label>
            <input style={s.input} placeholder={datei?.name ?? 'z.B. Noten Sopran'} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
            <button onClick={hochladen} disabled={laden} style={s.btnPri}>
              {laden ? 'Hochladen …' : '⬆ Hochladen'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  )
}

// ─── Liedtext Bearbeiten ─────────────────────────────────────
const MD_CHEATSHEET = [
  { syntax: '## Refrain',        desc: 'Abschnittstitel' },
  { syntax: '### Strophe 1',     desc: 'Kleiner Abschnittstitel' },
  { syntax: '**fett**',          desc: 'Fetter Text' },
  { syntax: '*kursiv*',          desc: 'Kursiver Text' },
  { syntax: '---',               desc: 'Trennlinie (zwischen Strophen)' },
  { syntax: '> Text',            desc: 'Eingerückter Text' },
  { syntax: 'Leerzeile',         desc: 'Neuer Absatz' },
]

const MD_BEISPIEL = `## Strophe 1
Zeile eins des Liedtexts
Zeile zwei des Liedtexts

---

## Refrain
La la la, oh oh oh
La la la, yeah yeah`

function MarkdownTooltip() {
  const [offen, setOffen] = useState(false)
  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      <button onClick={() => setOffen(o => !o)}
        style={{ width:24, height:24, borderRadius:'50%', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-3)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', lineHeight:1, flexShrink:0 }}>
        ?
      </button>
      {offen && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={() => setOffen(false)} />
          <div style={{ position:'absolute', top:'calc(100% + 8px)', left:'50%', transform:'translateX(-50%)', zIndex:200, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-lg)', padding:'16px 18px', minWidth:300, maxWidth:380 }}>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--text)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Markdown-Hilfe</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
              {MD_CHEATSHEET.map(({ syntax, desc }) => (
                <div key={syntax} style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                  <code style={{ fontFamily:'monospace', fontSize:12, color:'var(--accent)', background:'var(--bg-2)', padding:'2px 6px', borderRadius:4, whiteSpace:'nowrap', flexShrink:0 }}>{syntax}</code>
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>{desc}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Beispiel</div>
            <pre style={{ fontFamily:'monospace', fontSize:11, color:'var(--text-2)', background:'var(--bg-2)', borderRadius:6, padding:'8px 10px', margin:0, whiteSpace:'pre-wrap', lineHeight:1.7 }}>{MD_BEISPIEL}</pre>
          </div>
        </>
      )}
    </div>
  )
}

function LiedtextBearbeiten({ stueck, onSpeichern, onAbbrechen }) {
  const mob = useIsMobile()
  const [text,       setText]       = useState(stueck.liedtext ?? '')
  const [akkorde,    setAkkorde]    = useState(stueck.notizen  ?? '')
  const [tab,        setTab]        = useState('text')
  const [vorschau,   setVorschau]   = useState(false)
  const [istMd,      setIstMd]      = useState(stueck.liedtext_md !== false)
  const [audioModal, setAudioModal] = useState(false)
  const [fotoModal,  setFotoModal]  = useState(false)

  function kiErgebnisUebernehmen(kiText) {
    setText(t => t ? t + '\n\n' + kiText : kiText)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', borderBottom:'2px solid var(--border)', marginBottom:4, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4, flex:1 }}>
          {[['text','📝 Liedtext'],['akkorde','🎸 Akkorde (ChordPro)']].map(([k,l]) => (
            <button key={k} onClick={() => { setTab(k); setVorschau(false) }}
              style={{ padding:'8px 14px', background:'none', border:'none', fontSize:13, cursor:'pointer', fontFamily:'inherit', color: tab===k ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===k ? 700 : 400, borderBottom:`2px solid ${tab===k ? 'var(--primary)' : 'transparent'}`, marginBottom:-2 }}>
              {l}
            </button>
          ))}
        </div>
        {tab === 'text' && (
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', ...(mob ? { width:'100%', paddingBottom:8, paddingTop:4 } : {}) }}>
            <div style={{ display:'flex', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', overflow:'hidden' }}>
              <button onClick={() => setIstMd(true)}
                style={{ padding:'4px 10px', background: istMd ? 'var(--primary)' : 'var(--bg-2)', color: istMd ? 'var(--primary-fg, #fff)' : 'var(--text-3)', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>MD</button>
              <button onClick={() => setIstMd(false)}
                style={{ padding:'4px 10px', background: !istMd ? 'var(--primary)' : 'var(--bg-2)', color: !istMd ? 'var(--primary-fg, #fff)' : 'var(--text-3)', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Plain</button>
            </div>
            <button onClick={() => setVorschau(v => !v)}
              style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background: vorschau ? 'var(--primary)' : 'var(--bg-2)', color: vorschau ? 'var(--primary-fg, #fff)' : 'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              {vorschau ? '✏️' : '👁'}{mob ? '' : (vorschau ? ' Bearbeiten' : ' Vorschau')}
            </button>
            {istMd && <MarkdownTooltip />}
            {!vorschau && (
              <>
                <button onClick={() => setAudioModal(true)}
                  title="Text aus Audio-Aufnahme transkribieren (Whisper KI)"
                  style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  🎤{mob ? '' : ' Audio'}
                </button>
                <button onClick={() => setFotoModal(true)}
                  title="Text aus Foto/Scan extrahieren (OCR)"
                  style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  📷{mob ? '' : ' Bild'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {tab === 'text' ? (
        vorschau ? (
          <div
            dangerouslySetInnerHTML={{ __html: safeMarkdown(text || '*Kein Text vorhanden.*') }}
            style={{ fontFamily:'Georgia, serif', fontSize:15, lineHeight:1.9, color:'var(--text)', minHeight:300, padding:'8px 0' }} />
        ) : (
          <textarea value={text} onChange={e => setText(e.target.value)}
            style={{ ...s.input, minHeight:300, fontFamily:'Georgia, serif', fontSize:15, lineHeight:1.9, resize:'vertical' }}
            placeholder="Liedtext hier eingeben …" />
        )
      ) : (
        <>
          <textarea value={akkorde} onChange={e => setAkkorde(e.target.value)}
            style={{ ...s.input, minHeight:200, fontFamily:'monospace', fontSize:14, lineHeight:2, resize:'vertical' }}
            placeholder="[Am]Hallo [C]Welt" />
          <div style={{ fontSize:12, color:'var(--text-3)' }}>Format: [Akkord] vor dem Wort, z.B. [Am]Text [G]weiter</div>
          {akkorde && (
            <div>
              <div style={s.sectionLabel}>Vorschau</div>
              <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'12px 16px', marginTop:6 }}>
                <ChordPro text={akkorde} />
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onAbbrechen} style={s.btnSek}>Abbrechen</button>
        <button onClick={() => onSpeichern(text, akkorde, istMd)} style={s.btnPri}>💾 Speichern</button>
      </div>

      <Suspense fallback={null}>
        {audioModal && <AudioTranskribierenModal onErgebnis={kiErgebnisUebernehmen} onSchliessen={() => setAudioModal(false)} />}
        {fotoModal  && <FotoOCRModal            onErgebnis={kiErgebnisUebernehmen} onSchliessen={() => setFotoModal(false)}  />}
      </Suspense>
    </div>
  )
}

// ─── Akkord Datei Anzeige ─────────────────────────────────────
function AkkordDateiAnzeige({ datei, halbtoene = 0, kannLoeschen, onLoeschen }) {
  const [text, setText] = useState(null)
  useEffect(() => {
    supabase.storage.from('stueck-dateien').download(datei.bucket_pfad)
      .then(({ data }) => data?.text().then(setText))
  }, [datei.bucket_pfad])
  return (
    <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'16px 20px', border:'1px solid var(--border)', position:'relative' }}>
      {text ? <ChordPro text={transponiereText(text, halbtoene)} /> : <span style={{ color:'var(--text-3)' }}>Laden …</span>}
      {kannLoeschen && (
        <button onClick={onLoeschen} style={{ position:'absolute', top:10, right:10, background:'none', border:'none', fontSize:16, cursor:'pointer', color:'var(--danger)' }}>🗑</button>
      )}
    </div>
  )
}

// ─── Metronom ─────────────────────────────────────────────────
function Metronom({ initialBpm, onTempoSave }) {
  const [bpm, setBpm] = useState(() => { const n = parseInt(initialBpm); return (n >= 20 && n <= 300) ? n : 100 })
  const [lauft, setLauft] = useState(false)
  const [beat, setBeat] = useState(false)
  const ctxRef   = useRef(null)
  const timerRef = useRef(null)
  const lauftRef = useRef(false)
  const bpmRef   = useRef(bpm)
  const tapRef   = useRef([])
  bpmRef.current = bpm

  useEffect(() => () => {
    lauftRef.current = false
    clearTimeout(timerRef.current)
    ctxRef.current?.close().catch?.(() => {})
  }, [])

  function klick() {
    try {
      if (!ctxRef.current || ctxRef.current.state === 'closed')
        ctxRef.current = new (window.AudioContext || window.webkitAudioContext)()
      if (ctxRef.current.state === 'suspended') ctxRef.current.resume()
      const ctx = ctxRef.current
      const osc = ctx.createOscillator(); const gain = ctx.createGain()
      osc.connect(gain); gain.connect(ctx.destination)
      osc.frequency.value = 880
      gain.gain.setValueAtTime(0.5, ctx.currentTime)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.05)
      osc.start(ctx.currentTime); osc.stop(ctx.currentTime + 0.05)
      setBeat(true); setTimeout(() => setBeat(false), 80)
    } catch (_) {}
  }

  function schlagLoop() {
    if (!lauftRef.current) return
    klick()
    timerRef.current = setTimeout(schlagLoop, 60000 / bpmRef.current)
  }

  function toggle() {
    if (lauftRef.current) { lauftRef.current = false; clearTimeout(timerRef.current); setLauft(false) }
    else { lauftRef.current = true; setLauft(true); schlagLoop() }
  }

  function tap() {
    const now = Date.now()
    tapRef.current = [...tapRef.current.filter(t => now - t < 3000), now]
    const arr = tapRef.current
    if (arr.length >= 2) {
      const gaps = arr.slice(1).map((t, i) => t - arr[i])
      const avg = gaps.reduce((a, b) => a + b) / gaps.length
      const b = Math.round(60000 / avg)
      if (b >= 20 && b <= 300) setBpm(b)
    }
  }

  const label = bpm < 60 ? 'Largo' : bpm < 76 ? 'Adagio' : bpm < 108 ? 'Andante' : bpm < 120 ? 'Moderato' : bpm < 156 ? 'Allegro' : bpm < 176 ? 'Vivace' : 'Presto'

  return (
    <div style={{ background:'var(--bg-2)', border:'1.5px solid var(--border)', borderRadius:'var(--radius)', padding:'14px 16px', marginTop:14 }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, flexWrap:'wrap' }}>
        <button onClick={toggle}
          style={{ width:44, height:44, borderRadius:'50%', border:'none', background: lauft ? 'var(--danger)' : 'var(--primary)', color:'#fff', fontSize:18, cursor:'pointer', fontFamily:'inherit', flexShrink:0, transition:'background 0.15s' }}>
          {lauft ? '⏹' : '▶'}
        </button>
        <div style={{ display:'flex', alignItems:'center', gap:6, flexShrink:0 }}>
          <button onClick={() => setBpm(b => Math.max(20, b - 1))} style={ms.ctrl}>−</button>
          <div style={{ textAlign:'center', minWidth:56 }}>
            <div style={{ fontSize:22, fontWeight:900, lineHeight:1, color: beat ? 'var(--primary)' : 'var(--text)', transition:'color 0.05s' }}>{bpm}</div>
            <div style={{ fontSize:9, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>BPM</div>
          </div>
          <button onClick={() => setBpm(b => Math.min(300, b + 1))} style={ms.ctrl}>+</button>
        </div>
        <input type="range" min={20} max={300} value={bpm} onChange={e => setBpm(Number(e.target.value))}
          style={{ flex:1, minWidth:80, accentColor:'var(--primary)', cursor:'pointer' }} />
        <button onClick={tap} onPointerDown={e => e.preventDefault()}
          style={{ padding:'10px 14px', minHeight:44, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text-2)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0, userSelect:'none' }}>
          TAP
        </button>
        <div style={{ flexShrink:0, textAlign:'right' }}>
          <div style={{ fontSize:11, color:'var(--text-3)', fontStyle:'italic' }}>{label}</div>
          {onTempoSave && (
            <button onClick={() => onTempoSave(bpm)}
              style={{ fontSize:11, color:'var(--accent)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0, fontWeight:700, marginTop:2 }}>
              💾 als Tempo speichern
            </button>
          )}
        </div>
      </div>
    </div>
  )
}
const ms = {
  ctrl: { width:30, height:30, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function StueckDetail() {
  const { kursId, stueckId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { rolle, T, schule, confirm } = useApp()

  const mob = useIsMobile()
  const istEvent = location.pathname.includes('/events/')
  const rolle_ = location.pathname.split('/')[1]   // admin | lehrer | schueler
  const backPfad = istEvent
    ? `/${rolle_}/events/${kursId}/repertoire`
    : kursId
      ? `/${rolle_}/kurse/${kursId}/repertoire`
      : `/${rolle_}/repertoire`

  const [stueck,       setStueck]       = useState(null)
  const [dateien,      setDateien]      = useState([])
  const [laden,        setLaden]        = useState(true)
  const [tab,          setTab]          = useState('text')
  const [filterStimme, setFilterStimme] = useState('alle')
  const [bearbeiteText, setBearbeiteText] = useState(false)
  const [bearbeiteMeta, setBearbeiteMeta] = useState(false)
  const [metaForm,     setMetaForm]     = useState({ titel:'', komponist:'', tonart:'', tempo:'', takt:'', anmerkungen:'' })
  const [modal,        setModal]        = useState(null)
  const [textGroesse,  setTextGroesse]  = useState(18)
  const [vollbild,     setVollbild]     = useState(false)
  const [halbtoene,    setHalbtoene]    = useState(0)
  const [youtubeEdit,  setYoutubeEdit]  = useState(false)
  const [youtubeInput, setYoutubeInput] = useState('')
  const [spotifyModal, setSpotifyModal] = useState(false)
  const [pdfModal,     setPdfModal]     = useState(false)
  const [metronomOffen, setMetronomOffen] = useState(false)
  const [bpLaeuft,    setBpLaeuft]    = useState(false)
  const [bpFehler,    setBpFehler]    = useState('')
  const tapZeitenEditRef = useRef([])

  const kannBearbeiten = rolle === 'admin' || rolle === 'superadmin' || rolle === 'lehrer'

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') setVollbild(false) }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => { ladeData() }, [stueckId])

  async function ladeData() {
    const [st, d] = await Promise.all([
      supabase.from('stuecke').select('*').eq('id', stueckId).single(),
      supabase.from('stueck_dateien').select('*').eq('stueck_id', stueckId).order('hochgeladen_am'),
    ])
    setStueck(st.data)
    setDateien(d.data ?? [])
    setLaden(false)
  }

  async function textSpeichern(neuerText, neueAkkorde, neuesMd) {
    await supabase.from('stuecke').update({ liedtext: neuerText, notizen: neueAkkorde, liedtext_md: neuesMd }).eq('id', stueckId)
    setStueck(s => ({ ...s, liedtext: neuerText, notizen: neueAkkorde, liedtext_md: neuesMd }))
    setBearbeiteText(false)
  }

  function liedtextAlsPdf() {
    const win = window.open('', '_blank')
    const meta = [stueck.komponist, stueck.tonart, stueck.tempo].filter(Boolean).join(' · ')
    const html = safeMarkdown(stueck.liedtext ?? '')
    const logoHtml = schule?.logo_url
      ? `<img src="${schule.logo_url}" class="logo" alt="Logo" />`
      : ''
    const schuleKontakt = [schule?.email, schule?.telefon, schule?.website].filter(Boolean)
    const schuleInfoHtml = schule?.name ? `<div class="schule-info">
      <span style="font-weight:600">${schule.name}</span>${schuleKontakt.length ? ' · ' + schuleKontakt.join(' · ') : ''}
      ${schule?.adresse ? `<br/><span style="color:#bbb">${schule.adresse}</span>` : ''}
    </div>` : ''
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${stueck.titel}</title>
<style>
  body { font-family: Georgia, serif; max-width: 680px; margin: 40px auto; padding: 0 24px; color: #111; }
  .header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 4px; }
  .header-text { flex: 1; }
  .logo { max-height: 64px; max-width: 160px; object-fit: contain; flex-shrink: 0; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .meta { font-size: 13px; color: #777; margin-bottom: 32px; border-bottom: 1px solid #ddd; padding-bottom: 12px; }
  .schule-info { font-size: 11px; color: #999; margin-top: 2px; }
  h2 { font-size: 17px; margin: 28px 0 6px; color: #222; page-break-after: avoid; }
  h3 { font-size: 15px; margin: 20px 0 4px; color: #444; page-break-after: avoid; }
  p { margin: 0 0 8px; line-height: 1.9; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  blockquote { margin: 8px 0 8px 16px; padding-left: 12px; border-left: 3px solid #ccc; color: #555; font-style: italic; }
  ul, ol { margin: 0 0 8px 20px; padding: 0; line-height: 1.9; }
  li { margin-bottom: 2px; }
  section { page-break-inside: avoid; }
  @media print {
    body { margin: 15mm 20mm; }
    @page { margin: 15mm 20mm; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 10px; color: #aaa; text-align: center; padding-bottom: 8mm; }
  }
</style></head><body>
<div class="header">
  <div class="header-text">
    <h1>${stueck.titel}</h1>
    ${schuleInfoHtml}
  </div>
  ${logoHtml}
</div>
${meta ? `<div class="meta">${meta}</div>` : ''}
${html}
<div class="footer">${stueck.titel}${meta ? ' · ' + meta : ''}</div>
</body></html>`)
    win.document.close()
    win.onload = () => { win.focus(); win.print() }
  }

  async function tempoSpeichernVonMetronom(bpm) {
    const tempo = String(bpm)
    await supabase.from('stuecke').update({ tempo }).eq('id', stueckId)
    setStueck(s => ({ ...s, tempo }))
  }

  function metaBearbeitenStarten() {
    setMetaForm({ titel: stueck.titel ?? '', komponist: stueck.komponist ?? '', tonart: stueck.tonart ?? '', tempo: stueck.tempo ?? '', takt: stueck.takt ?? '', anmerkungen: stueck.anmerkungen ?? '' })
    tapZeitenEditRef.current = []
    setBearbeiteMeta(true)
  }

  async function metaSpeichern() {
    const payload = { titel: metaForm.titel.trim() || stueck.titel, komponist: metaForm.komponist.trim() || null, tonart: metaForm.tonart.trim() || null, tempo: metaForm.tempo.trim() || null, takt: metaForm.takt || null, anmerkungen: metaForm.anmerkungen.trim() || null }
    await supabase.from('stuecke').update(payload).eq('id', stueckId)
    setStueck(s => ({ ...s, ...payload }))
    setBearbeiteMeta(false)
  }

  async function youtubeSpeichern() {
    const url = youtubeInput.trim() || null
    await supabase.from('stuecke').update({ youtube_url: url }).eq('id', stueckId)
    setStueck(s => ({ ...s, youtube_url: url }))
    setYoutubeEdit(false)
  }

  async function spotifySpeichern(url) {
    const val = (url ?? '').trim() || null
    await supabase.from('stuecke').update({ spotify_url: val }).eq('id', stueckId)
    setStueck(s => ({ ...s, spotify_url: val }))
  }

  async function akkordErkennen() {
    if (!stueck.youtube_url) return
    setBpLaeuft(true); setBpFehler('')
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/basic-pitch`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...SPOTIFY_HEADERS,
        },
        body: JSON.stringify({ youtube_url: stueck.youtube_url }),
      })
      const data = await res.json()
      if (data.error) { setBpFehler(data.error); return }
      if (data.chordpro) {
        const neueAkkorde = data.chordpro
        await supabase.from('stuecke').update({ notizen: neueAkkorde }).eq('id', stueckId)
        setStueck(s => ({ ...s, notizen: neueAkkorde }))
        toast('Akkorde erkannt und gespeichert!', 'success')
      }
    } catch (e) {
      setBpFehler('Analyse fehlgeschlagen. Bitte später erneut versuchen.')
    } finally {
      setBpLaeuft(false)
    }
  }

  async function dateiLoeschen(dateiId, pfad) {
    if (!await confirm('Datei wirklich löschen?', { confirmLabel: 'Löschen' })) return
    await supabase.storage.from('stueck-dateien').remove([pfad])
    await supabase.from('stueck_dateien').delete().eq('id', dateiId)
    setDateien(prev => prev.filter(d => d.id !== dateiId))
  }

  async function stueckLoeschen() {
    if (!await confirm(`"${stueck.titel}" dauerhaft löschen?`, { sub: 'Das Stück wird aus allen Kursen entfernt und kann nicht wiederhergestellt werden.', confirmLabel: 'Löschen' })) return
    // Storage-Dateien zuerst entfernen
    const pfade = dateien.map(d => d.bucket_pfad)
    if (pfade.length > 0) await supabase.storage.from('stueck-dateien').remove(pfade)
    // DB-Eintrag löschen (Kaskade räumt stueck_dateien + unterricht_stuecke auf)
    await supabase.from('stuecke').delete().eq('id', stueckId)
    queryClient.invalidateQueries({ queryKey: ['repertoire'] })
    navigate(backPfad)
  }

  if (laden)  return <div style={{ padding:40, color:'var(--text-3)' }}>{T('loading')}</div>
  if (!stueck) return <div style={{ padding:40, color:'var(--danger)' }}>Stück nicht gefunden.</div>

  const gefilterteDateien = dateien.filter(d =>
    filterStimme === 'alle' || d.stimme === filterStimme || d.stimme === 'keine'
  )
  const notenDateien  = gefilterteDateien.filter(d => d.typ === 'noten')
  const audioDateien  = gefilterteDateien.filter(d => d.typ === 'audio')
  const akkordDateien = gefilterteDateien.filter(d => d.typ === 'akkorde')
  const dokumente     = gefilterteDateien.filter(d => d.typ === 'dokument' || d.typ === 'sonstiges')

  const tabs = [
    { id:'text',    label:'📝 Text',    zeigen: !!stueck.liedtext || kannBearbeiten },
    { id:'akkorde', label:'🎸 Akkorde', zeigen: akkordDateien.length > 0 || !!stueck.notizen || (kannBearbeiten && !!stueck.youtube_url) },
    { id:'noten',   label:'📄 Noten',   zeigen: notenDateien.length > 0 },
    { id:'audio',   label:'🎵 Audio',   zeigen: audioDateien.length > 0 },
    { id:'youtube', label:'▶️ Video',   zeigen: !!stueck.youtube_url || kannBearbeiten },
    { id:'spotify', label:'🟢 Spotify', zeigen: !!stueck.spotify_url || kannBearbeiten },
    { id:'dateien', label:'📁 Dateien', zeigen: dokumente.length > 0 || kannBearbeiten },
  ].filter(t => t.zeigen)

  const padContent = mob ? 16 : 28

  return (
    <div>
      {/* Zurück */}
      <button onClick={() => navigate(backPfad)}
        style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 14px' }}>
        ← {T('repertoire_title')}
      </button>

      {/* Header */}
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding: mob ? '16px' : '24px', border:'1px solid var(--border)', marginBottom:20, boxShadow:'var(--shadow)' }}>
        {bearbeiteMeta ? (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            <div style={{ display:'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap:10 }}>
              {[
                { key:'titel',     label:'Titel *',  placeholder:'z.B. Ave Maria' },
                { key:'komponist', label:'Komponist', placeholder:'z.B. Schubert' },
                { key:'tonart',    label:'Tonart',    placeholder:'z.B. F-Dur' },
                { key:'tempo',     label:'Tempo',     placeholder:'z.B. Andante / 80 BPM' },
              ].map(f => (
                <div key={f.key} style={{ display:'flex', flexDirection:'column', gap:5, gridColumn: f.key==='titel' ? 'span 2' : 'span 1' }}>
                  <label style={s.label}>{f.label}</label>
                  {f.key === 'tempo' ? (
                    <div style={{ display:'flex', gap:6 }}>
                      <input style={{ ...s.input, flex:1 }} placeholder={f.placeholder} value={metaForm[f.key]}
                        onChange={e => setMetaForm(p => ({ ...p, [f.key]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') metaSpeichern(); if (e.key === 'Escape') setBearbeiteMeta(false) }} />
                      <button onPointerDown={e => e.preventDefault()} onClick={() => {
                        const now = Date.now()
                        tapZeitenEditRef.current = [...tapZeitenEditRef.current.filter(t => now - t < 3000), now]
                        const arr = tapZeitenEditRef.current
                        if (arr.length >= 2) {
                          const gaps = arr.slice(1).map((t, i) => t - arr[i])
                          const avg = gaps.reduce((a, b) => a + b) / gaps.length
                          const b = Math.round(60000 / avg)
                          if (b >= 20 && b <= 300) setMetaForm(p => ({ ...p, tempo: String(b) }))
                        }
                      }} style={{ padding:'10px 12px', minHeight:44, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0, userSelect:'none', whiteSpace:'nowrap' }}>
                        TAP
                      </button>
                    </div>
                  ) : (
                    <input style={s.input} placeholder={f.placeholder} value={metaForm[f.key]}
                      onChange={e => setMetaForm(p => ({ ...p, [f.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') metaSpeichern(); if (e.key === 'Escape') setBearbeiteMeta(false) }} />
                  )}
                </div>
              ))}
              {/* Takt */}
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={s.label}>{T('piece_taktart')}</label>
                <select style={s.input} value={metaForm.takt} onChange={e => setMetaForm(p => ({ ...p, takt: e.target.value }))}>
                  <option value="">{T('piece_taktart_none')}</option>
                  <optgroup label="Gerader Takt">
                    <option value="4/4">4/4</option>
                    <option value="2/4">2/4</option>
                    <option value="2/2">2/2 (alla breve)</option>
                  </optgroup>
                  <optgroup label="Ungerader Takt">
                    <option value="3/4">3/4</option>
                    <option value="3/8">3/8</option>
                  </optgroup>
                  <optgroup label="Zusammengesetzt">
                    <option value="6/8">6/8</option>
                    <option value="6/4">6/4</option>
                    <option value="9/8">9/8</option>
                    <option value="12/8">12/8</option>
                  </optgroup>
                  <optgroup label="Ungerade">
                    <option value="5/4">5/4</option>
                    <option value="5/8">5/8</option>
                    <option value="7/8">7/8</option>
                    <option value="7/4">7/4</option>
                    <option value="10/8">10/8</option>
                    <option value="11/8">11/8</option>
                  </optgroup>
                </select>
              </div>
              {/* Anmerkungen */}
              <div style={{ display:'flex', flexDirection:'column', gap:5, gridColumn: mob ? 'span 1' : 'span 2' }}>
                <label style={s.label}>{T('piece_anmerkungen')}</label>
                <textarea style={{ ...s.input, minHeight:72, resize:'vertical' }} placeholder={T('piece_anmerkungen_placeholder')}
                  value={metaForm.anmerkungen}
                  onChange={e => setMetaForm(p => ({ ...p, anmerkungen: e.target.value }))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setBearbeiteMeta(false)} style={s.btnSek}>Abbrechen</button>
              <button onClick={metaSpeichern} style={s.btnPri}>💾 Speichern</button>
            </div>
          </div>
        ) : (
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
            <div style={{ flex:1, minWidth:0 }}>
              <h1 style={{ margin:'0 0 6px', fontSize: mob ? 20 : 24, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px', wordBreak:'break-word' }}>{stueck.titel}</h1>
              <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:13, color:'var(--text-2)', alignItems:'center' }}>
                {stueck.komponist && <span>🎼 {stueck.komponist}</span>}
                {stueck.tonart    && <span>🎵 {stueck.tonart}</span>}
                {stueck.takt      && <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><span style={{ fontSize:10, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{T('piece_takt')}</span><span style={{ fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{stueck.takt}</span></span>}
                {stueck.tempo     && <span>♩ {stueck.tempo}</span>}
                <button onClick={() => setMetronomOffen(o => !o)}
                  style={{ padding:'2px 10px', borderRadius:99, border:'1.5px solid var(--border)', background: metronomOffen ? 'var(--primary)' : 'var(--bg-2)', color: metronomOffen ? 'var(--primary-fg)' : 'var(--text-3)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', lineHeight:'22px' }}>
                  ♩ Metronom
                </button>
              </div>
              {stueck.anmerkungen && (
                <div style={{ marginTop:8, fontSize:13, color:'var(--text-2)', background:'var(--bg)', borderRadius:'var(--radius)', padding:'8px 12px', borderLeft:'3px solid var(--border)', whiteSpace:'pre-wrap' }}>
                  {stueck.anmerkungen}
                </div>
              )}
            </div>
            {kannBearbeiten && (
              <div style={{ display:'flex', gap:8 }}>
                <button onClick={metaBearbeitenStarten} style={s.btnSek} title="Metadaten bearbeiten">✏️</button>
                <button onClick={() => setModal('upload')} style={s.btnPri}>⬆ Upload</button>
                <button onClick={stueckLoeschen}
                  style={{ padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  🗑
                </button>
              </div>
            )}
          </div>
        )}

        {/* Metronom */}
        {metronomOffen && !bearbeiteMeta && (
          <Metronom
            initialBpm={stueck.tempo}
            onTempoSave={kannBearbeiten ? tempoSpeichernVonMetronom : null}
          />
        )}

        {/* Stimmen-Filter */}
        <div style={{ display:'flex', gap:6, marginTop:14, flexWrap:'wrap' }}>
          {['alle','sopran','alt','tenor','bass'].map(st => (
            <button key={st} onClick={() => setFilterStimme(st)}
              style={{ padding:'4px 12px', borderRadius:99, border:'1.5px solid var(--border)', background: filterStimme===st ? 'var(--primary)' : 'var(--bg-2)', color: filterStimme===st ? 'var(--primary-fg)' : 'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
              {st === 'alle' ? T('piece_voice_all') : st === 'sopran' ? T('piece_voice_soprano') : st === 'alt' ? T('piece_voice_alto') : st === 'tenor' ? T('piece_voice_tenor') : T('piece_voice_bass')}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <div style={{ display:'flex', gap:0, marginBottom:0, borderBottom:'2px solid var(--border)', overflowX:'auto', WebkitOverflowScrolling:'touch', scrollbarWidth:'none' }}>
          {tabs.map(t => {
            const [emoji, ...rest] = t.label.split(' ')
            const label = mob ? emoji : t.label
            return (
              <button key={t.id} onClick={() => setTab(t.id)} title={t.label}
                style={{ padding: mob ? '10px 12px' : '10px 18px', background:'none', border:'none', fontSize: mob ? 18 : 14, cursor:'pointer', fontFamily:'inherit', color: tab===t.id ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===t.id ? 800 : 500, borderBottom:`2px solid ${tab===t.id ? 'var(--primary)' : 'transparent'}`, marginBottom:-2, whiteSpace:'nowrap', flexShrink:0 }}>
                {label}
              </button>
            )
          })}
        </div>
      )}

      {/* Tab Inhalt */}
      <div style={{ background:'var(--surface)', borderRadius:'0 0 var(--radius-lg) var(--radius-lg)', padding:padContent, border:'1px solid var(--border)', borderTop:'none', boxShadow:'var(--shadow)', marginBottom:24 }}>

        {/* LIEDTEXT */}
        {tab === 'text' && (
          <div>
            {bearbeiteText && kannBearbeiten ? (
              <LiedtextBearbeiten stueck={stueck} onSpeichern={textSpeichern} onAbbrechen={() => setBearbeiteText(false)} />
            ) : stueck.liedtext ? (
              <>
                {/* Toolbar */}
                <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
                  <button onClick={() => setTextGroesse(g => Math.max(12, g - 2))}
                    style={{ width:36, height:36, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>A−</button>
                  <span style={{ fontSize:12, color:'var(--text-3)', minWidth:32, textAlign:'center' }}>{textGroesse}px</span>
                  <button onClick={() => setTextGroesse(g => Math.min(56, g + 2))}
                    style={{ width:36, height:36, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>A+</button>
                  <div style={{ flex:1 }} />
                  <button onClick={() => setPdfModal(true)} style={s.btnSek} title="Als PDF drucken">📄 PDF</button>
                  <button onClick={() => setVollbild(true)}
                    style={{ padding:'8px 16px', borderRadius:'var(--radius)', border:'none', background:'var(--accent)', color:'var(--accent-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    {T('piece_fullscreen')}
                  </button>
                  {kannBearbeiten && (
                    <button onClick={() => setBearbeiteText(true)} style={s.btnSek}>✏️</button>
                  )}
                </div>
                {stueck.liedtext_md !== false
                  ? <div dangerouslySetInnerHTML={{ __html: safeMarkdown(stueck.liedtext) }}
                      style={{ fontFamily:'Georgia, serif', fontSize:textGroesse, lineHeight:1.9, color:'var(--text)', transition:'font-size 0.2s', wordBreak:'break-word' }} />
                  : <pre style={{ fontFamily:'Georgia, serif', fontSize:textGroesse, lineHeight:1.9, color:'var(--text)', whiteSpace:'pre-wrap', margin:0, transition:'font-size 0.2s', wordBreak:'break-word' }}>{stueck.liedtext}</pre>
                }
              </>
            ) : kannBearbeiten ? (
              <div style={{ textAlign:'center', padding:32 }}>
                <p style={{ color:'var(--text-3)', marginBottom:16 }}>Noch kein Liedtext vorhanden.</p>
                <button onClick={() => setBearbeiteText(true)} style={s.btnPri}>+ Liedtext hinzufügen</button>
              </div>
            ) : (
              <div style={s.leer}>Kein Liedtext vorhanden.</div>
            )}
          </div>
        )}

        {/* AKKORDE */}
        {tab === 'akkorde' && (
          <div>
            <ChordPlayer notizen={stueck.notizen} tempo={stueck.tempo} takt={stueck.takt} />
            {/* Transpositions-Leiste */}
            {(stueck.notizen || akkordDateien.length > 0) && (
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:'12px 16px', background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px solid var(--border)', flexWrap:'wrap' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text-2)', flexShrink:0 }}>🎵 Transponieren:</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <button onClick={() => setHalbtoene(h => h - 1)}
                    style={{ width:34, height:34, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:18, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>−</button>
                  <div style={{ minWidth:52, textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:800, color: halbtoene !== 0 ? 'var(--accent)' : 'var(--text)' }}>
                      {halbtoene > 0 ? '+' : ''}{halbtoene}
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-3)', marginTop:-2 }}>{T('piece_halftones')}</div>
                  </div>
                  <button onClick={() => setHalbtoene(h => h + 1)}
                    style={{ width:34, height:34, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:18, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+</button>
                </div>
                {/* Schnellwahl-Steps */}
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {[-5,-4,-3,-2,-1,1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setHalbtoene(n)}
                      style={{ padding:'4px 8px', borderRadius:6, border:'1.5px solid var(--border)', background: halbtoene===n ? 'var(--accent)' : 'var(--bg)', color: halbtoene===n ? 'var(--accent-fg)' : 'var(--text-3)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      {n > 0 ? '+' : ''}{n}
                    </button>
                  ))}
                </div>
                {halbtoene !== 0 && (
                  <button onClick={() => setHalbtoene(0)}
                    style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                    ↺ Reset
                  </button>
                )}
              </div>
            )}

            {stueck.notizen && (
              <div style={{ marginBottom:24 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <div style={s.sectionLabel}>Akkorde</div>
                  {kannBearbeiten && <button onClick={() => { setBearbeiteText(true); setTab('text') }} style={{ ...s.btnSek, fontSize:12, padding:'5px 10px' }}>✏️ Bearbeiten</button>}
                </div>
                <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'16px 20px' }}>
                  <ChordPro text={transponiereText(stueck.notizen, halbtoene)} />
                </div>
              </div>
            )}
            {akkordDateien.map(d => (
              <div key={d.id} style={{ marginBottom:20 }}>
                <div style={s.sectionLabel}>{d.name}</div>
                <AkkordDateiAnzeige datei={d} halbtoene={halbtoene} kannLoeschen={kannBearbeiten} onLoeschen={() => dateiLoeschen(d.id, d.bucket_pfad)} />
              </div>
            ))}
            {kannBearbeiten && stueck.youtube_url && (
              <div style={{ marginTop: stueck.notizen || akkordDateien.length > 0 ? 16 : 0 }}>
                <button
                  onClick={akkordErkennen}
                  disabled={bpLaeuft}
                  style={{ ...s.btnSek, fontSize:13, padding:'8px 14px', display:'flex', alignItems:'center', gap:6, opacity: bpLaeuft ? 0.6 : 1 }}>
                  {bpLaeuft ? '⏳ Erkenne Akkorde…' : '🎵 Akkorde aus YouTube erkennen'}
                </button>
                {bpFehler && <div style={{ fontSize:12, color:'var(--danger)', marginTop:6 }}>{bpFehler}</div>}
              </div>
            )}
            {!stueck.notizen && akkordDateien.length === 0 && !stueck.youtube_url && (
              <div style={s.leer}>Keine Akkorde vorhanden.</div>
            )}
            {!stueck.notizen && akkordDateien.length === 0 && !!stueck.youtube_url && !kannBearbeiten && (
              <div style={s.leer}>Keine Akkorde vorhanden.</div>
            )}
          </div>
        )}

        {/* NOTEN */}
        {tab === 'noten' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {notenDateien.map(d => (
              <PdfCard key={d.id} datei={d} kannLoeschen={kannBearbeiten} onLoeschen={() => dateiLoeschen(d.id, d.bucket_pfad)} />
            ))}
          </div>
        )}

        {/* AUDIO */}
        {tab === 'audio' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {audioDateien.map(d => (
              <AudioPlayer key={d.id} datei={d} kannLoeschen={kannBearbeiten} onLoeschen={() => dateiLoeschen(d.id, d.bucket_pfad)} />
            ))}
          </div>
        )}

        {/* YOUTUBE */}
        {tab === 'youtube' && (
          <div>
            {stueck.youtube_url && !youtubeEdit ? (
              <>
                <div style={{ position:'relative', paddingBottom:'56.25%', height:0, overflow:'hidden', borderRadius:'var(--radius)', background:'#000' }}>
                  <iframe
                    style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', border:'none' }}
                    src={`https://www.youtube.com/embed/${youtubeId(stueck.youtube_url)}`}
                    title="YouTube"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div style={{ marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <a href={stueck.youtube_url} target="_blank" rel="noreferrer"
                    style={{ fontSize:13, color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>
                    ↗ Auf YouTube öffnen
                  </a>
                  {kannBearbeiten && (
                    <button onClick={() => { setYoutubeInput(stueck.youtube_url ?? ''); setYoutubeEdit(true) }}
                      style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                      ✎ Link ändern
                    </button>
                  )}
                </div>
              </>
            ) : kannBearbeiten ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <p style={{ margin:0, fontSize:14, color:'var(--text-2)' }}>
                  {stueck.youtube_url ? 'YouTube-Link bearbeiten:' : 'YouTube-Link hinzufügen:'}
                </p>
                <input
                  type="url"
                  value={youtubeInput}
                  onChange={e => setYoutubeInput(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  style={{ padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', outline:'none', width:'100%', boxSizing:'border-box' }}
                />
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  {stueck.youtube_url && (
                    <button onClick={() => { setYoutubeInput(''); youtubeSpeichern() }}
                      style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                      🗑 Entfernen
                    </button>
                  )}
                  <button onClick={() => setYoutubeEdit(false)}
                    style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                    Abbrechen
                  </button>
                  <button onClick={youtubeSpeichern} disabled={!youtubeInput.trim()}
                    style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    💾 Speichern
                  </button>
                </div>
              </div>
            ) : (
              <div style={s.leer}>Kein Video verlinkt.</div>
            )}
          </div>
        )}

        {/* SPOTIFY */}
        {tab === 'spotify' && (
          <div>
            {stueck.spotify_url ? (
              <>
                <iframe
                  src={`https://open.spotify.com/embed/track/${spotifyTrackId(stueck.spotify_url)}?utm_source=generator`}
                  width="100%" height="152" frameBorder="0"
                  allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
                  loading="lazy"
                  style={{ borderRadius:12, display:'block' }}
                />
                <div style={{ marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
                  <a href={stueck.spotify_url} target="_blank" rel="noreferrer"
                    style={{ fontSize:13, color:'#1DB954', textDecoration:'none', fontWeight:600 }}>
                    ↗ Auf Spotify öffnen
                  </a>
                  {kannBearbeiten && (
                    <div style={{ display:'flex', gap:8 }}>
                      <button onClick={() => setSpotifyModal(true)}
                        style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'1.5px solid #1DB954', background:'transparent', color:'#1DB954', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                        🔍 Song ändern
                      </button>
                      <button onClick={() => spotifySpeichern('')}
                        style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                        🗑
                      </button>
                    </div>
                  )}
                </div>
              </>
            ) : kannBearbeiten ? (
              <div style={{ textAlign:'center', padding:32 }}>
                <p style={{ color:'var(--text-3)', marginBottom:16, fontSize:14 }}>Noch kein Spotify-Track verknüpft.</p>
                <button onClick={() => setSpotifyModal(true)}
                  style={{ padding:'10px 24px', borderRadius:'var(--radius)', border:'none', background:'#1DB954', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                  🔍 Song auf Spotify suchen
                </button>
              </div>
            ) : (
              <div style={s.leer}>Kein Spotify-Track verlinkt.</div>
            )}
            {spotifyModal && (
              <SpotifyModal
                titelVorschlag={stueck.titel}
                onUebernehmen={url => spotifySpeichern(url)}
                onSchliessen={() => setSpotifyModal(false)}
              />
            )}
          </div>
        )}

        {/* DATEIEN */}
        {tab === 'dateien' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {dokumente.length === 0 ? (
              <div style={s.leer}>Keine allgemeinen Dateien.</div>
            ) : (
              dokumente.map(d => (
                <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)' }}>
                  <span style={{ fontSize:24, flexShrink:0 }}>{dateiIcon(d.name)}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <OeffnenButton pfad={d.bucket_pfad} />
                    <DownloadButton datei={d} label="⬇" />
                    {kannBearbeiten && (
                      <button onClick={() => dateiLoeschen(d.id, d.bucket_pfad)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--danger)', padding:4 }}>🗑</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {modal === 'upload' && (
        <DateiUploadModal stueckId={stueckId} onClose={() => setModal(null)} onErfolg={ladeData} />
      )}

      {/* PDF Export Modal */}
      {pdfModal && createPortal(
        <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => { if (e.target === e.currentTarget) setPdfModal(false) }}>
          <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:28, width:'100%', maxWidth:380, boxShadow:'var(--shadow-lg)' }}>
            <div style={{ fontWeight:800, fontSize:16, marginBottom:16 }}>📄 PDF exportieren</div>
            <div style={{ fontSize:14, color:'var(--text-2)', marginBottom:16 }}>
              <strong style={{ color:'var(--text)' }}>{stueck?.titel}</strong>
              {stueck?.komponist && <span style={{ color:'var(--text-3)' }}> · {stueck.komponist}</span>}
            </div>
            {schule?.logo_url ? (
              <div style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:20 }}>
                <img src={schule.logo_url} alt="Logo" style={{ maxHeight:36, maxWidth:100, objectFit:'contain' }}
                  onError={e => { e.target.style.display='none' }} />
                <span style={{ fontSize:12, color:'var(--text-3)' }}>Schullogo wird eingebettet</span>
              </div>
            ) : (
              <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:20, padding:'10px 14px', background:'var(--bg-2)', borderRadius:'var(--radius)' }}>
                Kein Logo hinterlegt — in den <strong>Schuleinstellungen</strong> konfigurierbar.
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setPdfModal(false)} style={s.btnSek}>Abbrechen</button>
              <button onClick={() => { setPdfModal(false); liedtextAlsPdf() }} style={s.btnPri}>🖨️ Drucken</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Vollbild Modus */}
      {vollbild && stueck?.liedtext && createPortal(
        <div style={{ position:'fixed', inset:0, background:'#111', zIndex:2000, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'rgba(255,255,255,0.06)', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stueck.titel}</div>
              {stueck.komponist && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>{stueck.komponist}</div>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
              <button onClick={() => setVollbild(false)}
                style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', padding:'8px 16px', borderRadius:8, flexShrink:0 }}>
                ✕ Schließen
              </button>
            </div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding: mob ? '24px 16px' : '40px 10vw', WebkitOverflowScrolling:'touch' }}>
            {stueck.liedtext_md !== false
              ? <div dangerouslySetInnerHTML={{ __html: safeMarkdown(stueck.liedtext) }}
                  style={{ fontFamily:'Georgia, serif', fontSize:textGroesse, lineHeight:1.9, color:'#fff', margin:'0 auto', maxWidth:700, transition:'font-size 0.15s', wordBreak:'break-word' }} />
              : <pre style={{ fontFamily:'Georgia, serif', fontSize:textGroesse, lineHeight:1.9, color:'#fff', whiteSpace:'pre-wrap', margin:'0 auto', maxWidth:700, transition:'font-size 0.15s', wordBreak:'break-word' }}>{stueck.liedtext}</pre>
            }
          </div>
          <div style={{ padding:'12px 16px', background:'rgba(255,255,255,0.06)', borderTop:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button onClick={() => setTextGroesse(g => Math.max(10, g - 2))}
                style={{ width:48, height:48, borderRadius:10, background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', fontSize:20, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>A−</button>
              <input type="range" min={10} max={80} value={textGroesse}
                onChange={e => setTextGroesse(Number(e.target.value))}
                style={{ flex:1, accentColor:'white', height:6, cursor:'pointer' }} />
              <button onClick={() => setTextGroesse(g => Math.min(80, g + 2))}
                style={{ width:48, height:48, borderRadius:10, background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', fontSize:20, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>A+</button>
              <span style={{ color:'rgba(255,255,255,0.4)', fontSize:12, minWidth:36, textAlign:'center' }}>{textGroesse}px</span>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  )
}

const s = {
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
  modal:       { background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', padding:'28px 32px 0', flexShrink:0 },
  modalBody:   { overflowY:'auto', flex:1, padding:'24px 32px 28px', overscrollBehavior:'contain' },
  modalTitel:  { margin:0, fontSize:18, fontWeight:800, color:'var(--text)' },
  iconBtn:     { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 },
  label:       { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  sectionLabel:{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 },
  input:       { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%', boxSizing:'border-box' },
  btnPri:      { padding:'10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek:      { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  leer:        { padding:'32px', textAlign:'center', color:'var(--text-3)', fontSize:13, background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px dashed var(--border)' },
}
