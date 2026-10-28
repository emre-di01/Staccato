import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { File, FileAudio, FileImage, FileText, FileVideo, Lock, GraduationCap, Users, Upload, Trash2, Music, Check } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { Gruppe, Trenner, Zeile, Knopf, Segment, Suchfeld, Leer, Laden, Blatt, Feld, eingabeStil } from '../ui'
import { useEigeneDateien, useStueckAuswahl, groesseText, SICHTBARKEITEN } from '../components/stueck/useEigeneDateien'
import { tagLabel } from './zeit'

const SICHT_ICON = { privat: Lock, lehrer: GraduationCap, alle: Users }

function dateiIcon(mime = '', name = '') {
  if (mime.startsWith('audio/')) return FileAudio
  if (mime.startsWith('video/')) return FileVideo
  if (mime.startsWith('image/')) return FileImage
  if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return FileText
  return File
}

// Eigene Dateien im neuen Design. Mit `stueck`: Dateien dieses Lieds, sonst alle (Seite „Meine Dateien“).
export default function EigeneDateienNeu({ stueck }) {
  const { profil, T, lang, zeitzone } = useApp()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const istGlobal = !stueck
  const ed = useEigeneDateien(stueck)

  const [ansicht, setAnsicht] = useState('meine')
  const [suche, setSuche] = useState('')
  const [offen, setOffen] = useState(null)        // Datei im Detail-Blatt
  const [auswahl, setAuswahl] = useState(null)    // File, wartet aufs Hochladen
  const [form, setForm] = useState({ sichtbarkeit: 'privat', notiz: '', stueckId: '' })
  const [laden, setLaden] = useState(false)
  const { data: stuecke = [] } = useStueckAuswahl(istGlobal && !!auswahl)

  const s_ = suche.trim().toLowerCase()
  const trifft = d => !s_ || [d.name, d.notiz, d.stueck?.titel, d.besitzer?.voller_name].some(x => x?.toLowerCase().includes(s_))

  function dateiGewaehlt(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !ed.pruefen(f)) return
    setForm({ sichtbarkeit: 'privat', notiz: '', stueckId: '' })
    setAuswahl(f)
  }

  async function hochladen() {
    setLaden(true)
    const ok = await ed.hochladen(auswahl, { sichtbarkeit: form.sichtbarkeit, notiz: form.notiz, stueckId: stueck?.id ?? (form.stueckId || null) })
    setLaden(false)
    if (ok) { setAuswahl(null); setAnsicht('meine') }
  }

  function zeile(d, i) {
    const eigene = d.besitzer_id === profil?.id
    const unter = [
      istGlobal ? (d.stueck?.titel ?? null) : null,
      eigene ? T(`n_sicht_${d.sichtbarkeit}`) : T('eigene_von').replace('{name}', d.besitzer?.voller_name ?? '–'),
      tagLabel(d.hochgeladen_am, zeitzone, lang, T),
    ].filter(Boolean).join(' · ')
    return (
      <div key={d.id}>
        {i > 0 && <Trenner />}
        <Zeile icon={dateiIcon(d.mime_typ ?? '', d.name)} titel={d.name} untertitel={unter} onClick={() => setOffen(d)} />
      </div>
    )
  }

  function liste(eintraege, leerText) {
    if (!eintraege.length) return <Leer text={leerText} />
    return <Gruppe>{eintraege.map(zeile)}</Gruppe>
  }

  const leerText = s_ ? T('eigene_kein_treffer') : ansicht === 'geteilt' ? T('eigene_geteilt_leer') : istGlobal ? T('eigene_leer_global') : T('eigene_leer')
  // Aktuelle Fassung der offenen Datei (nach Sichtbarkeitswechsel neu geladen)
  const offenAktuell = offen ? (ed.dateien.find(d => d.id === offen.id) ?? offen) : null

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <input ref={inputRef} type="file" onChange={dateiGewaehlt} style={{ display: 'none' }} />
      <div style={{ padding: '0 20px' }}>
        <Knopf icon={Upload} voll onClick={() => inputRef.current?.click()}>{T('n_datei_hochladen')}</Knopf>
      </div>

      {istGlobal && (
        <>
          <Segment label={T('n_ansicht')} wert={ansicht} onChange={setAnsicht} style={{ margin: '0 20px' }}
            optionen={[['meine', `${T('n_meine')} (${ed.meine.length})`], ['geteilt', `${T('n_geteilt')} (${ed.geteilt.length})`]]} />
          {ed.dateien.length > 0 && <Suchfeld wert={suche} onChange={setSuche} placeholder={T('n_dateien_suchen')} label={T('n_dateien_suchen')} />}
        </>
      )}

      {ed.isLoading ? <Laden /> : istGlobal ? (
        liste((ansicht === 'geteilt' ? ed.geteilt : ed.meine).filter(trifft), leerText)
      ) : (
        <>
          {liste(ed.meine, leerText)}
          {ed.geteilt.length > 0 && (
            <>
              <h3 style={{ margin: '8px 20px 0', fontSize: 20, fontWeight: 800 }}>{T('eigene_geteilt')}</h3>
              {liste(ed.geteilt, '')}
            </>
          )}
        </>
      )}

      {/* Hochladen */}
      {auswahl && (
        <Blatt titel={T('n_datei_hochladen')} onClose={() => !laden && setAuswahl(null)}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: 14, borderRadius: 14, background: 'var(--n-fill)' }}>
              {(() => { const I = dateiIcon(auswahl.type, auswahl.name); return <I aria-hidden="true" size={24} color="var(--primary)" /> })()}
              <div style={{ minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 600, overflowWrap: 'anywhere' }}>{auswahl.name}</div>
                <div style={{ fontSize: 15, color: 'var(--text-2)' }}>{groesseText(auswahl.size)}</div>
              </div>
            </div>
            {istGlobal && (
              <Feld label={T('eigene_stueck_label')}>
                <select value={form.stueckId} onChange={e => setForm(f => ({ ...f, stueckId: e.target.value }))} style={eingabeStil}>
                  <option value="">{T('eigene_stueck_keins')}</option>
                  {stuecke.map(x => <option key={x.id} value={x.id}>{x.titel}</option>)}
                </select>
              </Feld>
            )}
            <SichtWahl wert={form.sichtbarkeit} onChange={v => setForm(f => ({ ...f, sichtbarkeit: v }))} />
            <Feld label={T('eigene_notiz')}>
              <input value={form.notiz} onChange={e => setForm(f => ({ ...f, notiz: e.target.value }))} placeholder={T('eigene_notiz_ph')} style={eingabeStil} />
            </Feld>
            <Knopf voll icon={Upload} onClick={hochladen} disabled={laden}>{laden ? T('loading') : T('eigene_upload')}</Knopf>
          </div>
        </Blatt>
      )}

      {/* Details */}
      {offenAktuell && (() => {
        const d = offenAktuell
        const eigene = d.besitzer_id === profil?.id
        const darfLoeschen = eigene
        return (
          <Blatt titel={d.name} onClose={() => setOffen(null)}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
              {d.notiz && <div style={{ fontSize: 17, lineHeight: 1.5 }}>{d.notiz}</div>}
              <div style={{ fontSize: 16, color: 'var(--text-2)' }}>
                {[!eigene ? T('eigene_von').replace('{name}', d.besitzer?.voller_name ?? '–') : null, tagLabel(d.hochgeladen_am, zeitzone, lang, T), groesseText(d.groesse)].filter(Boolean).join(' · ')}
              </div>
              <Knopf voll onClick={() => ed.oeffnen(d)}>{T('n_oeffnen')}</Knopf>
              {istGlobal && d.stueck && (
                <Knopf voll variante="sekundaer" icon={Music} onClick={() => navigate(`/schueler/repertoire/${d.stueck.id}`)}>{d.stueck.titel}</Knopf>
              )}
              {eigene
                ? <SichtWahl wert={d.sichtbarkeit} onChange={v => ed.sichtbarkeitAendern(d, v)} />
                : <div style={{ fontSize: 16, color: 'var(--text-2)' }}>{T(`n_sicht_${d.sichtbarkeit}`)}</div>}
              {darfLoeschen && (
                <Knopf voll variante="gefahr" icon={Trash2} onClick={async () => { if (await ed.loeschen(d)) setOffen(null) }}>{T('n_datei_loeschen')}</Knopf>
              )}
            </div>
          </Blatt>
        )
      })()}
    </div>
  )
}

function SichtWahl({ wert, onChange }) {
  const { T } = useApp()
  return (
    <fieldset style={{ border: 'none', margin: 0, padding: 0 }}>
      <legend style={{ padding: 0, marginBottom: 8, fontSize: 16, fontWeight: 600, color: 'var(--text-2)' }}>{T('eigene_sicht_label')}</legend>
      <div role="radiogroup" style={{ borderRadius: 14, background: 'var(--n-fill)', overflow: 'hidden' }}>
        {SICHTBARKEITEN.map((v, i) => {
          const Icon = SICHT_ICON[v]
          const aktiv = wert === v
          return (
            <div key={v}>
              {i > 0 && <Trenner />}
              <button role="radio" aria-checked={aktiv} onClick={() => onChange(v)} style={{ display: 'flex', alignItems: 'center', gap: 14, width: '100%', minHeight: 56, padding: '12px 16px', border: 'none', background: 'none', color: 'var(--text)', fontFamily: 'inherit', fontSize: 17, fontWeight: aktiv ? 700 : 500, cursor: 'pointer', textAlign: 'left' }}>
                <Icon aria-hidden="true" size={22} color="var(--primary)" />
                <span style={{ flex: 1 }}>{T(`n_sicht_${v}`)}</span>
                {aktiv && <Check aria-hidden="true" size={22} color="var(--primary)" />}
              </button>
            </div>
          )
        })}
      </div>
    </fieldset>
  )
}
