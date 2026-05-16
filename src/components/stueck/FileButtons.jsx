import { useState } from 'react'
import { supabase } from '../../lib/supabase'

export async function getSignedUrl(pfad) {
  const { data } = await supabase.storage.from('stueck-dateien').createSignedUrl(pfad, 86400)
  return data?.signedUrl ?? null
}

export function DownloadButton({ datei, label = '⬇ Herunterladen', full = false }) {
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

export function OeffnenButton({ pfad }) {
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
