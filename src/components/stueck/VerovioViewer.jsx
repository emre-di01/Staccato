import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'

let verovioModCache = null
async function ladeVerovio() {
  if (verovioModCache) return verovioModCache
  const [{ default: createMod }, { VerovioToolkit }] = await Promise.all([
    import('verovio/wasm'),
    import('verovio/esm'),
  ])
  const mod = await createMod()
  verovioModCache = { mod, VerovioToolkit }
  return verovioModCache
}

export default function VerovioViewer({ datei, kannLoeschen, onLoeschen }) {
  const [seiten,  setSeiten]  = useState([])
  const [laden,   setLaden]   = useState(true)
  const [fehler,  setFehler]  = useState('')
  const [seite,   setSeite]   = useState(1)

  useEffect(() => { render() }, [])

  async function render() {
    setLaden(true); setFehler('')
    try {
      const { data } = await supabase.storage.from('stueck-dateien').createSignedUrl(datei.bucket_pfad, 3600)
      if (!data?.signedUrl) throw new Error('Signed URL fehlgeschlagen')
      const xml = await fetch(data.signedUrl).then(r => r.text())
      const { mod, VerovioToolkit } = await ladeVerovio()
      const tk = new VerovioToolkit(mod)
      tk.setOptions({ scale: 40, adjustPageWidth: 1, pageMarginTop: 60, pageMarginBottom: 60, pageMarginLeft: 60, pageMarginRight: 60 })
      tk.loadData(xml)
      const count = tk.getPageCount()
      const svgList = Array.from({ length: count }, (_, i) => tk.renderToSVG(i + 1))
      setSeiten(svgList)
    } catch (e) {
      setFehler(e.message)
    }
    setLaden(false)
  }

  const btnStyle = { padding:'5px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }

  return (
    <div style={{ borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', background:'var(--surface)' }}>
      <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 14px', borderBottom:'1px solid var(--border)', background:'var(--bg-2)' }}>
        <span style={{ fontSize:18 }}>🎼</span>
        <span style={{ fontWeight:700, fontSize:13, flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', color:'var(--text)' }}>{datei.name}</span>
        {kannLoeschen && <button onClick={onLoeschen} style={{ background:'none', border:'none', fontSize:16, cursor:'pointer', color:'var(--danger)', padding:4 }}>🗑</button>}
      </div>

      {laden && <div style={{ padding:32, textAlign:'center', color:'var(--text-3)', fontSize:13 }}>🎼 Lade Notation…</div>}
      {fehler && <div style={{ padding:20, color:'var(--danger)', fontSize:13 }}>{fehler}</div>}

      {seiten.length > 0 && (
        <>
          <div style={{ padding:12, overflowX:'auto', background:'#fff' }}
            dangerouslySetInnerHTML={{ __html: seiten[seite - 1] }} />
          {seiten.length > 1 && (
            <div style={{ display:'flex', alignItems:'center', justifyContent:'center', gap:12, padding:'8px 14px', borderTop:'1px solid var(--border)', background:'var(--bg-2)' }}>
              <button onClick={() => setSeite(s => Math.max(1, s - 1))} disabled={seite === 1} style={btnStyle}>‹</button>
              <span style={{ fontSize:13, color:'var(--text-3)' }}>Seite {seite} / {seiten.length}</span>
              <button onClick={() => setSeite(s => Math.min(seiten.length, s + 1))} disabled={seite === seiten.length} style={btnStyle}>›</button>
            </div>
          )}
        </>
      )}
    </div>
  )
}
