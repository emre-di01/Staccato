import { useState } from 'react'
import ChordDiagramTooltip from '../ChordDiagramTooltip'

export default function ChordPro({ text }) {
  const [tooltip, setTooltip] = useState(null) // { name, rect }

  if (!text) return null

  function handleChordClick(name, e) {
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    setTooltip(prev => prev?.name === name ? null : { name, rect })
  }

  return (
    <div style={{ fontFamily:'monospace', fontSize:14, lineHeight:2, color:'var(--text)' }}
      onClick={() => setTooltip(null)}>
      {text.split('\n').map((zeile, i) => {
        const teile = zeile.split(/(\[[^\]]+\])/)
        return (
          <div key={i} style={{ minHeight:'1.5em' }}>
            {teile.map((t, j) =>
              t.startsWith('[') && t.endsWith(']')
                ? <button key={j} onClick={e => handleChordClick(t.slice(1,-1), e)}
                    style={{ color:'var(--accent)', marginRight:2, fontSize:12, fontWeight:800,
                      background: tooltip?.name === t.slice(1,-1) ? 'color-mix(in srgb, var(--accent) 15%, transparent)' : 'none',
                      border:'none', cursor:'pointer', fontFamily:'monospace', padding:'0 2px',
                      borderRadius:4, textDecoration:'underline dotted' }}>
                    {t.slice(1,-1)}
                  </button>
                : <span key={j}>{t}</span>
            )}
          </div>
        )
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
