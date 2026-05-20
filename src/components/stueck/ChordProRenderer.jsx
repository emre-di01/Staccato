import { useState } from 'react'
import ChordDiagramTooltip from '../ChordDiagramTooltip'

// Parst eine ChordPro-Direktive: {name: value} oder {name}
function parseDirective(line) {
  const m = line.match(/^\{([^:}]+)(?::([^}]*))?\}$/)
  if (!m) return null
  return { name: m[1].trim().toLowerCase(), value: (m[2] || '').trim() }
}

// Rendert eine Zeile mit [Akkord]Text inline
function ChordLine({ text, onChordClick, activeChord }) {
  const parts = text.split(/(\[[^\]]+\])/)
  const hasChords = parts.some(p => p.startsWith('[') && p.endsWith(']'))
  const onlyChords = hasChords && parts.every(p => (p.startsWith('[') && p.endsWith(']')) || p.trim() === '')

  return (
    <div style={{ minHeight: '1.4em', lineHeight: '1.6', marginBottom: onlyChords ? 0 : 2 }}>
      {parts.map((p, i) =>
        p.startsWith('[') && p.endsWith(']')
          ? <button key={i} onClick={e => onChordClick(p.slice(1, -1), e)}
              style={{
                color: 'var(--accent)', fontWeight: 800, fontSize: 13,
                background: activeChord === p.slice(1, -1) ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'none',
                border: 'none', cursor: 'pointer', fontFamily: 'monospace',
                padding: '0 2px', borderRadius: 4, textDecoration: 'underline dotted',
                marginRight: 1,
              }}>
              {p.slice(1, -1)}
            </button>
          : <span key={i}>{p}</span>
      )}
    </div>
  )
}

export default function ChordPro({ text }) {
  const [tooltip, setTooltip] = useState(null)

  if (!text) return null

  function handleChordClick(name, e) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip(prev => prev?.name === name ? null : { name, rect })
  }

  // Bekannte Metadaten-Direktiven (werden oben als Header angezeigt)
  const metaKeys = ['title', 't', 'artist', 'a', 'subtitle', 'st', 'key', 'capo', 'tempo', 'time']
  // Bekannte Section-Start-Direktiven
  const sectionStart = {
    'start_of_chorus': 'Refrain', 'soc': 'Refrain',
    'start_of_verse': 'Strophe', 'sov': 'Strophe',
    'start_of_bridge': 'Bridge', 'sob': 'Bridge',
    'start_of_tab': 'Tab', 'sot': 'Tab',
    'start_of_grid': 'Grid', 'sog': 'Grid',
  }
  const sectionEnd = ['end_of_chorus','eoc','end_of_verse','eov','end_of_bridge','eob','end_of_tab','eot','end_of_grid','eog']

  const lines = text.split('\n')

  // Metadaten sammeln
  const meta = {}
  lines.forEach(l => {
    const d = parseDirective(l.trim())
    if (d && metaKeys.includes(d.name) && d.value) {
      if (d.name === 't') meta.title = d.value
      else if (d.name === 'a') meta.artist = d.value
      else if (d.name === 'st') meta.subtitle = d.value
      else meta[d.name] = d.value
    }
  })

  // Zeilen in Blöcke aufteilen
  const blocks = []
  let currentSection = null
  let sectionLines = []

  function flushSection() {
    if (sectionLines.length > 0) {
      blocks.push({ type: 'section', label: currentSection, lines: [...sectionLines] })
      sectionLines = []
    }
    currentSection = null
  }

  for (const raw of lines) {
    const line = raw // preserve whitespace in lyrics
    const trimmed = line.trim()

    // Leerzeilen
    if (!trimmed) {
      if (currentSection !== null) {
        sectionLines.push({ type: 'empty' })
      } else {
        blocks.push({ type: 'empty' })
      }
      continue
    }

    // # Kommentare ausblenden
    if (trimmed.startsWith('#')) continue

    // Direktive?
    const d = parseDirective(trimmed)
    if (d) {
      // Metadaten überspringen (werden im Header gezeigt)
      if (metaKeys.includes(d.name)) continue

      // Section-Start
      if (sectionStart[d.name] !== undefined) {
        flushSection()
        currentSection = sectionStart[d.name]
        continue
      }

      // Section-End
      if (sectionEnd.includes(d.name)) {
        flushSection()
        continue
      }

      // comment / c → Abschnittsbezeichnung
      if (d.name === 'comment' || d.name === 'c' || d.name === 'comment_italic' || d.name === 'ci') {
        flushSection()
        blocks.push({ type: 'comment', text: d.value })
        continue
      }

      // Alle anderen Direktiven ausblenden
      continue
    }

    // Normale Liedzeile
    const lineObj = { type: 'line', text: line }
    if (currentSection !== null) {
      sectionLines.push(lineObj)
    } else {
      blocks.push(lineObj)
    }
  }
  flushSection()

  const sectionStyle = (label) => {
    const isChorus = label === 'Refrain'
    return {
      background: isChorus
        ? 'color-mix(in srgb, var(--accent) 8%, transparent)'
        : 'color-mix(in srgb, var(--text) 4%, transparent)',
      border: `1.5px solid ${isChorus ? 'color-mix(in srgb, var(--accent) 30%, transparent)' : 'var(--border)'}`,
      borderRadius: 'var(--radius)',
      padding: '10px 14px',
      marginBottom: 14,
    }
  }

  return (
    <div style={{ fontFamily: 'monospace', fontSize: 14, lineHeight: 1.8, color: 'var(--text)' }}
      onClick={() => setTooltip(null)}>

      {/* Metadaten-Header */}
      {(meta.title || meta.artist || meta.key || meta.capo || meta.tempo) && (
        <div style={{ marginBottom: 16, paddingBottom: 12, borderBottom: '1px solid var(--border)' }}>
          {meta.title && <div style={{ fontSize: 16, fontWeight: 800, color: 'var(--text)' }}>{meta.title}</div>}
          {meta.artist && <div style={{ fontSize: 13, color: 'var(--text-2)', marginTop: 2 }}>{meta.artist}</div>}
          {meta.subtitle && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{meta.subtitle}</div>}
          <div style={{ display: 'flex', gap: 12, marginTop: 6, flexWrap: 'wrap' }}>
            {meta.key && <span style={{ fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', color: 'var(--text-2)', fontFamily: 'sans-serif' }}>🎵 {meta.key}</span>}
            {meta.capo && <span style={{ fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', color: 'var(--text-2)', fontFamily: 'sans-serif' }}>Capo {meta.capo}</span>}
            {meta.tempo && <span style={{ fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', color: 'var(--text-2)', fontFamily: 'sans-serif' }}>♩ {meta.tempo}</span>}
            {meta.time && <span style={{ fontSize: 11, background: 'var(--bg)', border: '1px solid var(--border)', borderRadius: 4, padding: '2px 7px', color: 'var(--text-2)', fontFamily: 'sans-serif' }}>{meta.time}</span>}
          </div>
        </div>
      )}

      {/* Blöcke */}
      {blocks.map((block, bi) => {
        if (block.type === 'empty') return <div key={bi} style={{ height: 10 }} />

        if (block.type === 'comment') return (
          <div key={bi} style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-2)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, marginTop: 10, fontFamily: 'sans-serif' }}>
            {block.text}
          </div>
        )

        if (block.type === 'line') return (
          <ChordLine key={bi} text={block.text}
            onChordClick={handleChordClick}
            activeChord={tooltip?.name} />
        )

        if (block.type === 'section') return (
          <div key={bi} style={sectionStyle(block.label)}>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: 1, marginBottom: 6, fontFamily: 'sans-serif' }}>
              {block.label}
            </div>
            {block.lines.map((l, li) =>
              l.type === 'empty'
                ? <div key={li} style={{ height: 8 }} />
                : <ChordLine key={li} text={l.text}
                    onChordClick={handleChordClick}
                    activeChord={tooltip?.name} />
            )}
          </div>
        )

        return null
      })}

      {tooltip && (
        <ChordDiagramTooltip
          name={tooltip.name}
          anchorRect={tooltip.rect}
          onClose={() => setTooltip(null)}
        />
      )}
    </div>
  )
}
