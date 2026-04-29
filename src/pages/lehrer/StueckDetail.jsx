import { useState, useEffect, useRef } from 'react'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

// ─── Transponieren ───────────────────────────────────────────
const SHARP = ['C','C#','D','D#','E','F','F#','G','G#','A','A#','B']
const FLAT  = ['C','Db','D','Eb','E','F','Gb','G','Ab','A','Bb','B']

// Welche Töne "klingen" besser mit b statt #
const BEVORZUGE_B = new Set(['F','Bb','Eb','Ab','Db','Gb'])

function noteIndex(note) {
  const i = SHARP.indexOf(note)
  return i >= 0 ? i : FLAT.indexOf(note)
}

function transponiereAkkord(akkord, ht) {
  if (!ht) return akkord
  // Akkord-Root erkennen: z.B. C, C#, Db, Am, Gmaj7, F#m7 ...
  const m = akkord.match(/^([A-G][#b]?)(.*)$/)
  if (!m) return akkord
  const [, root, suffix] = m
  const idx = noteIndex(root)
  if (idx < 0) return akkord
  const neuIdx = ((idx + ht) % 12 + 12) % 12
  // Sharp oder Flat je nach Zielton
  const neuRoot = BEVORZUGE_B.has(SHARP[neuIdx]) ? FLAT[neuIdx] : SHARP[neuIdx]
  return neuRoot + suffix
}

function transponiereText(text, ht) {
  if (!ht || !text) return text
  return text.replace(/\[([^\]]+)\]/g, (_, ak) => '[' + transponiereAkkord(ak, ht) + ']')
}

// Welche Tonart ergibt sich aus dem ersten Akkord nach Transposition
function aktuelleTonartenInfo(text, ht) {
  const match = text?.match(/\[([A-G][#b]?[^/\]]*)\]/)
  if (!match) return null
  const transponiert = transponiereAkkord(match[1].replace(/[^A-Ga-g#b].*/, ''), ht)
  const schritte = ['0', '+1', '+2', '+3', '+4', '+5', '+6', '-5', '-4', '-3', '-2', '-1']
  return `${transponiert} (${ht >= 0 ? '+' : ''}${ht} HT)`
}

// ─── ChordPro Renderer ────────────────────────────────────────
function ChordPro({ text }) {
  if (!text) return null
  return (
    <div style={{ fontFamily:'monospace', fontSize:14, lineHeight:2, color:'var(--text)' }}>
      {text.split('\n').map((zeile, i) => {
        const teile = zeile.split(/(\[[^\]]+\])/)
        return (
          <div key={i} style={{ minHeight:'1.5em' }}>
            {teile.map((t, j) =>
              t.startsWith('[') && t.endsWith(']')
                ? <strong key={j} style={{ color:'var(--accent)', marginRight:2, fontSize:12 }}>{t.slice(1,-1)}</strong>
                : <span key={j}>{t}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── YouTube ID extrahieren ───────────────────────────────────
function youtubeId(url) {
  return url?.match(/(?:v=|youtu\.be\/)([^&?/]+)/)?.[1]
}

// ─── Datei-Icon ───────────────────────────────────────────────
function dateiIcon(name = '') {
  const ext = name.split('.').pop()?.toLowerCase()
  if (['pdf'].includes(ext)) return '📄'
  if (['mp3','wav','ogg','m4a','aac','flac'].includes(ext)) return '🎵'
  if (['mp4','mov','avi','webm'].includes(ext)) return '🎬'
  if (['jpg','jpeg','png','gif','webp','svg'].includes(ext)) return '🖼'
  if (['zip','rar','7z'].includes(ext)) return '🗜'
  return '📎'
}

// ─── Signed URL holen ─────────────────────────────────────────
async function getSignedUrl(pfad) {
  const { data } = await supabase.storage.from('stueck-dateien').createSignedUrl(pfad, 3600)
  return data?.signedUrl ?? null
}

// ─── Download-Button ─────────────────────────────────────────
function DownloadButton({ datei, label = '⬇ Herunterladen', full = false }) {
  const [laden, setLaden] = useState(false)
  async function herunterladen() {
    setLaden(true)
    const { data } = await supabase.storage.from('stueck-dateien').download(datei.bucket_pfad)
    if (data) {
      const url = URL.createObjectURL(data)
      const a = document.createElement('a')
      a.href = url; a.download = datei.name; a.click()
      URL.revokeObjectURL(url)
    }
    setLaden(false)
  }
  return (
    <button onClick={herunterladen} disabled={laden}
      style={{ padding:'9px 16px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap', ...(full ? { width:'100%' } : {}) }}>
      {laden ? '…' : label}
    </button>
  )
}

// ─── Im Browser öffnen ────────────────────────────────────────
function OeffnenButton({ pfad }) {
  const [laden, setLaden] = useState(false)
  async function oeffnen() {
    setLaden(true)
    const url = await getSignedUrl(pfad)
    if (url) window.open(url, '_blank')
    setLaden(false)
  }
  return (
    <button onClick={oeffnen} disabled={laden}
      style={{ padding:'9px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
      {laden ? '…' : '↗ Öffnen'}
    </button>
  )
}

// ─── PDF Card (Mobile-first) ──────────────────────────────────
function PdfCard({ datei, kannLoeschen, onLoeschen }) {
  const [vorschau, setVorschau] = useState(false)
  const [url, setUrl] = useState(null)
  const mob = window.innerWidth < 640

  async function toggleVorschau() {
    if (!vorschau && !url) {
      const u = await getSignedUrl(datei.bucket_pfad)
      setUrl(u)
    }
    setVorschau(v => !v)
  }

  return (
    <div style={{ borderRadius:'var(--radius)', border:'1px solid var(--border)', overflow:'hidden', background:'var(--bg-2)' }}>
      {/* Datei-Zeile */}
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px' }}>
        <span style={{ fontSize:24, flexShrink:0 }}>📄</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{datei.name}</div>
          {datei.stimme && datei.stimme !== 'keine' && (
            <span style={{ fontSize:11, color:'var(--text-3)', textTransform:'capitalize', marginTop:2, display:'block' }}>Stimme: {datei.stimme}</span>
          )}
        </div>
        <div style={{ display:'flex', gap:6, flexShrink:0, alignItems:'center' }}>
          <button onClick={toggleVorschau}
            style={{ padding:'7px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background: vorschau ? 'var(--accent)' : 'var(--bg)', color: vorschau ? 'var(--accent-fg)' : 'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
            {vorschau ? '▲ Schließen' : '👁 Vorschau'}
          </button>
          <OeffnenButton pfad={datei.bucket_pfad} />
          <DownloadButton datei={datei} label="⬇" />
          {kannLoeschen && (
            <button onClick={onLoeschen} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--danger)', padding:4 }}>🗑</button>
          )}
        </div>
      </div>

      {/* Inline Vorschau */}
      {vorschau && (
        <div style={{ borderTop:'1px solid var(--border)' }}>
          {url
            ? <iframe src={url} style={{ width:'100%', height: mob ? '70vh' : 600, display:'block', border:'none' }} title={datei.name} />
            : <div style={{ padding:24, textAlign:'center', color:'var(--text-3)' }}>Lädt …</div>
          }
        </div>
      )}
    </div>
  )
}

// ─── Audio Player ─────────────────────────────────────────────
function AudioPlayer({ datei, kannLoeschen, onLoeschen }) {
  const [url, setUrl] = useState(null)

  useEffect(() => {
    supabase.storage.from('stueck-dateien').createSignedUrl(datei.bucket_pfad, 3600)
      .then(({ data }) => setUrl(data?.signedUrl))
  }, [datei.bucket_pfad])

  return (
    <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px solid var(--border)', overflow:'hidden' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12, padding:'12px 16px' }}>
        <span style={{ fontSize:22, flexShrink:0 }}>🎵</span>
        <div style={{ flex:1, minWidth:0 }}>
          <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{datei.name}</div>
          {datei.stimme && datei.stimme !== 'keine' && (
            <span style={{ fontSize:11, color:'var(--text-3)', textTransform:'capitalize' }}>Stimme: {datei.stimme}</span>
          )}
        </div>
        <div style={{ display:'flex', gap:6, flexShrink:0 }}>
          <DownloadButton datei={datei} label="⬇" />
          {kannLoeschen && (
            <button onClick={onLoeschen} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--danger)', padding:4 }}>🗑</button>
          )}
        </div>
      </div>
      {url
        ? <div style={{ padding:'0 16px 14px' }}><audio controls src={url} style={{ width:'100%' }} /></div>
        : <div style={{ padding:'0 16px 14px', color:'var(--text-3)', fontSize:13 }}>Lade Audio …</div>
      }
    </div>
  )
}

// ─── Upload Modal ─────────────────────────────────────────────
function DateiUploadModal({ stueckId, onClose, onErfolg }) {
  const { profil } = useApp()
  const fileRef = useRef()
  const [form, setForm] = useState({ typ: 'noten', stimme: 'keine', name: '' })
  const [datei, setDatei] = useState(null)
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')

  async function hochladen() {
    if (!datei) { setFehler('Bitte eine Datei wählen.'); return }
    setLaden(true)
    const sauberName = datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pfad = `${stueckId}/${form.typ}/${Date.now()}_${sauberName}`
    const { error: sErr } = await supabase.storage.from('stueck-dateien').upload(pfad, datei)
    if (sErr) { setFehler(sErr.message); setLaden(false); return }
    const { error: dErr } = await supabase.from('stueck_dateien').insert({
      stueck_id: stueckId, typ: form.typ, stimme: form.stimme,
      name: form.name || datei.name, bucket_pfad: pfad, hochgeladen_von: profil.id,
    })
    if (dErr) setFehler(dErr.message)
    else { onErfolg(); onClose() }
    setLaden(false)
  }

  return (
    <div style={s.overlay} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={s.modal}>
        <div style={s.modalHeader}>
          <h3 style={s.modalTitel}>📎 Datei hochladen</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Dateityp</label>
            <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
              {[
                { key:'noten',    icon:'📄', label:'Noten' },
                { key:'akkorde',  icon:'🎸', label:'Akkorde' },
                { key:'audio',    icon:'🎵', label:'Audio' },
                { key:'dokument', icon:'📋', label:'Dokument' },
              ].map(t => (
                <button key={t.key} onClick={() => setForm(f => ({ ...f, typ: t.key }))}
                  style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:`2px solid ${form.typ===t.key ? 'var(--accent)' : 'var(--border)'}`, background: form.typ===t.key ? 'var(--accent)' : 'var(--bg-2)', color: form.typ===t.key ? 'var(--accent-fg)' : 'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                  {t.icon} {t.label}
                </button>
              ))}
            </div>
          </div>

          {(form.typ === 'noten' || form.typ === 'audio') && (
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>Stimmgruppe</label>
              <select style={s.input} value={form.stimme} onChange={e => setForm(f => ({ ...f, stimme: e.target.value }))}>
                <option value="keine">Alle Stimmen</option>
                <option value="sopran">Sopran</option>
                <option value="alt">Alt</option>
                <option value="tenor">Tenor</option>
                <option value="bass">Bass</option>
              </select>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Datei</label>
            <div style={{ border:'2px dashed var(--border)', borderRadius:'var(--radius)', padding:24, textAlign:'center', cursor:'pointer', background:'var(--bg-2)' }}
              onClick={() => fileRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); setDatei(e.dataTransfer.files[0]) }}>
              {datei
                ? <span style={{ color:'var(--text)', fontWeight:600 }}>📎 {datei.name}</span>
                : <span style={{ color:'var(--text-3)' }}>Klicken oder Datei hierher ziehen</span>
              }
              <input ref={fileRef} type="file" hidden onChange={e => setDatei(e.target.files[0])} />
            </div>
          </div>

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Anzeigename (optional)</label>
            <input style={s.input} placeholder={datei?.name ?? 'z.B. Noten Sopran'} value={form.name}
              onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
          </div>

          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
            <button onClick={hochladen} disabled={laden} style={s.btnPri}>
              {laden ? 'Hochladen …' : '⬆ Hochladen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// ─── Liedtext Bearbeiten ─────────────────────────────────────
function LiedtextBearbeiten({ stueck, onSpeichern, onAbbrechen }) {
  const [text,    setText]    = useState(stueck.liedtext ?? '')
  const [akkorde, setAkkorde] = useState(stueck.notizen  ?? '')
  const [tab,     setTab]     = useState('text')

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
      <div style={{ display:'flex', gap:4, borderBottom:'2px solid var(--border)', marginBottom:4 }}>
        {[['text','📝 Liedtext'],['akkorde','🎸 Akkorde (ChordPro)']].map(([k,l]) => (
          <button key={k} onClick={() => setTab(k)}
            style={{ padding:'8px 14px', background:'none', border:'none', fontSize:13, cursor:'pointer', fontFamily:'inherit', color: tab===k ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===k ? 700 : 400, borderBottom:`2px solid ${tab===k ? 'var(--primary)' : 'transparent'}`, marginBottom:-2 }}>
            {l}
          </button>
        ))}
      </div>
      {tab === 'text' ? (
        <textarea value={text} onChange={e => setText(e.target.value)}
          style={{ ...s.input, minHeight:300, fontFamily:'Georgia, serif', fontSize:15, lineHeight:1.9, resize:'vertical' }}
          placeholder="Liedtext hier eingeben …" />
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
        <button onClick={() => onSpeichern(text, akkorde)} style={s.btnPri}>💾 Speichern</button>
      </div>
    </div>
  )
}

// ─── Akkord Datei Anzeige ─────────────────────────────────────
function AkkordDateiAnzeige({ datei, halbtoene = 0, kannLoeschen, onLoeschen }) {
  const [text, setText] = useState(null)
  useEffect(() => {
    supabase.storage.from('stueck-dateien').download(datei.bucket_pfad)
      .then(({ data }) => data?.text().then(setText))
  }, [datei.bucket_pfad])
  return (
    <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'16px 20px', border:'1px solid var(--border)', position:'relative' }}>
      {text ? <ChordPro text={transponiereText(text, halbtoene)} /> : <span style={{ color:'var(--text-3)' }}>Laden …</span>}
      {kannLoeschen && (
        <button onClick={onLoeschen} style={{ position:'absolute', top:10, right:10, background:'none', border:'none', fontSize:16, cursor:'pointer', color:'var(--danger)' }}>🗑</button>
      )}
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function StueckDetail() {
  const { kursId, stueckId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { rolle, T } = useApp()

  const mob = window.innerWidth < 640
  const istEvent = location.pathname.includes('/events/')
  const rolle_ = location.pathname.split('/')[1]   // admin | lehrer | schueler
  const backPfad = istEvent
    ? `/${rolle_}/events/${kursId}/repertoire`
    : kursId
      ? `/${rolle_}/kurse/${kursId}/repertoire`
      : `/${rolle_}/repertoire`

  const [stueck,       setStueck]       = useState(null)
  const [dateien,      setDateien]      = useState([])
  const [laden,        setLaden]        = useState(true)
  const [tab,          setTab]          = useState('text')
  const [filterStimme, setFilterStimme] = useState('alle')
  const [bearbeiteText, setBearbeiteText] = useState(false)
  const [modal,        setModal]        = useState(null)
  const [textGroesse,  setTextGroesse]  = useState(18)
  const [vollbild,     setVollbild]     = useState(false)
  const [halbtoene,    setHalbtoene]    = useState(0)
  const [youtubeEdit,  setYoutubeEdit]  = useState(false)
  const [youtubeInput, setYoutubeInput] = useState('')

  const kannBearbeiten = rolle === 'admin' || rolle === 'superadmin' || rolle === 'lehrer'

  useEffect(() => {
    function handleKey(e) { if (e.key === 'Escape') setVollbild(false) }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [])

  useEffect(() => { ladeData() }, [stueckId])

  async function ladeData() {
    const [st, d] = await Promise.all([
      supabase.from('stuecke').select('*').eq('id', stueckId).single(),
      supabase.from('stueck_dateien').select('*').eq('stueck_id', stueckId).order('hochgeladen_am'),
    ])
    setStueck(st.data)
    setDateien(d.data ?? [])
    setLaden(false)
  }

  async function textSpeichern(neuerText, neueAkkorde) {
    await supabase.from('stuecke').update({ liedtext: neuerText, notizen: neueAkkorde }).eq('id', stueckId)
    setStueck(s => ({ ...s, liedtext: neuerText, notizen: neueAkkorde }))
    setBearbeiteText(false)
  }

  async function youtubeSpeichern() {
    const url = youtubeInput.trim() || null
    await supabase.from('stuecke').update({ youtube_url: url }).eq('id', stueckId)
    setStueck(s => ({ ...s, youtube_url: url }))
    setYoutubeEdit(false)
  }

  async function dateiLoeschen(dateiId, pfad) {
    if (!confirm('Datei wirklich löschen?')) return
    await supabase.storage.from('stueck-dateien').remove([pfad])
    await supabase.from('stueck_dateien').delete().eq('id', dateiId)
    setDateien(prev => prev.filter(d => d.id !== dateiId))
  }

  async function stueckLoeschen() {
    if (!confirm(`"${stueck.titel}" dauerhaft aus dem globalen Repertoire löschen?\n\nDas Stück wird aus allen Kursen entfernt und kann nicht wiederhergestellt werden.`)) return
    // Storage-Dateien zuerst entfernen
    const pfade = dateien.map(d => d.bucket_pfad)
    if (pfade.length > 0) await supabase.storage.from('stueck-dateien').remove(pfade)
    // DB-Eintrag löschen (Kaskade räumt stueck_dateien + unterricht_stuecke auf)
    await supabase.from('stuecke').delete().eq('id', stueckId)
    navigate(backPfad)
  }

  if (laden)  return <div style={{ padding:40, color:'var(--text-3)' }}>{T('loading')}</div>
  if (!stueck) return <div style={{ padding:40, color:'var(--danger)' }}>Stück nicht gefunden.</div>

  const gefilterteDateien = dateien.filter(d =>
    filterStimme === 'alle' || d.stimme === filterStimme || d.stimme === 'keine'
  )
  const notenDateien  = gefilterteDateien.filter(d => d.typ === 'noten')
  const audioDateien  = gefilterteDateien.filter(d => d.typ === 'audio')
  const akkordDateien = gefilterteDateien.filter(d => d.typ === 'akkorde')
  const dokumente     = gefilterteDateien.filter(d => d.typ === 'dokument' || d.typ === 'sonstiges')

  const tabs = [
    { id:'text',    label:'📝 Text',    zeigen: !!stueck.liedtext || kannBearbeiten },
    { id:'akkorde', label:'🎸 Akkorde', zeigen: akkordDateien.length > 0 || (kannBearbeiten && !!stueck.notizen) },
    { id:'noten',   label:'📄 Noten',   zeigen: notenDateien.length > 0 },
    { id:'audio',   label:'🎵 Audio',   zeigen: audioDateien.length > 0 },
    { id:'youtube', label:'▶️ Video',   zeigen: !!stueck.youtube_url || kannBearbeiten },
    { id:'dateien', label:'📁 Dateien', zeigen: dokumente.length > 0 || kannBearbeiten },
  ].filter(t => t.zeigen)

  const padContent = mob ? 16 : 28

  return (
    <div>
      {/* Zurück */}
      <button onClick={() => navigate(backPfad)}
        style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 14px' }}>
        ← {T('repertoire_title')}
      </button>

      {/* Header */}
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding: mob ? '16px' : '24px', border:'1px solid var(--border)', marginBottom:20, boxShadow:'var(--shadow)' }}>
        <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10 }}>
          <div style={{ flex:1, minWidth:0 }}>
            <h1 style={{ margin:'0 0 6px', fontSize: mob ? 20 : 24, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px', wordBreak:'break-word' }}>{stueck.titel}</h1>
            <div style={{ display:'flex', gap:12, flexWrap:'wrap', fontSize:13, color:'var(--text-2)' }}>
              {stueck.komponist && <span>🎼 {stueck.komponist}</span>}
              {stueck.tonart    && <span>🎵 {stueck.tonart}</span>}
              {stueck.tempo     && <span>♩ {stueck.tempo}</span>}
            </div>
          </div>
          {kannBearbeiten && (
            <div style={{ display:'flex', gap:8 }}>
              <button onClick={() => setModal('upload')} style={s.btnPri}>⬆ Upload</button>
              <button onClick={stueckLoeschen}
                style={{ padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                🗑
              </button>
            </div>
          )}
        </div>

        {/* Stimmen-Filter */}
        <div style={{ display:'flex', gap:6, marginTop:14, flexWrap:'wrap' }}>
          {['alle','sopran','alt','tenor','bass'].map(st => (
            <button key={st} onClick={() => setFilterStimme(st)}
              style={{ padding:'4px 12px', borderRadius:99, border:'1.5px solid var(--border)', background: filterStimme===st ? 'var(--primary)' : 'var(--bg-2)', color: filterStimme===st ? 'var(--primary-fg)' : 'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
              {st === 'alle' ? T('piece_voice_all') : st === 'sopran' ? T('piece_voice_soprano') : st === 'alt' ? T('piece_voice_alto') : st === 'tenor' ? T('piece_voice_tenor') : T('piece_voice_bass')}
            </button>
          ))}
        </div>
      </div>

      {/* Tabs */}
      {tabs.length > 0 && (
        <div style={{ display:'flex', gap:0, marginBottom:0, borderBottom:'2px solid var(--border)', overflowX:'auto', WebkitOverflowScrolling:'touch' }}>
          {tabs.map(t => (
            <button key={t.id} onClick={() => setTab(t.id)}
              style={{ padding: mob ? '10px 14px' : '10px 18px', background:'none', border:'none', fontSize: mob ? 13 : 14, cursor:'pointer', fontFamily:'inherit', color: tab===t.id ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===t.id ? 800 : 500, borderBottom:`2px solid ${tab===t.id ? 'var(--primary)' : 'transparent'}`, marginBottom:-2, whiteSpace:'nowrap', flexShrink:0 }}>
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Tab Inhalt */}
      <div style={{ background:'var(--surface)', borderRadius:'0 0 var(--radius-lg) var(--radius-lg)', padding:padContent, border:'1px solid var(--border)', borderTop:'none', boxShadow:'var(--shadow)', marginBottom:24 }}>

        {/* LIEDTEXT */}
        {tab === 'text' && (
          <div>
            {bearbeiteText && kannBearbeiten ? (
              <LiedtextBearbeiten stueck={stueck} onSpeichern={textSpeichern} onAbbrechen={() => setBearbeiteText(false)} />
            ) : stueck.liedtext ? (
              <>
                {/* Toolbar */}
                <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
                  <button onClick={() => setTextGroesse(g => Math.max(12, g - 2))}
                    style={{ width:36, height:36, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>A−</button>
                  <span style={{ fontSize:12, color:'var(--text-3)', minWidth:32, textAlign:'center' }}>{textGroesse}px</span>
                  <button onClick={() => setTextGroesse(g => Math.min(56, g + 2))}
                    style={{ width:36, height:36, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>A+</button>
                  <div style={{ flex:1 }} />
                  <button onClick={() => setVollbild(true)}
                    style={{ padding:'8px 16px', borderRadius:'var(--radius)', border:'none', background:'var(--accent)', color:'var(--accent-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    {T('piece_fullscreen')}
                  </button>
                  {kannBearbeiten && (
                    <button onClick={() => setBearbeiteText(true)} style={s.btnSek}>✏️</button>
                  )}
                </div>
                <pre style={{ fontFamily:'Georgia, serif', fontSize:textGroesse, lineHeight:1.9, color:'var(--text)', whiteSpace:'pre-wrap', margin:0, transition:'font-size 0.2s', wordBreak:'break-word' }}>
                  {stueck.liedtext}
                </pre>
              </>
            ) : kannBearbeiten ? (
              <div style={{ textAlign:'center', padding:32 }}>
                <p style={{ color:'var(--text-3)', marginBottom:16 }}>Noch kein Liedtext vorhanden.</p>
                <button onClick={() => setBearbeiteText(true)} style={s.btnPri}>+ Liedtext hinzufügen</button>
              </div>
            ) : (
              <div style={s.leer}>Kein Liedtext vorhanden.</div>
            )}
          </div>
        )}

        {/* AKKORDE */}
        {tab === 'akkorde' && (
          <div>
            {/* Transpositions-Leiste */}
            {(stueck.notizen || akkordDateien.length > 0) && (
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:'12px 16px', background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px solid var(--border)', flexWrap:'wrap' }}>
                <span style={{ fontSize:13, fontWeight:700, color:'var(--text-2)', flexShrink:0 }}>🎵 Transponieren:</span>
                <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                  <button onClick={() => setHalbtoene(h => h - 1)}
                    style={{ width:34, height:34, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:18, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>−</button>
                  <div style={{ minWidth:52, textAlign:'center' }}>
                    <div style={{ fontSize:16, fontWeight:800, color: halbtoene !== 0 ? 'var(--accent)' : 'var(--text)' }}>
                      {halbtoene > 0 ? '+' : ''}{halbtoene}
                    </div>
                    <div style={{ fontSize:10, color:'var(--text-3)', marginTop:-2 }}>{T('piece_halftones')}</div>
                  </div>
                  <button onClick={() => setHalbtoene(h => h + 1)}
                    style={{ width:34, height:34, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:18, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+</button>
                </div>
                {/* Schnellwahl-Steps */}
                <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
                  {[-5,-4,-3,-2,-1,1,2,3,4,5].map(n => (
                    <button key={n} onClick={() => setHalbtoene(n)}
                      style={{ padding:'4px 8px', borderRadius:6, border:'1.5px solid var(--border)', background: halbtoene===n ? 'var(--accent)' : 'var(--bg)', color: halbtoene===n ? 'var(--accent-fg)' : 'var(--text-3)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                      {n > 0 ? '+' : ''}{n}
                    </button>
                  ))}
                </div>
                {halbtoene !== 0 && (
                  <button onClick={() => setHalbtoene(0)}
                    style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                    ↺ Reset
                  </button>
                )}
              </div>
            )}

            {stueck.notizen && (
              <div style={{ marginBottom:24 }}>
                <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
                  <div style={s.sectionLabel}>Akkorde</div>
                  {kannBearbeiten && <button onClick={() => setBearbeiteText(true)} style={{ ...s.btnSek, fontSize:12, padding:'5px 10px' }}>✏️ Bearbeiten</button>}
                </div>
                <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'16px 20px' }}>
                  <ChordPro text={transponiereText(stueck.notizen, halbtoene)} />
                </div>
              </div>
            )}
            {akkordDateien.map(d => (
              <div key={d.id} style={{ marginBottom:20 }}>
                <div style={s.sectionLabel}>{d.name}</div>
                <AkkordDateiAnzeige datei={d} halbtoene={halbtoene} kannLoeschen={kannBearbeiten} onLoeschen={() => dateiLoeschen(d.id, d.bucket_pfad)} />
              </div>
            ))}
            {!stueck.notizen && akkordDateien.length === 0 && (
              <div style={s.leer}>Keine Akkorde vorhanden.</div>
            )}
          </div>
        )}

        {/* NOTEN */}
        {tab === 'noten' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {notenDateien.map(d => (
              <PdfCard key={d.id} datei={d} kannLoeschen={kannBearbeiten} onLoeschen={() => dateiLoeschen(d.id, d.bucket_pfad)} />
            ))}
          </div>
        )}

        {/* AUDIO */}
        {tab === 'audio' && (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {audioDateien.map(d => (
              <AudioPlayer key={d.id} datei={d} kannLoeschen={kannBearbeiten} onLoeschen={() => dateiLoeschen(d.id, d.bucket_pfad)} />
            ))}
          </div>
        )}

        {/* YOUTUBE */}
        {tab === 'youtube' && (
          <div>
            {stueck.youtube_url && !youtubeEdit ? (
              <>
                <div style={{ position:'relative', paddingBottom:'56.25%', height:0, overflow:'hidden', borderRadius:'var(--radius)', background:'#000' }}>
                  <iframe
                    style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', border:'none' }}
                    src={`https://www.youtube.com/embed/${youtubeId(stueck.youtube_url)}`}
                    title="YouTube"
                    allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                    allowFullScreen
                  />
                </div>
                <div style={{ marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
                  <a href={stueck.youtube_url} target="_blank" rel="noreferrer"
                    style={{ fontSize:13, color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>
                    ↗ Auf YouTube öffnen
                  </a>
                  {kannBearbeiten && (
                    <button onClick={() => { setYoutubeInput(stueck.youtube_url ?? ''); setYoutubeEdit(true) }}
                      style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                      ✎ Link ändern
                    </button>
                  )}
                </div>
              </>
            ) : kannBearbeiten ? (
              <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
                <p style={{ margin:0, fontSize:14, color:'var(--text-2)' }}>
                  {stueck.youtube_url ? 'YouTube-Link bearbeiten:' : 'YouTube-Link hinzufügen:'}
                </p>
                <input
                  type="url"
                  value={youtubeInput}
                  onChange={e => setYoutubeInput(e.target.value)}
                  placeholder="https://youtube.com/watch?v=..."
                  style={{ padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', outline:'none', width:'100%', boxSizing:'border-box' }}
                />
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  {stueck.youtube_url && (
                    <button onClick={() => { setYoutubeInput(''); youtubeSpeichern() }}
                      style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>
                      🗑 Entfernen
                    </button>
                  )}
                  <button onClick={() => setYoutubeEdit(false)}
                    style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                    Abbrechen
                  </button>
                  <button onClick={youtubeSpeichern} disabled={!youtubeInput.trim()}
                    style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                    💾 Speichern
                  </button>
                </div>
              </div>
            ) : (
              <div style={s.leer}>Kein Video verlinkt.</div>
            )}
          </div>
        )}

        {/* DATEIEN */}
        {tab === 'dateien' && (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {dokumente.length === 0 ? (
              <div style={s.leer}>Keine allgemeinen Dateien.</div>
            ) : (
              dokumente.map(d => (
                <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)' }}>
                  <span style={{ fontSize:24, flexShrink:0 }}>{dateiIcon(d.name)}</span>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</div>
                  </div>
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    <OeffnenButton pfad={d.bucket_pfad} />
                    <DownloadButton datei={d} label="⬇" />
                    {kannBearbeiten && (
                      <button onClick={() => dateiLoeschen(d.id, d.bucket_pfad)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--danger)', padding:4 }}>🗑</button>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        )}
      </div>

      {modal === 'upload' && (
        <DateiUploadModal stueckId={stueckId} onClose={() => setModal(null)} onErfolg={ladeData} />
      )}

      {/* Vollbild Modus */}
      {vollbild && stueck?.liedtext && (
        <div style={{ position:'fixed', inset:0, background:'#111', zIndex:2000, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'rgba(255,255,255,0.06)', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stueck.titel}</div>
              {stueck.komponist && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>{stueck.komponist}</div>}
            </div>
            <button onClick={() => setVollbild(false)}
              style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', padding:'8px 16px', borderRadius:8, flexShrink:0 }}>
              ✕ Schließen
            </button>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding: mob ? '24px 16px' : '40px 10vw', WebkitOverflowScrolling:'touch' }}>
            <pre style={{ fontFamily:'Georgia, serif', fontSize:textGroesse, lineHeight:1.9, color:'#fff', whiteSpace:'pre-wrap', margin:'0 auto', maxWidth:700, transition:'font-size 0.15s', wordBreak:'break-word' }}>
              {stueck.liedtext}
            </pre>
          </div>
          <div style={{ padding:'12px 16px', background:'rgba(255,255,255,0.06)', borderTop:'1px solid rgba(255,255,255,0.1)', flexShrink:0 }}>
            <div style={{ display:'flex', alignItems:'center', gap:12 }}>
              <button onClick={() => setTextGroesse(g => Math.max(10, g - 2))}
                style={{ width:48, height:48, borderRadius:10, background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', fontSize:20, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>A−</button>
              <input type="range" min={10} max={80} value={textGroesse}
                onChange={e => setTextGroesse(Number(e.target.value))}
                style={{ flex:1, accentColor:'white', height:6, cursor:'pointer' }} />
              <button onClick={() => setTextGroesse(g => Math.min(80, g + 2))}
                style={{ width:48, height:48, borderRadius:10, background:'rgba(255,255,255,0.1)', border:'none', color:'#fff', fontSize:20, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>A+</button>
              <span style={{ color:'rgba(255,255,255,0.4)', fontSize:12, minWidth:36, textAlign:'center' }}>{textGroesse}px</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

const s = {
  overlay:     { position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 },
  modal:       { background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:480, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' },
  modalHeader: { display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:24 },
  modalTitel:  { margin:0, fontSize:18, fontWeight:800, color:'var(--text)' },
  iconBtn:     { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 },
  label:       { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  sectionLabel:{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:4 },
  input:       { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%', boxSizing:'border-box' },
  btnPri:      { padding:'10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek:      { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  leer:        { padding:'32px', textAlign:'center', color:'var(--text-3)', fontSize:13, background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px dashed var(--border)' },
}
