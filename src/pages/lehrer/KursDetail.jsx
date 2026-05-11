import { useState, useEffect } from 'react'
import { createPortal } from 'react-dom'
import { useParams, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import Avatar from '../../components/Avatar'

const TYP_ICON = { einzel: '🎵', gruppe: '👥', chor: '🎼', ensemble: '🎻' }
const STATUS_FARBE = {
  anwesend:    { bg:'var(--success)', text:'#fff' },
  abwesend:    { bg:'var(--danger)',  text:'#fff' },
  entschuldigt:{ bg:'var(--warning)', text:'#fff' },
  zu_spaet:    { bg:'#f59e0b',        text:'#fff' },
}

// ─── Einzelne Stunde erstellen Modal ─────────────────────────
function EinzelStundeModal({ kursId, raumId, onClose, onErfolg }) {
  const [form, setForm] = useState({
    datum:      new Date().toISOString().slice(0, 10),
    uhrzeit_von: '09:00',
    uhrzeit_bis: '10:00',
    notizen:    '',
    hausaufgaben:'',
  })
  const [raeume, setRaeume] = useState([])
  const [raum_id, setRaumId] = useState(raumId ?? '')
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    supabase.from('raeume').select('id, name').eq('aktiv', true).order('name')
      .then(({ data }) => setRaeume(data ?? []))
  }, [])

  async function erstellen() {
    if (!form.datum || !form.uhrzeit_von || !form.uhrzeit_bis) {
      setFehler('Datum und Uhrzeit sind erforderlich.'); return
    }
    setLaden(true)
    const beginn = `${form.datum}T${form.uhrzeit_von}:00`
    const ende   = `${form.datum}T${form.uhrzeit_bis}:00`

    // Stunde anlegen
    const { data: stunde, error } = await supabase.from('stunden').insert({
      unterricht_id: kursId,
      raum_id:       raum_id || null,
      beginn,
      ende,
      notizen:       form.notizen || null,
      hausaufgaben:  form.hausaufgaben || null,
    }).select().single()

    if (error) { setFehler(error.message); setLaden(false); return }

    // Lehrer der Stunde aus Unterricht übernehmen
    const { data: ul } = await supabase.from('unterricht_lehrer')
      .select('lehrer_id, rolle').eq('unterricht_id', kursId)
    if (ul?.length > 0) {
      await supabase.from('stunden_lehrer').insert(
        ul.map(l => ({ stunde_id: stunde.id, lehrer_id: l.lehrer_id, rolle: l.rolle }))
      )
    }

    onErfolg()
    onClose()
  }

  return createPortal(
    <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:460, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'28px 32px 0', flexShrink:0 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>+ Einzelne Stunde</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ overflowY:'auto', flex:1, padding:'20px 32px 28px', overscrollBehavior:'contain', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Datum</label>
            <input type="date" style={s.input} value={form.datum}
              onChange={e => setForm(f => ({ ...f, datum: e.target.value }))} />
          </div>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>Von</label>
              <input type="time" style={s.input} value={form.uhrzeit_von}
                onChange={e => setForm(f => ({ ...f, uhrzeit_von: e.target.value }))} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>Bis</label>
              <input type="time" style={s.input} value={form.uhrzeit_bis}
                onChange={e => setForm(f => ({ ...f, uhrzeit_bis: e.target.value }))} />
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Raum</label>
            <select style={s.input} value={raum_id} onChange={e => setRaumId(e.target.value)}>
              <option value="">– Kein Raum –</option>
              {raeume.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Notizen</label>
            <textarea style={{ ...s.input, minHeight:60, resize:'vertical' }} value={form.notizen}
              onChange={e => setForm(f => ({ ...f, notizen: e.target.value }))} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Hausaufgaben</label>
            <textarea style={{ ...s.input, minHeight:60, resize:'vertical' }} value={form.hausaufgaben}
              onChange={e => setForm(f => ({ ...f, hausaufgaben: e.target.value }))} />
          </div>
          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
            <button onClick={erstellen} disabled={laden} style={s.btnPri}>
              {laden ? 'Erstelle …' : '+ Stunde erstellen'}
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body)
}

// ─── Anwesenheits-Übersicht pro Schüler ───────────────────────
function AnwesenheitUebersicht({ schueler, stunden, kursName }) {
  const [anwesenheiten, setAnwesenheiten] = useState({})
  const [laden, setLaden] = useState(true)

  useEffect(() => {
    async function ladeAnwesenheit() {
      const stundenIds = stunden.filter(s => s.status === 'stattgefunden').map(s => s.id)
      if (stundenIds.length === 0) { setLaden(false); return }
      const { data } = await supabase.from('anwesenheit')
        .select('*').in('stunde_id', stundenIds)
      const map = {}
      data?.forEach(a => {
        if (!map[a.schueler_id]) map[a.schueler_id] = {}
        map[a.schueler_id][a.stunde_id] = a.status
      })
      setAnwesenheiten(map)
      setLaden(false)
    }
    ladeAnwesenheit()
  }, [stunden])

  const stattgefunden = stunden.filter(s => s.status === 'stattgefunden')

  function csvExportieren() {
    const header = ['Schüler', ...stattgefunden.map(st => new Date(st.beginn).toLocaleDateString('de-DE')), 'Quote (%)']
    const zeilen = [
      header.join(';'),
      ...schueler.map(sc => {
        const scAnw = anwesenheiten[sc.schueler_id] ?? {}
        const anwesend = stattgefunden.filter(st => ['anwesend','zu_spaet'].includes(scAnw[st.id])).length
        const quote = stattgefunden.length > 0 ? Math.round(100 * anwesend / stattgefunden.length) : ''
        const symbole = stattgefunden.map(st => {
          const v = scAnw[st.id]
          return v === 'anwesend' ? '✓' : v === 'abwesend' ? '✗' : v === 'entschuldigt' ? 'E' : v === 'zu_spaet' ? 'S' : '-'
        })
        return [`"${sc.profiles?.voller_name ?? ''}"`, ...symbole, quote].join(';')
      }),
    ]
    const blob = new Blob(['﻿' + zeilen.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `anwesenheit_${(kursName ?? 'kurs').replace(/[^a-z0-9]/gi,'_')}.csv`; a.click()
    URL.revokeObjectURL(url)
  }

  if (laden) return <div style={{ color:'var(--text-3)', fontSize:13, padding:16 }}>Lade Anwesenheiten …</div>
  if (stattgefunden.length === 0) return <div style={s.leer}>Noch keine Stunden abgehalten.</div>

  return (
    <div>
      <div style={{ display:'flex', justifyContent:'flex-end', padding:'10px 16px', borderBottom:'1px solid var(--border)' }}>
        <button onClick={csvExportieren} style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
          📥 CSV exportieren
        </button>
      </div>
      <div style={{ overflowX:'auto' }}>
        <table style={{ width:'100%', borderCollapse:'collapse', fontSize:13 }}>
          <thead>
            <tr style={{ background:'var(--bg-2)' }}>
              <th style={{ padding:'10px 14px', textAlign:'left', fontWeight:700, color:'var(--text-3)', fontSize:11, textTransform:'uppercase', borderBottom:'1px solid var(--border)', whiteSpace:'nowrap' }}>Schüler</th>
              {stattgefunden.map(st => (
                <th key={st.id} style={{ padding:'8px 6px', textAlign:'center', fontWeight:700, color:'var(--text-3)', fontSize:10, textTransform:'uppercase', borderBottom:'1px solid var(--border)', minWidth:44 }}>
                  {new Date(st.beginn).toLocaleDateString('de-DE', { day:'numeric', month:'short' })}
                </th>
              ))}
              <th style={{ padding:'10px 14px', textAlign:'center', fontWeight:700, color:'var(--text-3)', fontSize:11, textTransform:'uppercase', borderBottom:'1px solid var(--border)' }}>Quote</th>
            </tr>
          </thead>
          <tbody>
            {schueler.map((sc, i) => {
              const scAnw = anwesenheiten[sc.schueler_id] ?? {}
              const anwesend = Object.values(scAnw).filter(v => v === 'anwesend' || v === 'zu_spaet').length
              const gesamt   = stattgefunden.length
              const quote    = gesamt > 0 ? Math.round(100 * anwesend / gesamt) : null
              return (
                <tr key={sc.schueler_id} style={{ background: i%2===0 ? 'var(--surface)' : 'var(--bg)', borderBottom:'1px solid var(--border)' }}>
                  <td style={{ padding:'10px 14px', fontWeight:600, color:'var(--text)', whiteSpace:'nowrap' }}>
                    {sc.profiles?.voller_name}
                  </td>
                  {stattgefunden.map(st => {
                    const status = scAnw[st.id]
                    const f = STATUS_FARBE[status]
                    return (
                      <td key={st.id} style={{ padding:'6px', textAlign:'center' }}>
                        <span title={status ?? 'nicht erfasst'} style={{ display:'inline-block', width:24, height:24, borderRadius:'50%', background: f ? f.bg : 'var(--bg-3)', fontSize:12, lineHeight:'24px', textAlign:'center' }}>
                          {status === 'anwesend' ? '✓' : status === 'abwesend' ? '✗' : status === 'entschuldigt' ? 'E' : status === 'zu_spaet' ? 'S' : '·'}
                        </span>
                      </td>
                    )
                  })}
                  <td style={{ padding:'10px 14px', textAlign:'center' }}>
                    {quote !== null ? (
                      <span style={{ fontWeight:800, color: quote >= 80 ? 'var(--success)' : quote >= 60 ? 'var(--warning)' : 'var(--danger)' }}>
                        {quote}%
                      </span>
                    ) : '–'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Stunde absagen Modal ────────────────────────────────────
function AbsagenModal({ stunde, onClose, onErfolg }) {
  const [grund, setGrund] = useState('')
  const [laden, setLaden] = useState(false)
  const [fehler, setFehler] = useState('')

  async function absagen() {
    setLaden(true)
    const { error } = await supabase.from('stunden')
      .update({ status: 'abgesagt', notizen: grund || null })
      .eq('id', stunde.id)
    if (error) { setFehler(error.message); setLaden(false); return }
    supabase.functions.invoke('send-email', { body: { type: 'stunde_abgesagt', stunde_id: stunde.id } }).catch(() => {})
    onErfolg()
    onClose()
  }

  const beginn = new Date(stunde.beginn)
  return createPortal(
    <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:440, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>Stunde absagen</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <p style={{ margin:'0 0 16px', color:'var(--text-2)', fontSize:14 }}>
          {beginn.toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })} um {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr
        </p>
        <div style={{ display:'flex', flexDirection:'column', gap:6, marginBottom:20 }}>
          <label style={s.label}>Grund (optional)</label>
          <textarea style={{ ...s.input, minHeight:70, resize:'vertical' }}
            placeholder="z.B. Lehrer krank, Feiertag …"
            value={grund} onChange={e => setGrund(e.target.value)} />
        </div>
        {fehler && <p style={{ margin:'0 0 12px', color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
          <button onClick={absagen} disabled={laden}
            style={{ ...s.btnPri, background:'var(--danger)' }}>
            {laden ? 'Absage …' : '❌ Stunde absagen'}
          </button>
        </div>
      </div>
    </div>
  , document.body)
}

// ─── Anwesenheit erfassen Modal ───────────────────────────────
function AnwesenheitModal({ stunde, schueler, onClose, onErfolg }) {
  const { profil } = useApp()
  const [stati, setStati] = useState(
    Object.fromEntries(schueler.map(s => [s.schueler_id, 'anwesend']))
  )
  const [laden, setLaden] = useState(false)

  // Bestehende Anwesenheit laden
  useEffect(() => {
    async function laden() {
      const { data } = await supabase.from('anwesenheit').select('*').eq('stunde_id', stunde.id)
      if (data?.length > 0) {
        setStati(Object.fromEntries(data.map(a => [a.schueler_id, a.status])))
      }
    }
    laden()
  }, [stunde.id])

  async function speichern() {
    setLaden(true)
    const payload = schueler.map(s => ({ id: s.schueler_id, status: stati[s.schueler_id] ?? 'anwesend' }))
    await supabase.rpc('anwesenheit_erfassen', { p_stunde_id: stunde.id, p_schueler: payload })
    onErfolg()
    onClose()
  }

  const beginn = new Date(stunde.beginn)

  return createPortal(
    <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:500, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'28px 32px 0', flexShrink:0 }}>
          <div>
            <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>✅ Anwesenheit</h3>
            <div style={{ fontSize:13, color:'var(--text-3)', marginTop:4 }}>
              {beginn.toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })} · {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)' }}>✕</button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'20px 32px 28px', overscrollBehavior:'contain', display:'flex', flexDirection:'column', gap:10 }}>
          {schueler.map(s => (
            <div key={s.schueler_id} style={{ display:'flex', alignItems:'center', gap:12, padding:'10px 14px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)' }}>
              <Avatar name={s.profiles?.voller_name} avatarUrl={s.profiles?.avatar_url} size={36} />
              <span style={{ flex:1, fontSize:14, fontWeight:600, color:'var(--text)' }}>{s.profiles?.voller_name}</span>
              <div style={{ display:'flex', gap:4 }}>
                {['anwesend','abwesend','entschuldigt','zu_spaet'].map(st => (
                  <button key={st} onClick={() => setStati(prev => ({ ...prev, [s.schueler_id]: st }))}
                    style={{ padding:'4px 8px', borderRadius:6, border:`2px solid ${stati[s.schueler_id]===st ? STATUS_FARBE[st].bg : 'var(--border)'}`, background: stati[s.schueler_id]===st ? STATUS_FARBE[st].bg : 'transparent', color: stati[s.schueler_id]===st ? STATUS_FARBE[st].text : 'var(--text-3)', fontSize:11, cursor:'pointer', fontFamily:'inherit', fontWeight:700, transition:'all 0.1s' }}>
                    {st === 'anwesend' ? '✓' : st === 'abwesend' ? '✗' : st === 'entschuldigt' ? 'E' : 'S'}
                  </button>
                ))}
              </div>
            </div>
          ))}

          <div style={{ display:'flex', gap:10, justifyContent:'flex-end', marginTop:10 }}>
            <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
            <button onClick={speichern} disabled={laden} style={s.btnPri}>
              {laden ? 'Speichere …' : '💾 Anwesenheit speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body)
}

function StundenBulkModal({ kurs, onClose, onErfolg }) {
  const { confirm } = useApp()
  const [von,         setVon]         = useState('')
  const [bis,         setBis]         = useState('')
  const [laden,       setLaden]       = useState(false)
  const [loeschLaden, setLoeschLaden] = useState(false)
  const [result,      setResult]      = useState(null)
  const [geloescht,   setGeloescht]   = useState(null)
  const [fehler,      setFehler]      = useState('')

  async function generieren() {
    if (!von || !bis) { setFehler('Bitte Von- und Bis-Datum wählen.'); return }
    if (!kurs.wochentag) { setFehler('Kurs hat keinen Wochentag definiert.'); return }
    setLaden(true); setFehler(''); setGeloescht(null)
    const { data, error } = await supabase.rpc('stunden_generieren', { p_unterricht_id: kurs.id, p_von: von, p_bis: bis })
    if (error) setFehler(error.message)
    else { setResult(data); onErfolg() }
    setLaden(false)
  }

  async function loeschen() {
    if (!von || !bis) { setFehler('Bitte Von- und Bis-Datum wählen.'); return }
    const ok = await confirm(`Alle Stunden von ${von} bis ${bis} für „${kurs.name}" löschen?`, { confirmLabel: 'Löschen' })
    if (!ok) return
    setLoeschLaden(true); setFehler(''); setResult(null)
    const { data, error } = await supabase.from('stunden').delete()
      .eq('unterricht_id', kurs.id)
      .gte('beginn', `${von}T00:00:00`).lte('beginn', `${bis}T23:59:59`).select('id')
    if (error) setFehler(error.message)
    else { setGeloescht(data?.length ?? 0); onErfolg() }
    setLoeschLaden(false)
  }

  return createPortal(
    <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:460, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>⚡ Stunden – {kurs.name}</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
          {kurs.wochentag ? (
            <div style={{ padding:'10px 14px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)', fontSize:14, color:'var(--text-2)' }}>
              📅 Jede Woche am <strong>{kurs.wochentag.toUpperCase()}</strong> von <strong>{kurs.uhrzeit_von}</strong> bis <strong>{kurs.uhrzeit_bis}</strong>
            </div>
          ) : (
            <div style={{ padding:'10px 14px', borderRadius:'var(--radius)', background:'#fee2e2', border:'1px solid #fecaca', fontSize:13, color:'var(--danger)' }}>
              ⚠️ Kein Wochentag/Uhrzeit definiert. Bitte erst im Kurs eintragen.
            </div>
          )}
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Von</label>
              <input type="date" style={bulkInput} value={von} onChange={e => setVon(e.target.value)} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>Bis</label>
              <input type="date" style={bulkInput} value={bis} onChange={e => setBis(e.target.value)} />
            </div>
          </div>
          {result !== null && (
            <div style={{ padding:'12px 16px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--success)', color:'var(--success)', fontWeight:700, fontSize:14 }}>
              ✅ {result} Stunden generiert!
            </div>
          )}
          {geloescht !== null && (
            <div style={{ padding:'12px 16px', borderRadius:'var(--radius)', background:'#fee2e2', border:'1px solid #fecaca', color:'var(--danger)', fontWeight:700, fontSize:14 }}>
              🗑 {geloescht} Stunden gelöscht.
            </div>
          )}
          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'space-between', marginTop:4 }}>
            <button onClick={loeschen} disabled={loeschLaden || !von || !bis}
              style={{ padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:13, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
              {loeschLaden ? 'Lösche …' : '🗑 Löschen'}
            </button>
            <div style={{ display:'flex', gap:10 }}>
              <button onClick={onClose} style={{ padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' }}>Schließen</button>
              <button onClick={generieren} disabled={laden || !kurs.wochentag} style={{ padding:'10px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' }}>
                {laden ? 'Generiere …' : '⚡ Generieren'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  , document.body)
}

const bulkInput = { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%', boxSizing:'border-box' }

function SchuelerProfilModal({ profil: p, onClose }) {
  const alter = p?.geburtsdatum
    ? Math.floor((new Date() - new Date(p.geburtsdatum)) / (365.25 * 24 * 60 * 60 * 1000))
    : null
  return createPortal(
    <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:340, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:17, fontWeight:800, color:'var(--text)' }}>Schüler-Profil</h3>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4 }}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
          <Avatar name={p?.voller_name} avatarUrl={p?.avatar_url} size={72} />
          <div style={{ fontWeight:800, fontSize:18, color:'var(--text)', textAlign:'center' }}>{p?.voller_name}</div>
          {p?.geburtsdatum && (
            <div style={{ width:'100%', padding:'12px 16px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)', fontSize:14, color:'var(--text-2)', display:'flex', gap:10, alignItems:'center' }}>
              <span style={{ fontSize:18 }}>🎂</span>
              <div>
                <div>{new Date(p.geburtsdatum).toLocaleDateString('de-DE', { day:'numeric', month:'long', year:'numeric' })}</div>
                {alter !== null && <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{alter} Jahre alt</div>}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  , document.body)
}

function NotizModal({ stunde, onClose, onErfolg }) {
  const [notizen,      setNotizen]      = useState(stunde.notizen ?? '')
  const [hausaufgaben, setHausaufgaben] = useState(stunde.hausaufgaben ?? '')
  const [laden,        setLaden]        = useState(false)

  async function speichern() {
    setLaden(true)
    await supabase.from('stunden').update({
      notizen:      notizen.trim()      || null,
      hausaufgaben: hausaufgaben.trim() || null,
    }).eq('id', stunde.id)
    const neueHA = hausaufgaben.trim()
    if (neueHA && neueHA !== (stunde.hausaufgaben ?? '').trim()) {
      supabase.functions.invoke('send-email', { body: { type: 'hausaufgaben', stunde_id: stunde.id, hausaufgaben: neueHA } }).catch(() => {})
    }
    onErfolg({ notizen: notizen.trim() || null, hausaufgaben: hausaufgaben.trim() || null })
    onClose()
  }

  const beginn = new Date(stunde.beginn)
  return createPortal(
    <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'24px 28px', width:'100%', maxWidth:440, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:16 }}>
          <h3 style={{ margin:0, fontSize:16, fontWeight:800, color:'var(--text)' }}>
            📝 {beginn.toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })}
          </h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Notizen</label>
            <textarea style={{ ...s.input, minHeight:60, resize:'vertical' }} value={notizen}
              onChange={e => setNotizen(e.target.value)} placeholder="z.B. Atemtechnik besprochen …" />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>Hausaufgaben</label>
            <textarea style={{ ...s.input, minHeight:60, resize:'vertical' }} value={hausaufgaben}
              onChange={e => setHausaufgaben(e.target.value)} placeholder="z.B. Takt 1–8 üben …" />
          </div>
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
            <button onClick={speichern} disabled={laden} style={s.btnPri}>
              {laden ? 'Speichere …' : '💾 Speichern'}
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body)
}

export default function KursDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const location   = useLocation()
  const segment    = location.pathname.split('/')[1]  // 'admin' | 'lehrer'
  const { profil, T, toast, confirm } = useApp()
  const [kurs,     setKurs]     = useState(null)
  const [schueler, setSchueler] = useState([])
  const [stunden,  setStunden]  = useState([])
  const [laden,    setLaden]    = useState(true)
  const [aktiveTab, setAktiveTab] = useState('stunden')
  const [modal,        setModal]        = useState(null)
  const [stundenFilter, setStundenFilter] = useState('alle')
  const [jahrFilter,   setJahrFilter]   = useState('')
  const [monatFilter,  setMonatFilter]  = useState('')
  const [alleSchueler,      setAlleSchueler]      = useState([])
  const [schuelerSuche,     setSchuelerSuche]     = useState('')
  const [schuelerProfilModal, setSchuelerProfilModal] = useState(null)

  useEffect(() => {
    async function ladeData() {
      const [k, sc, st] = await Promise.all([
        supabase.from('unterricht').select('*, instrumente(name_de, icon), raeume(name), unterricht_lehrer(lehrer_id, rolle, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name, avatar_url))').eq('id', id).single(),
        supabase.from('unterricht_schueler').select('*, profiles!unterricht_schueler_schueler_id_fkey(id, voller_name, geburtsdatum, avatar_url)').eq('unterricht_id', id).eq('status', 'aktiv'),
        supabase.from('stunden').select('*').eq('unterricht_id', id).order('beginn', { ascending: false }),
      ])
      setKurs(k.data)
      setSchueler(sc.data ?? [])
      setStunden(st.data ?? [])
      setLaden(false)
    }
    ladeData()
  }, [id])

  function notizenDrucken() {
    const mitInhalt = stunden
      .filter(st => st.status === 'stattgefunden' && (st.notizen || st.hausaufgaben))
      .sort((a, b) => new Date(a.beginn) - new Date(b.beginn))
    if (mitInhalt.length === 0) { toast('Keine Notizen oder Hausaufgaben vorhanden.', 'warning'); return }
    const farbe = kurs.farbe ?? '#6366f1'
    const html = `<!DOCTYPE html><html lang="de"><head><meta charset="utf-8">
<title>Unterrichtsnotizen – ${kurs.name}</title>
<style>
  body{font-family:Georgia,serif;max-width:800px;margin:40px auto;color:#222;padding:0 24px}
  h1{font-size:22px;margin:0 0 4px}
  .sub{color:#666;font-size:13px;margin:0 0 32px}
  .stunde{margin-bottom:24px;border-left:3px solid ${farbe};padding-left:16px}
  .datum{font-weight:700;font-size:15px;color:#333;margin-bottom:8px}
  .label{font-size:11px;font-weight:700;text-transform:uppercase;letter-spacing:.06em;color:#888;margin-bottom:3px}
  .inhalt{font-size:13px;white-space:pre-wrap;color:#444;margin:0}
  .block{margin-bottom:10px}
  @media print{body{margin:20px}}
</style></head><body>
<h1>${kurs.name} – Unterrichtsnotizen</h1>
<p class="sub">Erstellt am ${new Date().toLocaleDateString('de-DE')} · ${mitInhalt.length} Einträge</p>
${mitInhalt.map(st => {
  const d = new Date(st.beginn)
  const datum = d.toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long', year:'numeric' })
  const uhrzeit = d.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })
  return `<div class="stunde">
<div class="datum">${datum} · ${uhrzeit} Uhr</div>
${st.notizen ? `<div class="block"><div class="label">📝 Notizen</div><p class="inhalt">${st.notizen.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p></div>` : ''}
${st.hausaufgaben ? `<div class="block"><div class="label">📚 Hausaufgaben</div><p class="inhalt">${st.hausaufgaben.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')}</p></div>` : ''}
</div>`
}).join('')}
</body></html>`
    const w = window.open('', '_blank')
    w.document.write(html)
    w.document.close()
    w.print()
  }

  async function stundeWiederherstellen(stundeId) {
    const { error } = await supabase.from('stunden')
      .update({ status: 'geplant' })
      .eq('id', stundeId)
    if (error) { toast(error.message, 'error'); return }
    setStunden(prev => prev.map(st => st.id === stundeId ? { ...st, status: 'geplant' } : st))
  }

  async function stundeLoeschen(stundeId, beginn) {
    const datum = new Date(beginn).toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })
    const ok = await confirm(`Stunde vom ${datum} löschen?`, { sub: 'Alle Anwesenheiten werden ebenfalls gelöscht.', confirmLabel: 'Löschen' })
    if (!ok) return
    const { error } = await supabase.from('stunden').delete().eq('id', stundeId)
    if (error) { toast(error.message, 'error'); return }
    setStunden(prev => prev.filter(st => st.id !== stundeId))
  }

  useEffect(() => {
    if (aktiveTab !== 'schueler' || alleSchueler.length > 0) return
    supabase.from('profiles')
      .select('id, voller_name, rolle')
      .in('rolle', ['schueler', 'vorstand', 'admin', 'superadmin'])
      .eq('aktiv', true).order('voller_name')
      .then(({ data }) => setAlleSchueler(data ?? []))
  }, [aktiveTab])

  async function schuelerHinzufuegen(schuelerId) {
    await supabase.from('unterricht_schueler').upsert({ unterricht_id: id, schueler_id: schuelerId, status: 'aktiv' })
    const { data } = await supabase.from('unterricht_schueler')
      .select('*, profiles!unterricht_schueler_schueler_id_fkey(id, voller_name, geburtsdatum, avatar_url)')
      .eq('unterricht_id', id).eq('status', 'aktiv')
    setSchueler(data ?? [])
  }

  async function schuelerEntfernen(schuelerId) {
    const ok = await confirm('Schüler aus Kurs entfernen?', { confirmLabel: 'Entfernen' })
    if (!ok) return
    await supabase.from('unterricht_schueler').delete().eq('unterricht_id', id).eq('schueler_id', schuelerId)
    setSchueler(prev => prev.filter(sc => sc.schueler_id !== schuelerId))
  }

  if (laden) return <div style={{ padding:40, color:'var(--text-3)' }}>{T('loading')}</div>
  if (!kurs)  return <div style={{ padding:40, color:'var(--danger)' }}>Kurs nicht gefunden.</div>

  const jetzt = new Date()
  const naechsteStunde = stunden.find(st => new Date(st.beginn) > jetzt && st.status === 'geplant')

  return (
    <div>
      {/* Header */}
      <button onClick={() => navigate(`/${segment}/kurse`)} style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 16px' }}>{T('kurs_back_to')}</button>

      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', marginBottom:24, boxShadow:'var(--shadow)' }}>
        <div style={{ height:6, background: kurs.farbe ?? 'var(--primary)' }} />
        <div style={{ padding:'20px 24px' }}>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:12 }}>
            <div>
              <div style={{ display:'flex', alignItems:'center', gap:10, marginBottom:6 }}>
                <span style={{ fontSize:28 }}>{TYP_ICON[kurs.typ]}</span>
                <h1 style={{ margin:0, fontSize:22, fontWeight:800, color:'var(--text)' }}>{kurs.name}</h1>
              </div>
              <div style={{ display:'flex', gap:16, flexWrap:'wrap', fontSize:13, color:'var(--text-2)' }}>
                {kurs.instrumente && <span>{kurs.instrumente.icon} {kurs.instrumente.name_de}</span>}
                {kurs.wochentag   && <span>📅 {kurs.wochentag.toUpperCase()} {kurs.uhrzeit_von?.slice(0,5)}–{kurs.uhrzeit_bis?.slice(0,5)}</span>}
                {kurs.raeume      && <span>🏫 {kurs.raeume.name}</span>}
                <span>👥 {schueler.length} Schüler</span>
              </div>
            </div>
            <button onClick={() => navigate(`/lehrer/kurse/${id}/unterrichtsmodus`)}
              style={{ padding:'10px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--accent)', color:'var(--accent-fg)', fontSize:14, fontWeight:800, cursor:'pointer', fontFamily:'inherit' }}>
              {T('kurs_teaching_mode')}
            </button>
          </div>

          {/* Lehrer */}
          <div style={{ marginTop:12, display:'flex', gap:8, flexWrap:'wrap' }}>
            {kurs.unterricht_lehrer?.map(ul => (
              <span key={ul.lehrer_id} style={{ fontSize:12, padding:'3px 10px', borderRadius:99, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-2)' }}>
                👨‍🏫 {ul.profiles?.voller_name} {ul.rolle === 'hauptlehrer' ? '(Haupt)' : '(Co)'}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div style={{ display:'flex', gap:4, marginBottom:20, borderBottom:'2px solid var(--border)' }}>
        {[['stunden', T('kurs_tab_lessons')],['anwesenheit', T('kurs_tab_attendance')],['schueler', T('kurs_tab_students')],['repertoire', T('kurs_tab_repertoire')]].map(([key, label]) => (
          <button key={key}
            onClick={() => key === 'repertoire' ? navigate(`/${segment}/kurse/${id}/repertoire`) : setAktiveTab(key)}
            style={{ padding:'10px 18px', background:'none', border:'none', fontSize:14, cursor:'pointer', fontFamily:'inherit', color: aktiveTab===key ? 'var(--text)' : 'var(--text-3)', fontWeight: aktiveTab===key ? 800 : 500, borderBottom:`2px solid ${aktiveTab===key ? 'var(--primary)' : 'transparent'}`, marginBottom:-2, transition:'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Stunden */}
      {aktiveTab === 'stunden' && (
        <div>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:14 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:8, flex:1 }}>
              {/* Status-Filter */}
              <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
                {[['alle', T('filter_all')], ['geplant', T('kurs_status_planned')], ['stattgefunden', T('kurs_status_done')], ['abgesagt', T('kurs_status_cancelled')]].map(([val, label]) => (
                  <button key={val} onClick={() => setStundenFilter(val)} style={{
                    padding:'5px 12px', borderRadius:99, border:'1.5px solid', fontSize:12, fontWeight:600,
                    cursor:'pointer', fontFamily:'inherit', transition:'all 0.15s',
                    borderColor: stundenFilter===val ? 'var(--primary)' : 'var(--border)',
                    background:  stundenFilter===val ? 'var(--primary)' : 'transparent',
                    color:       stundenFilter===val ? 'var(--primary-fg)' : 'var(--text-3)',
                  }}>{label}</button>
                ))}
              </div>
              {/* Jahr- und Monat-Filter */}
              {stunden.length > 0 && (() => {
                const jahre  = [...new Set(stunden.map(st => new Date(st.beginn).getFullYear()))].sort((a,b) => b-a)
                const monate = [
                  { val:'1',  label:'Januar' }, { val:'2',  label:'Februar' }, { val:'3',  label:'März' },
                  { val:'4',  label:'April' },  { val:'5',  label:'Mai' },     { val:'6',  label:'Juni' },
                  { val:'7',  label:'Juli' },   { val:'8',  label:'August' },  { val:'9',  label:'September' },
                  { val:'10', label:'Oktober' },{ val:'11', label:'November' },{ val:'12', label:'Dezember' },
                ]
                if (jahre.length < 2 && stunden.length < 6) return null
                return (
                  <div style={{ display:'flex', gap:8 }}>
                    <select value={jahrFilter} onChange={e => setJahrFilter(e.target.value)} style={selStyle}>
                      <option value=''>Alle Jahre</option>
                      {jahre.map(j => <option key={j} value={j}>{j}</option>)}
                    </select>
                    <select value={monatFilter} onChange={e => setMonatFilter(e.target.value)} style={selStyle}>
                      <option value=''>Alle Monate</option>
                      {monate.map(m => <option key={m.val} value={m.val}>{m.label}</option>)}
                    </select>
                  </div>
                )
              })()}
            </div>
            <div style={{ display:'flex', gap:8, flexShrink:0 }}>
              <button onClick={notizenDrucken} style={s.btnSek} title="Notizen und Hausaufgaben drucken / als PDF">
                🖨 Notizen
              </button>
              <button onClick={() => setModal({ typ:'stunden_bulk' })} style={s.btnSek} title="Wochentermine für einen Zeitraum generieren oder löschen">
                ⚡ Generieren
              </button>
              <button onClick={() => setModal({ typ:'einzelstunde' })} style={s.btnPri}>
                {T('kurs_create_lesson')}
              </button>
            </div>
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {(() => {
              let gefiltert = stundenFilter === 'alle' ? stunden : stunden.filter(st => st.status === stundenFilter)
              if (jahrFilter)  gefiltert = gefiltert.filter(st => new Date(st.beginn).getFullYear()  === Number(jahrFilter))
              if (monatFilter) gefiltert = gefiltert.filter(st => new Date(st.beginn).getMonth() + 1 === Number(monatFilter))
              if (gefiltert.length === 0) return <div style={s.leer}>{stunden.length === 0 ? T('kurs_no_lessons_found') : T('no_results')}</div>
              return gefiltert.map(st => {
            const beginn   = new Date(st.beginn)
            const istVorbei = beginn < jetzt
            const istHeute  = beginn.toDateString() === jetzt.toDateString()
            return (
              <div key={st.id} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'12px 16px', border:`1px solid ${istHeute ? 'var(--accent)' : 'var(--border)'}`, display:'flex', flexDirection:'column', gap:10 }}>
                {/* Obere Zeile: Datum + Info */}
                <div style={{ display:'flex', alignItems:'center', gap:14 }}>
                  <div style={{ textAlign:'center', minWidth:48, flexShrink:0 }}>
                    <div style={{ fontSize:11, fontWeight:700, color: istHeute ? 'var(--accent)' : 'var(--text-3)', textTransform:'uppercase' }}>
                      {istHeute ? 'Heute' : beginn.toLocaleDateString('de-DE', { weekday:'short' })}
                    </div>
                    <div style={{ fontSize:17, fontWeight:800, color:'var(--text)' }}>
                      {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })}
                    </div>
                    <div style={{ fontSize:11, color:'var(--text-3)' }}>
                      {beginn.toLocaleDateString('de-DE', { day:'numeric', month:'short' })}
                    </div>
                  </div>
                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontSize:12, color:'var(--text-3)' }}>
                      {st.status === 'stattgefunden' ? T('kurs_status_done') : st.status === 'abgesagt' ? T('kurs_status_cancelled') : T('kurs_status_planned')}
                    </div>
                    {st.notizen && <div style={{ fontSize:12, color:'var(--text-2)', marginTop:4 }}>📝 {st.notizen}</div>}
                    {st.hausaufgaben && <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2 }}>📚 {st.hausaufgaben}</div>}
                  </div>
                </div>
                {/* Untere Zeile: Buttons */}
                <div style={{ display:'flex', gap:6, flexWrap:'wrap', justifyContent:'flex-end' }}>
                  {!istVorbei && st.status === 'geplant' && (
                    <button onClick={() => setModal({ typ:'anwesenheit', stunde: st })}
                      style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      {T('kurs_mark_attendance')}
                    </button>
                  )}
                  {istVorbei && st.status === 'geplant' && (
                    <button onClick={() => setModal({ typ:'anwesenheit', stunde: st })}
                      style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      {T('kurs_mark_late')}
                    </button>
                  )}
                  {st.status === 'geplant' && (
                    <button onClick={() => setModal({ typ:'absagen', stunde: st })}
                      style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'1px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      {T('kurs_cancel_btn')}
                    </button>
                  )}
                  {st.status === 'stattgefunden' && (
                    <button onClick={() => setModal({ typ:'anwesenheit', stunde: st })}
                      style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-2)', fontSize:12, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      ✏️ Anwesenheit
                    </button>
                  )}
                  {st.status === 'abgesagt' && (
                    <button onClick={() => stundeWiederherstellen(st.id)}
                      style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                      {T('kurs_restore')}
                    </button>
                  )}
                  <button onClick={() => setModal({ typ:'notiz', stunde: st })}
                    style={{ padding:'6px 10px', borderRadius:'var(--radius)', border:'1px solid var(--border)', background:'transparent', color:'var(--text-3)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}
                    title="Notizen bearbeiten">
                    📝
                  </button>
                  <button onClick={() => stundeLoeschen(st.id, st.beginn)}
                    style={{ padding:'6px 10px', borderRadius:'var(--radius)', border:'1px solid var(--danger)', background:'transparent', color:'var(--danger)', fontSize:12, cursor:'pointer', fontFamily:'inherit' }}>
                    🗑
                  </button>
                </div>
              </div>
            )
          })
            })()}
          </div>
        </div>
      )}

      {/* Tab: Anwesenheit */}
      {aktiveTab === 'anwesenheit' && (
        <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', overflow:'hidden', boxShadow:'var(--shadow)' }}>
          <AnwesenheitUebersicht schueler={schueler} stunden={stunden} kursName={kurs?.name} />
        </div>
      )}

      {/* Tab: Schüler */}
      {aktiveTab === 'schueler' && (() => {
        const teilnehmerIds = new Set(schueler.map(sc => sc.schueler_id))
        const verfuegbar = alleSchueler.filter(s =>
          !teilnehmerIds.has(s.id) &&
          (!schuelerSuche || s.voller_name.toLowerCase().includes(schuelerSuche.toLowerCase()))
        )
        return (
          <div style={{ display:'flex', flexDirection:'column', gap:16 }}>
            {/* Aktuelle Teilnehmer */}
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
              <div style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' }}>
                Teilnehmer ({schueler.length})
              </div>
              {schueler.length === 0
                ? <div style={s.leer}>{T('kurs_no_active')}</div>
                : schueler.map(sc => (
                  <div key={sc.schueler_id} onClick={() => setSchuelerProfilModal(sc.profiles)} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'12px 16px', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:12, cursor:'pointer' }}
                    onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
                    onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
                    <Avatar name={sc.profiles?.voller_name} avatarUrl={sc.profiles?.avatar_url} size={36} />
                    <div style={{ flex:1 }}>
                      <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{sc.profiles?.voller_name}</div>
                      {sc.profiles?.geburtsdatum && (
                        <div style={{ fontSize:12, color:'var(--text-3)', marginTop:1 }}>
                          🎂 {new Date(sc.profiles.geburtsdatum).toLocaleDateString('de-DE')}
                        </div>
                      )}
                    </div>
                    {sc.stimmgruppe && sc.stimmgruppe !== 'keine' && (
                      <span style={{ fontSize:12, padding:'3px 10px', borderRadius:99, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-2)', textTransform:'capitalize' }}>
                        {sc.stimmgruppe}
                      </span>
                    )}
                    <button onClick={e => { e.stopPropagation(); schuelerEntfernen(sc.schueler_id) }}
                      style={{ background:'none', border:'none', fontSize:16, cursor:'pointer', color:'var(--danger)', padding:'4px 6px', lineHeight:1 }}
                      title="Aus Kurs entfernen">🗑</button>
                  </div>
                ))
              }
            </div>

            {/* Schüler hinzufügen */}
            {alleSchueler.length > 0 && (
              <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', padding:'16px 20px' }}>
                <div style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em', marginBottom:10 }}>
                  Schüler hinzufügen
                </div>
                <input
                  value={schuelerSuche}
                  onChange={e => setSchuelerSuche(e.target.value)}
                  placeholder="Name suchen …"
                  style={s.input}
                />
                {schuelerSuche && (
                  <div style={{ marginTop:8, display:'flex', flexWrap:'wrap', gap:8 }}>
                    {verfuegbar.length === 0
                      ? <span style={{ fontSize:13, color:'var(--text-3)' }}>Keine Treffer</span>
                      : verfuegbar.map(sc => (
                        <button key={sc.id} onClick={() => { schuelerHinzufuegen(sc.id); setSchuelerSuche('') }}
                          style={{ padding:'6px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' }}>
                          + {sc.voller_name}
                          {(sc.rolle === 'admin' || sc.rolle === 'superadmin') && <span style={{ opacity:0.6, fontSize:11 }}> (Admin)</span>}
                        </button>
                      ))
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        )
      })()}


      {modal?.typ === 'anwesenheit' && (
        <AnwesenheitModal
          stunde={modal.stunde}
          schueler={schueler}
          onClose={() => setModal(null)}
          onErfolg={() => {
            setStunden(prev => prev.map(st => st.id === modal.stunde.id ? { ...st, status: 'stattgefunden' } : st))
          }}
        />
      )}
      {modal?.typ === 'absagen' && (
        <AbsagenModal
          stunde={modal.stunde}
          onClose={() => setModal(null)}
          onErfolg={() => {
            setStunden(prev => prev.map(st => st.id === modal.stunde.id ? { ...st, status: 'abgesagt' } : st))
            setModal(null)
          }}
        />
      )}
      {modal?.typ === 'einzelstunde' && (
        <EinzelStundeModal
          kursId={id}
          raumId={kurs?.raum_id}
          onClose={() => setModal(null)}
          onErfolg={async () => {
            const { data } = await supabase.from('stunden').select('*').eq('unterricht_id', id).order('beginn', { ascending: false })
            setStunden(data ?? [])
          }}
        />
      )}
      {modal?.typ === 'stunden_bulk' && (
        <StundenBulkModal
          kurs={kurs}
          onClose={() => setModal(null)}
          onErfolg={async () => {
            const { data } = await supabase.from('stunden').select('*').eq('unterricht_id', id).order('beginn', { ascending: false })
            setStunden(data ?? [])
          }}
        />
      )}
      {schuelerProfilModal && (
        <SchuelerProfilModal profil={schuelerProfilModal} onClose={() => setSchuelerProfilModal(null)} />
      )}
      {modal?.typ === 'notiz' && (
        <NotizModal
          stunde={modal.stunde}
          onClose={() => setModal(null)}
          onErfolg={({ notizen, hausaufgaben }) => {
            setStunden(prev => prev.map(st => st.id === modal.stunde.id ? { ...st, notizen, hausaufgaben } : st))
          }}
        />
      )}
    </div>
  )
}

const s = {
  leer:   { padding:'32px', textAlign:'center', color:'var(--text-3)', fontSize:13, background:'var(--surface)', borderRadius:'var(--radius)', border:'1px solid var(--border)' },
  btnPri: { padding:'10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  btnSek: { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  iconBtn:{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4, lineHeight:1 },
  label:  { fontSize:13, fontWeight:600, color:'var(--text-2)' },
  input:  { padding:'9px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text)', fontSize:14, fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' },
}

const selStyle = {
  padding:'5px 10px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)',
  background:'var(--bg)', color:'var(--text)', fontSize:12, fontFamily:'inherit',
  cursor:'pointer', outline:'none',
}
