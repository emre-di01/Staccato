import { useState, lazy, Suspense } from 'react'
import { useIsMobile } from '../../hooks/useWindowWidth'
import { safeMarkdown } from '../../lib/markdown'
import { s } from './stueckStyles'
import ChordPro from './ChordProRenderer'

const AudioTranskribierenModal = lazy(() => import('../AudioTranskribierenModal'))
const FotoOCRModal = lazy(() => import('../FotoOCRModal'))

const MD_CHEATSHEET = [
  { syntax: '## Refrain',        desc: 'Abschnittstitel' },
  { syntax: '### Strophe 1',     desc: 'Kleiner Abschnittstitel' },
  { syntax: '**fett**',          desc: 'Fetter Text' },
  { syntax: '*kursiv*',          desc: 'Kursiver Text' },
  { syntax: '---',               desc: 'Trennlinie (zwischen Strophen)' },
  { syntax: '> Text',            desc: 'Eingerückter Text' },
  { syntax: 'Leerzeile',         desc: 'Neuer Absatz' },
]

const MD_BEISPIEL = `## Strophe 1
Zeile eins des Liedtexts
Zeile zwei des Liedtexts

---

## Refrain
La la la, oh oh oh
La la la, yeah yeah`

function MarkdownTooltip() {
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
            <div style={{ fontSize:12, fontWeight:800, color:'var(--text)', marginBottom:10, textTransform:'uppercase', letterSpacing:'0.06em' }}>Markdown-Hilfe</div>
            <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:14 }}>
              {MD_CHEATSHEET.map(({ syntax, desc }) => (
                <div key={syntax} style={{ display:'flex', alignItems:'baseline', gap:10 }}>
                  <code style={{ fontFamily:'monospace', fontSize:12, color:'var(--accent)', background:'var(--bg-2)', padding:'2px 6px', borderRadius:4, whiteSpace:'nowrap', flexShrink:0 }}>{syntax}</code>
                  <span style={{ fontSize:12, color:'var(--text-3)' }}>{desc}</span>
                </div>
              ))}
            </div>
            <div style={{ fontSize:11, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.05em', marginBottom:6 }}>Beispiel</div>
            <pre style={{ fontFamily:'monospace', fontSize:11, color:'var(--text-2)', background:'var(--bg-2)', borderRadius:6, padding:'8px 10px', margin:0, whiteSpace:'pre-wrap', lineHeight:1.7 }}>{MD_BEISPIEL}</pre>
          </div>
        </>
      )}
    </div>
  )
}

export default function LiedtextBearbeiten({ stueck, onSpeichern, onAbbrechen }) {
  const mob = useIsMobile()
  const [text,       setText]       = useState(stueck.liedtext ?? '')
  const [akkorde,    setAkkorde]    = useState(stueck.notizen  ?? '')
  const [tab,        setTab]        = useState('text')
  const [vorschau,   setVorschau]   = useState(false)
  const [istMd,      setIstMd]      = useState(stueck.liedtext_md !== false)
  const [audioModal, setAudioModal] = useState(false)
  const [fotoModal,  setFotoModal]  = useState(false)

  function kiErgebnisUebernehmen(kiText) {
    setText(t => t ? t + '\n\n' + kiText : kiText)
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
          <div style={{ display:'flex', alignItems:'center', gap:6, flexWrap:'wrap', ...(mob ? { width:'100%', paddingBottom:8, paddingTop:4 } : {}) }}>
            <div style={{ display:'flex', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', overflow:'hidden' }}>
              <button onClick={() => setIstMd(true)}
                style={{ padding:'4px 10px', background: istMd ? 'var(--primary)' : 'var(--bg-2)', color: istMd ? 'var(--primary-fg, #fff)' : 'var(--text-3)', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>MD</button>
              <button onClick={() => setIstMd(false)}
                style={{ padding:'4px 10px', background: !istMd ? 'var(--primary)' : 'var(--bg-2)', color: !istMd ? 'var(--primary-fg, #fff)' : 'var(--text-3)', border:'none', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>Plain</button>
            </div>
            <button onClick={() => setVorschau(v => !v)}
              style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background: vorschau ? 'var(--primary)' : 'var(--bg-2)', color: vorschau ? 'var(--primary-fg, #fff)' : 'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
              {vorschau ? '✏️' : '👁'}{mob ? '' : (vorschau ? ' Bearbeiten' : ' Vorschau')}
            </button>
            {istMd && <MarkdownTooltip />}
            {!vorschau && (
              <>
                <button onClick={() => setAudioModal(true)}
                  title="Text aus Audio-Aufnahme transkribieren (Whisper KI)"
                  style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  🎤{mob ? '' : ' Audio'}
                </button>
                <button onClick={() => setFotoModal(true)}
                  title="Text aus Foto/Scan extrahieren (OCR)"
                  style={{ padding:'4px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                  📷{mob ? '' : ' Bild'}
                </button>
              </>
            )}
          </div>
        )}
      </div>
      {tab === 'text' ? (
        vorschau ? (
          <div
            dangerouslySetInnerHTML={{ __html: safeMarkdown(text || '*Kein Text vorhanden.*') }}
            style={{ fontFamily:'Georgia, serif', fontSize:15, lineHeight:1.9, color:'var(--text)', minHeight:300, padding:'8px 0' }} />
        ) : (
          <textarea value={text} onChange={e => setText(e.target.value)}
            style={{ ...s.input, minHeight:300, fontFamily:'Georgia, serif', fontSize:15, lineHeight:1.9, resize:'vertical' }}
            placeholder="Liedtext hier eingeben …" />
        )
      ) : (
        <>
          <textarea value={akkorde} onChange={e => setAkkorde(e.target.value)}
            style={{ ...s.input, minHeight:200, fontFamily:'monospace', fontSize:14, lineHeight:2, resize:'vertical' }}
            placeholder="[Am]Hallo [C]Welt" />
          <div style={{ fontSize:12, color:'var(--text-3)' }}>Format: [Akkord] vor dem Wort, z.B. [Am]Text [G]weiter</div>
          {akkorde && (
            <div>
              <div style={s.sectionLabel}>Vorschau</div>
              <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'12px 16px', marginTop:6 }}>
                <ChordPro text={akkorde} />
              </div>
            </div>
          )}
        </>
      )}
      <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
        <button onClick={onAbbrechen} style={s.btnSek}>Abbrechen</button>
        <button onClick={() => onSpeichern(text, akkorde, istMd)} style={s.btnPri}>💾 Speichern</button>
      </div>

      <Suspense fallback={null}>
        {audioModal && <AudioTranskribierenModal onErgebnis={kiErgebnisUebernehmen} onSchliessen={() => setAudioModal(false)} />}
        {fotoModal  && <FotoOCRModal            onErgebnis={kiErgebnisUebernehmen} onSchliessen={() => setFotoModal(false)}  />}
      </Suspense>
    </div>
  )
}
