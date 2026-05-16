import { useState, useRef, useEffect } from 'react'
import { useApp } from '../context/AppContext'

const SPRACHEN = [
  { value: null,  label: 'Automatisch' },
  { value: 'de',  label: 'Deutsch' },
  { value: 'en',  label: 'Englisch' },
  { value: 'tr',  label: 'Türkisch' },
]

async function audioDekodieren(file) {
  const ab = await file.arrayBuffer()
  const ctx = new AudioContext({ sampleRate: 16000 })
  const buf = await ctx.decodeAudioData(ab)
  // Mono: mitteln wenn Stereo
  const ch0 = buf.getChannelData(0)
  let mono = ch0
  if (buf.numberOfChannels > 1) {
    const ch1 = buf.getChannelData(1)
    mono = new Float32Array(ch0.length)
    for (let i = 0; i < ch0.length; i++) mono[i] = (ch0[i] + ch1[i]) / 2
  }
  await ctx.close()
  return mono
}

export default function AudioTranskribierenModal({ onErgebnis, onSchliessen }) {
  const { T } = useApp()
  const [phase, setPhase]           = useState('idle')   // idle | laden | bereit | verarbeitung | fertig | fehler
  const [ladeInfo, setLadeInfo]     = useState('')
  const [fortschritt, setFortschritt] = useState(0)
  const [datei, setDatei]           = useState(null)
  const [sprache, setSprache]       = useState(null)
  const [ergebnis, setErgebnis]     = useState('')
  const [fehler, setFehler]         = useState('')
  const workerRef                   = useRef(null)

  useEffect(() => {
    const w = new Worker(new URL('../workers/whisper.worker.js', import.meta.url), { type: 'module' })
    workerRef.current = w
    w.onmessage = ({ data }) => {
      if (data.type === 'download') {
        if (data.status === 'progress') {
          setFortschritt(Math.round(data.progress ?? 0))
          setLadeInfo(`${data.file ?? 'Modell'} … ${Math.round(data.progress ?? 0)}%`)
        } else if (data.status === 'done') {
          setLadeInfo('Modell geladen')
        }
      } else if (data.type === 'ready') {
        setPhase('bereit')
      } else if (data.type === 'result') {
        setErgebnis(data.text)
        setPhase('fertig')
      } else if (data.type === 'error') {
        setFehler(data.message)
        setPhase('fehler')
      }
    }
    setPhase('laden')
    setLadeInfo('Whisper-Modell wird geladen (≈145 MB, einmalig) …')
    w.postMessage({ type: 'load' })
    return () => w.terminate()
  }, [])

  async function transkribieren() {
    if (!datei) return
    setPhase('verarbeitung')
    setFortschritt(0)
    try {
      const audio = await audioDekodieren(datei)
      workerRef.current.postMessage({ type: 'transcribe', audio: audio.buffer, language: sprache }, [audio.buffer])
    } catch (e) {
      setFehler('Audio konnte nicht dekodiert werden: ' + e.message)
      setPhase('fehler')
    }
  }

  const s = {
    overlay: { position:'fixed', inset:0, background:'rgba(0,0,0,0.55)', zIndex:1000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 },
    box: { background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:28, maxWidth:480, width:'100%', boxShadow:'var(--shadow-lg)', display:'flex', flexDirection:'column', gap:16 },
    label: { fontSize:13, color:'var(--text-2)', fontWeight:600 },
    bar: { height:6, borderRadius:3, background:'var(--border)', overflow:'hidden' },
    fill: { height:'100%', background:'var(--primary)', transition:'width 0.3s', width:`${fortschritt}%` },
    select: { padding:'8px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text)', fontSize:13, cursor:'pointer', fontFamily:'inherit', width:'100%' },
    textarea: { padding:'10px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text)', fontSize:14, fontFamily:'Georgia, serif', lineHeight:1.8, resize:'vertical', minHeight:120, width:'100%', boxSizing:'border-box' },
    btnPri: { padding:'9px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg, #fff)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
    btnSek: { padding:'9px 18px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onSchliessen()}>
      <div style={s.box}>
        <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>🎤 Audio transkribieren</div>

        {(phase === 'laden' || phase === 'verarbeitung') && (
          <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
            <div style={s.label}>{phase === 'laden' ? ladeInfo : 'Wird transkribiert …'}</div>
            {phase === 'laden' && <div style={s.bar}><div style={s.fill} /></div>}
            {phase === 'verarbeitung' && (
              <div style={{ display:'flex', gap:6, alignItems:'center' }}>
                <div style={{ width:16, height:16, borderRadius:'50%', border:'2px solid var(--primary)', borderTopColor:'transparent', animation:'spin 0.8s linear infinite' }} />
                <span style={{ fontSize:13, color:'var(--text-3)' }}>Whisper analysiert Audio …</span>
              </div>
            )}
          </div>
        )}

        {(phase === 'bereit' || phase === 'fertig') && (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={s.label}>Audio-Datei</div>
              <input type="file" accept="audio/*" onChange={e => setDatei(e.target.files[0] || null)}
                style={{ fontSize:13, color:'var(--text)', cursor:'pointer' }} />
              {datei && <div style={{ fontSize:12, color:'var(--text-3)' }}>{datei.name}</div>}
            </div>

            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <div style={s.label}>Sprache</div>
              <select value={sprache ?? ''} onChange={e => setSprache(e.target.value || null)} style={s.select}>
                {SPRACHEN.map(({ value, label }) => (
                  <option key={value ?? 'auto'} value={value ?? ''}>{label}</option>
                ))}
              </select>
            </div>

            {phase === 'fertig' && (
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <div style={s.label}>Ergebnis</div>
                <textarea value={ergebnis} onChange={e => setErgebnis(e.target.value)} style={s.textarea} />
              </div>
            )}
          </>
        )}

        {phase === 'fehler' && (
          <div style={{ padding:'10px 14px', borderRadius:'var(--radius)', background:'rgba(var(--danger-rgb,220,38,38),0.08)', color:'var(--danger)', fontSize:13 }}>
            Fehler: {fehler}
          </div>
        )}

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:4 }}>
          <button onClick={onSchliessen} style={s.btnSek}>Abbrechen</button>
          {phase === 'bereit' && (
            <button onClick={transkribieren} disabled={!datei} style={{ ...s.btnPri, opacity: datei ? 1 : 0.4 }}>
              Transkribieren
            </button>
          )}
          {phase === 'fertig' && (
            <>
              <button onClick={transkribieren} disabled={!datei} style={{ ...s.btnSek, fontSize:13 }}>
                Nochmal
              </button>
              <button onClick={() => { onErgebnis(ergebnis); onSchliessen() }} style={s.btnPri}>
                Übernehmen
              </button>
            </>
          )}
        </div>
      </div>
      <style>{`@keyframes spin { to { transform: rotate(360deg) } }`}</style>
    </div>
  )
}
