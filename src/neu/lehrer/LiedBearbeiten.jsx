import { useRef, useState, lazy, Suspense } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Check, Mic, Camera, Search, FileUp, Upload, Trash2, FileText, Music, FileMusic, Paperclip } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { safeMarkdown } from '../../lib/markdown'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Trenner, Zeile, Feld, Knopf, Segment, SchalterZeile, Leer, Laden, eingabeStil } from '../../ui'
import ChordPro from '../../components/stueck/ChordProRenderer'
import DateiUploadModal from '../../components/stueck/DateiUploadModal'
import { useNeuLaden } from '../daten'

const AudioTranskribierenModal = lazy(() => import('../../components/AudioTranskribierenModal'))
const FotoOCRModal             = lazy(() => import('../../components/FotoOCRModal'))

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL
const HEADERS = {
  'Authorization': `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
  'apikey': import.meta.env.VITE_SUPABASE_ANON_KEY,
  'Content-Type': 'application/json',
}

const TAKTE = [
  ['takt_even', ['4/4', '2/4', '2/2']],
  ['takt_triple', ['3/4', '3/8']],
  ['takt_compound', ['6/8', '6/4', '9/8', '12/8']],
  ['takt_irregular', ['5/4', '5/8', '7/8', '7/4', '10/8', '11/8']],
]
const DATEI_ICON = { noten: FileText, musicxml: FileMusic, audio: Music, akkorde: FileText }

export default function LiedBearbeiten() {
  const { stueckId } = useParams()
  const { T } = useApp()
  const { data, isLoading, refetch } = useQuery({
    queryKey: ['nl-lied-bearbeiten', stueckId],
    queryFn: async () => {
      const [st, d] = await Promise.all([
        supabase.from('stuecke').select('*').eq('id', stueckId).single(),
        supabase.from('stueck_dateien').select('*').eq('stueck_id', stueckId).order('hochgeladen_am'),
      ])
      if (st.error) throw st.error
      return { stueck: st.data, dateien: d.data ?? [] }
    },
  })
  const zurueck = { to: '/lehrer/repertoire', label: T('n_tab_lieder') }

  if (isLoading) return <Seite zurueck={zurueck}><div style={{ marginTop: 24 }}><Laden hoehe={320} /></div></Seite>
  if (!data) return <Seite zurueck={zurueck}><div style={{ marginTop: 24 }}><Leer text={T('piece_not_found')} /></div></Seite>
  return <Formular key={data.stueck.id} stueck={data.stueck} dateien={data.dateien} neuLadenDateien={refetch} />
}

function Formular({ stueck, dateien, neuLadenDateien }) {
  const navigate = useNavigate()
  const { state } = useLocation()
  const { T, toast, confirm } = useApp()
  const neuLaden = useNeuLaden()
  const [form, setForm] = useState({
    titel: stueck.titel ?? '', komponist: stueck.komponist ?? '', tonart: stueck.tonart ?? '', tempo: stueck.tempo ?? '',
    takt: stueck.takt ?? '', anmerkungen: stueck.anmerkungen ?? '',
    liedtext: stueck.liedtext ?? '', liedtext_md: stueck.liedtext_md !== false, notizen: stueck.notizen ?? '',
    youtube_url: stueck.youtube_url ?? '', youtube_music_url: stueck.youtube_music_url ?? '', spotify_url: stueck.spotify_url ?? '',
  })
  const [textAnsicht, setTextAnsicht] = useState('bearbeiten')
  const [sendet, setSendet] = useState(false)
  const [kiModal, setKiModal] = useState(null)        // 'audio' | 'foto'
  const [upload, setUpload] = useState(false)
  const [lyrics, setLyrics] = useState({ laden: false, treffer: null })
  const tapRef = useRef([])
  const chordproRef = useRef(null)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const lied = `/lehrer/repertoire/${stueck.id}`
  const fertig = () => state?.vonLied ? navigate(-1) : navigate(lied, { replace: true })

  function tap() {
    const jetzt = Date.now()
    tapRef.current = [...tapRef.current.filter(t => jetzt - t < 3000), jetzt]
    const z = tapRef.current
    if (z.length < 2) return
    const schnitt = (z[z.length - 1] - z[0]) / (z.length - 1)
    const bpm = Math.round(60000 / schnitt)
    if (bpm >= 20 && bpm <= 300) setze('tempo', String(bpm))
  }

  function textAnhaengen(neu) {
    setForm(f => ({ ...f, liedtext: f.liedtext ? f.liedtext + '\n\n' + neu : neu }))
    setTextAnsicht('bearbeiten')
  }

  async function lyricsHolen() {
    setLyrics({ laden: true, treffer: null })
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/lyrics-suche`, {
        method: 'POST', headers: HEADERS,
        body: JSON.stringify({ youtube_url: form.youtube_music_url || form.youtube_url || undefined, titel: form.titel, komponist: form.komponist || undefined }),
      })
      const d = await res.json()
      if (d.error) { toast(d.error, 'error'); setLyrics({ laden: false, treffer: null }); return }
      setLyrics({ laden: false, treffer: d })
    } catch {
      toast(T('conn_error'), 'error')
      setLyrics({ laden: false, treffer: null })
    }
  }

  async function chordproImportieren(e) {
    const datei = e.target.files?.[0]
    e.target.value = ''
    if (datei) setze('notizen', await datei.text())
  }

  async function speichern() {
    if (!form.titel.trim()) { toast(T('title_required'), 'error'); return }
    setSendet(true)
    const leer = v => v.trim() || null
    const { error } = await supabase.from('stuecke').update({
      titel: form.titel.trim(), komponist: leer(form.komponist), tonart: leer(form.tonart), tempo: leer(form.tempo),
      takt: form.takt || null, anmerkungen: leer(form.anmerkungen),
      liedtext: form.liedtext, liedtext_md: form.liedtext_md, notizen: form.notizen,
      youtube_url: leer(form.youtube_url), youtube_music_url: leer(form.youtube_music_url), spotify_url: leer(form.spotify_url),
    }).eq('id', stueck.id)
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    neuLaden('n-lied', 'nl-lieder', 'n-lieder', 'repertoire')
    toast(T('nl_gespeichert'), 'success')
    fertig()
  }

  async function dateiLoeschen(d) {
    if (!await confirm(T('file_delete_confirm'), { sub: d.name, confirmLabel: T('delete') })) return
    await supabase.storage.from('stueck-dateien').remove([d.bucket_pfad])
    const { error } = await supabase.from('stueck_dateien').delete().eq('id', d.id)
    if (error) { toast(error.message, 'error'); return }
    neuLadenDateien()
    neuLaden('n-lied')
  }

  async function liedLoeschen() {
    if (!await confirm(T('piece_delete_confirm').replace('{titel}', stueck.titel), { sub: T('piece_delete_sub'), confirmLabel: T('delete') })) return
    const pfade = dateien.map(d => d.bucket_pfad)
    if (pfade.length) await supabase.storage.from('stueck-dateien').remove(pfade)
    const { error } = await supabase.from('stuecke').delete().eq('id', stueck.id)
    if (error) { toast(error.message, 'error'); return }
    neuLaden('nl-lieder', 'n-lieder', 'repertoire')
    navigate('/lehrer/repertoire', { replace: true })
  }

  const textFeld = { ...eingabeStil, resize: 'vertical', lineHeight: 1.6 }

  return (
    <Seite zurueck={{ onClick: fertig, label: stueck.titel }} titel={T('nl_lied_bearbeiten')}>
      <Abschnitt titel={T('nl_angaben')} style={{ marginTop: 24 }}>
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Feld label={T('piece_title_label')}>
            <input value={form.titel} onChange={e => setze('titel', e.target.value)} style={eingabeStil} />
          </Feld>
          <Feld label={T('piece_composer')}>
            <input value={form.komponist} onChange={e => setze('komponist', e.target.value)} style={eingabeStil} />
          </Feld>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 140px' }}>
              <Feld label={T('piece_key')}>
                <input value={form.tonart} onChange={e => setze('tonart', e.target.value)} placeholder="F-Dur" style={eingabeStil} />
              </Feld>
            </div>
            <div style={{ flex: '1 1 140px' }}>
              <Feld label={T('piece_taktart')}>
                <select value={form.takt} onChange={e => setze('takt', e.target.value)} style={eingabeStil}>
                  <option value="">{T('piece_taktart_none')}</option>
                  {TAKTE.map(([gruppe, takte]) => (
                    <optgroup key={gruppe} label={T(gruppe)}>{takte.map(t => <option key={t} value={t}>{t}</option>)}</optgroup>
                  ))}
                </select>
              </Feld>
            </div>
          </div>
          <Feld label={T('piece_tempo')} hinweis={T('nl_tempo_tippen_hinweis')}>
            <div style={{ display: 'flex', gap: 10 }}>
              <input value={form.tempo} onChange={e => setze('tempo', e.target.value)} placeholder="Andante / 80" style={{ ...eingabeStil, flex: 1, minWidth: 0 }} />
              <Knopf type="button" variante="sekundaer" onPointerDown={e => e.preventDefault()} onClick={tap} style={{ flexShrink: 0 }}>{T('nl_tempo_tippen')}</Knopf>
            </div>
          </Feld>
          <Feld label={T('piece_anmerkungen')}>
            <textarea rows={2} value={form.anmerkungen} onChange={e => setze('anmerkungen', e.target.value)} placeholder={T('piece_anmerkungen_placeholder')} style={textFeld} />
          </Feld>
        </div>
      </Abschnitt>

      <Abschnitt titel={T('piece_lyrics')}>
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Segment label={T('piece_lyrics')} wert={textAnsicht} onChange={setTextAnsicht}
            optionen={[['bearbeiten', T('piece_edit')], ['vorschau', T('piece_preview')]]} />
          {textAnsicht === 'vorschau' ? (
            form.liedtext_md
              ? <div className="n-lied-text" dangerouslySetInnerHTML={{ __html: safeMarkdown(form.liedtext || T('piece_lyrics_empty_md')) }} style={{ minHeight: 200, fontSize: 18, lineHeight: 1.7 }} />
              : <pre style={{ margin: 0, minHeight: 200, whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 18, lineHeight: 1.7 }}>{form.liedtext}</pre>
          ) : (
            <textarea aria-label={T('piece_lyrics')} rows={12} value={form.liedtext} onChange={e => setze('liedtext', e.target.value)}
              placeholder={T('piece_lyrics_placeholder')} style={{ ...textFeld, fontSize: 17 }} />
          )}
        </div>
        <Gruppe style={{ marginTop: 14 }}>
          <SchalterZeile titel={T('nl_formatierung')} untertitel={T('nl_formatierung_hinweis')} an={form.liedtext_md} onChange={v => setze('liedtext_md', v)} />
        </Gruppe>

        {lyrics.treffer && (
          <div style={{ margin: '14px 20px 0', padding: 16, borderRadius: 18, background: 'var(--n-fill)' }}>
            <div style={{ fontSize: 17, fontWeight: 700 }}>{lyrics.treffer.titel}</div>
            <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{[lyrics.treffer.artist, lyrics.treffer.quelle].filter(Boolean).join(' · ')}</div>
            <pre style={{ margin: '10px 0 0', maxHeight: 220, overflowY: 'auto', whiteSpace: 'pre-wrap', fontFamily: 'inherit', fontSize: 16, lineHeight: 1.6 }}>{lyrics.treffer.lyrics}</pre>
            <div style={{ marginTop: 12, display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <Knopf klein onClick={() => { textAnhaengen(lyrics.treffer.lyrics); setLyrics({ laden: false, treffer: null }) }}>{T('apply')}</Knopf>
              <Knopf klein variante="rahmen" onClick={() => setLyrics({ laden: false, treffer: null })}>{T('discard')}</Knopf>
            </div>
          </div>
        )}

        <div style={{ margin: '22px 20px 10px', fontSize: 15, fontWeight: 600, color: 'var(--text-2)' }}>{T('import_text_title')}</div>
        <Gruppe>
          <Zeile icon={Search} titel={T('import_lyrics')} chevron={false} onClick={lyricsHolen}
            untertitel={lyrics.laden ? T('import_loading') : form.youtube_music_url ? T('import_lyrics_src_ytmusic') : form.youtube_url ? T('import_lyrics_src_youtube') : `${T('import_lyrics_src_search')} ${form.titel}`} />
          <Trenner />
          <Zeile icon={Mic} titel={T('import_audio')} untertitel={T('import_audio_desc')} onClick={() => setKiModal('audio')} />
          <Trenner />
          <Zeile icon={Camera} titel={T('import_foto')} untertitel={T('import_foto_desc')} onClick={() => setKiModal('foto')} />
        </Gruppe>
      </Abschnitt>

      <Abschnitt titel={T('piece_chords')}>
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Feld label={T('nl_akkorde_chordpro')} hinweis={T('piece_chords_help')}>
            <textarea rows={8} value={form.notizen} onChange={e => setze('notizen', e.target.value)} placeholder="[Am]Hallo [C]Welt"
              style={{ ...textFeld, fontFamily: 'ui-monospace, monospace', fontSize: 16, lineHeight: 1.9 }} />
          </Feld>
          <div style={{ display: 'flex' }}>
            <Knopf klein variante="sekundaer" icon={FileUp} onClick={() => chordproRef.current?.click()}>{T('nl_chordpro_import')}</Knopf>
            <input ref={chordproRef} type="file" accept=".cho,.chopro,.chordpro,.txt" hidden onChange={chordproImportieren} />
          </div>
          {form.notizen.trim() && (
            <div style={{ padding: '14px 16px', borderRadius: 18, background: 'var(--n-fill)' }}>
              <div style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-2)', marginBottom: 6 }}>{T('piece_preview')}</div>
              <ChordPro text={form.notizen} />
            </div>
          )}
        </div>
      </Abschnitt>

      <Abschnitt titel={T('nl_links')}>
        <div style={{ padding: '0 20px', display: 'flex', flexDirection: 'column', gap: 16 }}>
          <Feld label="YouTube">
            <input type="url" inputMode="url" value={form.youtube_url} onChange={e => setze('youtube_url', e.target.value)} placeholder="https://youtube.com/watch?v=…" style={eingabeStil} />
          </Feld>
          <Feld label="YouTube Music">
            <input type="url" inputMode="url" value={form.youtube_music_url} onChange={e => setze('youtube_music_url', e.target.value)} placeholder="https://music.youtube.com/watch?v=…" style={eingabeStil} />
          </Feld>
          <Feld label="Spotify">
            <input type="url" inputMode="url" value={form.spotify_url} onChange={e => setze('spotify_url', e.target.value)} placeholder="https://open.spotify.com/track/…" style={eingabeStil} />
          </Feld>
        </div>
      </Abschnitt>

      <div style={{ margin: '28px 20px 0' }}>
        <Knopf voll icon={Check} onClick={speichern} disabled={sendet} style={{ height: 56, fontSize: 18 }}>{T('save')}</Knopf>
      </div>

      <Abschnitt titel={T('files')}>
        <div style={{ margin: '-4px 20px 12px', fontSize: 15, color: 'var(--text-2)' }}>{T('nl_dateien_sofort_hinweis')}</div>
        <Gruppe>
          {dateien.map(d => (
            <div key={d.id}>
              <div style={{ display: 'flex', alignItems: 'center' }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <Zeile icon={DATEI_ICON[d.typ] ?? Paperclip} titel={d.name} chevron={false}
                    untertitel={[T(`nl_dateityp_${d.typ}`), d.stimme && d.stimme !== 'keine' ? d.stimme : null].filter(Boolean).join(' · ')} />
                </div>
                <button onClick={() => dateiLoeschen(d)} aria-label={`${T('delete')}: ${d.name}`}
                  style={{ width: 44, height: 44, marginRight: 8, flexShrink: 0, borderRadius: 22, border: 'none', background: 'none', color: 'var(--danger)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Trash2 aria-hidden="true" size={20} />
                </button>
              </div>
              <Trenner />
            </div>
          ))}
          <Zeile icon={Upload} titel={T('nl_datei_hochladen')} untertitel={T('nl_datei_hochladen_hinweis')} onClick={() => setUpload(true)} />
        </Gruppe>
      </Abschnitt>

      <div style={{ margin: '40px 20px 0' }}>
        <Knopf voll variante="gefahr" icon={Trash2} onClick={liedLoeschen}>{T('nl_lied_loeschen')}</Knopf>
      </div>

      {upload && <DateiUploadModal stueckId={stueck.id} onClose={() => setUpload(false)} onErfolg={() => { neuLadenDateien(); neuLaden('n-lied') }} />}
      <Suspense fallback={null}>
        {kiModal === 'audio' && <AudioTranskribierenModal onErgebnis={textAnhaengen} onSchliessen={() => setKiModal(null)} />}
        {kiModal === 'foto' && <FotoOCRModal onErgebnis={textAnhaengen} onSchliessen={() => setKiModal(null)} />}
      </Suspense>
    </Seite>
  )
}
