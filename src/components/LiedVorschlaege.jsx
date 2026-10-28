import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'
import Dialog from './Dialog'
import Hinweis from './Hinweis'

const STATUS_FARBE = { offen:'var(--primary)', angenommen:'var(--success)', abgelehnt:'var(--text-3)' }
const STATUS_ICON  = { offen:'⏳', angenommen:'✅', abgelehnt:'✕' }

// Kurse, in denen der Schüler aktiv eingeschrieben ist (für die Kurs-Auswahl im Formular)
function useMeineKurse(profilId) {
  return useQuery({
    queryKey: ['lied-vorschlag-kurse', profilId],
    enabled: !!profilId,
    queryFn: async () => {
      const { data } = await supabase.from('unterricht_schueler')
        .select('unterricht(id, name)').eq('schueler_id', profilId).eq('status', 'aktiv')
      return (data ?? []).map(d => d.unterricht).filter(Boolean)
    },
  })
}

// Zeilenweiser Diff (LCS) für Textänderungs-Vorschläge
function zeilenDiff(alt, neu) {
  const a = (alt ?? '').split('\n'), b = (neu ?? '').split('\n')
  const L = Array.from({ length: a.length + 1 }, () => new Array(b.length + 1).fill(0))
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      L[i][j] = a[i] === b[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1])
  const zeilen = []
  let i = 0, j = 0
  while (i < a.length && j < b.length) {
    if (a[i] === b[j])               { zeilen.push({ typ:'gleich', text:a[i] }); i++; j++ }
    else if (L[i + 1][j] >= L[i][j + 1]) zeilen.push({ typ:'weg', text:a[i++] })
    else                              zeilen.push({ typ:'neu', text:b[j++] })
  }
  while (i < a.length) zeilen.push({ typ:'weg', text:a[i++] })
  while (j < b.length) zeilen.push({ typ:'neu', text:b[j++] })
  return zeilen
}

function DiffAnsicht({ alt, neu }) {
  const { T } = useApp()
  return (
    <div style={{ marginTop:8 }}>
      <div style={{ fontSize:14, color:'var(--text-2)', marginBottom:6 }}>{T('vorschlag_diff_legend')}</div>
      <div style={{ ...s.liedtext, whiteSpace:'normal', padding:'10px 0' }}>
        {zeilenDiff(alt, neu).map((z, i) => (
          <div key={i} style={{
            padding:'1px 16px', whiteSpace:'pre-wrap', minHeight:'1.6em',
            ...(z.typ === 'weg' && { background:'color-mix(in srgb, var(--danger) 14%, transparent)', color:'var(--danger)', textDecoration:'line-through' }),
            ...(z.typ === 'neu' && { background:'color-mix(in srgb, var(--success) 16%, transparent)', color:'var(--text)', fontWeight:600 }),
          }}>
            <span aria-hidden style={{ display:'inline-block', width:18, fontWeight:800 }}>{z.typ === 'weg' ? '−' : z.typ === 'neu' ? '+' : ''}</span>
            {z.text}
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Vorschlag anlegen / bearbeiten ───────────────────────────
// zielStueck gesetzt (oder vorschlag.art === 'liedtext') → Textänderung an bestehendem Stück
export function VorschlagModal({ vorschlag, zielStueck, onClose, onErfolg }) {
  const { profil, schule, T, toast } = useApp()
  const istText = vorschlag ? vorschlag.art === 'liedtext' : !!zielStueck
  const originalText = (vorschlag ? vorschlag.ziel?.liedtext : zielStueck?.liedtext) ?? ''
  const { data: kurse = [], isLoading: kurseLaden } = useMeineKurse(istText ? null : profil?.id)
  const [form, setForm] = useState({
    titel:         vorschlag?.titel ?? zielStueck?.titel ?? '',
    komponist:     vorschlag?.komponist ?? '',
    unterricht_id: vorschlag?.unterricht_id ?? '',
    youtube_url:   vorschlag?.youtube_url ?? '',
    liedtext:      vorschlag?.liedtext ?? originalText,
    kommentar:     vorschlag?.kommentar ?? '',
  })
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')
  const setze = (k, v) => setForm(p => ({ ...p, [k]: v }))
  // Liedvorschläge sind immer an einen Kurs gebunden; bei nur einem Kurs ist er vorausgewählt
  const kursId = form.unterricht_id || (kurse.length === 1 ? kurse[0].id : '')

  async function speichern() {
    if (!form.titel.trim()) { setFehler(T('title_required')); return }
    if (!istText && !kursId) { setFehler(T('vorschlag_course_required')); return }
    if (istText && form.liedtext.trim() === originalText.trim()) { setFehler(T('vorschlag_text_unchanged')); return }
    setLaden(true)
    const daten = istText
      ? { liedtext: form.liedtext, kommentar: form.kommentar }
      : { ...form, titel: form.titel.trim(), unterricht_id: kursId }
    const { error } = vorschlag
      ? await supabase.from('lied_vorschlaege').update(daten).eq('id', vorschlag.id)
      : await supabase.from('lied_vorschlaege').insert({
          ...daten, vorgeschlagen_von: profil.id, schule_id: schule?.id,
          ...(istText && { art: 'liedtext', ziel_stueck_id: zielStueck.id, titel: zielStueck.titel }),
        })
    setLaden(false)
    if (error) { setFehler(error.message); return }
    toast(T(vorschlag ? 'vorschlag_saved' : 'vorschlag_sent'), 'success')
    onErfolg()
  }

  if (istText) return (
    <Dialog titel={`${T(originalText ? 'vorschlag_text_btn' : 'vorschlag_text_add')}: ${form.titel}`} onClose={onClose} maxWidth={640}>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <p style={{ margin:0, fontSize:16, color:'var(--text-2)', lineHeight:1.5 }}>{T('vorschlag_text_hint')}</p>
        <Feld label={T('piece_lyrics')}>
          <textarea style={{ ...s.input, minHeight:320, resize:'vertical', lineHeight:1.6 }} value={form.liedtext}
            placeholder={T('vorschlag_lyrics_ph')} onChange={e => setze('liedtext', e.target.value)} />
        </Feld>
        <Feld label={T('vorschlag_comment')}>
          <textarea style={{ ...s.input, minHeight:70, resize:'vertical' }} value={form.kommentar} onChange={e => setze('kommentar', e.target.value)} />
        </Feld>
        {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:15 }}>{fehler}</p>}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
          <button onClick={speichern} disabled={laden} style={s.btnPri}>
            {laden ? T('loading') : vorschlag ? T('save') : T('vorschlag_send')}
          </button>
        </div>
      </div>
    </Dialog>
  )

  if (!vorschlag && !kurseLaden && kurse.length === 0) return (
    <Dialog titel={T('vorschlag_new')} onClose={onClose}>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <p style={{ margin:0, fontSize:16, color:'var(--text)', lineHeight:1.5 }}>{T('vorschlag_keine_kurse')}</p>
        <button onClick={onClose} style={{ ...s.btnSek, alignSelf:'flex-end' }}>{T('cancel')}</button>
      </div>
    </Dialog>
  )

  return (
    <Dialog titel={vorschlag ? T('vorschlag_edit_title') : T('vorschlag_new')} onClose={onClose} maxWidth={560}>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <Feld label={`${T('vorschlag_course')} *`}>
          <select style={s.input} value={kursId} onChange={e => setze('unterricht_id', e.target.value)}>
            <option value="" disabled>{kurseLaden ? T('loading') : T('vorschlag_course_waehlen')}</option>
            {kurse.map(k => <option key={k.id} value={k.id}>{k.name}</option>)}
          </select>
        </Feld>
        <Feld label={`${T('piece_title_label')} *`}>
          <input style={s.input} value={form.titel} placeholder="z.B. Halleluja" onChange={e => setze('titel', e.target.value)} />
        </Feld>
        <Feld label={T('vorschlag_artist')}>
          <input style={s.input} value={form.komponist} placeholder="z.B. Leonard Cohen" onChange={e => setze('komponist', e.target.value)} />
        </Feld>
        <Feld label={T('vorschlag_link')}>
          <input style={s.input} value={form.youtube_url} placeholder="https://youtube.com/..." onChange={e => setze('youtube_url', e.target.value)} />
        </Feld>
        <Feld label={T('vorschlag_lyrics')}>
          <textarea style={{ ...s.input, minHeight:180, resize:'vertical', lineHeight:1.5 }} value={form.liedtext}
            placeholder={T('vorschlag_lyrics_ph')} onChange={e => setze('liedtext', e.target.value)} />
        </Feld>
        <Feld label={T('vorschlag_comment')}>
          <textarea style={{ ...s.input, minHeight:70, resize:'vertical' }} value={form.kommentar} onChange={e => setze('kommentar', e.target.value)} />
        </Feld>
        {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:15 }}>{fehler}</p>}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
          <button onClick={speichern} disabled={laden} style={s.btnPri}>
            {laden ? T('loading') : vorschlag ? T('save') : T('vorschlag_send')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Lehrer: Annehmen / Ablehnen ──────────────────────────────
function EntscheidenModal({ vorschlag, annehmen, onClose, onErfolg }) {
  const { T, toast } = useApp()
  const [antwort, setAntwort] = useState('')
  const [laden, setLaden] = useState(false)

  async function entscheiden() {
    setLaden(true)
    const { error } = await supabase.rpc('lied_vorschlag_entscheiden', {
      p_vorschlag_id: vorschlag.id, p_annehmen: annehmen, p_antwort: antwort,
    })
    setLaden(false)
    if (error) { toast(error.message, 'error'); return }
    toast(T(!annehmen ? 'vorschlag_rejected' : istText ? 'vorschlag_text_accepted' : 'vorschlag_accepted'), 'success')
    onErfolg()
  }

  const istText = vorschlag.art === 'liedtext'
  const annehmenLabel = istText ? 'vorschlag_text_accept' : 'vorschlag_accept'

  return (
    <Dialog titel={T(!annehmen ? 'vorschlag_reject_title' : istText ? 'vorschlag_text_accept_title' : 'vorschlag_accept_title')} onClose={onClose}>
      <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
        <div style={{ fontSize:17, fontWeight:700, color:'var(--text)' }}>
          {vorschlag.titel}{vorschlag.komponist && <span style={{ fontWeight:400, color:'var(--text-2)' }}> · {vorschlag.komponist}</span>}
        </div>
        <Feld label={T('vorschlag_answer')}>
          <textarea style={{ ...s.input, minHeight:80, resize:'vertical' }} value={antwort} onChange={e => setAntwort(e.target.value)} />
        </Feld>
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end', flexWrap:'wrap' }}>
          <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
          <button onClick={entscheiden} disabled={laden}
            style={annehmen ? s.btnPri : { ...s.btnPri, background:'var(--danger)' }}>
            {laden ? T('loading') : T(annehmen ? annehmenLabel : 'vorschlag_reject')}
          </button>
        </div>
      </div>
    </Dialog>
  )
}

// ─── Liste ────────────────────────────────────────────────────
// modus 'schueler': eigene Vorschläge, bearbeiten/zurückziehen solange offen
// modus 'lehrer':   Vorschläge der Schule (RLS filtert auf eigene Kurse), annehmen/ablehnen
export default function LiedVorschlaege({ modus, rollePfad, fokusId }) {
  const { profil, schule, T, confirm, toast } = useApp()
  const navigate    = useNavigate()
  const queryClient = useQueryClient()
  const istLehrer   = modus === 'lehrer'

  const [statusFilter, setStatusFilter] = useState(istLehrer ? 'offen' : 'alle')
  const [bearbeiten,   setBearbeiten]   = useState(null)
  const [entscheidung, setEntscheidung] = useState(null)   // { vorschlag, annehmen }
  const [offeneTexte,  setOffeneTexte]  = useState({})

  const { data: vorschlaege = [], isLoading } = useQuery({
    queryKey: ['lied-vorschlaege', modus, profil?.id, schule?.id],
    enabled: !!profil?.id && !!schule?.id,
    queryFn: async () => {
      let q = supabase.from('lied_vorschlaege')
        .select('*, von:profiles!lied_vorschlaege_vorgeschlagen_von_fkey(voller_name), unterricht(name), ziel:stuecke!lied_vorschlaege_ziel_stueck_id_fkey(titel, liedtext)')
        .eq('schule_id', schule.id)
        .order('erstellt_am', { ascending: false })
      if (!istLehrer) q = q.eq('vorgeschlagen_von', profil.id)
      const { data, error } = await q
      if (error) throw error
      return data ?? []
    },
  })

  // Sprung zu einem bestimmten Vorschlag (z. B. aus dem Hinweis auf der Stück-Seite)
  useEffect(() => {
    if (!fokusId || isLoading) return
    document.getElementById(`vorschlag-${fokusId}`)?.scrollIntoView({ behavior:'smooth', block:'start' })
  }, [fokusId, isLoading])

  function neuLaden() {
    queryClient.invalidateQueries({ queryKey: ['lied-vorschlaege'] })
    queryClient.invalidateQueries({ queryKey: ['repertoire'] })
  }

  async function zurueckziehen(v) {
    const ok = await confirm(T('vorschlag_withdraw_confirm'), { confirmLabel: T('vorschlag_withdraw') })
    if (!ok) return
    const { error } = await supabase.from('lied_vorschlaege').delete().eq('id', v.id)
    if (error) { toast(error.message, 'error'); return }
    neuLaden()
  }

  const gefiltert = vorschlaege.filter(v => statusFilter === 'alle' || v.status === statusFilter)

  return (
    <div>
      <Hinweis text={T(istLehrer ? 'vorschlag_hint_teacher' : 'vorschlag_hint')} style={{ marginBottom:20 }} />

      {istLehrer && (
        <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20 }}>
          {[
            ['offen',      `⏳ ${T('vorschlag_filter_open')}`],
            ['angenommen', `✅ ${T('vorschlag_status_angenommen')}`],
            ['abgelehnt',  T('vorschlag_status_abgelehnt')],
            ['alle',       T('filter_all')],
          ].map(([k, l]) => (
            <button key={k} onClick={() => setStatusFilter(k)}
              style={{ ...s.chip, background: statusFilter===k ? 'var(--primary)' : 'var(--surface)', color: statusFilter===k ? 'var(--primary-fg)' : 'var(--text-2)' }}>
              {l}
            </button>
          ))}
        </div>
      )}

      {isLoading ? (
        <div style={s.leer}>{T('loading')}</div>
      ) : gefiltert.length === 0 ? (
        <div style={s.leer}>{T(istLehrer ? 'vorschlag_empty_teacher' : 'vorschlag_empty_mine')}</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {gefiltert.map(v => {
            const istText   = v.art === 'liedtext'
            const zeigeDiff = istText && v.status === 'offen'
            // Lehrer sehen offene Textänderungen direkt aufgeklappt – das ist der eigentliche Inhalt
            const textOffen = offeneTexte[v.id] ?? (zeigeDiff && istLehrer)
            const zumStueck = v.stueck_id ?? v.ziel_stueck_id
            const statusLabel = istText && v.status === 'angenommen' ? T('vorschlag_status_angenommen_text') : T(`vorschlag_status_${v.status}`)
            return (
              <div key={v.id} id={`vorschlag-${v.id}`} style={{ ...s.karte, scrollMarginTop:80, ...(v.id === fokusId && { borderColor:'var(--primary)', borderWidth:2 }) }}>
                {/* Titel einzeilig + Status */}
                <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:12, flexWrap:'wrap' }}>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontWeight:800, fontSize:17, color:'var(--text)' }}>{v.titel}</div>
                    {v.komponist && <div style={{ fontSize:15, color:'var(--text-2)', marginTop:2 }}>🎼 {v.komponist}</div>}
                  </div>
                  <span style={{ ...s.status, color: STATUS_FARBE[v.status], borderColor: STATUS_FARBE[v.status] }}>
                    {STATUS_ICON[v.status]} {statusLabel}
                  </span>
                </div>

                {/* Meta */}
                <div style={{ display:'flex', gap:8, flexWrap:'wrap', fontSize:14, color:'var(--text-2)', alignItems:'center' }}>
                  {istText && <span style={{ ...s.badge, color:'var(--primary)', borderColor:'var(--primary)' }}>{T('vorschlag_text_badge')}</span>}
                  {istLehrer && <span>👤 {T('vorschlag_by')}: <b>{v.von?.voller_name ?? '–'}</b></span>}
                  {v.unterricht?.name && <span style={s.badge}>{v.unterricht.name}</span>}
                  <span>{new Date(v.erstellt_am).toLocaleDateString()}</span>
                </div>

                {v.kommentar && <div style={{ fontSize:15, color:'var(--text)', fontStyle:'italic' }}>„{v.kommentar}“</div>}

                {v.youtube_url && (
                  <a href={v.youtube_url} target="_blank" rel="noopener noreferrer" style={{ fontSize:15, color:'var(--primary)', fontWeight:600, wordBreak:'break-all' }}>
                    ▶️ {v.youtube_url}
                  </a>
                )}

                {(v.liedtext || zeigeDiff) && (
                  <div>
                    <button onClick={() => setOffeneTexte(p => ({ ...p, [v.id]: !textOffen }))} style={s.btnLink}>
                      📝 {T(zeigeDiff
                        ? (textOffen ? 'vorschlag_hide_changes' : 'vorschlag_show_changes')
                        : (textOffen ? 'vorschlag_hide_lyrics'  : 'vorschlag_show_lyrics'))}
                    </button>
                    {textOffen && (zeigeDiff
                      ? <DiffAnsicht alt={v.ziel?.liedtext} neu={v.liedtext} />
                      : <pre style={s.liedtext}>{v.liedtext}</pre>)}
                  </div>
                )}

                {v.antwort && (
                  <div style={{ fontSize:15, color:'var(--text)', background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'10px 14px' }}>
                    <b>{T('vorschlag_teacher_answer')}:</b> {v.antwort}
                  </div>
                )}

                {/* Aktionen */}
                {(v.status === 'offen' || zumStueck) && (
                  <>
                    <div style={{ height:1, background:'var(--border)' }} />
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap' }}>
                      {v.status === 'offen' && istLehrer && <>
                        <button onClick={() => setEntscheidung({ vorschlag: v, annehmen: true })} style={s.btnPri}>{T(istText ? 'vorschlag_text_accept' : 'vorschlag_accept')}</button>
                        <button onClick={() => setEntscheidung({ vorschlag: v, annehmen: false })} style={{ ...s.btnSek, marginLeft:'auto' }}>{T('vorschlag_reject')}</button>
                      </>}
                      {v.status === 'offen' && !istLehrer && <>
                        <button onClick={() => setBearbeiten(v)} style={s.btnSek}>✏️ {T('edit')}</button>
                        <button onClick={() => zurueckziehen(v)} style={{ ...s.btnSek, marginLeft:'auto', color:'var(--danger)' }}>{T('vorschlag_withdraw')}</button>
                      </>}
                      {zumStueck && (
                        <button onClick={() => navigate(`/${rollePfad}/repertoire/${zumStueck}`)} style={s.btnSek}>🎼 {T('vorschlag_open_piece')}</button>
                      )}
                    </div>
                  </>
                )}
              </div>
            )
          })}
        </div>
      )}

      {bearbeiten && (
        <VorschlagModal vorschlag={bearbeiten} onClose={() => setBearbeiten(null)} onErfolg={() => { setBearbeiten(null); neuLaden() }} />
      )}
      {entscheidung && (
        <EntscheidenModal {...entscheidung} onClose={() => setEntscheidung(null)} onErfolg={() => { setEntscheidung(null); neuLaden() }} />
      )}
    </div>
  )
}

function Feld({ label, children }) {
  return (
    <label style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <span style={s.label}>{label}</span>
      {children}
    </label>
  )
}

// Bewusst größere Schrift und Klickflächen (Feedback: Nutzer 50+)
const s = {
  label:    { fontSize:14, fontWeight:700, color:'var(--text-2)' },
  input:    { padding:'12px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:16, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', boxSizing:'border-box', width:'100%' },
  btnPri:   { padding:'12px 20px', minHeight:44, borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:16, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek:   { padding:'12px 18px', minHeight:44, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:16, fontWeight:600, cursor:'pointer', fontFamily:'inherit' },
  btnLink:  { background:'none', border:'none', padding:'8px 0', minHeight:44, fontSize:15, fontWeight:600, color:'var(--primary)', cursor:'pointer', fontFamily:'inherit' },
  chip:     { padding:'10px 16px', minHeight:44, borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:15, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  karte:    { background:'var(--surface)', borderRadius:'var(--radius)', border:'1px solid var(--border)', padding:'18px 20px', display:'flex', flexDirection:'column', gap:12, boxShadow:'var(--shadow)' },
  status:   { fontSize:14, fontWeight:700, padding:'4px 12px', borderRadius:99, border:'1.5px solid', whiteSpace:'nowrap' },
  badge:    { fontSize:14, padding:'2px 10px', borderRadius:99, background:'var(--bg-2)', color:'var(--text-2)', border:'1px solid var(--border)', fontWeight:600 },
  liedtext: { margin:'8px 0 0', whiteSpace:'pre-wrap', fontFamily:'inherit', fontSize:16, lineHeight:1.6, color:'var(--text)', background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'14px 16px', maxHeight:360, overflowY:'auto' },
  leer:     { padding:'48px 24px', textAlign:'center', color:'var(--text-2)', fontSize:16, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' },
}
