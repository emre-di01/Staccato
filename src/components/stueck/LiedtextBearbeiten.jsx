import { useState, lazy, Suspense } from 'react'
import { useIsMobile } from '../../hooks/useWindowWidth'
import { useApp } from '../../context/AppContext'
import { safeMarkdown } from '../../lib/markdown'
import { s } from './stueckStyles'
import ChordPro from './ChordProRenderer'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const HEADERS = {
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
}

const AudioTranskribierenModal = lazy(() => import('../AudioTranskribierenModal'))
const FotoOCRModal             = lazy(() => import('../FotoOCRModal'))

const MD_CHEATSHEET_KEYS = [
  { syntax: '## Refrain',    descKey: 'md_section' },
  { syntax: '### Strophe 1', descKey: 'md_subsection' },
  { syntax: '**fett**',      descKey: 'md_bold' },
  { syntax: '*kursiv*',      descKey: 'md_italic' },
  { syntax: '---',           descKey: 'md_separator' },
  { syntax: '> Text',        descKey: 'md_indent' },
  { syntax: 'Leerzeile',     descKey: 'md_paragraph' },
]

const MD_BEISPIEL = `## Strophe 1
Zeile eins des Liedtexts
Zeile zwei des Liedtexts

---

## Refrain
La la la, oh oh oh
La la la, yeah yeah`

function MarkdownTooltip({ T }) {
  const [offen, setOffen] = useState(false)
  return (
    <div style={{ position:'relative', display:'inline-block' }}>
      <button onClick={() => setOffen(o => !o)}
        style={{ width:24, height:24, borderRadius:'50%', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-3)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', lineHeight:1, flexShrink:0 }}>
        ?
      </button>
      {offen && (
        <>
          <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={() => setOffen(false)} />
          <div style={{ position:'absolute', top:'calc(100% + 8px)', left:'50%', transform:'translateX(-50%)', zIndex:200, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-lg)', padding:'16px 18px', minWidth:300, maxWidth:380 }}>
            <div style={{ fontSize:12, fontWeight:800, color:'var(--text)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>{T('md_help_title')}</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
              {MD_CHEATSHEET_KEYS.map(({ syntax, descKey }) => (
                <div key={syntax} style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                  <code style={{ fontFamily:'monospace', fontSize:12, color:'var(--accent)', background:'var(--bg-2)', padding:'2px 6px', borderRadius:4, whiteSpace:'nowrap', flexShrink:0 }}>{syntax}</code>
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>{T(descKey)}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>{T('md_example')}</div>
            <pre style={{ fontFamily:'monospace', fontSize:11, color:'var(--text-2)', background:'var(--bg-2)', borderRadius:6, padding:'8px 10px', margin:0, whiteSpace:'pre-wrap', lineHeight:1.7 }}>{MD_BEISPIEL}</pre>
          </div>
        </>
      )}
    </div>
  )
}

export default function LiedtextBearbeiten({ stueck, onSpeichern, onAbbrechen }) {
  const mob = useIsMobile()
  const { T } = useApp()
  const [text,          setText]          = useState(stueck.liedtext ?? '')
  const [akkorde,       setAkkorde]       = useState(stueck.notizen  ?? '')
  const [tab,           setTab]           = useState('text')
  const [vorschau,      setVorschau]      = useState(false)
  const [istMd,         setIstMd]         = useState(stueck.liedtext_md !== false)
  const [audioModal,    setAudioModal]    = useState(false)
  const [fotoModal,     setFotoModal]     = useState(false)
  const [importOffen,   setImportOffen]   = useState(false)
  const [lyricsLaden,   setLyricsLaden]   = useState(false)
  const [lyricsTreffer, setLyricsTreffer] = useState(null)
  const [lyricsFehler,  setLyricsFehler]  = useState('')

  function kiErgebnisUebernehmen(kiText) {
    setText(t => t ? t + '\n\n' + kiText : kiText)
  }

  async function lyricsHolen() {
    setLyricsLaden(true); setLyricsFehler(''); setLyricsTreffer(null)
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/lyrics-suche`, {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ youtube_url: stueck.youtube_music_url || stueck.youtube_url || undefined, titel: stueck.titel, komponist: stueck.komponist || undefined }),
      })
      const data = await res.json()
      if (data.error) { setLyricsFehler(data.error); return }
      setLyricsTreffer(data)
    } catch {
      setLyricsFehler(T('conn_error'))
    } finally {
      setLyricsLaden(false)
    }
  }

  function lyricsUebernehmen() {
    kiErgebnisUebernehmen(lyricsTreffer.lyrics)
    setLyricsTreffer(null)
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', alignItems:'center', borderBottom:'2px solid var(--border)', marginBottom:4, flexWrap:'wrap' }}>
        <div style={{ display:'flex', gap:4, flex:1 }}>
          {[['text','📝 Liedtext'],['akkorde','🎸 Akkorde (ChordPro)']].map(([k,l]) => (
            <button key={k} onClick={() => { setTab(k); setVorschau(false) }}
              style={{ padding:'8px 14px', background:'none', border:'none', fontSize:13, cursor:'pointer', fontFamily:'inherit', color: tab===k ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===k ? 700 : 400, borderBottom:`2px solid ${tab===k ? 'var(--primary)' : 'transparent'}`, marginBottom:-2 }}>
              {l}
            </button>
          ))}
        </div>
        {tab === 'text' && (
          <div style={{ position:'relative', display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', ...(mob ? { width:'100%', paddingBottom:8, paddingTop:4 } : {}) }}>
            <div style={{ display:'flex', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', overflow:'hidden' }}>
              <button onClick={() => setIstMd(true)}
                style={{ padding:'4px 10px', background: istMd ? 'var(--primary)' : 'var(--bg-2)', color: istMd ? 'var(--primary-fg, #fff)' : 'var(--text-3)', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>MD</button>
              <button onClick={() => setIstMd(false)}
                style={{ padding:'4px 10px', background: !istMd ? 'var(--primary)' : 'var(--bg-2)', color: !istMd ? 'var(--primary-fg, #fff)' : 'var(--text-3)', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Plain</button>
            </div>
            <button onClick={() => setVorschau(v => !v)}
              style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background: vorschau ? 'var(--primary)' : 'var(--bg-2)', color: vorschau ? 'var(--primary-fg, #fff)' : 'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              {vorschau ? '✏️' : '👁'}{mob ? '' : (' ' + (vorschau ? T('piece_edit') : T('piece_preview')))}
            </button>
            {istMd && <MarkdownTooltip T={T} />}
            {!vorschau && (
              <button onClick={() => setImportOffen(o => !o)} disabled={lyricsLaden}
                style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background: importOffen ? 'var(--primary)' : 'var(--bg-2)', color: importOffen ? 'var(--primary-fg, #fff)' : 'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', display:'flex', alignItems:'center', gap:4, opacity: lyricsLaden ? 0.6 : 1 }}>
                {lyricsLaden ? T('import_loading') : T('import_btn')}
              </button>
            )}
            {importOffen && (
              <>
                <div style={{ position:'fixed', inset:0, zIndex:199 }} onClick={() => setImportOffen(false)} />
                <div style={{ position:'absolute', top:'calc(100% + 4px)', right:0, zIndex:200, background:'var(--surface)', border:'1px solid var(--border)', borderRadius:'var(--radius-lg)', boxShadow:'var(--shadow-lg)', minWidth:230, overflow:'hidden' }}>
                  <div style={{ padding:'8px 14px', fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', borderBottom:'1px solid var(--border)' }}>{T('import_text_title')}</div>
                  <button onClick={() => { setImportOffen(false); setAudioModal(true) }}
                    style={{ width:'100%', padding:'10px 14px', background:'none', border:'none', borderBottom:'1px solid var(--border)', fontSize:13, cursor:'pointer', fontFamily:'inherit', color:'var(--text)', textAlign:'left', display:'flex', flexDirection:'column', gap:2 }}>
                    <span style={{ fontWeight:600 }}>🎤 {T('import_audio')}</span>
                    <span style={{ fontSize:11, color:'var(--text-3)' }}>{T('import_audio_desc')}</span>
                  </button>
                  <button onClick={() => { setImportOffen(false); setFotoModal(true) }}
                    style={{ width:'100%', padding:'10px 14px', background:'none', border:'none', borderBottom:'1px solid var(--border)', fontSize:13, cursor:'pointer', fontFamily:'inherit', color:'var(--text)', textAlign:'left', display:'flex', flexDirection:'column', gap:2 }}>
                    <span style={{ fontWeight:600 }}>📷 {T('import_foto')}</span>
                    <span style={{ fontSize:11, color:'var(--text-3)' }}>{T('import_foto_desc')}</span>
                  </button>
                  <button onClick={() => { setImportOffen(false); lyricsHolen() }}
                    style={{ width:'100%', padding:'10px 14px', background:'none', border:'none', fontSize:13, cursor:'pointer', fontFamily:'inherit', color:'var(--text)', textAlign:'left', display:'flex', flexDirection:'column', gap:2 }}>
                    <span style={{ fontWeight:600 }}>🎵 {T('import_lyrics')}</span>
                    <span style={{ fontSize:11, color:'var(--text-3)' }}>
                      {stueck.youtube_music_url ? T('import_lyrics_src_ytmusic') : stueck.youtube_url ? T('import_lyrics_src_youtube') : `${T('import_lyrics_src_search')} ${stueck.titel}`}
                    </span>
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </div>

      {lyricsFehler && (
        <div style={{ fontSize:13, color:'var(--danger)', padding:'8px 12px', background:'color-mix(in srgb, var(--danger) 8%, var(--bg))', borderRadius:'var(--radius)', border:'1px solid color-mix(in srgb, var(--danger) 20%, var(--border))' }}>
          {lyricsFehler}
        </div>
      )}

      {lyricsTreffer && (
        <div style={{ border:'1.5px solid var(--primary)', borderRadius:'var(--radius)', overflow:'hidden' }}>
          <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'8px 12px', background:'color-mix(in srgb, var(--primary) 8%, var(--bg))', gap:10 }}>
            <div style={{ fontSize:12, color:'var(--text-2)', minWidth:0 }}>
              <strong style={{ color:'var(--text)' }}>{lyricsTreffer.titel}</strong>
              {lyricsTreffer.artist ? <span> · {lyricsTreffer.artist}</span> : null}
              <span style={{ marginLeft:8, opacity:0.5 }}>via {lyricsTreffer.quelle}</span>
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <button onClick={() => setLyricsTreffer(null)}
                style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                {T('discard')}
              </button>
              <button onClick={lyricsUebernehmen}
                style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg, #fff)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {T('apply')}
              </button>
            </div>
          </div>
          <pre style={{ margin:0, padding:'12px 14px', fontFamily:'Georgia, serif', fontSize:13, lineHeight:1.8, color:'var(--text)', whiteSpace:'pre-wrap', maxHeight:200, overflowY:'auto', background:'var(--bg-2)' }}>
            {lyricsTreffer.lyrics}
          </pre>
        </div>
      )}

      {tab === 'text' ? (
        vorschau ? (
          <div
            dangerouslySetInnerHTML={{ __html: safeMarkdown(text || T('piece_lyrics_empty_md')) }}
            style={{ fontFamily:'Georgia, serif', fontSize:15, lineHeight:1.9, color:'var(--text)', minHeight:300, padding:'8px 0' }} />
        ) : (
          <textarea value={text} onChange={e => setText(e.target.value)}
            style={{ ...s.input, minHeight:300, fontFamily:'Georgia, serif', fontSize:15, lineHeight:1.9, resize:'vertical' }}
            placeholder={T('piece_lyrics_placeholder')} />
        )
      ) : (
        <>
          <textarea value={akkorde} onChange={e => setAkkorde(e.target.value)}
            style={{ ...s.input, minHeight:200, fontFamily:'monospace', fontSize:14, lineHeight:2, resize:'vertical' }}
            placeholder="[Am]Hallo [C]Welt" />
          <div style={{ fontSize:12, color:'var(--text-3)' }}>{T('piece_chords_help')}</div>
          {akkorde && (
            <div>
              <div style={s.sectionLabel}>{T('piece_preview')}</div>
              <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'12px 16px', marginTop:6 }}>
                <ChordPro text={akkorde} />
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onAbbrechen} style={s.btnSek}>{T('cancel')}</button>
        <button onClick={() => onSpeichern(text, akkorde, istMd)} style={s.btnPri}>💾 {T('save')}</button>
      </div>

      <Suspense fallback={null}>
        {audioModal && <AudioTranskribierenModal onErgebnis={kiErgebnisUebernehmen} onSchliessen={() => setAudioModal(false)} />}
        {fotoModal  && <FotoOCRModal            onErgebnis={kiErgebnisUebernehmen} onSchliessen={() => setFotoModal(false)}  />}
      </Suspense>
    </div>
  )
}
