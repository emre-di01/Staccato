import { useState, useEffect, useRef } from 'react'

const ctrl = { width:30, height:30, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }

export default function Metronom({ initialBpm, onTempoSave }) {
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
          <button onClick={() => setBpm(b => Math.max(20, b - 1))} style={ctrl}>−</button>
          <div style={{ textAlign:'center', minWidth:56 }}>
            <div style={{ fontSize:22, fontWeight:900, lineHeight:1, color: beat ? 'var(--primary)' : 'var(--text)', transition:'color 0.05s' }}>{bpm}</div>
            <div style={{ fontSize:9, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>BPM</div>
          </div>
          <button onClick={() => setBpm(b => Math.min(300, b + 1))} style={ctrl}>+</button>
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
