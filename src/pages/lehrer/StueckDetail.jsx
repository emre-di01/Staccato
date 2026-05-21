import { useState, useEffect, useRef } from 'react'
import { createPortal } from 'react-dom'
import { useIsMobile } from '../../hooks/useWindowWidth'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { safeMarkdown } from '../../lib/markdown'
import { transponiereText, youtubeId, dateiIcon } from '../../lib/akkordeUtils'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

import ChordPlayer from '../../components/stueck/ChordPlayer'
import SpotifyModal, { spotifyTrackId } from '../../components/stueck/SpotifyModal'
import YtMusicModal from '../../components/stueck/YtMusicModal'
import ChordPro from '../../components/stueck/ChordProRenderer'
import { DownloadButton, OeffnenButton } from '../../components/stueck/FileButtons'
import PdfCard from '../../components/stueck/PdfCard'
import AudioPlayer from '../../components/stueck/AudioPlayer'
import VerovioViewer from '../../components/stueck/VerovioViewer'
import AkkordDateiAnzeige from '../../components/stueck/AkkordDateiAnzeige'
import Metronom from '../../components/stueck/Metronom'
import DateiUploadModal from '../../components/stueck/DateiUploadModal'
import LiedtextBearbeiten from '../../components/stueck/LiedtextBearbeiten'
import { s } from '../../components/stueck/stueckStyles'

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const SUPABASE_HEADERS = {
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function StueckDetail() {
  const { kursId, stueckId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const queryClient = useQueryClient()
  const { rolle, T, schule, confirm } = useApp()

  const mob = useIsMobile()
  const istEvent = location.pathname.includes('/events/')
  const rolle_ = location.pathname.split('/')[1]
  const backPfad = istEvent
    ? `/${rolle_}/events/${kursId}/repertoire`
    : kursId
      ? `/${rolle_}/kurse/${kursId}/repertoire`
      : `/${rolle_}/repertoire`

  const [stueck,        setStueck]        = useState(null)
  const [dateien,       setDateien]       = useState([])
  const [laden,         setLaden]         = useState(true)
  const [tab,           setTab]           = useState(() => mob ? '' : 'text')
  const [filterStimme,  setFilterStimme]  = useState('alle')
  const [bearbeiteText, setBearbeiteText] = useState(false)
  const [bearbeiteMeta, setBearbeiteMeta] = useState(false)
  const [metaForm,      setMetaForm]      = useState({ titel:'', komponist:'', tonart:'', tempo:'', takt:'', anmerkungen:'' })
  const [modal,         setModal]         = useState(null)
  const [textGroesse,   setTextGroesse]   = useState(18)
  const [vollbild,      setVollbild]      = useState(false)
  const [halbtoene,     setHalbtoene]     = useState(0)
  const [youtubeEdit,    setYoutubeEdit]    = useState(false)
  const [youtubeInput,   setYoutubeInput]   = useState('')
  const [ytMusicEdit,    setYtMusicEdit]    = useState(false)
  const [ytMusicInput,   setYtMusicInput]   = useState('')
  const [ytMusicModal,   setYtMusicModal]   = useState(false)
  const [spotifyModal,  setSpotifyModal]  = useState(false)
  const [pdfModal,      setPdfModal]      = useState(false)
  const [metronomOffen, setMetronomOffen] = useState(false)
  const [mbLaden,       setMbLaden]       = useState(false)
  const [mbErgebnisse,  setMbErgebnisse]  = useState([])
  const tapZeitenEditRef = useRef([])
  const chordproInputRef = useRef(null)

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

  async function textSpeichern(neuerText, neueAkkorde, neuesMd) {
    await supabase.from('stuecke').update({ liedtext: neuerText, notizen: neueAkkorde, liedtext_md: neuesMd }).eq('id', stueckId)
    setStueck(s => ({ ...s, liedtext: neuerText, notizen: neueAkkorde, liedtext_md: neuesMd }))
    setBearbeiteText(false)
  }

  function liedtextAlsPdf() {
    const win = window.open('', '_blank')
    const meta = [stueck.komponist, stueck.tonart, stueck.tempo].filter(Boolean).join(' · ')
    const html = safeMarkdown(stueck.liedtext ?? '')
    const logoHtml = schule?.logo_url
      ? `<img src="${schule.logo_url}" class="logo" alt="Logo" />`
      : ''
    const schuleKontakt = [schule?.email, schule?.telefon, schule?.website].filter(Boolean)
    const schuleInfoHtml = schule?.name ? `<div class="schule-info">
      <span style="font-weight:600">${schule.name}</span>${schuleKontakt.length ? ' · ' + schuleKontakt.join(' · ') : ''}
      ${schule?.adresse ? `<br/><span style="color:#bbb">${schule.adresse}</span>` : ''}
    </div>` : ''
    win.document.write(`<!DOCTYPE html><html><head><meta charset="utf-8">
<title>${stueck.titel}</title>
<style>
  body { font-family: Georgia, serif; max-width: 680px; margin: 40px auto; padding: 0 24px; color: #111; }
  .header { display: flex; align-items: flex-start; gap: 20px; margin-bottom: 4px; }
  .header-text { flex: 1; }
  .logo { max-height: 64px; max-width: 160px; object-fit: contain; flex-shrink: 0; }
  h1 { font-size: 26px; margin: 0 0 4px; }
  .meta { font-size: 13px; color: #777; margin-bottom: 32px; border-bottom: 1px solid #ddd; padding-bottom: 12px; }
  .schule-info { font-size: 11px; color: #999; margin-top: 2px; }
  h2 { font-size: 17px; margin: 28px 0 6px; color: #222; page-break-after: avoid; }
  h3 { font-size: 15px; margin: 20px 0 4px; color: #444; page-break-after: avoid; }
  p { margin: 0 0 8px; line-height: 1.9; }
  strong { font-weight: 700; }
  em { font-style: italic; }
  hr { border: none; border-top: 1px solid #ddd; margin: 24px 0; }
  blockquote { margin: 8px 0 8px 16px; padding-left: 12px; border-left: 3px solid #ccc; color: #555; font-style: italic; }
  ul, ol { margin: 0 0 8px 20px; padding: 0; line-height: 1.9; }
  li { margin-bottom: 2px; }
  section { page-break-inside: avoid; }
  @media print {
    body { margin: 15mm 20mm; }
    @page { margin: 15mm 20mm; }
    .footer { position: fixed; bottom: 0; left: 0; right: 0; font-size: 10px; color: #aaa; text-align: center; padding-bottom: 8mm; }
  }
</style></head><body>
<div class="header">
  <div class="header-text">
    <h1>${stueck.titel}</h1>
    ${schuleInfoHtml}
  </div>
  ${logoHtml}
</div>
${meta ? `<div class="meta">${meta}</div>` : ''}
${html}
<div class="footer">${stueck.titel}${meta ? ' · ' + meta : ''}</div>
</body></html>`)
    win.document.close()
    win.onload = () => { win.focus(); win.print() }
  }

  async function tempoSpeichernVonMetronom(bpm) {
    const tempo = String(bpm)
    await supabase.from('stuecke').update({ tempo }).eq('id', stueckId)
    setStueck(s => ({ ...s, tempo }))
  }

  function metaBearbeitenStarten() {
    setMetaForm({ titel: stueck.titel ?? '', komponist: stueck.komponist ?? '', tonart: stueck.tonart ?? '', tempo: stueck.tempo ?? '', takt: stueck.takt ?? '', anmerkungen: stueck.anmerkungen ?? '' })
    tapZeitenEditRef.current = []
    setBearbeiteMeta(true)
  }

  async function metaSpeichern() {
    const payload = { titel: metaForm.titel.trim() || stueck.titel, komponist: metaForm.komponist.trim() || null, tonart: metaForm.tonart.trim() || null, tempo: metaForm.tempo.trim() || null, takt: metaForm.takt || null, anmerkungen: metaForm.anmerkungen.trim() || null }
    await supabase.from('stuecke').update(payload).eq('id', stueckId)
    setStueck(s => ({ ...s, ...payload }))
    setBearbeiteMeta(false)
  }

  async function youtubeSpeichern() {
    const url = youtubeInput.trim() || null
    await supabase.from('stuecke').update({ youtube_url: url }).eq('id', stueckId)
    setStueck(s => ({ ...s, youtube_url: url }))
    setYoutubeEdit(false)
  }

  async function ytMusicSpeichern() {
    const val = ytMusicInput.trim() || null
    await supabase.from('stuecke').update({ youtube_music_url: val }).eq('id', stueckId)
    setStueck(s => ({ ...s, youtube_music_url: val }))
    setYtMusicEdit(false)
  }

  async function ytMusicSpeichernDirekt(url) {
    const val = url?.trim() || null
    await supabase.from('stuecke').update({ youtube_music_url: val }).eq('id', stueckId)
    setStueck(s => ({ ...s, youtube_music_url: val }))
  }

  async function spotifySpeichern(url) {
    const val = (url ?? '').trim() || null
    await supabase.from('stuecke').update({ spotify_url: val }).eq('id', stueckId)
    setStueck(s => ({ ...s, spotify_url: val }))
  }

  function mbTonart(key) {
    if (!key) return ''
    return key
      .replace('Bb', 'B').replace('Eb', 'Es').replace('Ab', 'As')
      .replace('Db', 'Des').replace('Gb', 'Ges').replace('Cb', 'Ces')
      .replace('F#', 'Fis').replace('C#', 'Cis').replace('G#', 'Gis')
      .replace('D#', 'Dis').replace('A#', 'Ais').replace('E#', 'Eis')
      .replace(' major', '-Dur').replace(' minor', '-Moll')
  }

  async function mbSuchen() {
    const q = metaForm.titel.trim()
    if (!q) return
    setMbLaden(true); setMbErgebnisse([])
    try {
      const res = await fetch(
        `https://musicbrainz.org/ws/2/work?query=${encodeURIComponent(q)}&fmt=json&limit=8`,
        { headers: { 'Accept': 'application/json' } }
      )
      const data = await res.json()
      const treffer = (data.works ?? []).map(w => ({
        titel:     w.title ?? '',
        komponist: w.relations?.find(r => r.type === 'composer')?.artist?.name ?? '',
        tonart:    mbTonart(w.attributes?.find(a => a.type === 'Key')?.value ?? ''),
      })).filter(t => t.titel)
      setMbErgebnisse(treffer)
    } catch { /* silent */ }
    setMbLaden(false)
  }

  function mbUebernehmen(t) {
    setMetaForm(p => ({
      ...p,
      titel:     t.titel     || p.titel,
      komponist: t.komponist || p.komponist,
      tonart:    t.tonart    || p.tonart,
    }))
    setMbErgebnisse([])
  }

  async function chordproImportieren(e) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    await supabase.from('stuecke').update({ notizen: text }).eq('id', stueckId)
    setStueck(s => ({ ...s, notizen: text }))
    e.target.value = ''
  }

  async function dateiLoeschen(dateiId, pfad) {
    if (!await confirm(T('file_delete_confirm'), { confirmLabel: T('delete') })) return
    await supabase.storage.from('stueck-dateien').remove([pfad])
    await supabase.from('stueck_dateien').delete().eq('id', dateiId)
    setDateien(prev => prev.filter(d => d.id !== dateiId))
  }

  async function stueckLoeschen() {
    if (!await confirm(T('piece_delete_confirm').replace('{titel}', stueck.titel), { sub: T('piece_delete_sub'), confirmLabel: T('delete') })) return
    const pfade = dateien.map(d => d.bucket_pfad)
    if (pfade.length > 0) await supabase.storage.from('stueck-dateien').remove(pfade)
    await supabase.from('stuecke').delete().eq('id', stueckId)
    queryClient.invalidateQueries({ queryKey: ['repertoire'] })
    navigate(backPfad)
  }

  if (laden)   return <div style={{ padding:40, color:'var(--text-3)' }}>{T('loading')}</div>
  if (!stueck) return <div style={{ padding:40, color:'var(--danger)' }}>{T('piece_not_found')}</div>

  const gefilterteDateien = dateien.filter(d =>
    filterStimme === 'alle' || d.stimme === filterStimme || d.stimme === 'keine'
  )
  const notenDateien  = gefilterteDateien.filter(d => d.typ === 'noten')
  const xmlDateien    = gefilterteDateien.filter(d => d.typ === 'musicxml')
  const audioDateien  = gefilterteDateien.filter(d => d.typ === 'audio')
  const akkordDateien = gefilterteDateien.filter(d => d.typ === 'akkorde')
  const dokumente     = gefilterteDateien.filter(d => d.typ === 'dokument' || d.typ === 'sonstiges')

  const tabs = [
    { id:'text',    label:`📝 ${T('piece_lyrics')}`,      zeigen: !!stueck.liedtext || kannBearbeiten },
    { id:'akkorde', label:`🎸 ${T('piece_chords')}`,      zeigen: akkordDateien.length > 0 || !!stueck.notizen || (kannBearbeiten && !!stueck.youtube_url) },
    { id:'noten',   label:`📄 ${T('piece_notes_label')}`, zeigen: notenDateien.length > 0 || xmlDateien.length > 0 },
    { id:'audio',   label:`🎵 ${T('piece_audio')}`,       zeigen: audioDateien.length > 0 },
    { id:'youtube', label:`▶️ ${T('piece_youtube')}`,     zeigen: !!stueck.youtube_url       || kannBearbeiten },
    { id:'ytmusic', label:`🎵 YT Music`,                  zeigen: !!stueck.youtube_music_url || kannBearbeiten },
    { id:'spotify', label:`🟢 Spotify`,                   zeigen: !!stueck.spotify_url       || kannBearbeiten },
    { id:'dateien', label:`📁 ${T('files')}`,             zeigen: dokumente.length > 0 || kannBearbeiten },
  ].filter(t => t.zeigen)

  const padContent = mob ? 16 : 28

  function tabInhalt(id) {
    if (id === 'text') return (
      <div>
        {bearbeiteText && kannBearbeiten ? (
          <LiedtextBearbeiten stueck={stueck} onSpeichern={textSpeichern} onAbbrechen={() => setBearbeiteText(false)} />
        ) : stueck.liedtext ? (
          <>
            <div style={{ display:'flex', gap:8, marginBottom:16, alignItems:'center', flexWrap:'wrap' }}>
              <button onClick={() => setTextGroesse(g => Math.max(12, g - 2))} style={{ width:36, height:36, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>A−</button>
              <span style={{ fontSize:12, color:'var(--text-3)', minWidth:32, textAlign:'center' }}>{textGroesse}px</span>
              <button onClick={() => setTextGroesse(g => Math.min(56, g + 2))} style={{ width:36, height:36, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit', fontWeight:700, flexShrink:0 }}>A+</button>
              <div style={{ flex:1 }} />
              <button onClick={() => setPdfModal(true)} style={s.btnSek} title="Als PDF drucken">📄 PDF</button>
              <button onClick={() => setVollbild(true)} style={{ padding:'8px 16px', borderRadius:'var(--radius)', border:'none', background:'var(--accent)', color:'var(--accent-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{T('piece_fullscreen')}</button>
              {kannBearbeiten && <button onClick={() => setBearbeiteText(true)} style={s.btnSek}>✏️</button>}
            </div>
            {stueck.liedtext_md !== false
              ? <div dangerouslySetInnerHTML={{ __html: safeMarkdown(stueck.liedtext) }} style={{ fontFamily:'Georgia, serif', fontSize:textGroesse, lineHeight:1.9, color:'var(--text)', transition:'font-size 0.2s', wordBreak:'break-word' }} />
              : <pre style={{ fontFamily:'Georgia, serif', fontSize:textGroesse, lineHeight:1.9, color:'var(--text)', whiteSpace:'pre-wrap', margin:0, transition:'font-size 0.2s', wordBreak:'break-word' }}>{stueck.liedtext}</pre>
            }
          </>
        ) : kannBearbeiten ? (
          <div style={{ textAlign:'center', padding:32 }}>
            <p style={{ color:'var(--text-3)', marginBottom:16 }}>{T('piece_no_lyrics')}</p>
            <button onClick={() => setBearbeiteText(true)} style={s.btnPri}>{T('piece_add_lyrics')}</button>
          </div>
        ) : <div style={s.leer}>{T('piece_no_lyrics')}</div>}
      </div>
    )
    if (id === 'akkorde') return (
      <div>
        <ChordPlayer notizen={stueck.notizen} tempo={stueck.tempo} takt={stueck.takt} />
        {(stueck.notizen || akkordDateien.length > 0) && (
          <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:20, padding:'12px 16px', background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px solid var(--border)', flexWrap:'wrap' }}>
            <span style={{ fontSize:13, fontWeight:700, color:'var(--text-2)', flexShrink:0 }}>🎵 {T('piece_transpose')}:</span>
            <div style={{ display:'flex', alignItems:'center', gap:6 }}>
              <button onClick={() => setHalbtoene(h => h - 1)} style={{ width:34, height:34, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:18, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>−</button>
              <div style={{ minWidth:52, textAlign:'center' }}>
                <div style={{ fontSize:16, fontWeight:800, color: halbtoene !== 0 ? 'var(--accent)' : 'var(--text)' }}>{halbtoene > 0 ? '+' : ''}{halbtoene}</div>
                <div style={{ fontSize:10, color:'var(--text-3)', marginTop:-2 }}>{T('piece_halftones')}</div>
              </div>
              <button onClick={() => setHalbtoene(h => h + 1)} style={{ width:34, height:34, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text)', fontSize:18, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>+</button>
            </div>
            <div style={{ display:'flex', gap:4, flexWrap:'wrap' }}>
              {[-5,-4,-3,-2,-1,1,2,3,4,5].map(n => (
                <button key={n} onClick={() => setHalbtoene(n)} style={{ padding:'4px 8px', borderRadius:6, border:'1.5px solid var(--border)', background: halbtoene===n ? 'var(--accent)' : 'var(--bg)', color: halbtoene===n ? 'var(--accent-fg)' : 'var(--text-3)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{n > 0 ? '+' : ''}{n}</button>
              ))}
            </div>
            {halbtoene !== 0 && <button onClick={() => setHalbtoene(0)} style={{ marginLeft:'auto', padding:'5px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg)', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>↺ Reset</button>}
          </div>
        )}
        {kannBearbeiten && (
          <input ref={chordproInputRef} type="file" accept=".cho,.chopro,.chordpro,.txt" style={{ display:'none' }} onChange={chordproImportieren} />
        )}
        {stueck.notizen && (
          <div style={{ marginBottom:24 }}>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:8 }}>
              <div style={s.sectionLabel}>Akkorde</div>
              {kannBearbeiten && (
                <div style={{ display:'flex', gap:6 }}>
                  <button onClick={() => chordproInputRef.current?.click()} style={{ ...s.btnSek, fontSize:12, padding:'5px 10px' }}>📂 Import</button>
                  <button onClick={() => { setBearbeiteText(true); setTab('text') }} style={{ ...s.btnSek, fontSize:12, padding:'5px 10px' }}>✏️ Bearbeiten</button>
                </div>
              )}
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
          kannBearbeiten ? (
            <div style={{ textAlign:'center', padding:32 }}>
              <p style={{ color:'var(--text-3)', marginBottom:16 }}>Noch keine Akkorde vorhanden.</p>
              <div style={{ display:'flex', gap:10, justifyContent:'center', flexWrap:'wrap' }}>
                <button onClick={() => chordproInputRef.current?.click()} style={s.btnPri}>📂 .chordpro importieren</button>
                <button onClick={() => { setBearbeiteText(true); setTab('text') }} style={s.btnSek}>✏️ Manuell eingeben</button>
              </div>
            </div>
          ) : <div style={s.leer}>Keine Akkorde vorhanden.</div>
        )}
      </div>
    )
    if (id === 'noten') return (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {xmlDateien.map(d => <VerovioViewer key={d.id} datei={d} kannLoeschen={kannBearbeiten} onLoeschen={() => dateiLoeschen(d.id, d.bucket_pfad)} />)}
        {notenDateien.map(d => <PdfCard key={d.id} datei={d} kannLoeschen={kannBearbeiten} onLoeschen={() => dateiLoeschen(d.id, d.bucket_pfad)} />)}
      </div>
    )
    if (id === 'audio') return (
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {audioDateien.map(d => <AudioPlayer key={d.id} datei={d} kannLoeschen={kannBearbeiten} onLoeschen={() => dateiLoeschen(d.id, d.bucket_pfad)} />)}
      </div>
    )
    if (id === 'youtube') return (
      <div>
        {stueck.youtube_url && !youtubeEdit ? (
          <>
            <div style={{ position:'relative', paddingBottom:'56.25%', height:0, overflow:'hidden', borderRadius:'var(--radius)', background:'#000' }}>
              <iframe style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', border:'none' }} src={`https://www.youtube.com/embed/${youtubeId(stueck.youtube_url)}`} title="YouTube" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            <div style={{ marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center' }}>
              <a href={stueck.youtube_url} target="_blank" rel="noreferrer" style={{ fontSize:13, color:'var(--accent)', textDecoration:'none', fontWeight:600 }}>{T('piece_open_youtube')}</a>
              {kannBearbeiten && <button onClick={() => { setYoutubeInput(stueck.youtube_url ?? ''); setYoutubeEdit(true) }} style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>✎ {T('link_change')}</button>}
            </div>
          </>
        ) : kannBearbeiten ? (
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <p style={{ margin:0, fontSize:14, color:'var(--text-2)' }}>{stueck.youtube_url ? T('piece_youtube_link_edit') : T('piece_youtube_link_add')}</p>
            <input type="url" value={youtubeInput} onChange={e => setYoutubeInput(e.target.value)} placeholder="https://youtube.com/watch?v=..." style={{ padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', outline:'none', width:'100%', boxSizing:'border-box' }} />
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              {stueck.youtube_url && <button onClick={() => { setYoutubeInput(''); youtubeSpeichern() }} style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>🗑 {T('remove')}</button>}
              <button onClick={() => setYoutubeEdit(false)} style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{T('cancel')}</button>
              <button onClick={youtubeSpeichern} disabled={!youtubeInput.trim()} style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💾 {T('save')}</button>
            </div>
          </div>
        ) : <div style={s.leer}>{T('piece_no_video')}</div>}
      </div>
    )
    if (id === 'ytmusic') return (
      <div>
        {stueck.youtube_music_url && !ytMusicEdit ? (
          <>
            <div style={{ position:'relative', paddingBottom:'56.25%', height:0, overflow:'hidden', borderRadius:'var(--radius)', background:'#000' }}>
              <iframe style={{ position:'absolute', top:0, left:0, width:'100%', height:'100%', border:'none' }} src={`https://www.youtube.com/embed/${youtubeId(stueck.youtube_music_url)}`} title="YouTube Music" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
            </div>
            <div style={{ marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
              <a href={stueck.youtube_music_url} target="_blank" rel="noreferrer" style={{ fontSize:13, color:'#FF0000', textDecoration:'none', fontWeight:600 }}>{T('piece_open_ytmusic')}</a>
              {kannBearbeiten && (
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => { setYtMusicInput(stueck.youtube_music_url ?? ''); setYtMusicEdit(true) }} style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>✎ {T('link_change')}</button>
                  <button onClick={() => { setYtMusicInput(''); ytMusicSpeichern() }} style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>🗑</button>
                </div>
              )}
            </div>
          </>
        ) : kannBearbeiten ? (
          <div style={{ display:'flex', flexDirection:'column', gap:16, alignItems:'center', padding:32 }}>
            <p style={{ margin:0, fontSize:14, color:'var(--text-3)' }}>{T('piece_no_ytmusic')}</p>
            <div style={{ display:'flex', gap:10, flexWrap:'wrap', justifyContent:'center' }}>
              <button onClick={() => setYtMusicModal(true)}
                style={{ padding:'10px 24px', borderRadius:'var(--radius)', border:'none', background:'#FF0000', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {T('piece_ytmusic_search')}
              </button>
              <button onClick={() => { setYtMusicInput(''); setYtMusicEdit(true) }}
                style={{ padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>
                {T('piece_ytmusic_link_direct')}
              </button>
            </div>
            {ytMusicEdit && (
              <div style={{ display:'flex', flexDirection:'column', gap:8, width:'100%' }}>
                <input type="url" value={ytMusicInput} onChange={e => setYtMusicInput(e.target.value)}
                  placeholder="https://music.youtube.com/watch?v=..."
                  style={{ padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', outline:'none', width:'100%', boxSizing:'border-box' }} autoFocus />
                <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
                  <button onClick={() => setYtMusicEdit(false)} style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>{T('cancel')}</button>
                  <button onClick={ytMusicSpeichern} disabled={!ytMusicInput.trim()} style={{ padding:'8px 14px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>💾 {T('save')}</button>
                </div>
              </div>
            )}
          </div>
        ) : <div style={s.leer}>{T('piece_no_ytmusic')}</div>}
        {ytMusicModal && <YtMusicModal titelVorschlag={stueck.titel + (stueck.komponist ? ' ' + stueck.komponist : '')} onUebernehmen={url => { setYtMusicInput(url); ytMusicSpeichernDirekt(url) }} onSchliessen={() => setYtMusicModal(false)} />}
      </div>
    )
    if (id === 'spotify') return (
      <div>
        {stueck.spotify_url ? (
          <>
            <iframe src={`https://open.spotify.com/embed/track/${spotifyTrackId(stueck.spotify_url)}?utm_source=generator`} width="100%" height="152" frameBorder="0" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture" loading="lazy" style={{ borderRadius:12, display:'block' }} />
            <div style={{ marginTop:12, display:'flex', justifyContent:'space-between', alignItems:'center', flexWrap:'wrap', gap:8 }}>
              <a href={stueck.spotify_url} target="_blank" rel="noreferrer" style={{ fontSize:13, color:'#1DB954', textDecoration:'none', fontWeight:600 }}>{T('piece_open_spotify')}</a>
              {kannBearbeiten && (
                <div style={{ display:'flex', gap:8 }}>
                  <button onClick={() => setSpotifyModal(true)} style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'1.5px solid #1DB954', background:'transparent', color:'#1DB954', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>{T('piece_spotify_change')}</button>
                  <button onClick={() => spotifySpeichern('')} style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:13, cursor:'pointer', fontFamily:'inherit', fontWeight:600 }}>🗑</button>
                </div>
              )}
            </div>
          </>
        ) : kannBearbeiten ? (
          <div style={{ textAlign:'center', padding:32 }}>
            <p style={{ color:'var(--text-3)', marginBottom:16, fontSize:14 }}>{T('piece_no_spotify')}</p>
            <button onClick={() => setSpotifyModal(true)} style={{ padding:'10px 24px', borderRadius:'var(--radius)', border:'none', background:'#1DB954', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>{T('piece_spotify_search_btn')}</button>
          </div>
        ) : <div style={s.leer}>{T('piece_no_spotify')}</div>}
        {spotifyModal && <SpotifyModal titelVorschlag={stueck.titel} onUebernehmen={url => spotifySpeichern(url)} onSchliessen={() => setSpotifyModal(false)} />}
      </div>
    )
    if (id === 'dateien') return (
      <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
        {dokumente.length === 0 ? <div style={s.leer}>{T('piece_no_general_files')}</div> : dokumente.map(d => (
          <div key={d.id} style={{ display:'flex', alignItems:'center', gap:12, padding:'14px 16px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)' }}>
            <span style={{ fontSize:24, flexShrink:0 }}>{dateiIcon(d.name)}</span>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ fontWeight:700, fontSize:14, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{d.name}</div>
            </div>
            <div style={{ display:'flex', gap:6, flexShrink:0 }}>
              <OeffnenButton pfad={d.bucket_pfad} />
              <DownloadButton datei={d} label="⬇" />
              {kannBearbeiten && <button onClick={() => dateiLoeschen(d.id, d.bucket_pfad)} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--danger)', padding:4 }}>🗑</button>}
            </div>
          </div>
        ))}
      </div>
    )
    return null
  }

  return (
    <div>
      <button onClick={() => navigate(backPfad)}
        style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 14px' }}>
        ← {T('repertoire_title')}
      </button>

      {/* Header */}
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding: mob ? '16px' : '24px', border:'1px solid var(--border)', marginBottom:20, boxShadow:'var(--shadow)' }}>
        {bearbeiteMeta ? (
          <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
            {/* MusicBrainz Metadaten-Suche */}
            <div>
              <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                <span style={{ fontSize:12, color:'var(--text-3)', fontWeight:600 }}>🎵 MusicBrainz</span>
                <button onClick={mbSuchen} disabled={!metaForm.titel.trim() || mbLaden}
                  style={{ ...s.btnSek, fontSize:12, padding:'4px 12px', opacity: !metaForm.titel.trim() ? 0.45 : 1 }}>
                  {mbLaden ? '…' : T('piece_mb_search')}
                </button>
                {mbErgebnisse.length > 0 && (
                  <button onClick={() => setMbErgebnisse([])}
                    style={{ background:'none', border:'none', fontSize:13, color:'var(--text-3)', cursor:'pointer', padding:'2px 6px' }}>✕</button>
                )}
              </div>
              {mbErgebnisse.length > 0 && (
                <div style={{ marginTop:8, display:'flex', flexDirection:'column', gap:0, background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', overflow:'hidden' }}>
                  {mbErgebnisse.map((t, i) => (
                    <button key={i} onClick={() => mbUebernehmen(t)}
                      style={{ display:'flex', alignItems:'center', gap:10, padding:'9px 14px', background:'none', border:'none', borderBottom: i < mbErgebnisse.length-1 ? '1px solid var(--border)' : 'none', cursor:'pointer', textAlign:'left', fontFamily:'inherit' }}>
                      <div style={{ flex:1, minWidth:0 }}>
                        <div style={{ fontWeight:700, fontSize:13, color:'var(--text)', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{t.titel}</div>
                        <div style={{ fontSize:12, color:'var(--text-3)' }}>{[t.komponist, t.tonart].filter(Boolean).join(' · ') || '—'}</div>
                      </div>
                      <span style={{ fontSize:11, color:'var(--accent)', flexShrink:0 }}>↙ {T('apply')}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>

            <div style={{ display:'grid', gridTemplateColumns: mob ? '1fr' : '1fr 1fr', gap:10 }}>
              {[
                { key:'titel',     label:`${T('piece_title_label')} *`, placeholder:'z.B. Ave Maria' },
                { key:'komponist', label:T('piece_composer'),            placeholder:'z.B. Schubert' },
                { key:'tonart',    label:T('piece_key'),                 placeholder:'z.B. F-Dur' },
                { key:'tempo',     label:T('piece_tempo'),               placeholder:'z.B. Andante / 80 BPM' },
              ].map(f => (
                <div key={f.key} style={{ display:'flex', flexDirection:'column', gap:5, gridColumn: f.key==='titel' ? 'span 2' : 'span 1' }}>
                  <label style={s.label}>{f.label}</label>
                  {f.key === 'tempo' ? (
                    <div style={{ display:'flex', gap:6 }}>
                      <input style={{ ...s.input, flex:1 }} placeholder={f.placeholder} value={metaForm[f.key]}
                        onChange={e => setMetaForm(p => ({ ...p, [f.key]: e.target.value }))}
                        onKeyDown={e => { if (e.key === 'Enter') metaSpeichern(); if (e.key === 'Escape') setBearbeiteMeta(false) }} />
                      <button onPointerDown={e => e.preventDefault()} onClick={() => {
                        const now = Date.now()
                        tapZeitenEditRef.current = [...tapZeitenEditRef.current.filter(t => now - t < 3000), now]
                        const arr = tapZeitenEditRef.current
                        if (arr.length >= 2) {
                          const gaps = arr.slice(1).map((t, i) => t - arr[i])
                          const avg = gaps.reduce((a, b) => a + b) / gaps.length
                          const b = Math.round(60000 / avg)
                          if (b >= 20 && b <= 300) setMetaForm(p => ({ ...p, tempo: String(b) }))
                        }
                      }} style={{ padding:'10px 12px', minHeight:44, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', flexShrink:0, userSelect:'none', whiteSpace:'nowrap' }}>
                        TAP
                      </button>
                    </div>
                  ) : (
                    <input style={s.input} placeholder={f.placeholder} value={metaForm[f.key]}
                      onChange={e => setMetaForm(p => ({ ...p, [f.key]: e.target.value }))}
                      onKeyDown={e => { if (e.key === 'Enter') metaSpeichern(); if (e.key === 'Escape') setBearbeiteMeta(false) }} />
                  )}
                </div>
              ))}
              <div style={{ display:'flex', flexDirection:'column', gap:5 }}>
                <label style={s.label}>{T('piece_taktart')}</label>
                <select style={s.input} value={metaForm.takt} onChange={e => setMetaForm(p => ({ ...p, takt: e.target.value }))}>
                  <option value="">{T('piece_taktart_none')}</option>
                  <optgroup label={T('takt_even')}>
                    <option value="4/4">4/4</option>
                    <option value="2/4">2/4</option>
                    <option value="2/2">2/2 (alla breve)</option>
                  </optgroup>
                  <optgroup label={T('takt_triple')}>
                    <option value="3/4">3/4</option>
                    <option value="3/8">3/8</option>
                  </optgroup>
                  <optgroup label={T('takt_compound')}>
                    <option value="6/8">6/8</option>
                    <option value="6/4">6/4</option>
                    <option value="9/8">9/8</option>
                    <option value="12/8">12/8</option>
                  </optgroup>
                  <optgroup label={T('takt_irregular')}>
                    <option value="5/4">5/4</option>
                    <option value="5/8">5/8</option>
                    <option value="7/8">7/8</option>
                    <option value="7/4">7/4</option>
                    <option value="10/8">10/8</option>
                    <option value="11/8">11/8</option>
                  </optgroup>
                </select>
              </div>
              <div style={{ display:'flex', flexDirection:'column', gap:5, gridColumn: mob ? 'span 1' : 'span 2' }}>
                <label style={s.label}>{T('piece_anmerkungen')}</label>
                <textarea style={{ ...s.input, minHeight:72, resize:'vertical' }} placeholder={T('piece_anmerkungen_placeholder')}
                  value={metaForm.anmerkungen}
                  onChange={e => setMetaForm(p => ({ ...p, anmerkungen: e.target.value }))} />
              </div>
            </div>
            <div style={{ display:'flex', gap:8, justifyContent:'flex-end' }}>
              <button onClick={() => setBearbeiteMeta(false)} style={s.btnSek}>{T('cancel')}</button>
              <button onClick={metaSpeichern} style={s.btnPri}>💾 {T('save')}</button>
            </div>
          </div>
        ) : (
          <div>
            <h1 style={{ margin:'0 0 8px', fontSize: mob ? 19 : 22, fontWeight:800, color:'var(--text)', letterSpacing:'-0.4px', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stueck.titel}</h1>

            <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:13, color:'var(--text-2)', alignItems:'center' }}>
              {stueck.komponist && <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>🎼 <span>{stueck.komponist}</span></span>}
              {stueck.tonart    && <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}>🎵 <span>{stueck.tonart}</span></span>}
              {stueck.takt      && <span style={{ display:'inline-flex', alignItems:'center', gap:4 }}><span style={{ fontSize:10, color:'var(--text-3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{T('piece_takt')}</span><span style={{ fontWeight:700, fontVariantNumeric:'tabular-nums' }}>{stueck.takt}</span></span>}
              {stueck.tempo     && <span>♩ {stueck.tempo}</span>}
              <button onClick={() => setMetronomOffen(o => !o)}
                style={{ padding:'2px 10px', borderRadius:99, border:'1.5px solid var(--border)', background: metronomOffen ? 'var(--primary)' : 'var(--bg-2)', color: metronomOffen ? 'var(--primary-fg)' : 'var(--text-3)', fontSize:11, fontWeight:700, cursor:'pointer', fontFamily:'inherit', lineHeight:'22px' }}>
                {T('piece_metronom')}
              </button>
            </div>

            {stueck.anmerkungen && (
              <div style={{ marginTop:8, fontSize:13, color:'var(--text-2)', background:'var(--bg)', borderRadius:'var(--radius)', padding:'8px 12px', borderLeft:'3px solid var(--border)', whiteSpace:'pre-wrap' }}>
                {stueck.anmerkungen}
              </div>
            )}

            <div style={{ display:'flex', gap:6, marginTop:12, flexWrap:'wrap' }}>
              {['alle','sopran','alt','tenor','bass'].map(st => (
                <button key={st} onClick={() => setFilterStimme(st)}
                  style={{ padding:'4px 12px', borderRadius:99, border:'1.5px solid var(--border)', background: filterStimme===st ? 'var(--primary)' : 'var(--bg-2)', color: filterStimme===st ? 'var(--primary-fg)' : 'var(--text-3)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', textTransform:'capitalize' }}>
                  {st === 'alle' ? T('piece_voice_all') : st === 'sopran' ? T('piece_voice_soprano') : st === 'alt' ? T('piece_voice_alto') : st === 'tenor' ? T('piece_voice_tenor') : T('piece_voice_bass')}
                </button>
              ))}
            </div>

            {kannBearbeiten && (
              <>
                <div style={{ borderTop:'1px solid var(--border)', margin:'14px 0 12px' }} />
                <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
                  <button onClick={metaBearbeitenStarten}
                    style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    ✏️ {T('edit')}
                  </button>
                  <button onClick={() => setModal('upload')}
                    style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit' }}>
                    ⬆ {T('upload')}
                  </button>
                  <button onClick={stueckLoeschen}
                    style={{ display:'inline-flex', alignItems:'center', gap:6, padding:'7px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:13, fontWeight:600, cursor:'pointer', fontFamily:'inherit', marginLeft:'auto' }}>
                    🗑 {T('delete')}
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {metronomOffen && !bearbeiteMeta && (
          <Metronom
            initialBpm={stueck.tempo}
            onTempoSave={kannBearbeiten ? tempoSpeichernVonMetronom : null}
          />
        )}
      </div>

      {/* Tabs / Akkordeon */}
      {tabs.length > 0 && (mob ? (
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:24 }}>
          {tabs.map(t => (
            <div key={t.id} style={{ borderRadius:'var(--radius)', border:`1.5px solid ${tab===t.id ? 'var(--primary)' : 'var(--border)'}`, overflow:'hidden', background:'var(--surface)' }}>
              <button
                onClick={() => setTab(tab === t.id ? '' : t.id)}
                style={{ width:'100%', display:'flex', alignItems:'center', justifyContent:'space-between', padding:'13px 16px', background: tab===t.id ? 'color-mix(in srgb, var(--primary) 8%, var(--surface))' : 'none', border:'none', cursor:'pointer', fontFamily:'inherit', textAlign:'left' }}>
                <span style={{ fontWeight: tab===t.id ? 800 : 600, fontSize:15, color: tab===t.id ? 'var(--primary)' : 'var(--text)' }}>{t.label}</span>
                <span style={{ fontSize:12, color:'var(--text-3)', transform: tab===t.id ? 'rotate(180deg)' : 'none', transition:'transform 0.2s', display:'inline-block' }}>▼</span>
              </button>
              {tab === t.id && (
                <div style={{ padding:16, borderTop:'1px solid var(--border)' }}>
                  {tabInhalt(t.id)}
                </div>
              )}
            </div>
          ))}
        </div>
      ) : (
        <>
          <div style={{ display:'flex', gap:0, marginBottom:0, borderBottom:'2px solid var(--border)' }}>
            {tabs.map(t => (
              <button key={t.id} onClick={() => setTab(t.id)}
                style={{ padding:'10px 18px', background:'none', border:'none', fontSize:14, cursor:'pointer', fontFamily:'inherit', color: tab===t.id ? 'var(--text)' : 'var(--text-3)', fontWeight: tab===t.id ? 800 : 500, borderBottom:`2px solid ${tab===t.id ? 'var(--primary)' : 'transparent'}`, marginBottom:-2, whiteSpace:'nowrap' }}>
                {t.label}
              </button>
            ))}
          </div>
          <div style={{ background:'var(--surface)', borderRadius:'0 0 var(--radius-lg) var(--radius-lg)', padding:padContent, border:'1px solid var(--border)', borderTop:'none', boxShadow:'var(--shadow)', marginBottom:24 }}>
            {tabInhalt(tab)}
          </div>
        </>
      ))}

      {modal === 'upload' && (
        <DateiUploadModal stueckId={stueckId} onClose={() => setModal(null)} onErfolg={ladeData} />
      )}

      {/* PDF Export Modal */}
      {pdfModal && createPortal(
        <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', zIndex:2000, display:'flex', alignItems:'center', justifyContent:'center', padding:16 }}
          onClick={e => { if (e.target === e.currentTarget) setPdfModal(false) }}>
          <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:28, width:'100%', maxWidth:380, boxShadow:'var(--shadow-lg)' }}>
            <div style={{ fontWeight:800, fontSize:16, marginBottom:16 }}>{T('piece_pdf_export')}</div>
            <div style={{ fontSize:14, color:'var(--text-2)', marginBottom:16 }}>
              <strong style={{ color:'var(--text)' }}>{stueck?.titel}</strong>
              {stueck?.komponist && <span style={{ color:'var(--text-3)' }}> · {stueck.komponist}</span>}
            </div>
            {schule?.logo_url ? (
              <div style={{ display:'flex', alignItems:'center', gap:12, background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:20 }}>
                <img src={schule.logo_url} alt="Logo" style={{ maxHeight:36, maxWidth:100, objectFit:'contain' }}
                  onError={e => { e.target.style.display='none' }} />
                <span style={{ fontSize:12, color:'var(--text-3)' }}>{T('piece_pdf_logo_hint')}</span>
              </div>
            ) : (
              <div style={{ fontSize:12, color:'var(--text-3)', marginBottom:20, padding:'10px 14px', background:'var(--bg-2)', borderRadius:'var(--radius)' }}>
                {T('piece_pdf_no_logo')}
              </div>
            )}
            <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
              <button onClick={() => setPdfModal(false)} style={s.btnSek}>{T('cancel')}</button>
              <button onClick={() => { setPdfModal(false); liedtextAlsPdf() }} style={s.btnPri}>{T('piece_pdf_print')}</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Vollbild Modus */}
      {vollbild && stueck?.liedtext && createPortal(
        <div style={{ position:'fixed', inset:0, background:'#111', zIndex:2000, display:'flex', flexDirection:'column' }}>
          <div style={{ display:'flex', alignItems:'center', gap:10, padding:'12px 16px', background:'rgba(255,255,255,0.06)', flexShrink:0, borderBottom:'1px solid rgba(255,255,255,0.1)' }}>
            <div style={{ flex:1, minWidth:0 }}>
              <div style={{ color:'#fff', fontWeight:800, fontSize:15, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{stueck.titel}</div>
              {stueck.komponist && <div style={{ color:'rgba(255,255,255,0.4)', fontSize:12 }}>{stueck.komponist}</div>}
            </div>
            <div style={{ display:'flex', alignItems:'center', gap:8, flexShrink:0 }}>
              <button onClick={() => setVollbild(false)}
                style={{ background:'rgba(255,255,255,0.15)', border:'none', color:'#fff', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', padding:'8px 16px', borderRadius:8, flexShrink:0 }}>
                ✕ {T('close')}
              </button>
            </div>
          </div>
          <div style={{ flex:1, overflowY:'auto', padding: mob ? '24px 16px' : '40px 10vw', WebkitOverflowScrolling:'touch' }}>
            {stueck.liedtext_md !== false
              ? <div dangerouslySetInnerHTML={{ __html: safeMarkdown(stueck.liedtext) }}
                  style={{ fontFamily:'Georgia, serif', fontSize:textGroesse, lineHeight:1.9, color:'#fff', margin:'0 auto', maxWidth:700, transition:'font-size 0.15s', wordBreak:'break-word' }} />
              : <pre style={{ fontFamily:'Georgia, serif', fontSize:textGroesse, lineHeight:1.9, color:'#fff', whiteSpace:'pre-wrap', margin:'0 auto', maxWidth:700, transition:'font-size 0.15s', wordBreak:'break-word' }}>{stueck.liedtext}</pre>
            }
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
        </div>,
        document.body
      )}
    </div>
  )
}
