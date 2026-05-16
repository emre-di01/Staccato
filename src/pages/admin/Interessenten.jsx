import { useState, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const PIPELINE = ['interessent', 'kontaktiert', 'probe', 'angebot']
const ALLE_STATUS = [...PIPELINE, 'verloren']

const SF = {
  interessent: { bg:'#e0e7ff', text:'#4338ca', dot:'#818cf8' },
  kontaktiert: { bg:'#f3e8ff', text:'#7c3aed', dot:'#a78bfa' },
  probe:       { bg:'#fef9c3', text:'#ca8a04', dot:'#facc15' },
  angebot:     { bg:'#dcfce7', text:'#16a34a', dot:'#4ade80' },
  verloren:    { bg:'#fee2e2', text:'#dc2626', dot:'#f87171' },
}

const SK = {
  interessent: 'interessent_status_interessent',
  kontaktiert: 'interessent_status_kontaktiert',
  probe:       'interessent_status_probe',
  angebot:     'interessent_status_angebot',
  verloren:    'interessent_status_verloren',
}

// ─── Stepper pro Karte ────────────────────────────────────────
function KartenStepper({ current, onChange }) {
  const { T } = useApp()
  const idx = PIPELINE.indexOf(current)
  return (
    <div style={{ display:'flex', alignItems:'center', marginTop:12 }}>
      {PIPELINE.map((st, i) => {
        const done   = i < idx
        const active = i === idx
        const f = SF[st]
        return (
          <div key={st} style={{ display:'flex', alignItems:'center', flex: i < PIPELINE.length - 1 ? 1 : 'none' }}>
            <button
              onClick={e => { e.stopPropagation(); onChange(st) }}
              title={T(SK[st])}
              style={{
                display:'flex', flexDirection:'column', alignItems:'center', gap:4,
                background:'none', border:'none', cursor:'pointer', padding:0, flex:'none',
              }}
            >
              <div style={{
                width: active ? 26 : 20, height: active ? 26 : 20,
                borderRadius:'50%', display:'flex', alignItems:'center', justifyContent:'center',
                fontSize: active ? 11 : 10, fontWeight:800, transition:'all 0.15s',
                background: active ? f.text : done ? f.dot : 'var(--border)',
                color:'#fff',
                boxShadow: active ? `0 0 0 3px ${f.bg}` : 'none',
                flexShrink:0,
              }}>
                {done ? '✓' : i + 1}
              </div>
              <span style={{
                fontSize:9, fontWeight: active ? 700 : 500, lineHeight:1.1, marginTop:1,
                color: active ? f.text : done ? f.dot : 'var(--text-3)',
                whiteSpace:'nowrap',
              }}>
                {T(SK[st])}
              </span>
            </button>
            {i < PIPELINE.length - 1 && (
              <div style={{
                flex:1, height:2, marginBottom:16, marginLeft:4, marginRight:4,
                background: done ? SF[PIPELINE[i]].dot : 'var(--border)',
                transition:'background 0.2s',
              }} />
            )}
          </div>
        )
      })}
    </div>
  )
}

// ─── Verlauf-Eintrag ──────────────────────────────────────────
function VerlaufEintrag({ entry, T }) {
  const fmt = d => new Date(d).toLocaleDateString('de-DE', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })
  const ICONS = { erstellt:'📋', status_geaendert:'🔄', probe_termin:'📅', notiz:'💬', bearbeitet:'✏️' }
  let text = ''
  switch (entry.typ) {
    case 'erstellt':         text = T('interessent_verlauf_erstellt'); break
    case 'status_geaendert': text = `${T('interessent_verlauf_status')}: ${T(SK[entry.alt_wert] ?? entry.alt_wert)} → ${T(SK[entry.neu_wert] ?? entry.neu_wert)}`; break
    case 'probe_termin':     text = `${T('interessent_verlauf_probe')}: ${fmt(entry.neu_wert)}`; break
    case 'notiz':            text = entry.inhalt; break
    case 'bearbeitet':       text = T('interessent_verlauf_bearbeitet'); break
    default:                 text = entry.typ
  }
  return (
    <div style={{ display:'flex', gap:10, padding:'10px 0', borderBottom:'1px solid var(--border)' }}>
      <span style={{ fontSize:15, width:20, textAlign:'center', flexShrink:0, marginTop:1 }}>{ICONS[entry.typ] ?? '•'}</span>
      <div style={{ flex:1, minWidth:0 }}>
        <div style={{ fontSize:13, color:'var(--text)', lineHeight:1.4 }}>{text}</div>
        <div style={{ fontSize:11, color:'var(--text-3)', marginTop:2 }}>
          {fmt(entry.erstellt_am)}{entry.profiles?.voller_name ? ` · ${entry.profiles.voller_name}` : ''}
        </div>
      </div>
    </div>
  )
}

// ─── Detail-Modal (Verlauf + Notizen) ─────────────────────────
function DetailModal({ item, onClose, onErfolg, onEdit, onKonvertieren, onLoeschen }) {
  const { T, profil, rolle, confirm } = useApp()
  const [verlauf,   setVerlauf]   = useState([])
  const [laden,     setLaden]     = useState(true)
  const [notiz,     setNotiz]     = useState('')
  const [speichert, setSpeichert] = useState(false)

  const ladeVerlauf = useCallback(async () => {
    const { data } = await supabase
      .from('interessenten_verlauf')
      .select('*, profiles(voller_name)')
      .eq('interessent_id', item.id)
      .order('erstellt_am', { ascending: false })
    setVerlauf(data ?? [])
    setLaden(false)
  }, [item.id])

  useEffect(() => { ladeVerlauf() }, [ladeVerlauf])

  async function notizSpeichern() {
    if (!notiz.trim()) return
    setSpeichert(true)
    await supabase.from('interessenten_verlauf').insert({
      interessent_id: item.id,
      schule_id: profil?.schule_id,
      typ: 'notiz',
      inhalt: notiz.trim(),
    })
    setNotiz('')
    setSpeichert(false)
    ladeVerlauf()
  }

  const isAdmin = ['admin','superadmin'].includes(rolle)

  return createPortal(
    <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:520, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>

        {/* Header */}
        <div style={{ display:'flex', alignItems:'center', gap:12, padding:'22px 24px 16px', flexShrink:0, borderBottom:'1px solid var(--border)' }}>
          <div style={{ width:40, height:40, borderRadius:'50%', background:SF[item.status]?.text ?? 'var(--primary)', color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:16, fontWeight:800, flexShrink:0 }}>
            {item.voller_name.charAt(0).toUpperCase()}
          </div>
          <div style={{ flex:1 }}>
            <div style={{ fontWeight:800, fontSize:16, color:'var(--text)' }}>{item.voller_name}</div>
            <div style={{ fontSize:12, color:'var(--text-3)' }}>{T('interessent_since')} {new Date(item.angemeldet_am).toLocaleDateString('de-DE')}</div>
          </div>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'18px 24px 22px', overscrollBehavior:'contain' }}>

          {/* Kontaktdaten */}
          <div style={{ display:'flex', flexWrap:'wrap', gap:8, marginBottom:16 }}>
            {item.email       && <span style={s.chip}>✉️ {item.email}</span>}
            {item.telefon     && <span style={s.chip}>📞 {item.telefon}</span>}
            {item.instrumente && <span style={s.chip}>{item.instrumente.icon} {item.instrumente.name_de}</span>}
            {item.profiles    && <span style={s.chip}>👨‍🏫 {item.profiles.voller_name}</span>}
            {item.geburtsdatum && <span style={s.chip}>🎂 {new Date(item.geburtsdatum).toLocaleDateString('de-DE')}</span>}
            {item.probe_datum && <span style={{ ...s.chip, background:SF.probe.bg, color:SF.probe.text }}>🗓 {new Date(item.probe_datum).toLocaleDateString('de-DE', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>}
          </div>
          {item.notizen && (
            <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'9px 12px', marginBottom:16, fontSize:13, color:'var(--text-2)', fontStyle:'italic', border:'1px solid var(--border)' }}>
              📝 {item.notizen}
            </div>
          )}

          {/* Aktionen */}
          <div style={{ display:'flex', gap:8, flexWrap:'wrap', marginBottom:20, paddingBottom:20, borderBottom:'1px solid var(--border)' }}>
            <button onClick={() => { onEdit(item); onClose() }} style={s.btnSek}>✏️ {T('edit')}</button>
            <button onClick={() => { onKonvertieren(item); onClose() }}
              style={{ ...s.btnSek, background:'var(--success)', color:'#fff', border:'none' }}>
              🎓 {T('interessent_make_member_short')}
            </button>
            <button onClick={async () => { if (await confirm(`„${item.voller_name}" wirklich löschen?`, { confirmLabel:'Löschen' })) { await onLoeschen(item); onClose() } }}
              style={{ ...s.btnSek, color:'var(--danger)', borderColor:'var(--danger)', marginLeft:'auto' }}>
              🗑
            </button>
          </div>

          {/* Notiz hinzufügen */}
          {isAdmin && (
            <div style={{ display:'flex', gap:8, marginBottom:20 }}>
              <input style={{ ...s.input, flex:1 }} placeholder={T('interessent_notiz_placeholder')}
                value={notiz} onChange={e => setNotiz(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && notizSpeichern()} />
              <button onClick={notizSpeichern} disabled={speichert || !notiz.trim()} style={s.btnPri}>
                {speichert ? '…' : '+ Notiz'}
              </button>
            </div>
          )}

          {/* Timeline */}
          <div style={{ fontSize:12, fontWeight:700, color:'var(--text-3)', marginBottom:6, textTransform:'uppercase', letterSpacing:'0.5px' }}>
            Verlauf
          </div>
          {laden ? (
            <div style={{ textAlign:'center', padding:16, color:'var(--text-3)' }}>…</div>
          ) : verlauf.length === 0 ? (
            <div style={{ textAlign:'center', padding:16, color:'var(--text-3)', fontSize:13 }}>{T('interessent_verlauf_leer')}</div>
          ) : verlauf.map(e => <VerlaufEintrag key={e.id} entry={e} T={T} />)}
        </div>
      </div>
    </div>
  , document.body)
}

// ─── Interessent anlegen / bearbeiten ─────────────────────────
function InteressentModal({ item, onClose, onErfolg }) {
  const { T, profil } = useApp()
  const istNeu = !item?.id
  const [form, setForm] = useState({
    voller_name:  item?.voller_name  ?? '',
    email:        item?.email        ?? '',
    telefon:      item?.telefon      ?? '',
    geburtsdatum: item?.geburtsdatum ?? '',
    instrument_id:item?.instrument_id?? '',
    wunsch_lehrer:item?.wunsch_lehrer?? '',
    status:       item?.status       ?? 'interessent',
    probe_datum:  item?.probe_datum  ? item.probe_datum.slice(0,16) : '',
    probe_raum_id:item?.probe_raum_id?? '',
    notizen:      item?.notizen      ?? '',
  })
  const [instrumente, setInstrumente] = useState([])
  const [lehrer,      setLehrer]      = useState([])
  const [raeume,      setRaeume]      = useState([])
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('instrumente').select('id, name_de, icon').order('name_de'),
      supabase.from('profiles').select('id, voller_name').in('rolle', ['lehrer','admin','superadmin']).eq('aktiv', true).order('voller_name'),
      supabase.from('raeume').select('id, name').eq('aktiv', true).order('name'),
    ]).then(([i, l, r]) => {
      setInstrumente(i.data ?? [])
      setLehrer(l.data ?? [])
      setRaeume(r.data ?? [])
    })
  }, [])

  async function speichern() {
    if (!form.voller_name.trim()) { setFehler(T('name_required')); return }
    setLaden(true)
    const payload = {
      ...form,
      geburtsdatum:  form.geburtsdatum  || null,
      instrument_id: form.instrument_id || null,
      wunsch_lehrer: form.wunsch_lehrer || null,
      probe_datum:   form.probe_datum   || null,
      probe_raum_id: form.probe_raum_id || null,
      notizen:       form.notizen       || null,
      email:         form.email         || null,
      telefon:       form.telefon       || null,
      ...(istNeu && { schule_id: profil?.schule_id }),
    }
    const { error } = istNeu
      ? await supabase.from('interessenten').insert(payload)
      : await supabase.from('interessenten').update(payload).eq('id', item.id)
    if (error) { setFehler(error.message); setLaden(false); return }
    onErfolg(); onClose()
  }

  const F = (key, label, type='text', placeholder='') => (
    <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
      <label style={s.label}>{label}</label>
      <input type={type} style={s.input} placeholder={placeholder}
        value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} />
    </div>
  )

  return createPortal(
    <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', width:'100%', maxWidth:520, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', display:'flex', flexDirection:'column', overflow:'hidden' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'24px 28px 0', flexShrink:0 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>
            {istNeu ? T('interessent_new') : T('interessent_edit')}
          </h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>

        <div style={{ overflowY:'auto', flex:1, padding:'20px 28px 24px', overscrollBehavior:'contain', display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'span 2' }}>{F('voller_name',T('full_name_label'),'text',T('interessent_name_placeholder'))}</div>
            {F('email',T('email'),'email','name@beispiel.de')}
            {F('telefon',T('profile_phone'),'tel','+49 ...')}
            {F('geburtsdatum',T('profile_birthday'),'date')}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>{T('status')}</label>
              <select style={s.input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                {ALLE_STATUS.map(st => (
                  <option key={st} value={st}>{T(SK[st])}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>{T('instrument')}</label>
              <select style={s.input} value={form.instrument_id} onChange={e => setForm(f => ({ ...f, instrument_id: e.target.value }))}>
                <option value="">{T('none_option')}</option>
                {instrumente.map(i => <option key={i.id} value={i.id}>{i.icon} {i.name_de}</option>)}
              </select>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>{T('interessent_wunsch_lehrer')}</label>
              <select style={s.input} value={form.wunsch_lehrer} onChange={e => setForm(f => ({ ...f, wunsch_lehrer: e.target.value }))}>
                <option value="">{T('none_option')}</option>
                {lehrer.map(l => <option key={l.id} value={l.id}>{l.voller_name}</option>)}
              </select>
            </div>
          </div>

          {form.status === 'probe' && (
            <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
              {F('probe_datum',T('interessent_probe_termin'),'datetime-local')}
              <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
                <label style={s.label}>{T('interessent_probe_raum')}</label>
                <select style={s.input} value={form.probe_raum_id} onChange={e => setForm(f => ({ ...f, probe_raum_id: e.target.value }))}>
                  <option value="">{T('none_option')}</option>
                  {raeume.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
                </select>
              </div>
            </div>
          )}

          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>{T('notes')}</label>
            <textarea style={{ ...s.input, minHeight:70, resize:'vertical' }}
              value={form.notizen} onChange={e => setForm(f => ({ ...f, notizen: e.target.value }))} />
          </div>

          {fehler && <p style={{ margin:0, color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
          <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
            <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
            <button onClick={speichern} disabled={laden} style={s.btnPri}>
              {laden ? T('saving') : istNeu ? T('interessent_anlegen') : T('save')}
            </button>
          </div>
        </div>
      </div>
    </div>
  , document.body)
}

// ─── Zu Mitglied konvertieren Modal ───────────────────────────
function KonvertierenModal({ item, onClose, onErfolg }) {
  const { T } = useApp()
  const [kurse,    setKurse]    = useState([])
  const [kursId,   setKursId]   = useState('')
  const [passwort, setPasswort] = useState('')
  const [laden,    setLaden]    = useState(false)
  const [fehler,   setFehler]   = useState('')
  const [erfolg,   setErfolg]   = useState(false)

  useEffect(() => {
    supabase.from('unterricht').select('id, name, instrumente(icon, name_de)').order('name')
      .then(({ data }) => setKurse(data ?? []))
  }, [])

  async function konvertieren() {
    if (!item.email)      { setFehler(T('interessent_email_required')); return }
    if (!passwort.trim()) { setFehler(T('interessent_password_required')); return }
    setLaden(true); setFehler('')

    const { error: createErr } = await supabase.rpc('create_user', {
      p_email:       item.email,
      p_passwort:    passwort,
      p_voller_name: item.voller_name,
      p_rolle:       'schueler',
    })

    if (createErr) {
      setFehler(createErr.message.includes('409') || createErr.message.includes('already')
        ? T('interessent_email_exists')
        : createErr.message)
      setLaden(false); return
    }

    const { data: neuesProfil } = await supabase.from('profiles')
      .select('id').eq('voller_name', item.voller_name).order('erstellt_am', { ascending: false }).limit(1).single()

    if (neuesProfil) {
      const updates = {}
      if (item.telefon)      updates.telefon = item.telefon
      if (item.geburtsdatum) updates.geburtsdatum = item.geburtsdatum
      if (item.notizen)      updates.notizen = item.notizen
      if (Object.keys(updates).length > 0)
        await supabase.from('profiles').update(updates).eq('id', neuesProfil.id)

      if (kursId)
        await supabase.from('unterricht_schueler').insert({ unterricht_id: kursId, schueler_id: neuesProfil.id, status: 'aktiv' })
    }

    await supabase.from('interessenten').delete().eq('id', item.id)
    setErfolg(true); setLaden(false)
  }

  if (erfolg) return createPortal(
    <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}>
      <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'32px', width:'100%', maxWidth:440, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
        <h3 style={{ margin:'0 0 8px', fontSize:18, fontWeight:800, color:'var(--text)' }}>{item.voller_name} {T('interessent_converted_title')}</h3>
        <p style={{ margin:'0 0 20px', color:'var(--text-3)', fontSize:13 }}>{T('interessent_converted_desc')}</p>
        <button onClick={() => { onErfolg(); onClose() }} style={s.btnPri}>{T('done')}</button>
      </div>
    </div>
  , document.body)

  return createPortal(
    <div className="modal-overlay" style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1100, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-inner" style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'24px 28px', width:'100%', maxWidth:460, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>{T('interessent_konvertieren')}</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>

        <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'12px 14px', marginBottom:18, border:'1px solid var(--border)' }}>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:4 }}>{item.voller_name}</div>
          {item.email   && <div style={{ fontSize:13, color:'var(--text-3)' }}>✉️ {item.email}</div>}
          {item.telefon && <div style={{ fontSize:13, color:'var(--text-3)' }}>📞 {item.telefon}</div>}
        </div>

        {!item.email && (
          <div style={{ background:'#fef3c7', border:'1px solid #f59e0b', borderRadius:'var(--radius)', padding:'10px 14px', marginBottom:16, fontSize:13, color:'#92400e' }}>
            {T('interessent_no_email_warning')}
          </div>
        )}

        <div style={{ display:'flex', flexDirection:'column', gap:14, marginBottom:20 }}>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>{T('interessent_password_label')}</label>
            <input type="password" style={s.input} placeholder={T('interessent_password_placeholder')}
              value={passwort} onChange={e => setPasswort(e.target.value)} />
          </div>
          <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
            <label style={s.label}>{T('interessent_assign_course')}</label>
            <select style={s.input} value={kursId} onChange={e => setKursId(e.target.value)}>
              <option value="">{T('no_course_option')}</option>
              {kurse.map(k => <option key={k.id} value={k.id}>{k.instrumente?.icon} {k.name}</option>)}
            </select>
          </div>
        </div>

        {fehler && <p style={{ margin:'0 0 14px', color:'var(--danger)', fontSize:13 }}>{fehler}</p>}
        <div style={{ display:'flex', gap:10, justifyContent:'flex-end' }}>
          <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
          <button onClick={konvertieren} disabled={laden || !item.email} style={s.btnPri}>
            {laden ? T('interessent_converting') : T('interessent_make_member')}
          </button>
        </div>
      </div>
    </div>
  , document.body)
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function Interessenten() {
  const { profil, T, confirm } = useApp()
  const [liste,         setListe]        = useState([])
  const [laden,         setLaden]        = useState(true)
  const [suche,         setSuche]        = useState('')
  const [filterStatus,  setFilterStatus] = useState('alle')
  const [zeigeVerloren, setZeigeVerloren]= useState(false)
  const [modal,         setModal]        = useState(null)

  const ladeDaten = useCallback(async () => {
    if (!profil?.schule_id) return
    setLaden(true)
    const { data } = await supabase
      .from('interessenten')
      .select('*, instrumente(name_de, icon), profiles!interessenten_wunsch_lehrer_fkey(voller_name)')
      .eq('schule_id', profil.schule_id)
      .order('angemeldet_am', { ascending: false })
    setListe(data ?? [])
    setLaden(false)
  }, [profil?.schule_id])

  useEffect(() => { ladeDaten() }, [ladeDaten])

  async function statusAendern(item, neuerStatus) {
    await supabase.from('interessenten').update({ status: neuerStatus }).eq('id', item.id)
    setListe(prev => prev.map(i => i.id === item.id ? { ...i, status: neuerStatus } : i))
  }

  const aktive    = liste.filter(i => i.status !== 'verloren')
  const verlorene = liste.filter(i => i.status === 'verloren')

  const gefiltert = liste.filter(item => {
    if (!zeigeVerloren && item.status === 'verloren') return false
    if (filterStatus !== 'alle' && item.status !== filterStatus) return false
    if (suche && !item.voller_name.toLowerCase().includes(suche.toLowerCase()) &&
        !item.email?.toLowerCase().includes(suche.toLowerCase())) return false
    return true
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:20, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={s.h1}>📋 {T('prospects')}</h1>
          <p style={{ ...s.sub, display:'flex', alignItems:'center', flexWrap:'wrap', gap:6 }}>
            <span>{aktive.length} aktiv</span>
            {PIPELINE.map(st => {
              const n = liste.filter(i => i.status === st).length
              if (!n) return null
              return <span key={st} style={{ fontSize:11, background:SF[st].bg, color:SF[st].text, borderRadius:99, padding:'1px 8px', fontWeight:600 }}>{T(SK[st])} {n}</span>
            })}
            {verlorene.length > 0 && <span style={{ fontSize:11, background:SF.verloren.bg, color:SF.verloren.text, borderRadius:99, padding:'1px 8px', fontWeight:600 }}>✗ {verlorene.length}</span>}
          </p>
        </div>
        <button onClick={() => setModal({ typ:'interessent' })} style={s.btnPri}>{T('interessent_new')}</button>
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ ...s.input, width:220 }} placeholder={T('search') + ' …'} value={suche}
          onChange={e => setSuche(e.target.value)} />
        <div style={{ display:'flex', gap:6, flexWrap:'wrap' }}>
          {['alle', ...PIPELINE].map(st => (
            <button key={st} onClick={() => setFilterStatus(st)}
              style={{ padding:'7px 14px', borderRadius:99, border:'1.5px solid var(--border)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                background: filterStatus===st ? (SF[st]?.bg ?? 'var(--primary)') : 'var(--surface)',
                color:      filterStatus===st ? (SF[st]?.text ?? 'var(--primary-fg)') : 'var(--text-2)',
                borderColor:filterStatus===st ? (SF[st]?.dot ?? 'var(--primary)') : 'var(--border)' }}>
              {st === 'alle' ? T('all') : T(SK[st])}
            </button>
          ))}
          {verlorene.length > 0 && (
            <button onClick={() => { setZeigeVerloren(v => !v); if (!zeigeVerloren) setFilterStatus('alle') }}
              style={{ padding:'7px 14px', borderRadius:99, border:'1.5px solid var(--border)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                background: zeigeVerloren ? SF.verloren.bg : 'var(--surface)',
                color:      zeigeVerloren ? SF.verloren.text : 'var(--text-2)',
                borderColor:zeigeVerloren ? SF.verloren.dot : 'var(--border)' }}>
              {zeigeVerloren ? T('interessent_verloren_ausblenden') : T('interessent_verloren_zeigen')} ({verlorene.length})
            </button>
          )}
        </div>
      </div>

      {/* Liste */}
      {laden ? (
        <div style={s.leer}>{T('loading')}</div>
      ) : gefiltert.length === 0 ? (
        <div style={s.leer}>
          <div style={{ marginBottom:12 }}>{T('interessent_none_found')}</div>
          {suche === '' && filterStatus === 'alle' && (
            <button onClick={() => setModal({ typ:'interessent' })} style={s.btnPri}>{T('interessent_new')}</button>
          )}
        </div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
          {gefiltert.map(item => {
            const sf = SF[item.status] ?? SF.interessent
            const verloren = item.status === 'verloren'
            return (
              <div key={item.id}
                style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', padding:'16px 20px', boxShadow:'var(--shadow)', opacity: verloren ? 0.7 : 1 }}>

                {/* Obere Zeile: Avatar + Info + Aktionen */}
                <div style={{ display:'flex', alignItems:'flex-start', gap:14 }}>
                  <div style={{ width:42, height:42, borderRadius:'50%', background: verloren ? 'var(--text-3)' : sf.text, color:'#fff', display:'flex', alignItems:'center', justifyContent:'center', fontSize:17, fontWeight:800, flexShrink:0 }}>
                    {item.voller_name.charAt(0).toUpperCase()}
                  </div>

                  <div style={{ flex:1, minWidth:0 }}>
                    <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:4 }}>{item.voller_name}</div>
                    <div style={{ display:'flex', gap:10, flexWrap:'wrap', fontSize:12, color:'var(--text-3)' }}>
                      {item.email      && <span>✉️ {item.email}</span>}
                      {item.telefon    && <span>📞 {item.telefon}</span>}
                      {item.instrumente&& <span>{item.instrumente.icon} {item.instrumente.name_de}</span>}
                      {item.profiles   && <span>👨‍🏫 {item.profiles.voller_name}</span>}
                      {item.probe_datum && <span style={{ background:SF.probe.bg, color:SF.probe.text, borderRadius:99, padding:'1px 7px', fontWeight:600 }}>🗓 {new Date(item.probe_datum).toLocaleDateString('de-DE', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>}
                    </div>
                  </div>

                  {/* Aktionen */}
                  <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                    {!verloren && (
                      <button onClick={() => setModal({ typ:'konvertieren', item })}
                        style={{ padding:'6px 12px', borderRadius:'var(--radius)', border:'none', background:'var(--success)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                        🎓 {T('interessent_make_member_short')}
                      </button>
                    )}
                    <button onClick={() => setModal({ typ:'detail', item })} style={s.btnKlein} title="Verlauf & Details">🕐</button>
                    <button onClick={() => setModal({ typ:'interessent', item })} style={s.btnKlein}>✏️</button>
                  </div>
                </div>

                {/* Stepper (bei verloren: nur Badge) */}
                {verloren ? (
                  <div style={{ marginTop:12, display:'flex', alignItems:'center', gap:8 }}>
                    <span style={{ fontSize:12, background:SF.verloren.bg, color:SF.verloren.text, borderRadius:99, padding:'3px 10px', fontWeight:700 }}>
                      ✗ {T('interessent_status_verloren')}
                    </span>
                    <button onClick={() => statusAendern(item, 'interessent')}
                      style={{ fontSize:11, color:'var(--text-3)', background:'none', border:'1px solid var(--border)', borderRadius:99, padding:'2px 10px', cursor:'pointer', fontFamily:'inherit' }}>
                      ↩ {T('interessent_status_interessent')}
                    </button>
                  </div>
                ) : (
                  <KartenStepper current={item.status} onChange={st => statusAendern(item, st)} />
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Modals */}
      {modal?.typ === 'detail' && (
        <DetailModal
          item={modal.item}
          onClose={() => { setModal(null); ladeDaten() }}
          onErfolg={ladeDaten}
          onEdit={item => setModal({ typ:'interessent', item })}
          onKonvertieren={item => setModal({ typ:'konvertieren', item })}
          onLoeschen={async item => { await supabase.from('interessenten').delete().eq('id', item.id); ladeDaten() }}
        />
      )}
      {modal?.typ === 'interessent' && (
        <InteressentModal item={modal.item} onClose={() => setModal(null)} onErfolg={ladeDaten} />
      )}
      {modal?.typ === 'konvertieren' && (
        <KonvertierenModal item={modal.item} onClose={() => setModal(null)} onErfolg={ladeDaten} />
      )}
    </div>
  )
}

const s = {
  h1:      { margin:'0 0 4px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  sub:     { margin:0, color:'var(--text-3)', fontSize:14 },
  leer:    { padding:'48px', textAlign:'center', color:'var(--text-3)', fontSize:14, background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)' },
  label:   { fontSize:13, fontWeight:600, color:'var(--text-2)' },
  input:   { padding:'9px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text)', fontSize:14, fontFamily:'inherit', outline:'none', width:'100%', boxSizing:'border-box' },
  chip:    { fontSize:12, padding:'3px 10px', borderRadius:99, background:'var(--bg-2)', color:'var(--text-2)', border:'1px solid var(--border)', whiteSpace:'nowrap' },
  btnPri:  { padding:'10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnSek:  { padding:'8px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnKlein:{ padding:'7px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  iconBtn: { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4, lineHeight:1 },
}
