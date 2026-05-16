import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { getSignedUrl, DownloadButton } from './FileButtons'

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

export default function PdfCard({ datei, kannLoeschen, onLoeschen }) {
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
            <button onClick={async () => { const u = await getSignedUrl(datei.bucket_pfad); if (u) window.open(u, '_blank') }}
              style={{ padding:'9px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
              ↗ Öffnen
            </button>
            <DownloadButton datei={datei} label="⬇" />
            {kannLoeschen && (
              <button onClick={onLoeschen} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--danger)', padding:4 }}>🗑</button>
            )}
          </div>
        </div>
      </div>

      {modal && createPortal(
        <div style={{ position:'fixed', inset:0, background:'#000', zIndex:2000, display:'flex', flexDirection:'column' }}>
          <PdfViewer url={url} />
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
