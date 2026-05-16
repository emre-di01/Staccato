import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'

// ── Noten-Hilfsfunktionen ────────────────────────────────────────
const NOTEN = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const CHORD_INTERVALS = [
  ['dim7',[0,3,6,9]],['maj7',[0,4,7,11]],['sus4',[0,5,7]],['sus2',[0,2,7]],
  ['dim',[0,3,6]],['aug',[0,4,8]],['m7',[0,3,7,10]],['7',[0,4,7,10]],
  ['m',[0,3,7]],['maj',[0,4,7]],['add9',[0,4,7,14]],['9',[0,4,7,10,14]],
  ['6',[0,4,7,9]],['m6',[0,3,7,9]],['sus',[0,5,7]],['aug7',[0,4,8,10]],
  ['',[0,4,7]],
]
function akkordZuPitchClasses(name) {
  let root, suffix
  if (name.length > 1 && (name[1] === '#' || name[1] === 'b')) {
    root = name.slice(0,2); suffix = name.slice(2)
  } else {
    root = name[0]; suffix = name.slice(1)
  }
  // Normalize flats
  const flatMap = {'Db':'C#','Eb':'D#','Fb':'E','Gb':'F#','Ab':'G#','Bb':'A#','Cb':'B'}
  const r = flatMap[root] ?? root
  const ri = NOTEN.indexOf(r)
  if (ri === -1) return []
  for (const [s, iv] of CHORD_INTERVALS) {
    if (suffix === s) return iv.map(i => NOTEN[(ri + i) % 12])
  }
  return [r]
}

// ── Guitar DB lookup ─────────────────────────────────────────────
const DB_KEY_MAP = {
  'C':'C','C#':'Csharp','Db':'Csharp',
  'D':'D','D#':'Eb','Eb':'Eb',
  'E':'E','F':'F','F#':'Fsharp','Gb':'Fsharp',
  'G':'G','G#':'Ab','Ab':'Ab',
  'A':'A','A#':'Bb','Bb':'Bb','B':'B',
}
const SUFFIX_MAP = {
  '':'major','m':'minor','7':'7','m7':'m7','maj7':'maj7','9':'9','m9':'m9',
  'maj9':'maj9','sus4':'sus4','sus2':'sus2','dim':'dim','dim7':'dim7','aug':'aug',
  '6':'6','m6':'m6','add9':'add9','7sus4':'7sus4','mmaj7':'mmaj7',
}
function parseChordName(name) {
  const m = name.match(/^([A-G][#b]?)(.*)$/)
  if (!m) return null
  return { root: m[1], suffix: m[2] }
}

let guitarDbCache = null
async function getGuitarPosition(name) {
  if (!guitarDbCache) {
    const mod = await import('@tombatossals/chords-db/src/db/guitar')
    guitarDbCache = mod.default
  }
  const parsed = parseChordName(name)
  if (!parsed) return null
  const dbKey = DB_KEY_MAP[parsed.root]
  if (!dbKey) return null
  const list = guitarDbCache.chords[dbKey]
  if (!list) return null
  const dbSuffix = SUFFIX_MAP[parsed.suffix] ?? 'major'
  const chordData = list.find(c => c?.suffix === dbSuffix)
  return chordData?.positions?.[0] ?? null
}

// ── Guitar SVG ───────────────────────────────────────────────────
function GuitarSVG({ position }) {
  if (!position) return (
    <div style={{ padding:'12px', fontSize:12, color:'var(--text-3)', textAlign:'center' }}>
      Kein Griffbild verfügbar
    </div>
  )
  const { frets: fretsStr, fingers: fingersStr, barres } = position
  const fretsArr = (fretsStr || '').split('').map(c => c === 'x' ? -1 : parseInt(c, 16))
  const activeFrets = fretsArr.filter(f => f > 0)
  const minFret = activeFrets.length ? Math.min(...activeFrets) : 1
  const baseFret = barres ?? (minFret > 4 ? minFret : 1)

  const W = 90, H = 120
  const nutY = 28
  const fretH = 18
  const strX = i => 12 + i * 13
  const dotCY = f => nutY + (f - baseFret + 0.5) * fretH

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* Strings */}
      {[0,1,2,3,4,5].map(i => (
        <line key={i} x1={strX(i)} y1={nutY} x2={strX(i)} y2={nutY + 4*fretH} stroke="#999" strokeWidth="1" />
      ))}
      {/* Fret lines */}
      {[0,1,2,3,4].map(j => (
        <line key={j} x1={strX(0)} y1={nutY + j*fretH} x2={strX(5)} y2={nutY + j*fretH}
          stroke="#999" strokeWidth={j === 0 && baseFret === 1 ? 3 : 1} />
      ))}
      {/* Open / Muted above nut */}
      {fretsArr.map((f, i) => f === 0
        ? <circle key={i} cx={strX(i)} cy={nutY - 9} r={4} fill="none" stroke="#999" strokeWidth="1.5" />
        : f === -1
          ? <text key={i} x={strX(i)} y={nutY - 4} textAnchor="middle" fontSize="11" fill="#999" fontWeight="bold">×</text>
          : null
      )}
      {/* Barre bar */}
      {barres != null && (
        <rect x={strX(0) - 5} y={dotCY(barres) - 8} width={strX(5) - strX(0) + 10} height={16}
          rx={8} fill="var(--primary)" opacity="0.9" />
      )}
      {/* Finger dots */}
      {fretsArr.map((f, i) => {
        if (f <= 0 || f === barres) return null
        return <circle key={i} cx={strX(i)} cy={dotCY(f)} r={7} fill="var(--primary)" />
      })}
      {/* BaseFret label */}
      {baseFret > 1 && (
        <text x={3} y={nutY + 10} fontSize="8" fill="#999">{baseFret}fr</text>
      )}
    </svg>
  )
}

// ── Piano SVG ────────────────────────────────────────────────────
const WHITE_INDICES = [0,2,4,5,7,9,11] // C D E F G A B
const BLACK_REL_POS = {1:0.67, 3:1.67, 6:3.67, 8:4.67, 10:5.67}

function PianoSVG({ pitchClasses }) {
  const active = new Set(pitchClasses)
  const W = 112, H = 64
  const wkW = W / 14
  const bkW = wkW * 0.6
  const bkH = H * 0.6

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`}>
      {/* White keys — 2 octaves (14 keys) */}
      {Array.from({ length: 14 }, (_, wi) => {
        const note = NOTEN[WHITE_INDICES[wi % 7]]
        const isActive = active.has(note)
        return (
          <rect key={wi} x={wi * wkW + 0.5} y={0.5} width={wkW - 1} height={H - 1}
            rx={2} fill={isActive ? 'var(--primary)' : '#fff'} stroke="#bbb" strokeWidth="0.5" />
        )
      })}
      {/* Black keys — 2 octaves */}
      {[0,1].map(oct => Object.entries(BLACK_REL_POS).map(([semi, rel]) => {
        const note = NOTEN[parseInt(semi)]
        const isActive = active.has(note)
        const x = (oct * 7 + rel) * wkW - bkW / 2
        return (
          <rect key={`${oct}-${semi}`} x={x} y={0} width={bkW} height={bkH}
            rx={2} fill={isActive ? 'var(--primary)' : '#222'} />
        )
      }))}
    </svg>
  )
}

// ── Tooltip ──────────────────────────────────────────────────────
export default function ChordDiagramTooltip({ name, anchorRect, onClose }) {
  const [tab, setTab] = useState('guitar')
  const [guitarPos, setGuitarPos] = useState(undefined) // undefined=loading, null=not found
  const boxRef = useRef()

  useEffect(() => {
    let alive = true
    getGuitarPosition(name).then(pos => { if (alive) setGuitarPos(pos ?? null) })
    return () => { alive = false }
  }, [name])

  // Position tooltip above or below anchor, clamped to viewport
  useEffect(() => {
    const box = boxRef.current
    if (!box || !anchorRect) return
    const vw = window.innerWidth, vh = window.innerHeight
    const bw = box.offsetWidth, bh = box.offsetHeight
    let left = anchorRect.left + anchorRect.width / 2 - bw / 2
    let top = anchorRect.top - bh - 8
    if (top < 8) top = anchorRect.bottom + 8
    left = Math.max(8, Math.min(vw - bw - 8, left))
    top  = Math.max(8, Math.min(vh - bh - 8, top))
    box.style.left = left + 'px'
    box.style.top  = top  + 'px'
  }, [anchorRect, guitarPos])

  // Close on outside click
  useEffect(() => {
    function handler(e) { if (boxRef.current && !boxRef.current.contains(e.target)) onClose() }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  const pitchClasses = akkordZuPitchClasses(name)
  const tabBtn = (id, label) => (
    <button onClick={() => setTab(id)} style={{
      padding:'4px 12px', borderRadius:99, border:'none', cursor:'pointer', fontFamily:'inherit',
      fontSize:12, fontWeight: tab===id ? 700 : 500,
      background: tab===id ? 'var(--primary)' : 'transparent',
      color: tab===id ? 'var(--primary-fg)' : 'var(--text-3)',
    }}>{label}</button>
  )

  return createPortal(
    <div ref={boxRef} onClick={e => e.stopPropagation()} style={{
      position:'fixed', zIndex:3000, background:'var(--surface)',
      border:'1.5px solid var(--border)', borderRadius:'var(--radius-lg)',
      boxShadow:'var(--shadow-lg)', padding:'12px', minWidth:140,
      display:'flex', flexDirection:'column', gap:8,
    }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', gap:8 }}>
        <span style={{ fontWeight:800, fontSize:14, color:'var(--primary)' }}>{name}</span>
        <button onClick={onClose} style={{ background:'none', border:'none', fontSize:14, cursor:'pointer', color:'var(--text-3)', padding:0, lineHeight:1 }}>✕</button>
      </div>

      <div style={{ display:'flex', gap:4, background:'var(--bg-2)', borderRadius:99, padding:3 }}>
        {tabBtn('guitar','🎸 Gitarre')}
        {tabBtn('piano','🎹 Piano')}
      </div>

      {tab === 'guitar' && (
        <div style={{ display:'flex', justifyContent:'center' }}>
          {guitarPos === undefined
            ? <div style={{ fontSize:12, color:'var(--text-3)', padding:'12px 0' }}>…</div>
            : <GuitarSVG position={guitarPos} />
          }
        </div>
      )}

      {tab === 'piano' && (
        <div>
          <PianoSVG pitchClasses={pitchClasses} />
          {pitchClasses.length > 0 && (
            <div style={{ fontSize:11, color:'var(--text-3)', textAlign:'center', marginTop:4 }}>
              {pitchClasses.join(' · ')}
            </div>
          )}
        </div>
      )}
    </div>,
    document.body
  )
}
