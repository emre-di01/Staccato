// YouTube/Spotify erst nach einem Klick laden: vorher erfährt der Anbieter nichts
import { useState } from 'react'
import { useApp } from '../context/AppContext'

const ADRESSE = {
  YouTube: id => `https://www.youtube-nocookie.com/embed/${encodeURIComponent(id)}?autoplay=1`,
  Spotify: id => `https://open.spotify.com/embed/track/${encodeURIComponent(id)}?utm_source=generator`,
}

export default function ExternesMedium({ anbieter = 'YouTube', id, titel }) {
  const { T } = useApp()
  const [geladen, setGeladen] = useState(null)   // ID, für die zugestimmt wurde
  const video = anbieter === 'YouTube'
  const rahmen = { width: '100%', border: 'none', borderRadius: 16, display: 'block', ...(video ? { aspectRatio: '16 / 9' } : { height: 152 }) }
  if (!id) return null
  if (geladen === id) return <iframe src={ADRESSE[anbieter](id)} title={titel ?? anbieter} allow="autoplay; encrypted-media; fullscreen; picture-in-picture" allowFullScreen style={rahmen} />
  return (
    <div style={{ ...rahmen, boxSizing: 'border-box', aspectRatio: undefined, height: 'auto', minHeight: 152, padding: 20, background: '#1C1C1E', color: '#FFFFFF', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14, textAlign: 'center' }}>
      <div style={{ fontSize: 15, lineHeight: 1.45, maxWidth: 420 }}>{T('medium_hinweis').replaceAll('{anbieter}', anbieter)}</div>
      <button type="button" onClick={() => setGeladen(id)} style={{ minHeight: 48, padding: '0 22px', borderRadius: 24, border: 'none', background: '#FFFFFF', color: '#1C1C1E', fontFamily: 'inherit', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
        {T('medium_laden').replaceAll('{anbieter}', anbieter)}
      </button>
    </div>
  )
}
