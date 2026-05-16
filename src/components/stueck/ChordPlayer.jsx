import { useState, useEffect, useRef, useMemo } from 'react'

const NOTEN_NAMES = ["C","C#","D","D#","E","F","F#","G","G#","A","A#","B"]
const CHORD_INTERVALS = [
  ['dim7', [0,3,6,9]],
  ['maj7', [0,4,7,11]],
  ['sus4', [0,5,7]],
  ['sus2', [0,2,7]],
  ['dim',  [0,3,6]],
  ['aug',  [0,4,8]],
  ['m7',   [0,3,7,10]],
  ['7',    [0,4,7,10]],
  ['m',    [0,3,7]],
  ['',     [0,4,7]],
]

export function akkordZuNoten(name) {
  let root, suffix
  if (name.length > 1 && name[1] === '#') {
    root = name.slice(0, 2); suffix = name.slice(2)
  } else {
    root = name[0]; suffix = name.slice(1)
  }
  const ri = NOTEN_NAMES.indexOf(root)
  if (ri === -1) return []
  for (const [s, iv] of CHORD_INTERVALS) {
    if (suffix === s) {
      return iv.map(i => NOTEN_NAMES[(ri + i) % 12] + (3 + Math.floor((ri + i) / 12)))
    }
  }
  return []
}

export default function ChordPlayer({ notizen, tempo, takt }) {
  const [laeuft,   setLaeuft]   = useState(false)
  const [aktIdx,   setAktIdx]   = useState(-1)
  const [geladen,  setGeladen]  = useState(false)
  const synthRef   = useRef(null)
  const timerRefs  = useRef([])
  const ToneRef    = useRef(null)

  const akkorde = useMemo(() => {
    if (!notizen) return []
    return [...notizen.matchAll(/\[([^\]]+)\]/g)].map(m => m[1])
  }, [notizen])

  const bpm = Math.max(40, Math.min(300, parseInt(tempo) || 120))
  const zaehler = parseInt((takt || '4/4').split('/')[0]) || 4
  const secPerMeasure = (zaehler / bpm) * 60

  async function toggleAbspielen() {
    if (laeuft) { stoppen(); return }
    if (akkorde.length === 0) return

    if (!ToneRef.current) {
      ToneRef.current = await import('tone')
      setGeladen(true)
    }
    const Tone = ToneRef.current
    await Tone.start()

    if (!synthRef.current) {
      synthRef.current = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.05, decay: 0.2, sustain: 0.5, release: 1.5 },
        volume: -8,
      }).toDestination()
    }

    const synth    = synthRef.current
    const noteDur  = secPerMeasure * 0.88
    const startNow = Tone.now() + 0.05

    akkorde.forEach((name, i) => {
      const t     = startNow + i * secPerMeasure
      const noten = akkordZuNoten(name)
      if (noten.length) synth.triggerAttackRelease(noten, noteDur, t)
    })

    timerRefs.current.forEach(clearTimeout)
    timerRefs.current = akkorde.map((_, i) =>
      setTimeout(() => setAktIdx(i), 50 + i * secPerMeasure * 1000)
    )
    timerRefs.current.push(
      setTimeout(() => { setLaeuft(false); setAktIdx(-1) }, 50 + akkorde.length * secPerMeasure * 1000)
    )

    setLaeuft(true)
    setAktIdx(0)
  }

  function stoppen() {
    timerRefs.current.forEach(clearTimeout)
    synthRef.current?.releaseAll?.()
    setLaeuft(false)
    setAktIdx(-1)
  }

  useEffect(() => () => stoppen(), [])

  if (akkorde.length === 0) return null

  const aktAkkord = akkorde[aktIdx]

  return (
    <div style={{ display:'flex', alignItems:'center', gap:10, padding:'10px 16px', background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px solid var(--border)', marginBottom:16, flexWrap:'wrap' }}>
      <button
        onClick={toggleAbspielen}
        style={{ width:36, height:36, borderRadius:'50%', border:'none', background:'var(--primary)', color:'#fff', fontSize:16, cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flexShrink:0 }}>
        {laeuft ? '⏸' : '▶'}
      </button>
      <div style={{ fontSize:13, color:'var(--text-2)', flex:1 }}>
        {laeuft
          ? <><span style={{ fontWeight:800, color:'var(--primary)', fontSize:15 }}>{aktAkkord}</span><span style={{ color:'var(--text-3)', marginLeft:6 }}>{aktIdx + 1} / {akkorde.length}</span></>
          : <span>{akkorde.length} Akkorde · {bpm} BPM · {takt || '4/4'}</span>
        }
      </div>
      {laeuft && (
        <button onClick={stoppen} style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
          ■ Stop
        </button>
      )}
    </div>
  )
}
