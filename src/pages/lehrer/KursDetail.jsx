import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
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

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:460, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>+ Einzelne Stunde</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
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
  )
}

// ─── Anwesenheits-Übersicht pro Schüler ───────────────────────
function AnwesenheitUebersicht({ schueler, stunden }) {
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

  if (laden) return <div style={{ color:'var(--text-3)', fontSize:13, padding:16 }}>Lade Anwesenheiten …</div>
  if (stattgefunden.length === 0) return <div style={s.leer}>Noch keine Stunden abgehalten.</div>

  return (
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
    onErfolg()
    onClose()
  }

  const beginn = new Date(stunde.beginn)
  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:440, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
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
  )
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

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:500, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <div>
            <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>✅ Anwesenheit</h3>
            <div style={{ fontSize:13, color:'var(--text-3)', marginTop:4 }}>
              {beginn.toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })} · {beginn.toLocaleTimeString('de-DE', { hour:'2-digit', minute:'2-digit' })} Uhr
            </div>
          </div>
          <button onClick={onClose} style={{ background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)' }}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:10, marginBottom:20 }}>
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
        </div>

        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={s.btnSek}>Abbrechen</button>
          <button onClick={speichern} disabled={laden} style={s.btnPri}>
            {laden ? 'Speichere …' : '💾 Anwesenheit speichern'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default function KursDetail() {
  const { id }     = useParams()
  const navigate   = useNavigate()
  const { profil, T } = useApp()
  const [kurs,     setKurs]     = useState(null)
  const [schueler, setSchueler] = useState([])
  const [stunden,  setStunden]  = useState([])
  const [laden,    setLaden]    = useState(true)
  const [aktiveTab, setAktiveTab] = useState('stunden')
  const [modal,        setModal]        = useState(null)
  const [stundenFilter, setStundenFilter] = useState('alle')
  const [jahrFilter,   setJahrFilter]   = useState('')
  const [monatFilter,  setMonatFilter]  = useState('')

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

  async function stundeWiederherstellen(stundeId) {
    const { error } = await supabase.from('stunden')
      .update({ status: 'geplant' })
      .eq('id', stundeId)
    if (error) { alert(error.message); return }
    setStunden(prev => prev.map(st => st.id === stundeId ? { ...st, status: 'geplant' } : st))
  }

  async function stundeLoeschen(stundeId, beginn) {
    const datum = new Date(beginn).toLocaleDateString('de-DE', { weekday:'long', day:'numeric', month:'long' })
    if (!window.confirm(`Stunde vom ${datum} wirklich löschen? Alle Anwesenheiten werden ebenfalls gelöscht.`)) return
    const { error } = await supabase.from('stunden').delete().eq('id', stundeId)
    if (error) { alert(error.message); return }
    setStunden(prev => prev.filter(st => st.id !== stundeId))
  }

  if (laden) return <div style={{ padding:40, color:'var(--text-3)' }}>{T('loading')}</div>
  if (!kurs)  return <div style={{ padding:40, color:'var(--danger)' }}>Kurs nicht gefunden.</div>

  const jetzt = new Date()
  const naechsteStunde = stunden.find(st => new Date(st.beginn) > jetzt && st.status === 'geplant')

  return (
    <div>
      {/* Header */}
      <button onClick={() => navigate('/lehrer/kurse')} style={{ background:'none', border:'none', color:'var(--text-3)', fontSize:14, cursor:'pointer', fontFamily:'inherit', padding:'0 0 16px' }}>{T('kurs_back_to')}</button>

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
          <button key={key} onClick={() => setAktiveTab(key)}
            style={{ padding:'10px 18px', background:'none', border:'none', fontSize:14, cursor:'pointer', fontFamily:'inherit', color: aktiveTab===key ? 'var(--text)' : 'var(--text-3)', fontWeight: aktiveTab===key ? 800 : 500, borderBottom:`2px solid ${aktiveTab===key ? 'var(--primary)' : 'transparent'}`, marginBottom:-2, transition:'all 0.15s' }}>
            {label}
          </button>
        ))}
      </div>

      {/* Tab: Stunden */}
      {aktiveTab === 'stunden' && (
        <div>
          <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', flexWrap:'wrap', gap:10, marginBottom:14 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:8 }}>
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
            <button onClick={() => setModal({ typ:'einzelstunde' })} style={s.btnPri}>
              {T('kurs_create_lesson')}
            </button>
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
                    {st.hausaufgaben && <div style={{ fontSize:12, color:'var(--text-2)', marginTop:2, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>📝 {st.hausaufgaben}</div>}
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
          <AnwesenheitUebersicht schueler={schueler} stunden={stunden} />
        </div>
      )}

      {/* Tab: Schüler */}
      {aktiveTab === 'schueler' && (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {schueler.length === 0 ? <div style={s.leer}>{T('kurs_no_active')}</div> :
           schueler.map(sc => (
            <div key={sc.schueler_id} style={{ background:'var(--surface)', borderRadius:'var(--radius)', padding:'14px 18px', border:'1px solid var(--border)', display:'flex', alignItems:'center', gap:14 }}>
              <Avatar name={sc.profiles?.voller_name} avatarUrl={sc.profiles?.avatar_url} size={40} />
              <div style={{ flex:1 }}>
                <div style={{ fontWeight:700, fontSize:14, color:'var(--text)' }}>{sc.profiles?.voller_name}</div>
                {sc.profiles?.geburtsdatum && (
                  <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>
                    🎂 {new Date(sc.profiles.geburtsdatum).toLocaleDateString('de-DE')}
                  </div>
                )}
              </div>
              {sc.stimmgruppe && sc.stimmgruppe !== 'keine' && (
                <span style={{ fontSize:12, padding:'3px 10px', borderRadius:99, background:'var(--bg-2)', border:'1px solid var(--border)', color:'var(--text-2)', textTransform:'capitalize' }}>
                  {sc.stimmgruppe}
                </span>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Tab: Repertoire */}
      {aktiveTab === 'repertoire' && (
        <div style={{ textAlign:'center', padding:32 }}>
          <div style={{ fontSize:40, marginBottom:12 }}>🎼</div>
          <p style={{ color:'var(--text-3)', marginBottom:16 }}>Zum vollständigen Repertoire & Dateien-Bereich</p>
          <button onClick={() => navigate(`/lehrer/kurse/${id}/repertoire`)} style={s.btnPri}>
            {T('kurs_open_repertoire')}
          </button>
        </div>
      )}

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
