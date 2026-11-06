import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams, useLocation } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { ChevronLeft, ChevronRight, Play, Pause, Pencil, Video, Music, Headphones, Minus, Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { safeMarkdown } from '../../lib/markdown'
import { transponiereText } from '../../lib/akkordeUtils'
import { useApp } from '../../context/AppContext'
import { NEU_THEME } from '../../themes/themes'
import { liedFarbe, Gruppe, Trenner } from '../../ui'
import ChordPro from '../../components/stueck/ChordProRenderer'
import ChordPlayer from '../../components/stueck/ChordPlayer'
import Metronom from '../../components/stueck/Metronom'
import AkkordDateiAnzeige from '../../components/stueck/AkkordDateiAnzeige'
import PdfCard from '../../components/stueck/PdfCard'
import VerovioViewer from '../../components/stueck/VerovioViewer'
import AudioPlayer from '../../components/stueck/AudioPlayer'
import EigeneDateienNeu from '../EigeneDateienNeu'
import { getSignedUrl, OeffnenButton, DownloadButton } from '../../components/stueck/FileButtons'
import { VorschlagModal } from '../../components/LiedVorschlaege'
import { useBasis } from '../rolle'
import { useNeuLaden } from '../daten'
import LiedAngaben from '../LiedAngaben'

const GROESSEN = [22, 27, 33]
const STIMMEN = [['sopran', 'piece_voice_soprano'], ['alt', 'piece_voice_alto'], ['tenor', 'piece_voice_tenor'], ['bass', 'piece_voice_bass']]

function zeitText(s) {
  if (!isFinite(s)) return '–:––'
  return `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`
}

export default function NeuLied() {
  const { stueckId } = useParams()
  const navigate = useNavigate()
  const location = useLocation()
  const { T, darkMode, rolle, toast } = useApp()
  const basis = useBasis()
  const lehrer = ['lehrer', 'admin', 'superadmin'].includes(rolle)
  const [tab, setTab] = useState(null)
  const [stufe, setStufe] = useState(() => {
    const s = parseInt(localStorage.getItem('staccato_lied_groesse') ?? '0', 10)
    return s >= 0 && s <= 2 ? s : 0
  })
  const [vorschlagOffen, setVorschlagOffen] = useState(false)
  const [halbtoene, setHalbtoene] = useState(0)
  const [metronomOffen, setMetronomOffen] = useState(false)
  const [stimme, setStimme] = useState('alle')
  const neuLaden = useNeuLaden()

  const { data, isLoading } = useQuery({
    queryKey: ['n-lied', stueckId],
    queryFn: async () => {
      const [st, d] = await Promise.all([
        supabase.from('stuecke').select('*').eq('id', stueckId).single(),
        supabase.from('stueck_dateien').select('*').eq('stueck_id', stueckId).order('hochgeladen_am'),
      ])
      if (st.error) throw st.error
      return { stueck: st.data, dateien: d.data ?? [] }
    },
  })

  useEffect(() => { localStorage.setItem('staccato_lied_groesse', String(stufe)) }, [stufe])
  useEffect(() => { setTab(null); setHalbtoene(0); setMetronomOffen(false); setStimme('alle') }, [stueckId])

  const farbe = liedFarbe(stueckId)
  // Lokale Variablen: wiederverwendete Bausteine (Akkorde) passen sich dem farbigen Grund an
  const aufFarbe = {
    '--text': '#FFFFFF', '--text-2': '#E8EEF2', '--text-3': '#E8EEF2', '--accent': '#FDBA74', '--primary': '#FDBA74',
    '--surface': 'rgba(255,255,255,0.10)', '--bg-2': 'rgba(255,255,255,0.10)', '--border': 'rgba(255,255,255,0.25)',
  }
  // Dateien-Bereich: zurück auf die normalen Farben des neuen Designs
  const { globalCss, ...normal } = darkMode ? NEU_THEME.dark : NEU_THEME.light

  const zurueck = () => (window.history.state?.idx > 0 ? navigate(-1) : navigate(`${basis}/repertoire`))

  if (isLoading) return <div style={{ minHeight: '100dvh', background: farbe }} aria-busy="true" />
  if (!data?.stueck) return (
    <div style={{ padding: 40, textAlign: 'center' }}>
      <p style={{ fontSize: 17 }}>{T('piece_not_found')}</p>
      <button onClick={zurueck} style={{ marginTop: 16, fontSize: 17, color: 'var(--primary)', background: 'none', border: 'none', cursor: 'pointer' }}>{T('n_tab_lieder')}</button>
    </div>
  )

  const { stueck, dateien } = data
  const akkordDateien = dateien.filter(d => d.typ === 'akkorde')
  const stimmen = STIMMEN.filter(([wert]) => dateien.some(d => d.stimme === wert))
  const passt = d => stimme === 'alle' || !d.stimme || d.stimme === 'keine' || d.stimme === stimme
  const noten  = dateien.filter(d => d.typ === 'noten' && passt(d))
  const xml    = dateien.filter(d => d.typ === 'musicxml' && passt(d))
  const audio  = dateien.filter(d => d.typ === 'audio' && passt(d))
  const sonst  = dateien.filter(d => d.typ === 'dokument' || d.typ === 'sonstiges' || d.typ === 'liedtext')

  const tabs = [
    stueck.liedtext && ['text', T('piece_lyrics')],
    (stueck.notizen || akkordDateien.length > 0) && ['akkorde', T('piece_chords')],
    ['dateien', T('n_dateien')],
  ].filter(Boolean)
  const aktiv = tab ?? tabs[0][0]

  // Vor/Zurück innerhalb der Liste, aus der man kam (Probe, Lieder-Liste)
  const liste = location.state?.liste ?? []
  const pos = liste.findIndex(l => l.id === stueckId)
  const vorher = pos > 0 ? liste[pos - 1] : null
  const nachher = pos >= 0 && pos < liste.length - 1 ? liste[pos + 1] : null
  const gehe = l => navigate(`${basis}/repertoire/${l.id}`, { state: location.state, replace: true })

  const anhoeren = [
    [stueck.youtube_url, Video, 'YouTube'],
    [stueck.youtube_music_url, Music, 'YouTube Music'],
    [stueck.spotify_url, Headphones, 'Spotify'],
  ].filter(([url]) => url)
  const hatLeiste = audio.length > 0 || vorher || nachher
  const akkordText = transponiereText(stueck.notizen ?? '', halbtoene)

  async function tempoSpeichern(bpm) {
    const { error } = await supabase.from('stuecke').update({ tempo: String(bpm) }).eq('id', stueckId)
    if (error) { toast(error.message, 'error'); return }
    neuLaden('n-lied')
  }

  return (
    <div style={{ minHeight: '100dvh', background: farbe, color: '#FFFFFF', paddingBottom: hatLeiste ? 200 : 48, ...aufFarbe }}>
      <div style={{ maxWidth: 760, margin: '0 auto' }}>
        <div style={{ padding: 'calc(10px + env(safe-area-inset-top, 0px)) 12px 0 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <button onClick={zurueck} style={{ height: 44, padding: '0 8px', display: 'flex', alignItems: 'center', gap: 2, fontSize: 17, fontWeight: 600, background: 'none', border: 'none', color: '#FFFFFF', cursor: 'pointer', fontFamily: 'inherit' }}>
            <ChevronLeft aria-hidden="true" size={24} strokeWidth={2.2} />{T('n_tab_lieder')}
          </button>
          <div style={{ display: 'flex', gap: 8 }}>
          {lehrer && (
            <button onClick={() => navigate(`${basis}/repertoire/${stueckId}/bearbeiten`, { state: { vonLied: true } })} style={{ height: 44, padding: '0 16px', borderRadius: 22, border: 'none', background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 17, fontWeight: 700, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
              <Pencil aria-hidden="true" size={18} />{T('edit')}
            </button>
          )}
          <button onClick={() => setStufe(s => (s + 1) % 3)} aria-label={T('n_schrift_aendern')} style={{ height: 44, padding: '0 16px', borderRadius: 22, border: 'none', background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 17, fontWeight: 700, cursor: 'pointer' }}>
            Aa · {[T('n_normal'), T('n_gross'), T('n_sehr_gross')][stufe]}
          </button>
          </div>
        </div>

        <header style={{ padding: '14px 20px 0' }}>
          <h1 style={{ margin: 0, fontSize: 30, lineHeight: 1.15, fontWeight: 800, letterSpacing: '-0.02em', overflowWrap: 'anywhere' }}>{stueck.titel}</h1>
          {stueck.komponist && <div style={{ marginTop: 6, fontSize: 17, color: '#E8EEF2' }}>{stueck.komponist}</div>}
          <LiedAngaben stueck={stueck} style={{ marginTop: 12 }} />
          {stueck.anmerkungen && <div style={{ marginTop: 12, padding: '10px 14px', borderRadius: 14, background: 'rgba(0,0,0,0.22)', fontSize: 16, lineHeight: 1.45, whiteSpace: 'pre-wrap', overflowWrap: 'anywhere' }}>{stueck.anmerkungen}</div>}
        </header>

        <div style={{ margin: '12px 20px 0' }}>
          <button onClick={() => setMetronomOffen(o => !o)} aria-expanded={metronomOffen} style={{ minHeight: 44, padding: '0 16px', borderRadius: 22, border: 'none', background: metronomOffen ? '#FFFFFF' : 'rgba(255,255,255,0.16)', color: metronomOffen ? '#111114' : '#FFFFFF', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>
            {T('piece_metronom')}
          </button>
          {metronomOffen && (
            <div style={{ marginTop: 12, padding: 12, borderRadius: 18, background: 'var(--bg)', color: 'var(--text)', ...normal }}>
              <Metronom initialBpm={stueck.tempo} onTempoSave={lehrer ? tempoSpeichern : null} />
            </div>
          )}
        </div>

        {anhoeren.length > 0 && (
          <nav aria-label={T('n_anhoeren')} style={{ margin: '16px 20px 0', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {anhoeren.map(([url, Icon, name]) => (
              <a key={name} href={url} target="_blank" rel="noopener noreferrer" style={{ minHeight: 44, padding: '0 16px', borderRadius: 22, background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', textDecoration: 'none', fontSize: 16, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <Icon aria-hidden="true" size={18} />{name}
              </a>
            ))}
          </nav>
        )}

        {tabs.length > 1 && (
          <div role="tablist" aria-label={T('n_ansicht')} style={{ margin: '18px 20px 0', padding: 4, borderRadius: 14, background: 'rgba(0,0,0,0.22)', display: 'flex', gap: 4 }}>
            {tabs.map(([id, label]) => (
              <button key={id} role="tab" aria-selected={aktiv === id} onClick={() => setTab(id)} style={{
                flex: 1, minHeight: 44, borderRadius: 11, border: 'none', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: 'pointer',
                background: aktiv === id ? '#FFFFFF' : 'transparent', color: aktiv === id ? '#111114' : '#FFFFFF',
              }}>{label}</button>
            ))}
          </div>
        )}

        {aktiv === 'text' && (
          <div style={{ padding: '24px 20px 0' }}>
            {stueck.liedtext_md !== false
              ? <div className="n-lied-text" style={{ fontSize: GROESSEN[stufe], lineHeight: 1.5, fontWeight: 600, overflowWrap: 'break-word' }} dangerouslySetInnerHTML={{ __html: safeMarkdown(stueck.liedtext) }} />
              : <div style={{ fontSize: GROESSEN[stufe], lineHeight: 1.5, fontWeight: 600, whiteSpace: 'pre-wrap', overflowWrap: 'break-word' }}>{stueck.liedtext}</div>}
            {!lehrer && <button onClick={() => setVorschlagOffen(true)} style={{ marginTop: 28, minHeight: 44, padding: '0 16px', borderRadius: 22, border: '1.5px solid rgba(255,255,255,0.45)', background: 'transparent', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
              <Pencil aria-hidden="true" size={18} />{T('vorschlag_text_btn')}
            </button>}
          </div>
        )}

        {aktiv === 'akkorde' && (
          <div style={{ padding: '24px 20px 0', fontSize: GROESSEN[stufe] - 4 }}>
            <div role="group" aria-label={T('piece_transpose')} style={{ marginBottom: 16, display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: 10, fontSize: 16 }}>
              <span style={{ fontWeight: 700 }}>{T('piece_transpose')}</span>
              <button onClick={() => setHalbtoene(h => h - 1)} aria-label={`${T('piece_transpose')} −1`} style={rundKnopf}><Minus aria-hidden="true" size={20} /></button>
              <span aria-live="polite" style={{ minWidth: 96, textAlign: 'center', fontWeight: 700, fontVariantNumeric: 'tabular-nums' }}>{halbtoene > 0 ? '+' : ''}{halbtoene} {T('piece_halftones')}</span>
              <button onClick={() => setHalbtoene(h => h + 1)} aria-label={`${T('piece_transpose')} +1`} style={rundKnopf}><Plus aria-hidden="true" size={20} /></button>
              {halbtoene !== 0 && <button onClick={() => setHalbtoene(0)} style={{ minHeight: 44, padding: '0 16px', borderRadius: 22, border: '1.5px solid rgba(255,255,255,0.45)', background: 'transparent', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>{T('tools_bpm_reset')}</button>}
            </div>
            {stueck.notizen && (
              <div style={{ marginBottom: 16, color: 'var(--text)', fontSize: 16, ...normal }}>
                <ChordPlayer notizen={akkordText} tempo={stueck.tempo} takt={stueck.takt} />
              </div>
            )}
            {stueck.notizen && <ChordPro text={akkordText} />}
            {akkordDateien.map(d => <AkkordDateiAnzeige key={d.id} datei={d} halbtoene={halbtoene} />)}
          </div>
        )}

        {aktiv === 'dateien' && (
          <div style={{ margin: '24px 12px 0', padding: '20px 0', borderRadius: 24, background: 'var(--bg)', color: 'var(--text)', ...normal }}>
            {!stueck.liedtext && !lehrer && (
              <div style={{ padding: '0 20px 20px' }}>
                <button onClick={() => setVorschlagOffen(true)} style={{ minHeight: 48, padding: '0 18px', borderRadius: 14, border: 'none', background: 'var(--n-tint)', color: 'var(--n-tint-fg)', fontFamily: 'inherit', fontSize: 17, fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                  <Pencil aria-hidden="true" size={18} />{T('vorschlag_text_add')}
                </button>
              </div>
            )}
            {stimmen.length > 0 && (
              <div role="group" aria-label={T('n_stimme_filtern')} style={{ padding: '0 20px 20px', display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                {[['alle', 'piece_voice_all'], ...stimmen].map(([wert, label]) => (
                  <button key={wert} onClick={() => setStimme(wert)} aria-pressed={stimme === wert} style={{ minHeight: 44, padding: '0 16px', borderRadius: 22, border: 'none', background: stimme === wert ? 'var(--primary)' : 'var(--n-fill)', color: stimme === wert ? 'var(--primary-fg)' : 'var(--text)', fontFamily: 'inherit', fontSize: 16, fontWeight: 700, cursor: 'pointer' }}>{T(label)}</button>
                ))}
              </div>
            )}
            {(noten.length > 0 || xml.length > 0) && (
              <Bereich titel={T('piece_notes_label')}>
                {xml.map(d => <VerovioViewer key={d.id} datei={d} />)}
                {noten.map(d => <PdfCard key={d.id} datei={d} />)}
              </Bereich>
            )}
            {audio.length > 0 && (
              <Bereich titel={T('piece_audio')}>
                {audio.map(d => <AudioPlayer key={d.id} datei={d} />)}
              </Bereich>
            )}
            {sonst.length > 0 && (
              <Bereich titel={T('n_weitere')}>
                <Gruppe style={{ margin: 0 }}>
                  {sonst.map((d, i) => (
                    <div key={d.id}>
                      {i > 0 && <Trenner />}
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 16px', flexWrap: 'wrap' }}>
                        <span style={{ flex: 1, minWidth: 160, fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{d.name}</span>
                        <OeffnenButton pfad={d.bucket_pfad} />
                        <DownloadButton datei={d} label="⬇" />
                      </div>
                    </div>
                  ))}
                </Gruppe>
              </Bereich>
            )}
            {/* EigeneDateienNeu bringt eigene Seitenabstände mit */}
            <section style={{ marginBottom: 24 }}>
              <h2 style={{ margin: '0 20px 12px', fontSize: 20, fontWeight: 800 }}>{T('eigene_meine')}</h2>
              <EigeneDateienNeu stueck={stueck} />
            </section>
          </div>
        )}
      </div>

      {hatLeiste && <Leiste audio={audio[0]} vorher={vorher} nachher={nachher} pos={pos} anzahl={liste.length} onGehe={gehe} />}

      {/* Modal rendert per Portal in <body> und nutzt damit wieder die normalen Farben */}
      {vorschlagOffen && <VorschlagModal zielStueck={stueck} onClose={() => setVorschlagOffen(false)} onErfolg={() => setVorschlagOffen(false)} />}
    </div>
  )
}

const rundKnopf = { width: 44, height: 44, borderRadius: 22, border: 'none', background: 'rgba(255,255,255,0.16)', color: '#FFFFFF', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }

function Bereich({ titel, children }) {
  return (
    <section style={{ padding: '0 20px', marginBottom: 24 }}>
      <h2 style={{ margin: '0 0 12px', fontSize: 20, fontWeight: 800 }}>{titel}</h2>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>{children}</div>
    </section>
  )
}

// Untere Leiste: Probe-Aufnahme abspielen + vor/zurück in der Liste
function Leiste({ audio, vorher, nachher, pos, anzahl, onGehe }) {
  const { T } = useApp()
  const ref = useRef(null)
  const [url, setUrl] = useState(null)
  const [spielt, setSpielt] = useState(false)
  const [zeit, setZeit] = useState({ akt: 0, dauer: NaN })

  useEffect(() => { setUrl(null); setSpielt(false); setZeit({ akt: 0, dauer: NaN }) }, [audio?.id])

  async function umschalten() {
    const el = ref.current
    if (!el) return
    if (spielt) { el.pause(); return }
    if (!url) {
      const u = await getSignedUrl(audio.bucket_pfad)
      if (!u) return
      setUrl(u)
      el.src = u
    }
    el.play().catch(() => {})
  }

  const anteil = zeit.dauer > 0 ? (zeit.akt / zeit.dauer) * 100 : 0

  return (
    <div className="n-lied-leiste" style={{ position: 'fixed', left: 12, right: 12, bottom: 'calc(16px + env(safe-area-inset-bottom, 0px))', zIndex: 50, maxWidth: 736, margin: '0 auto', padding: '14px 16px', borderRadius: 22, background: 'rgba(17,17,20,0.82)', backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)', color: '#FFFFFF', boxShadow: '0 10px 30px rgba(0,0,0,0.35)', display: 'flex', flexDirection: 'column', gap: 12 }}>
      {audio && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <button onClick={umschalten} aria-label={spielt ? T('n_pause') : T('n_abspielen')} style={{ width: 52, height: 52, flexShrink: 0, borderRadius: 26, border: 'none', background: '#FFFFFF', color: '#111114', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>
            {spielt ? <Pause aria-hidden="true" size={22} fill="currentColor" /> : <Play aria-hidden="true" size={22} fill="currentColor" style={{ marginLeft: 3 }} />}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 16, fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{audio.name}</div>
            <div role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(anteil)} style={{ marginTop: 8, height: 4, borderRadius: 2, background: 'rgba(255,255,255,0.25)' }}>
              <div style={{ width: `${anteil}%`, height: 4, borderRadius: 2, background: '#FFFFFF' }} />
            </div>
          </div>
          <div style={{ fontSize: 15, color: '#E8EEF2', fontVariantNumeric: 'tabular-nums' }}>{zeitText(spielt || zeit.akt ? zeit.akt : zeit.dauer)}</div>
          <audio ref={ref} preload="none"
            onPlay={() => setSpielt(true)} onPause={() => setSpielt(false)} onEnded={() => setSpielt(false)}
            onTimeUpdate={e => setZeit({ akt: e.currentTarget.currentTime, dauer: e.currentTarget.duration })}
            onLoadedMetadata={e => setZeit(z => ({ ...z, dauer: e.currentTarget.duration }))} />
        </div>
      )}
      {(vorher || nachher) && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, borderTop: audio ? '1px solid rgba(255,255,255,0.15)' : 'none', paddingTop: audio ? 10 : 0 }}>
          <button onClick={() => vorher && onGehe(vorher)} disabled={!vorher} style={navKnopf(!!vorher)}>
            <ChevronLeft aria-hidden="true" size={20} strokeWidth={2.2} /><span style={navText}>{vorher?.titel ?? ''}</span>
          </button>
          <span style={{ fontSize: 15, color: '#E8EEF2', flexShrink: 0 }}>{T('n_x_von_y').replace('{x}', pos + 1).replace('{y}', anzahl)}</span>
          <button onClick={() => nachher && onGehe(nachher)} disabled={!nachher} style={{ ...navKnopf(!!nachher), justifyContent: 'flex-end' }}>
            <span style={navText}>{nachher?.titel ?? ''}</span><ChevronRight aria-hidden="true" size={20} strokeWidth={2.2} />
          </button>
        </div>
      )}
      <style>{`@media (min-width: 900px) { .n-lied-leiste { left: 272px !important; } }`}</style>
    </div>
  )
}

const navKnopf = aktiv => ({ flex: 1, minWidth: 0, height: 44, display: 'flex', alignItems: 'center', gap: 2, background: 'none', border: 'none', color: '#FFFFFF', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: aktiv ? 'pointer' : 'default', opacity: aktiv ? 1 : 0, padding: 0 })
const navText = { overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }
