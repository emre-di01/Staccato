import { useState, useEffect, useRef } from 'react'

/**
 * Parse a stored address string ("Straße, PLZ Ort, Land") back into sub-fields.
 * Only called ONCE on mount — not on every value change.
 */
function parse(combined) {
  if (!combined?.trim()) return { strasse: '', plz: '', ort: '', land: 'Deutschland' }
  const parts = combined.split(',').map(s => s.trim()).filter(Boolean)

  if (parts.length >= 3) {
    const plzOrt = parts[1]
    const m = plzOrt.match(/^(\d{3,10})\s+(.+)$/)
    return {
      strasse: parts[0],
      plz:     m ? m[1] : '',
      ort:     m ? m[2] : plzOrt,
      land:    parts.slice(2).join(', ') || 'Deutschland',
    }
  }
  if (parts.length === 2) {
    // "PLZ Ort, Land" or "Straße, Ort"
    const m = parts[0].match(/^(\d{3,10})\s+(.+)$/)
    if (m) return { strasse: '', plz: m[1], ort: m[2], land: parts[1] }
    return { strasse: parts[0], plz: '', ort: parts[1], land: 'Deutschland' }
  }
  return { strasse: parts[0] ?? combined, plz: '', ort: '', land: 'Deutschland' }
}

function combine(f) {
  const plzOrt = [f.plz, f.ort].filter(Boolean).join(' ')
  // Only attach land when there's something else worth storing
  const main = [f.strasse, plzOrt].filter(Boolean)
  if (main.length === 0) return ''
  return [...main, f.land].filter(Boolean).join(', ')
}

export default function OrtAutocomplete({ value, onChange, inputStyle = {}, showMap = false }) {
  // Initialize sub-fields from value ONCE — never re-parse on subsequent value changes
  // (re-parsing would corrupt fields while the user is typing)
  const [felder, setFelder]           = useState(() => parse(value ?? ''))
  const [suggestions, setSuggestions] = useState([])
  const [offen, setOffen]             = useState(false)
  const [laden, setLaden]             = useState(false)
  const [hovered, setHovered]         = useState(-1)
  const [coords, setCoords]           = useState(null)
  const timerRef = useRef(null)
  const wrapRef  = useRef(null)

  // Only re-sync when the parent loads fresh data into an already-mounted component
  // (e.g., profil loads async after mount). Guard against our own onChange calls.
  const lastEmitted = useRef(combine(felder))
  useEffect(() => {
    if (value !== lastEmitted.current) {
      setFelder(parse(value ?? ''))
    }
  }, [value]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    function handle(e) {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) setOffen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function update(key, val) {
    const next = { ...felder, [key]: val }
    setFelder(next)
    const combined = combine(next)
    lastEmitted.current = combined
    onChange(combined)
    suche(next)
  }

  function suche(f) {
    clearTimeout(timerRef.current)
    const q = combine(f)
    if (q.replace(/,\s*/g, '').length < 3) { setSuggestions([]); setOffen(false); return }
    timerRef.current = setTimeout(async () => {
      setLaden(true)
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=5&addressdetails=1&accept-language=de`,
          { headers: { 'Accept-Language': 'de' } }
        )
        const data = await res.json()
        setSuggestions(data)
        setOffen(data.length > 0)
        setHovered(-1)
      } catch { /* network error — fail silently */ }
      finally { setLaden(false) }
    }, 400)
  }

  function waehlen(item) {
    const a = item.address ?? {}
    const next = {
      strasse: [a.road, a.house_number].filter(Boolean).join(' ') || felder.strasse,
      plz:     a.postcode                                         ?? felder.plz,
      ort:     a.city ?? a.town ?? a.village ?? a.municipality    ?? felder.ort,
      land:    a.country                                          ?? felder.land,
    }
    setFelder(next)
    const combined = combine(next)
    lastEmitted.current = combined
    onChange(combined)
    setSuggestions([])
    setOffen(false)
    if (showMap && item.lat && item.lon) setCoords({ lat: parseFloat(item.lat), lon: parseFloat(item.lon) })
  }

  function handleKeyDown(e) {
    if (!offen || !suggestions.length) return
    if (e.key === 'ArrowDown') { e.preventDefault(); setHovered(h => Math.min(h + 1, suggestions.length - 1)) }
    if (e.key === 'ArrowUp')   { e.preventDefault(); setHovered(h => Math.max(h - 1, 0)) }
    if (e.key === 'Enter' && hovered >= 0) { e.preventDefault(); waehlen(suggestions[hovered]) }
    if (e.key === 'Escape') setOffen(false)
  }

  const base = {
    padding: '9px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)',
    fontSize: 14, fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)',
    boxSizing: 'border-box',
    ...inputStyle,
  }

  return (
    <div ref={wrapRef} style={{ position: 'relative', width: '100%' }}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <input
          value={felder.strasse}
          onChange={e => update('strasse', e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Straße & Hausnummer"
          autoComplete="off"
          style={{ ...base, width: '100%' }}
        />
        <div style={{ display: 'flex', gap: 6 }}>
          <input
            value={felder.plz}
            onChange={e => update('plz', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="PLZ"
            autoComplete="off"
            maxLength={10}
            style={{ ...base, width: 90, flexShrink: 0 }}
          />
          <input
            value={felder.ort}
            onChange={e => update('ort', e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ort"
            autoComplete="off"
            style={{ ...base, flex: 1, width: 'auto', minWidth: 0 }}
          />
        </div>
        <input
          value={felder.land}
          onChange={e => update('land', e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Land"
          autoComplete="off"
          style={{ ...base, width: '100%' }}
        />
      </div>

      {laden && (
        <div style={{ marginTop: 4, fontSize: 11, color: 'var(--text-3)' }}>Suche …</div>
      )}

      {offen && suggestions.length > 0 && (
        <div style={{
          position: 'absolute', zIndex: 1000, top: 'calc(100% + 4px)', left: 0, right: 0,
          background: 'var(--surface)', border: '1px solid var(--border)',
          borderRadius: 'var(--radius)', boxShadow: 'var(--shadow-lg)',
          maxHeight: 240, overflowY: 'auto',
        }}>
          {suggestions.map((s, i) => {
            const a       = s.address ?? {}
            const strasse = [a.road, a.house_number].filter(Boolean).join(' ')
            const plzOrt  = [a.postcode, a.city ?? a.town ?? a.village ?? a.municipality].filter(Boolean).join(' ')
            const land    = a.country ?? ''
            return (
              <div
                key={s.place_id}
                onMouseDown={() => waehlen(s)}
                onMouseEnter={() => setHovered(i)}
                style={{
                  padding: '9px 12px', cursor: 'pointer', fontSize: 13,
                  background: hovered === i ? 'var(--bg-2)' : 'transparent',
                  borderBottom: i < suggestions.length - 1 ? '1px solid var(--border)' : 'none',
                  display: 'flex', alignItems: 'flex-start', gap: 8,
                  transition: 'background 0.1s',
                }}
              >
                <span style={{ flexShrink: 0, marginTop: 1 }}>📍</span>
                <div>
                  <div style={{ color: 'var(--text)', fontWeight: 500, lineHeight: 1.3 }}>
                    {strasse || s.display_name.split(',')[0]}
                  </div>
                  {(plzOrt || land) && (
                    <div style={{ color: 'var(--text-3)', fontSize: 11, marginTop: 2 }}>
                      {[plzOrt, land].filter(Boolean).join(', ')}
                    </div>
                  )}
                </div>
              </div>
            )
          })}
          <div style={{ padding: '5px 12px', fontSize: 10, color: 'var(--text-3)', borderTop: '1px solid var(--border)', textAlign: 'right' }}>
            © OpenStreetMap contributors
          </div>
        </div>
      )}

      {showMap && coords && (
        <div style={{ marginTop: 10, borderRadius: 'var(--radius)', overflow: 'hidden', border: '1px solid var(--border)' }}>
          <iframe
            title="Kartenvorschau"
            width="100%"
            height="200"
            frameBorder="0"
            scrolling="no"
            loading="lazy"
            src={`https://www.openstreetmap.org/export/embed.html?bbox=${coords.lon - 0.006},${coords.lat - 0.004},${coords.lon + 0.006},${coords.lat + 0.004}&layer=mapnik&marker=${coords.lat},${coords.lon}`}
            style={{ display: 'block' }}
          />
          <div style={{ padding: '4px 8px', fontSize: 10, color: 'var(--text-3)', background: 'var(--bg-2)', textAlign: 'right' }}>
            © <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" style={{ color: 'var(--text-3)' }}>OpenStreetMap</a>
          </div>
        </div>
      )}
    </div>
  )
}
