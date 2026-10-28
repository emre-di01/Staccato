import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import Hinweis from '../Hinweis'
import { useEigeneDateien, useStueckAuswahl, groesseText, SICHTBARKEITEN } from './useEigeneDateien'

function dateiIcon(mime = '', name = '') {
  if (mime.startsWith('audio/')) return '🎵'
  if (mime.startsWith('video/')) return '🎬'
  if (mime.startsWith('image/')) return '🖼️'
  if (mime === 'application/pdf' || name.toLowerCase().endsWith('.pdf')) return '📄'
  return '📎'
}

// Route-Präfix für Repertoire-Links; eltern haben kein Repertoire
function repertoirePfad(rolle, stueckId) {
  const praefix = rolle === 'superadmin' ? 'admin' : rolle
  return rolle === 'eltern' ? null : `/${praefix}/repertoire/${stueckId}`
}

// Eigene Dateien mit Sichtbarkeit pro Datei (privat / Lehrkräfte / alle).
// Mit `stueck`: Dateien dieses Stücks (Tab in StueckDetail).
// Ohne `stueck`: alle Dateien der Schule, die der Nutzer sehen darf (Seite „Meine Dateien“).
export default function EigeneDateien({ stueck }) {
  const { profil, rolle, T } = useApp()
  const navigate = useNavigate()
  const inputRef = useRef(null)
  const istGlobal = !stueck
  const istLehrkraft = rolle === 'lehrer' || rolle === 'admin' || rolle === 'superadmin'

  const [auswahl,      setAuswahl]      = useState(null)   // File, wartet auf Bestätigung
  const [sichtbarkeit, setSichtbarkeit] = useState('privat')
  const [notiz,        setNotiz]        = useState('')
  const [zielStueck,   setZielStueck]   = useState('')
  const [laden,        setLaden]        = useState(false)
  const [ansicht,      setAnsicht]      = useState('meine')   // meine | geteilt (nur global)
  const [suche,        setSuche]        = useState('')

  const { dateien, isLoading, meine, geteilt, pruefen, hochladen: dateiHochladen, oeffnen, sichtbarkeitAendern, loeschen } = useEigeneDateien(stueck)
  const { data: stuecke = [] } = useStueckAuswahl(istGlobal && !!auswahl)

  const s_ = suche.trim().toLowerCase()
  const trifft = d => !s_ || [d.name, d.notiz, d.stueck?.titel, d.besitzer?.voller_name].some(x => x?.toLowerCase().includes(s_))
  const liste = (istGlobal && ansicht === 'geteilt' ? geteilt : meine).filter(trifft)

  function dateiGewaehlt(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    if (!f || !pruefen(f)) return
    setAuswahl(f); setSichtbarkeit('privat'); setNotiz(''); setZielStueck('')
  }

  async function hochladen() {
    setLaden(true)
    const ok = await dateiHochladen(auswahl, { sichtbarkeit, notiz, stueckId: stueck?.id ?? (zielStueck || null) })
    setLaden(false)
    if (ok) { setAuswahl(null); setAnsicht('meine') }
  }

  function dateiZeile(d) {
    const eigene = d.besitzer_id === profil?.id
    const stueckLink = istGlobal && d.stueck ? repertoirePfad(rolle, d.stueck.id) : null
    return (
      <div key={d.id} style={st.zeile}>
        <div style={{ display:'flex', alignItems:'flex-start', gap:12 }}>
          <span style={{ fontSize:28, flexShrink:0, lineHeight:1.2 }}>{dateiIcon(d.mime_typ ?? '', d.name)}</span>
          <div style={{ flex:1, minWidth:0 }}>
            <div style={{ fontWeight:700, fontSize:16, color:'var(--text)', wordBreak:'break-word' }}>{d.name}</div>
            {d.notiz && <div style={{ fontSize:15, color:'var(--text)', marginTop:2 }}>{d.notiz}</div>}
            {istGlobal && (
              <div style={{ marginTop:6 }}>
                {d.stueck
                  ? stueckLink
                    ? <button onClick={() => navigate(stueckLink)} style={st.stueckChip}>🎼 {d.stueck.titel}</button>
                    : <span style={st.stueckChip}>🎼 {d.stueck.titel}</span>
                  : <span style={{ ...st.stueckChip, color:'var(--text-2)', borderColor:'var(--border)', cursor:'default' }}>{T('eigene_ohne_stueck')}</span>}
              </div>
            )}
            <div style={{ fontSize:14, color:'var(--text-2)', marginTop:6 }}>
              {!eigene && <>{T('eigene_von').replace('{name}', d.besitzer?.voller_name ?? '–')} · </>}
              {new Date(d.hochgeladen_am).toLocaleDateString()}{d.groesse ? ` · ${groesseText(d.groesse)}` : ''}
              {!eigene && <> · {T(`eigene_sicht_${d.sichtbarkeit}`)}</>}
            </div>
          </div>
        </div>
        <div style={{ height:1, background:'var(--border)' }} />
        <div style={{ display:'flex', gap:10, flexWrap:'wrap', alignItems:'center' }}>
          <button onClick={() => oeffnen(d)} style={st.btnSek}>{T('eigene_oeffnen')}</button>
          {eigene && (
            <select value={d.sichtbarkeit} onChange={e => sichtbarkeitAendern(d, e.target.value)} aria-label={T('eigene_sicht_label')} style={{ ...st.input, width:'auto', minHeight:44 }}>
              {SICHTBARKEITEN.map(v => <option key={v} value={v}>{T(`eigene_sicht_${v}`)}</option>)}
            </select>
          )}
          {(eigene || (istLehrkraft && d.sichtbarkeit === 'alle')) && (
            <button onClick={() => loeschen(d)} style={{ ...st.btnSek, marginLeft:'auto', color:'var(--danger)' }}>🗑 {T('delete')}</button>
          )}
        </div>
      </div>
    )
  }

  const leerText = suche
    ? T('eigene_kein_treffer')
    : istGlobal && ansicht === 'geteilt' ? T('eigene_geteilt_leer')
    : istGlobal ? T('eigene_leer_global') : T('eigene_leer')

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
      <Hinweis text={T(istGlobal ? 'eigene_hint_global' : 'eigene_hint')} />

      <input ref={inputRef} type="file" onChange={dateiGewaehlt} style={{ display:'none' }} />

      {auswahl ? (
        <div style={{ ...st.zeile, borderColor:'var(--primary)' }}>
          <div style={{ fontWeight:700, fontSize:16, color:'var(--text)', wordBreak:'break-word' }}>
            {dateiIcon(auswahl.type, auswahl.name)} {auswahl.name} <span style={{ fontWeight:400, color:'var(--text-2)' }}>· {groesseText(auswahl.size)}</span>
          </div>
          {istGlobal && (
            <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <span style={st.label}>{T('eigene_stueck_label')}</span>
              <select style={st.input} value={zielStueck} onChange={e => setZielStueck(e.target.value)}>
                <option value="">{T('eigene_stueck_keins')}</option>
                {stuecke.map(x => <option key={x.id} value={x.id}>{x.titel}</option>)}
              </select>
            </label>
          )}
          <fieldset style={{ border:'none', padding:0, margin:0, display:'flex', flexDirection:'column', gap:8 }}>
            <legend style={{ ...st.label, marginBottom:8 }}>{T('eigene_sicht_label')}</legend>
            {SICHTBARKEITEN.map(v => (
              <label key={v} style={{ ...st.option, borderColor: sichtbarkeit === v ? 'var(--primary)' : 'var(--border)', background: sichtbarkeit === v ? 'color-mix(in srgb, var(--primary) 10%, transparent)' : 'var(--bg)' }}>
                <input type="radio" name="sichtbarkeit" value={v} checked={sichtbarkeit === v} onChange={() => setSichtbarkeit(v)} style={{ width:20, height:20, margin:0 }} />
                {T(`eigene_sicht_${v}`)}
              </label>
            ))}
          </fieldset>
          <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <span style={st.label}>{T('eigene_notiz')}</span>
            <input style={st.input} value={notiz} placeholder={T('eigene_notiz_ph')} onChange={e => setNotiz(e.target.value)} />
          </label>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
            <button onClick={() => setAuswahl(null)} disabled={laden} style={st.btnSek}>{T('cancel')}</button>
            <button onClick={hochladen} disabled={laden} style={st.btnPri}>{laden ? T('loading') : `⬆ ${T('eigene_upload')}`}</button>
          </div>
        </div>
      ) : (
        <button onClick={() => inputRef.current?.click()} style={{ ...st.btnPri, alignSelf:'flex-start' }}>{T('eigene_waehlen')}</button>
      )}

      {istGlobal && (
        <>
          <div style={{ display:'flex', gap:8, flexWrap:'wrap' }}>
            {[['meine', `${T('eigene_meine')} (${meine.length})`], ['geteilt', `${T('eigene_geteilt_tab')} (${geteilt.length})`]].map(([k, l]) => (
              <button key={k} onClick={() => setAnsicht(k)}
                style={{ ...st.btnSek, background: ansicht === k ? 'var(--primary)' : 'var(--surface)', color: ansicht === k ? 'var(--primary-fg)' : 'var(--text-2)', borderColor: ansicht === k ? 'var(--primary)' : 'var(--border)' }}>
                {l}
              </button>
            ))}
          </div>
          {dateien.length > 0 && <input style={st.input} value={suche} placeholder={T('eigene_suche')} onChange={e => setSuche(e.target.value)} />}
        </>
      )}

      {isLoading ? (
        <div style={st.leer}>{T('loading')}</div>
      ) : istGlobal ? (
        <section style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {liste.length === 0 ? <div style={st.leer}>{leerText}</div> : liste.map(dateiZeile)}
        </section>
      ) : (
        <>
          <section style={{ display:'flex', flexDirection:'column', gap:10 }}>
            <h3 style={st.titel}>{T('eigene_meine')}</h3>
            {meine.length === 0 ? <div style={st.leer}>{leerText}</div> : meine.map(dateiZeile)}
          </section>
          {geteilt.length > 0 && (
            <section style={{ display:'flex', flexDirection:'column', gap:10 }}>
              <h3 style={st.titel}>{T('eigene_geteilt')}</h3>
              {geteilt.map(dateiZeile)}
            </section>
          )}
        </>
      )}
    </div>
  )
}

// Bewusst größere Schrift und Klickflächen (Feedback: Nutzer 50+)
const st = {
  titel:      { margin:'8px 0 0', fontSize:18, fontWeight:800, color:'var(--text)' },
  label:      { fontSize:15, fontWeight:700, color:'var(--text-2)', padding:0 },
  input:      { padding:'12px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:16, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', boxSizing:'border-box', width:'100%' },
  option:     { display:'flex', alignItems:'center', gap:12, padding:'12px 14px', minHeight:44, borderRadius:'var(--radius)', border:'1.5px solid', fontSize:16, color:'var(--text)', cursor:'pointer' },
  btnPri:     { padding:'12px 20px', minHeight:44, borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek:     { padding:'10px 16px', minHeight:44, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  stueckChip: { display:'inline-block', fontSize:14, fontWeight:600, padding:'6px 12px', borderRadius:99, border:'1.5px solid var(--primary)', color:'var(--primary)', background:'transparent', cursor:'pointer', fontFamily:'inherit' },
  zeile:      { display:'flex', flexDirection:'column', gap:12, padding:'16px 18px', borderRadius:'var(--radius)', background:'var(--surface)', border:'1.5px solid var(--border)' },
  leer:       { padding:'28px 20px', textAlign:'center', color:'var(--text-2)', fontSize:16, background:'var(--bg-2)', borderRadius:'var(--radius)', border:'1px solid var(--border)' },
}
