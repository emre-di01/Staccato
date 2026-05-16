import { useState, useRef } from 'react'

const SPRACHEN = [
  { value: 'deu+eng',         label: 'Deutsch + Englisch' },
  { value: 'deu',             label: 'Deutsch' },
  { value: 'eng',             label: 'Englisch' },
  { value: 'tur',             label: 'Türkisch' },
  { value: 'deu+eng+tur',     label: 'Alle (langsamer)' },
]

export default function FotoOCRModal({ onErgebnis, onSchliessen }) {
  const [phase, setPhase]           = useState('idle')   // idle | laden | fertig | fehler
  const [vorschau, setVorschau]     = useState(null)
  const [datei, setDatei]           = useState(null)
  const [sprache, setSprache]       = useState('deu+eng')
  const [ladeInfo, setLadeInfo]     = useState('')
  const [ergebnis, setErgebnis]     = useState('')
  const [fehler, setFehler]         = useState('')

  function bildGewaehlt(e) {
    const file = e.target.files[0]
    if (!file) return
    setDatei(file)
    const url = URL.createObjectURL(file)
    setVorschau(url)
    setPhase('idle')
    setErgebnis('')
  }

  async function extrahieren() {
    if (!datei) return
    setPhase('laden')
    setLadeInfo('Tesseract lädt Sprachdaten …')
    try {
      const { createWorker } = await import('tesseract.js')
      const worker = await createWorker(sprache, 1, {
        logger: m => {
          if (m.status === 'recognizing text') {
            setLadeInfo(`Texterkennung … ${Math.round(m.progress * 100)}%`)
          } else if (m.status === 'loading tesseract core') {
            setLadeInfo('Tesseract wird geladen …')
          } else if (m.status === 'loading language traineddata') {
            setLadeInfo(`Sprachdaten werden geladen … ${Math.round(m.progress * 100)}%`)
          }
        }
      })
      const { data: { text } } = await worker.recognize(datei)
      await worker.terminate()
      setErgebnis(text.trim())
      setPhase('fertig')
    } catch (e) {
      setFehler(e.message)
      setPhase('fehler')
    }
  }

  const s = {
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
    box: { background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:28, maxWidth:520, width:'100%', boxShadow:'var(--shadow-lg)', display:'flex', flexDirection:'column', gap:16, maxHeight:'90vh', overflowY:'auto' },
    label: { fontSize:13, color:'var(--text-2)', fontWeight:600 },
    select: { padding:'8px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text)', fontSize:13, cursor:'pointer', fontFamily:'inherit', width:'100%' },
    textarea: { padding:'10px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text)', fontSize:14, fontFamily:'Georgia, serif', lineHeight:1.8, resize:'vertical', minHeight:150, width:'100%', boxSizing:'border-box' },
    btnPri: { padding:'9px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg, #fff)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
    btnSek: { padding:'9px 18px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onSchliessen()}>
      <div style={s.box}>
        <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>📷 Text aus Bild extrahieren</div>

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={s.label}>Foto oder Scan</div>
          <input type="file" accept="image/*" onChange={bildGewaehlt}
            style={{ fontSize:13, color:'var(--text)', cursor:'pointer' }} />
        </div>

        {vorschau && (
          <img src={vorschau} alt="Vorschau"
            style={{ maxHeight:200, borderRadius:'var(--radius)', border:'1px solid var(--border)', objectFit:'contain', width:'100%' }} />
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <div style={s.label}>Sprache im Bild</div>
          <select value={sprache} onChange={e => setSprache(e.target.value)} style={s.select}>
            {SPRACHEN.map(({ value, label }) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </div>

        {phase === 'laden' && (
          <div style={{ display:'flex', gap:8, alignItems:'center' }}>
            <div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid var(--primary)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite', flexShrink:0 }} />
            <span style={{ fontSize:13, color:'var(--text-3)' }}>{ladeInfo}</span>
          </div>
        )}

        {phase === 'fertig' && (
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <div style={s.label}>Erkannter Text</div>
            <textarea value={ergebnis} onChange={e => setErgebnis(e.target.value)} style={s.textarea} />
            <div style={{ fontSize:12, color:'var(--text-3)' }}>Du kannst den Text vor dem Übernehmen bearbeiten.</div>
          </div>
        )}

        {phase === 'fehler' && (
          <div style={{ padding:'10px 14px', borderRadius:'var(--radius)', background:'rgba(var(--danger-rgb,220,38,38),0.08)', color:'var(--danger)', fontSize:13 }}>
            Fehler: {fehler}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
          <button onClick={onSchliessen} style={s.btnSek}>Abbrechen</button>
          {phase !== 'laden' && datei && phase !== 'fertig' && (
            <button onClick={extrahieren} style={s.btnPri}>Text extrahieren</button>
          )}
          {phase === 'fertig' && (
            <>
              <button onClick={extrahieren} style={{ ...s.btnSek, fontSize:13 }}>Nochmal</button>
              <button onClick={() => { onErgebnis(ergebnis); onSchliessen() }} style={s.btnPri}>Übernehmen</button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
