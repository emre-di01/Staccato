import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { transponiereText } from '../../lib/akkordeUtils'
import ChordPro from './ChordProRenderer'

export default function AkkordDateiAnzeige({ datei, halbtoene = 0, kannLoeschen, onLoeschen }) {
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
