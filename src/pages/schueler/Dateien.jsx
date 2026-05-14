import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TYP_ICON = {
  aufnahmeformular: '📋',
  vertrag:          '📝',
  sepa:             '🏦',
  einverstaendnis:  '✅',
  sonstiges:        '📎',
}

const TYP_ORDER = ['aufnahmeformular', 'vertrag', 'sepa', 'einverstaendnis', 'sonstiges']

function DateiZeile({ datei, T }) {
  const [laden, setLaden] = useState(false)

  async function oeffnen() {
    setLaden(true)
    const { data } = await supabase.storage.from('mitglied-dateien').createSignedUrl(datei.bucket_pfad, 86400)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
    setLaden(false)
  }

  async function herunterladen() {
    setLaden(true)
    const { data } = await supabase.storage.from('mitglied-dateien').download(datei.bucket_pfad)
    if (data) {
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url; a.download = datei.name; a.click()
      URL.revokeObjectURL(url)
    }
    setLaden(false)
  }

  return (
    <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)' }}>
      <span style={{ fontSize:24, flexShrink:0 }}>📄</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{datei.name}</div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
          {new Date(datei.hochgeladen_am).toLocaleDateString('de-DE', { day:'2-digit', month:'2-digit', year:'numeric' })}
        </div>
      </div>
      <div style={{ display:'flex', gap:6, flexShrink:0 }}>
        <button onClick={herunterladen} disabled={laden}
          style={{ padding:'8px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
          {laden ? '…' : '⬇'}
        </button>
        <button onClick={oeffnen} disabled={laden}
          style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
          {laden ? '…' : T('dok_open') ?? '↗ Öffnen'}
        </button>
      </div>
    </div>
  )
}

export default function SchuelerDateien() {
  const { profil, T } = useApp()
  const [dateien,  setDateien]  = useState([])
  const [laden,    setLaden]    = useState(true)

  useEffect(() => {
    if (!profil?.id) return
    supabase.from('mitglied_dateien')
      .select('*')
      .eq('profil_id', profil.id)
      .order('hochgeladen_am', { ascending: false })
      .then(({ data }) => { setDateien(data ?? []); setLaden(false) })
  }, [profil?.id])

  const gruppen = {}
  for (const d of dateien) {
    if (!gruppen[d.typ]) gruppen[d.typ] = []
    gruppen[d.typ].push(d)
  }
  const sortiertTypen = TYP_ORDER.filter(t => gruppen[t])

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ margin:'0 0 24px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' }}>
        📁 {T('nav_dateien') ?? 'Dateien'}
      </h1>

      {laden ? (
        <div style={{ padding:40, textAlign:'center', color:'var(--text-3)', fontSize:14 }}>{T('loading')}</div>
      ) : dateien.length === 0 ? (
        <div style={{ padding:'48px 32px', textAlign:'center', background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' }}>
          <div style={{ fontSize:40, marginBottom:12 }}>📂</div>
          <div style={{ fontWeight:700, fontSize:16, color:'var(--text)', marginBottom:6 }}>Noch keine Dateien</div>
          <div style={{ fontSize:13, color:'var(--text-3)', lineHeight:1.6 }}>
            Deine Schule stellt hier Dokumente für dich bereit —<br />
            z.&nbsp;B. Vertrag, SEPA-Mandat oder Einverständniserklärung.
          </div>
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:24 }}>
          {sortiertTypen.map(typ => (
            <div key={typ} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow)' }}>
              <div style={{ display:'flex', alignItems:'center', gap:10, padding:'14px 18px', borderBottom:'1px solid var(--border)', background:'var(--bg-2)' }}>
                <span style={{ fontSize:18 }}>{TYP_ICON[typ] ?? '📎'}</span>
                <span style={{ fontWeight:800, fontSize:14, color:'var(--text)' }}>
                  {T(`dok_type_${typ}`) ?? typ}
                </span>
                <span style={{ marginLeft:'auto', fontSize:12, color:'var(--text-3)', fontWeight:600 }}>
                  {gruppen[typ].length} {gruppen[typ].length === 1 ? 'Datei' : 'Dateien'}
                </span>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:8, padding:'12px 14px' }}>
                {gruppen[typ].map(d => (
                  <DateiZeile key={d.id} datei={d} T={T} />
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
