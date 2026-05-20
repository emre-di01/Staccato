import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useApp } from '../../context/AppContext'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const HEADERS = {
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
}

const ms = {
  overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1200, display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
  box:     { background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:24, maxWidth:500, width:'100%', maxHeight:'85vh', display:'flex', flexDirection:'column', gap:14, boxShadow:'var(--shadow-lg)', overflow:'hidden' },
  input:   { padding:'9px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', outline:'none', flex:1 },
  track:   (aktiv) => ({ display:'flex', alignItems:'center', gap:10, padding:'10px 12px', borderRadius:'var(--radius)', border:`1.5px solid ${aktiv ? 'var(--primary)' : 'var(--border)'}`, background: aktiv ? 'color-mix(in srgb, var(--primary) 8%, var(--bg-2))' : 'var(--bg-2)', cursor:'pointer' }),
  btnPri:  { padding:'9px 20px', borderRadius:'var(--radius)', border:'none', background:'#FF0000', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek:  { padding:'9px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
}

export default function YtMusicModal({ titelVorschlag, onUebernehmen, onSchliessen }) {
  const { T } = useApp()
  const [query,      setQuery]      = useState(titelVorschlag ?? '')
  const [ergebnisse, setErgebnisse] = useState([])
  const [laden,      setLaden]      = useState(false)
  const [fehler,     setFehler]     = useState('')
  const [gewaehlter, setGewaehlter] = useState(null)

  async function suchen() {
    if (!query.trim()) return
    setLaden(true); setFehler(''); setErgebnisse([]); setGewaehlter(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/ytmusic-suche`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ q: query.trim() }),
      })
      const data = await res.json()
      if (data.error) { setFehler(data.error); return }
      setErgebnisse(data.tracks ?? [])
      if (!data.tracks?.length) setFehler(T('no_results'))
    } catch { setFehler(T('conn_error')) }
    setLaden(false)
  }

  return createPortal(
    <div style={ms.overlay} onClick={e => e.target === e.currentTarget && onSchliessen()}>
      <div style={ms.box}>
        <div style={{ fontSize:17, fontWeight:800, color:'var(--text)', flexShrink:0 }}>{T('piece_ytmusic_modal_title')}</div>

        <div style={{ display:'flex', gap:8, flexShrink:0 }}>
          <input style={ms.input} value={query} onChange={e => setQuery(e.target.value)}
            placeholder={T('search_title_artist')}
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
              <div key={t.videoId} onClick={() => setGewaehlter(t)} style={ms.track(gewaehlter?.videoId === t.videoId)}>
                {t.thumbnail
                  ? <img src={t.thumbnail} alt="" style={{ width:40, height:40, borderRadius:4, objectFit:'cover', flexShrink:0 }} />
                  : <div style={{ width:40, height:40, borderRadius:4, background:'var(--border)', flexShrink:0, display:'flex', alignItems:'center', justifyContent:'center', fontSize:18 }}>🎵</div>
                }
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.title}</div>
                  <div style={{ fontSize:12, color:'var(--text-3)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.artist}{t.album ? ` · ${t.album}` : ''}</div>
                </div>
              </div>
            ))}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexShrink:0 }}>
          <button onClick={onSchliessen} style={ms.btnSek}>{T('cancel')}</button>
          <button disabled={!gewaehlter}
            onClick={() => { onUebernehmen(`https://music.youtube.com/watch?v=${gewaehlter.videoId}`); onSchliessen() }}
            style={{ ...ms.btnPri, opacity: !gewaehlter ? 0.4 : 1 }}>
            {T('piece_ytmusic_link_btn')}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
