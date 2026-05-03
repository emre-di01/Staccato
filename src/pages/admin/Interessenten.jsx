import { useState, useEffect, useCallback } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const STATUS_LABEL_KEYS = { interessent: 'interessent_status_interessent', probe: 'interessent_status_probe' }
const STATUS_FARBE = {
  interessent: { bg:'#e0e7ff', text:'#4338ca' },
  probe:       { bg:'#fef3c7', text:'#d97706' },
}

// ─── Interessent anlegen / bearbeiten ─────────────────────────
function InteressentModal({ item, onClose, onErfolg }) {
  const { T } = useApp()
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

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:520, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', maxHeight:'90vh', overflowY:'auto' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>
            {istNeu ? T('interessent_new') : T('interessent_edit')}
          </h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>

        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
          <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:12 }}>
            <div style={{ gridColumn:'span 2' }}>{F('voller_name',T('full_name_label'),'text',T('interessent_name_placeholder'))}</div>
            {F('email',T('email'),'email','name@beispiel.de')}
            {F('telefon',T('profile_phone'),'tel','+49 ...')}
            {F('geburtsdatum',T('profile_birthday'),'date')}
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>{T('status')}</label>
              <select style={s.input} value={form.status} onChange={e => setForm(f => ({ ...f, status: e.target.value }))}>
                <option value="interessent">{T('interessent_status_interessent')}</option>
                <option value="probe">{T('interessent_status_probe')}</option>
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
  )
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
    if (!item.email)    { setFehler(T('interessent_email_required')); return }
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

    const { data: profil } = await supabase.from('profiles')
      .select('id').eq('voller_name', item.voller_name).order('erstellt_am', { ascending: false }).limit(1).single()

    if (profil) {
      const updates = {}
      if (item.telefon)      updates.telefon = item.telefon
      if (item.geburtsdatum) updates.geburtsdatum = item.geburtsdatum
      if (item.notizen)      updates.notizen = item.notizen
      if (Object.keys(updates).length > 0)
        await supabase.from('profiles').update(updates).eq('id', profil.id)

      if (kursId && profil.id) {
        await supabase.from('unterricht_schueler').insert({ unterricht_id: kursId, schueler_id: profil.id, status: 'aktiv' })
      }
    }

    await supabase.from('interessenten').delete().eq('id', item.id)
    setErfolg(true); setLaden(false)
  }

  if (erfolg) return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'32px', width:'100%', maxWidth:440, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)', textAlign:'center' }}>
        <div style={{ fontSize:48, marginBottom:12 }}>✅</div>
        <h3 style={{ margin:'0 0 8px', fontSize:18, fontWeight:800, color:'var(--text)' }}>{item.voller_name} {T('interessent_converted_title')}</h3>
        <p style={{ margin:'0 0 20px', color:'var(--text-3)', fontSize:13 }}>
          {T('interessent_converted_desc')}
        </p>
        <button onClick={() => { onErfolg(); onClose() }} style={s.btnPri}>{T('done')}</button>
      </div>
    </div>
  )

  return (
    <div style={{ position:'fixed', inset:0, background:'rgba(0,0,0,0.5)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:1000, padding:16 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'28px 32px', width:'100%', maxWidth:460, boxShadow:'var(--shadow-lg)', border:'1px solid var(--border)' }}>
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:20 }}>
          <h3 style={{ margin:0, fontSize:18, fontWeight:800, color:'var(--text)' }}>{T('interessent_konvertieren')}</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>

        <div style={{ background:'var(--bg-2)', borderRadius:'var(--radius)', padding:'14px 16px', marginBottom:20, border:'1px solid var(--border)' }}>
          <div style={{ fontWeight:700, fontSize:15, color:'var(--text)', marginBottom:4 }}>{item.voller_name}</div>
          {item.email && <div style={{ fontSize:13, color:'var(--text-3)' }}>✉️ {item.email}</div>}
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
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function Interessenten() {
  const { profil, T } = useApp()
  const [liste,        setListe]        = useState([])
  const [laden,        setLaden]        = useState(true)
  const [filterStatus, setFilterStatus] = useState('alle')
  const [suche,        setSuche]        = useState('')
  const [modal,        setModal]        = useState(null)

  const ladeDaten = useCallback(async () => {
    setLaden(true)
    const { data } = await supabase
      .from('interessenten')
      .select('*, instrumente(name_de, icon), profiles!interessenten_wunsch_lehrer_fkey(voller_name)')
      .order('angemeldet_am', { ascending: false })
    setListe(data ?? [])
    setLaden(false)
  }, [])

  useEffect(() => { ladeDaten() }, [ladeDaten])

  async function loeschen(item) {
    if (!confirm(`„${item.voller_name}" wirklich löschen?`)) return
    await supabase.from('interessenten').delete().eq('id', item.id)
    ladeDaten()
  }

  const gefiltert = liste.filter(item => {
    if (filterStatus !== 'alle' && item.status !== filterStatus) return false
    if (suche && !item.voller_name.toLowerCase().includes(suche.toLowerCase()) &&
        !item.email?.toLowerCase().includes(suche.toLowerCase())) return false
    return true
  })

  return (
    <div>
      {/* Header */}
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', marginBottom:24, flexWrap:'wrap', gap:12 }}>
        <div>
          <h1 style={s.h1}>📋 {T('prospects')}</h1>
          <p style={s.sub}>{liste.length} {T('all').toLowerCase()} · {liste.filter(i => i.status === 'probe').length} {T('interessent_probe_date').toLowerCase().replace(':','')}</p>
        </div>
        <button onClick={() => setModal({ typ:'interessent' })} style={s.btnPri}>{T('interessent_new')}</button>
      </div>

      {/* Filter */}
      <div style={{ display:'flex', gap:10, marginBottom:20, flexWrap:'wrap', alignItems:'center' }}>
        <input style={{ ...s.input, width:220 }} placeholder={T('search') + ' …'} value={suche}
          onChange={e => setSuche(e.target.value)} />
        <div style={{ display:'flex', gap:6 }}>
          {['alle','interessent','probe'].map(st => (
            <button key={st} onClick={() => setFilterStatus(st)}
              style={{ padding:'7px 14px', borderRadius:99, border:'1.5px solid var(--border)', fontSize:12, fontWeight:600, cursor:'pointer', fontFamily:'inherit',
                background: filterStatus===st ? 'var(--primary)' : 'var(--surface)',
                color:      filterStatus===st ? 'var(--primary-fg)' : 'var(--text-2)',
                borderColor:filterStatus===st ? 'var(--primary)' : 'var(--border)' }}>
              {st === 'alle' ? T('all') : T(STATUS_LABEL_KEYS[st])}
            </button>
          ))}
        </div>
      </div>

      {/* Liste */}
      {laden ? (
        <div style={s.leer}>{T('loading')}</div>
      ) : gefiltert.length === 0 ? (
        <div style={s.leer}>{T('interessent_none_found')}</div>
      ) : (
        <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
          {gefiltert.map(item => {
            const sf = STATUS_FARBE[item.status] ?? { bg:'var(--bg-2)', text:'var(--text-3)' }
            return (
              <div key={item.id} style={{ background:'var(--surface)', borderRadius:'var(--radius-lg)', border:'1px solid var(--border)', padding:'16px 20px', display:'flex', alignItems:'center', gap:16, boxShadow:'var(--shadow)' }}>
                {/* Avatar */}
                <div style={{ width:44, height:44, borderRadius:'50%', background:'var(--primary)', color:'var(--primary-fg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:18, fontWeight:800, flexShrink:0 }}>
                  {item.voller_name.charAt(0).toUpperCase()}
                </div>

                {/* Info */}
                <div style={{ flex:1, minWidth:0 }}>
                  <div style={{ display:'flex', alignItems:'center', gap:8, marginBottom:4, flexWrap:'wrap' }}>
                    <span style={{ fontWeight:700, fontSize:15, color:'var(--text)' }}>{item.voller_name}</span>
                    <span style={{ fontSize:11, fontWeight:700, padding:'2px 9px', borderRadius:99, background: sf.bg, color: sf.text }}>
                      {T(STATUS_LABEL_KEYS[item.status]) ?? item.status}
                    </span>
                  </div>
                  <div style={{ display:'flex', gap:14, flexWrap:'wrap', fontSize:12, color:'var(--text-3)' }}>
                    {item.email    && <span>✉️ {item.email}</span>}
                    {item.telefon  && <span>📞 {item.telefon}</span>}
                    {item.instrumente && <span>{item.instrumente.icon} {item.instrumente.name_de}</span>}
                    {item.profiles && <span>👨‍🏫 {item.profiles.voller_name}</span>}
                    {item.probe_datum && <span>🗓 {T('interessent_probe_date')} {new Date(item.probe_datum).toLocaleDateString('de-DE', { day:'numeric', month:'short', hour:'2-digit', minute:'2-digit' })}</span>}
                    <span style={{ color:'var(--bg-3)' }}>{T('interessent_since')} {new Date(item.angemeldet_am).toLocaleDateString('de-DE')}</span>
                  </div>
                  {item.notizen && (
                    <div style={{ fontSize:12, color:'var(--text-3)', marginTop:4, fontStyle:'italic', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', maxWidth:400 }}>
                      📝 {item.notizen}
                    </div>
                  )}
                </div>

                {/* Aktionen */}
                <div style={{ display:'flex', gap:6, flexShrink:0 }}>
                  <button onClick={() => setModal({ typ:'konvertieren', item })}
                    style={{ padding:'7px 13px', borderRadius:'var(--radius)', border:'none', background:'var(--success)', color:'#fff', fontSize:12, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' }}>
                    {T('interessent_make_member_short')}
                  </button>
                  <button onClick={() => setModal({ typ:'interessent', item })} style={s.btnKlein}>✏️</button>
                  <button onClick={() => loeschen(item)} style={{ ...s.btnKlein, color:'var(--danger)' }}>🗑</button>
                </div>
              </div>
            )
          })}
        </div>
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
  btnPri:  { padding:'10px 18px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit', whiteSpace:'nowrap' },
  btnSek:  { padding:'10px 16px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:14, cursor:'pointer', fontFamily:'inherit' },
  btnKlein:{ padding:'7px 12px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background:'var(--bg-2)', color:'var(--text-2)', fontSize:13, cursor:'pointer', fontFamily:'inherit' },
  iconBtn: { background:'none', border:'none', fontSize:18, cursor:'pointer', color:'var(--text-3)', padding:4, lineHeight:1 },
}
