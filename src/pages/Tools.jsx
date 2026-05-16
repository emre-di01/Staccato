import { useState, useEffect, useRef, useCallback } from 'react'
import { useApp } from '../context/AppContext'

const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']
const BEVORZUGE_B = new Set([1,3,6,8,10])

function noteIdx(n) {
  const i = SHARP.indexOf(n); return i >= 0 ? i : FLAT.indexOf(n)
}
function transponiereAkkord(root, quality, ht) {
  const i = noteIdx(root); if (i < 0) return root + quality
  const ni = (i + ht + 12) % 12
  return (BEVORZUGE_B.has(ni) ? FLAT[ni] : SHARP[ni]) + quality
}

const KAPO_AKKORDE = [
  ['C',''],['D',''],['E',''],['F',''],['G',''],['A',''],['B',''],
  ['A','m'],['D','m'],['E','m'],['B','m'],['G','7'],['D','7'],['A','7'],
]

// ── Autocorrelation pitch detection ─────────────────────────────
function autoCorrelate(buf, sampleRate) {
  const SIZE = buf.length, MAX = Math.floor(SIZE / 2)
  let rms = 0
  for (let i = 0; i < SIZE; i++) rms += buf[i] * buf[i]
  rms = Math.sqrt(rms / SIZE)
  if (rms < 0.015) return -1

  const corr = new Array(MAX)
  let bestOff = -1, bestCorr = 0, lastCorr = 1, found = false
  for (let off = 0; off < MAX; off++) {
    let c = 0
    for (let i = 0; i < MAX; i++) c += Math.abs(buf[i] - buf[i + off])
    c = 1 - c / MAX
    corr[off] = c
    if (c > 0.9 && c > lastCorr) {
      found = true
      if (c > bestCorr) { bestCorr = c; bestOff = off }
    } else if (found) {
      const shift = (corr[bestOff + 1] - corr[bestOff - 1]) / corr[bestOff]
      return sampleRate / (bestOff + 8 * shift)
    }
    lastCorr = c
  }
  if (bestCorr > 0.01) return sampleRate / bestOff
  return -1
}
function freqToMidi(f) { return Math.round(12 * Math.log2(f / 440) + 69) }
function midiToNote(m) { return SHARP[((m % 12) + 12) % 12] }
function midiToOktave(m) { return Math.floor(m / 12) - 1 }
function getCents(f, m) {
  return Math.round(1200 * Math.log2(f / (440 * Math.pow(2, (m - 69) / 12))))
}

// ── Kapo Tab ─────────────────────────────────────────────────────
function KapoTab() {
  const { T } = useApp()
  const [kapo, setKapo] = useState(0)

  return (
    <div>
      <p style={{ color: 'var(--text-2)', fontSize: 13, marginBottom: 20 }}>
        {T('tools_kapo_desc')}
      </p>

      {/* Kapo-Position Buttons */}
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 24 }}>
        {Array.from({ length: 8 }, (_, i) => (
          <button key={i} onClick={() => setKapo(i)} style={{
            width: 48, height: 48, borderRadius: 'var(--radius)',
            border: kapo === i ? '2px solid var(--primary)' : '1px solid var(--border)',
            background: kapo === i ? 'var(--primary)' : 'var(--surface)',
            color: kapo === i ? '#fff' : 'var(--text)',
            fontWeight: kapo === i ? 700 : 400,
            cursor: 'pointer', fontSize: 15, fontFamily: 'inherit',
          }}>
            {i === 0 ? '–' : i}
          </button>
        ))}
      </div>

      {kapo === 0 ? (
        <div style={{ textAlign: 'center', padding: '32px 0', color: 'var(--text-3)', fontSize: 14 }}>
          {T('tools_kapo_none')}
        </div>
      ) : (
        <>
          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: '10px 16px',
            marginBottom: 20, fontSize: 14, color: 'var(--text-2)',
          }}>
            Kapo am <strong style={{ color: 'var(--text)' }}>{kapo}. {T('tools_kapo_bund')}</strong>
            {' '}= alles klingt <strong style={{ color: 'var(--primary)' }}>+{kapo} {T('tools_kapo_halbtöne')}</strong> höher
          </div>

          <div style={{
            background: 'var(--surface)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', overflow: 'hidden',
          }}>
            <div style={{
              display: 'grid', gridTemplateColumns: '1fr 1fr',
              borderBottom: '1px solid var(--border)',
              padding: '8px 16px',
            }}>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>{T('tools_kapo_greifst')}</span>
              <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1 }}>{T('tools_kapo_klingt')}</span>
            </div>
            {KAPO_AKKORDE.map(([root, q], idx) => {
              const klingt = transponiereAkkord(root, q, kapo)
              return (
                <div key={idx} style={{
                  display: 'grid', gridTemplateColumns: '1fr 1fr',
                  padding: '10px 16px',
                  borderBottom: idx < KAPO_AKKORDE.length - 1 ? '1px solid var(--border)' : 'none',
                  background: idx % 2 === 0 ? 'transparent' : 'var(--bg)',
                }}>
                  <span style={{ fontWeight: 600, fontSize: 16 }}>{root}{q}</span>
                  <span style={{ fontWeight: 700, fontSize: 16, color: 'var(--primary)' }}>{klingt}</span>
                </div>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}

// ── Tuner Tab ─────────────────────────────────────────────────────
function TunerTab() {
  const { toast, T } = useApp()
  const [aktiv, setAktiv] = useState(false)
  const [note, setNote] = useState(null) // { name, oktave, cents, freq }
  const streamRef = useRef(null)
  const ctxRef    = useRef(null)
  const analyserRef = useRef(null)
  const bufRef    = useRef(null)
  const rafRef    = useRef(null)

  const tick = useCallback(() => {
    if (!analyserRef.current || !ctxRef.current) return
    analyserRef.current.getFloatTimeDomainData(bufRef.current)
    const freq = autoCorrelate(bufRef.current, ctxRef.current.sampleRate)
    if (freq > 60 && freq < 1500) {
      const midi = freqToMidi(freq)
      setNote({ name: midiToNote(midi), oktave: midiToOktave(midi), cents: getCents(freq, midi), freq })
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [])

  const start = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false })
      streamRef.current = stream
      const ctx = new (window.AudioContext || window.webkitAudioContext)()
      ctxRef.current = ctx
      const analyser = ctx.createAnalyser()
      analyser.fftSize = 2048
      analyserRef.current = analyser
      bufRef.current = new Float32Array(analyser.fftSize)
      ctx.createMediaStreamSource(stream).connect(analyser)
      setAktiv(true)
      rafRef.current = requestAnimationFrame(tick)
    } catch {
      toast(T('tools_tuner_denied'), 'error')
    }
  }

  const stop = useCallback(() => {
    cancelAnimationFrame(rafRef.current)
    streamRef.current?.getTracks().forEach(t => t.stop())
    ctxRef.current?.close()
    streamRef.current = null; ctxRef.current = null; analyserRef.current = null
    setAktiv(false); setNote(null)
  }, [])

  useEffect(() => () => stop(), [stop])

  const cents = note?.cents ?? 0
  const absCents = Math.abs(cents)
  const inTune = absCents <= 10
  const nahezu = absCents <= 25
  const tunerColor = !note ? 'var(--border)' : inTune ? 'var(--success)' : nahezu ? '#f59e0b' : 'var(--danger)'

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingTop: 8 }}>
      {/* Note circle */}
      <div style={{
        width: 140, height: 140, borderRadius: '50%',
        border: `4px solid ${tunerColor}`,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        transition: 'border-color 0.15s',
        background: 'var(--surface)',
      }}>
        {note ? (
          <>
            <span style={{ fontSize: 52, fontWeight: 800, lineHeight: 1, color: tunerColor, transition: 'color 0.15s' }}>{note.name}</span>
            <span style={{ fontSize: 13, color: 'var(--text-3)', marginTop: 2 }}>{note.oktave}</span>
          </>
        ) : (
          <span style={{ fontSize: 32, color: 'var(--text-3)' }}>🎵</span>
        )}
      </div>

      {/* Cents meter */}
      <div style={{ width: '100%', maxWidth: 300 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11, color: 'var(--text-3)', marginBottom: 6 }}>
          <span>{T('tools_tuner_low')}</span>
          <span style={{ fontWeight: 700, color: note ? tunerColor : 'var(--text-3)', transition: 'color 0.15s' }}>
            {note ? `${cents > 0 ? '+' : ''}${cents} ¢` : '– ¢'}
          </span>
          <span>{T('tools_tuner_high')}</span>
        </div>
        <div style={{ height: 8, background: 'var(--border)', borderRadius: 4, position: 'relative', overflow: 'hidden' }}>
          {/* center line */}
          <div style={{ position: 'absolute', left: '50%', top: 0, bottom: 0, width: 2, background: 'var(--text-3)', transform: 'translateX(-50%)' }} />
          {/* needle */}
          {note && (
            <div style={{
              position: 'absolute', top: 0, bottom: 0, width: 4, borderRadius: 2,
              background: tunerColor,
              left: `calc(50% + ${Math.max(-46, Math.min(46, cents * 0.92))}%)`,
              transform: 'translateX(-50%)',
              transition: 'left 0.1s, background 0.15s',
            }} />
          )}
        </div>
        {note && (
          <div style={{ textAlign: 'center', fontSize: 11, color: 'var(--text-3)', marginTop: 6 }}>
            {note.freq.toFixed(1)} Hz
          </div>
        )}
      </div>

      <button onClick={aktiv ? stop : start} style={{
        padding: '12px 32px', borderRadius: 'var(--radius)',
        background: aktiv ? 'var(--danger)' : 'var(--primary)',
        color: '#fff', border: 'none', cursor: 'pointer',
        fontWeight: 700, fontSize: 15, fontFamily: 'inherit',
      }}>
        {aktiv ? `⏹ ${T('tools_tuner_stop')}` : `🎤 ${T('tools_tuner_start')}`}
      </button>

      {aktiv && inTune && note && (
        <div style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{T('tools_tuner_intune')}</div>
      )}
    </div>
  )
}

// ── BPM Tab ───────────────────────────────────────────────────────
function BpmTab() {
  const { T } = useApp()
  const [bpm, setBpm] = useState(null)
  const [taps, setTaps] = useState(0)
  const tapTimesRef = useRef([])
  const resetRef = useRef(null)

  const tap = useCallback(() => {
    const now = Date.now()
    const times = tapTimesRef.current

    if (times.length > 0 && now - times[times.length - 1] > 3000) {
      tapTimesRef.current = []
    }
    tapTimesRef.current.push(now)
    if (tapTimesRef.current.length > 8) tapTimesRef.current.shift()

    const n = tapTimesRef.current.length
    setTaps(n)

    if (n >= 2) {
      const intervals = []
      for (let i = 1; i < n; i++) intervals.push(tapTimesRef.current[i] - tapTimesRef.current[i - 1])
      const avg = intervals.reduce((a, b) => a + b) / intervals.length
      setBpm(Math.round(60000 / avg))
    }

    clearTimeout(resetRef.current)
  }, [])

  const reset = () => {
    tapTimesRef.current = []
    setBpm(null)
    setTaps(0)
    clearTimeout(resetRef.current)
  }

  // Spacebar support
  useEffect(() => {
    const handler = (e) => { if (e.code === 'Space' && e.target === document.body) { e.preventDefault(); tap() } }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [tap])

  const bpmLabel = bpm
    ? bpm < 60 ? 'Largo' : bpm < 80 ? 'Adagio' : bpm < 108 ? 'Andante'
      : bpm < 120 ? 'Moderato' : bpm < 156 ? 'Allegro' : 'Presto'
    : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 24, paddingTop: 8 }}>
      {/* BPM display */}
      <div style={{
        background: 'var(--surface)', border: '1px solid var(--border)',
        borderRadius: 'var(--radius-lg)', padding: '20px 48px', textAlign: 'center', minWidth: 180,
      }}>
        <div style={{ fontSize: 64, fontWeight: 800, lineHeight: 1, color: bpm ? 'var(--primary)' : 'var(--text-3)' }}>
          {bpm ?? '–'}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 4 }}>BPM</div>
        {bpmLabel && <div style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-2)', marginTop: 6 }}>{bpmLabel}</div>}
      </div>

      {/* Tap button */}
      <button
        onClick={tap}
        style={{
          width: 160, height: 160, borderRadius: '50%',
          background: 'var(--primary)', color: '#fff',
          border: 'none', cursor: 'pointer', fontFamily: 'inherit',
          fontSize: 18, fontWeight: 700,
          boxShadow: 'var(--shadow-lg)',
          userSelect: 'none', WebkitUserSelect: 'none',
          WebkitTapHighlightColor: 'transparent',
          transition: 'transform 0.07s, opacity 0.07s',
          active: { transform: 'scale(0.93)' },
        }}
        onPointerDown={e => e.currentTarget.style.transform = 'scale(0.93)'}
        onPointerUp={e => e.currentTarget.style.transform = 'scale(1)'}
        onPointerLeave={e => e.currentTarget.style.transform = 'scale(1)'}
      >
        {T('tools_bpm_tap')}
      </button>

      <div style={{ fontSize: 12, color: 'var(--text-3)' }}>
        {taps < 2 ? T('tools_bpm_hint') : `${taps} ${T('tools_bpm_taps')}`}
      </div>

      {taps > 0 && (
        <button onClick={reset} style={{
          padding: '8px 20px', borderRadius: 'var(--radius)',
          background: 'none', border: '1px solid var(--border)',
          color: 'var(--text-2)', cursor: 'pointer', fontFamily: 'inherit', fontSize: 13,
        }}>
          {T('tools_bpm_reset')}
        </button>
      )}
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────
export default function Tools() {
  const { T } = useApp()
  const [tab, setTab] = useState('kapo')

  return (
    <div style={{ padding: '20px 16px', maxWidth: 600, margin: '0 auto' }}>
      <h2 style={{ margin: '0 0 20px', fontSize: 20 }}>🔧 {T('tools_title')}</h2>

      {/* Tab bar */}
      <div style={{ display: 'flex', borderBottom: '2px solid var(--border)', marginBottom: 28 }}>
        {[['kapo','🎸',T('tools_kapo')],['tuner','🎵',T('tools_tuner')],['bpm','🥁',T('tools_bpm')]].map(([key, icon, label]) => (
          <button key={key} onClick={() => setTab(key)} style={{
            flex: 1, padding: '10px 4px', background: 'none', border: 'none',
            cursor: 'pointer', fontFamily: 'inherit',
            borderBottom: `2px solid ${tab === key ? 'var(--primary)' : 'transparent'}`,
            marginBottom: -2,
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3,
          }}>
            <span style={{ fontSize: 20 }}>{icon}</span>
            <span style={{ fontSize: 11, fontWeight: tab === key ? 700 : 400, color: tab === key ? 'var(--text)' : 'var(--text-3)' }}>{label}</span>
          </button>
        ))}
      </div>

      {tab === 'kapo'  && <KapoTab />}
      {tab === 'tuner' && <TunerTab />}
      {tab === 'bpm'   && <BpmTab />}
    </div>
  )
}
