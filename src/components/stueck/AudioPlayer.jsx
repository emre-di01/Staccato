import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { DownloadButton } from './FileButtons'

export default function AudioPlayer({ datei, kannLoeschen, onLoeschen }) {
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
