import { useState, useEffect } from 'react'
import { CircleCheck, Mail, Phone } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Blatt, Feld, Knopf, FehlerText, eingabeStil } from '../../ui'

// Formular-Blätter für Interessenten: anlegen/bearbeiten und zu Mitglied machen.
// Logik wie in pages/admin/Interessenten.jsx, nur neue Oberfläche.

const ALLE_STATUS = ['interessent', 'kontaktiert', 'probe', 'angebot', 'verloren']

export function InteressentBlatt({ item, onClose, onErfolg }) {
  const { T, schule, lang } = useApp()
  const istNeu = !item?.id
  const [form, setForm] = useState({
    voller_name:   item?.voller_name   ?? '',
    email:         item?.email         ?? '',
    telefon:       item?.telefon       ?? '',
    geburtsdatum:  item?.geburtsdatum  ?? '',
    instrument_id: item?.instrument_id ?? '',
    wunsch_lehrer: item?.wunsch_lehrer ?? '',
    status:        item?.status        ?? 'interessent',
    probe_datum:   item?.probe_datum ? item.probe_datum.slice(0, 16) : '',
    probe_raum_id: item?.probe_raum_id ?? '',
    notizen:       item?.notizen       ?? '',
  })
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [instrumente, setInstrumente] = useState([])
  const [lehrer,      setLehrer]      = useState([])
  const [raeume,      setRaeume]      = useState([])
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')

  useEffect(() => {
    Promise.all([
      supabase.from('instrumente').select('id, name_de, name_en, name_tr, icon').order('name_de'),
      supabase.from('profiles').select('id, voller_name').in('rolle', ['lehrer', 'admin', 'superadmin']).eq('aktiv', true).order('voller_name'),
      supabase.from('raeume').select('id, name').eq('aktiv', true).order('name'),
    ]).then(([i, l, r]) => {
      setInstrumente(i.data ?? [])
      setLehrer(l.data ?? [])
      setRaeume(r.data ?? [])
    })
  }, [])

  async function speichern() {
    if (!form.voller_name.trim()) { setFehler(T('name_required')); return }
    setSendet(true)
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
      ...(istNeu && { schule_id: schule?.id }),
    }
    const { error } = istNeu
      ? await supabase.from('interessenten').insert(payload)
      : await supabase.from('interessenten').update(payload).eq('id', item.id)
    if (error) { setFehler(error.message); setSendet(false); return }
    onErfolg(); onClose()
  }

  const eingabe = (key, label, type = 'text', extra = {}) => (
    <Feld label={label}>
      <input type={type} value={form[key]} onChange={e => setze(key, e.target.value)} style={eingabeStil} {...extra} />
    </Feld>
  )

  return (
    <Blatt titel={istNeu ? T('interessent_new') : T('interessent_edit')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        {eingabe('voller_name', T('name'), 'text', { placeholder: T('interessent_name_placeholder'), autoComplete: 'off' })}
        {eingabe('email', T('email'), 'email', { inputMode: 'email' })}
        {eingabe('telefon', T('profile_phone'), 'tel')}
        {eingabe('geburtsdatum', T('profile_birthday'), 'date')}
        <Feld label={T('status')}>
          <select value={form.status} onChange={e => setze('status', e.target.value)} style={eingabeStil}>
            {ALLE_STATUS.map(st => <option key={st} value={st}>{T(`interessent_status_${st}`)}</option>)}
          </select>
        </Feld>
        <Feld label={T('instrument')}>
          <select value={form.instrument_id} onChange={e => setze('instrument_id', e.target.value)} style={eingabeStil}>
            <option value="">{T('nb_keine')}</option>
            {instrumente.map(i => <option key={i.id} value={i.id}>{i.icon} {i[`name_${lang}`] ?? i.name_de}</option>)}
          </select>
        </Feld>
        <Feld label={T('interessent_wunsch_lehrer')}>
          <select value={form.wunsch_lehrer} onChange={e => setze('wunsch_lehrer', e.target.value)} style={eingabeStil}>
            <option value="">{T('nb_keine')}</option>
            {lehrer.map(l => <option key={l.id} value={l.id}>{l.voller_name}</option>)}
          </select>
        </Feld>
        {form.status === 'probe' && (
          <>
            {eingabe('probe_datum', T('interessent_probe_termin'), 'datetime-local')}
            <Feld label={T('interessent_probe_raum')}>
              <select value={form.probe_raum_id} onChange={e => setze('probe_raum_id', e.target.value)} style={eingabeStil}>
                <option value="">{T('nb_keine')}</option>
                {raeume.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </Feld>
          </>
        )}
        <Feld label={T('notes')}>
          <textarea rows={3} value={form.notizen} onChange={e => setze('notizen', e.target.value)} style={{ ...eingabeStil, resize: 'vertical' }} />
        </Feld>
        {fehler && <FehlerText>{fehler}</FehlerText>}
        <Knopf voll onClick={speichern} disabled={sendet}>{sendet ? T('saving') : istNeu ? T('interessent_anlegen') : T('save')}</Knopf>
      </div>
    </Blatt>
  )
}

export function KonvertierenBlatt({ item, onClose, onErfolg }) {
  const { T } = useApp()
  const [kurse,    setKurse]    = useState([])
  const [kursId,   setKursId]   = useState('')
  const [passwort, setPasswort] = useState('')
  const [sendet,   setSendet]   = useState(false)
  const [fehler,   setFehler]   = useState('')
  const [erfolg,   setErfolg]   = useState(false)

  useEffect(() => {
    supabase.from('unterricht').select('id, name, instrumente(icon, name_de)').order('name')
      .then(({ data }) => setKurse(data ?? []))
  }, [])

  async function konvertieren() {
    if (!item.email)      { setFehler(T('interessent_email_required')); return }
    if (!passwort.trim()) { setFehler(T('interessent_password_required')); return }
    setSendet(true); setFehler('')

    const { error: createErr } = await supabase.rpc('create_user', {
      p_email: item.email, p_passwort: passwort, p_voller_name: item.voller_name, p_rolle: 'schueler',
    })
    if (createErr) {
      setFehler(createErr.message.includes('409') || createErr.message.includes('already') ? T('interessent_email_exists') : createErr.message)
      setSendet(false); return
    }

    const { data: neuesProfil } = await supabase.from('profiles')
      .select('id').eq('voller_name', item.voller_name).order('erstellt_am', { ascending: false }).limit(1).single()

    if (neuesProfil) {
      const updates = {}
      if (item.telefon)      updates.telefon = item.telefon
      if (item.geburtsdatum) updates.geburtsdatum = item.geburtsdatum
      if (item.notizen)      updates.notizen = item.notizen
      if (Object.keys(updates).length > 0) await supabase.from('profiles').update(updates).eq('id', neuesProfil.id)
      if (kursId) await supabase.from('unterricht_schueler').insert({ unterricht_id: kursId, schueler_id: neuesProfil.id, status: 'aktiv' })
    }

    await supabase.from('interessenten').delete().eq('id', item.id)
    setErfolg(true); setSendet(false)
  }

  if (erfolg) {
    const schliessen = () => { onErfolg(); onClose() }
    return (
      <Blatt titel={T('interessent_konvertieren')} onClose={schliessen}>
        <div style={{ textAlign: 'center', padding: '8px 0' }}>
          <CircleCheck aria-hidden="true" size={56} color="var(--success)" strokeWidth={1.8} />
          <div style={{ margin: '12px 0 6px', fontSize: 20, fontWeight: 800 }}>{item.voller_name} {T('interessent_converted_title')}</div>
          <p style={{ margin: '0 0 20px', fontSize: 17, color: 'var(--text-2)', lineHeight: 1.45 }}>{T('interessent_converted_desc')}</p>
          <Knopf voll onClick={schliessen}>{T('done')}</Knopf>
        </div>
      </Blatt>
    )
  }

  return (
    <Blatt titel={T('interessent_konvertieren')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ padding: '14px 16px', borderRadius: 14, background: 'var(--n-fill)' }}>
          <div style={{ fontSize: 17, fontWeight: 700 }}>{item.voller_name}</div>
          {item.email && <div style={kontakt}><Mail aria-hidden="true" size={16} />{item.email}</div>}
          {item.telefon && <div style={kontakt}><Phone aria-hidden="true" size={16} />{item.telefon}</div>}
        </div>
        {!item.email && (
          <div role="alert" style={{ padding: '12px 16px', borderRadius: 14, background: 'color-mix(in srgb, var(--warning) 16%, var(--bg))', fontSize: 16, lineHeight: 1.45 }}>
            {T('interessent_no_email_warning')}
          </div>
        )}
        <Feld label={T('password')}>
          <input type="password" autoComplete="new-password" value={passwort} onChange={e => setPasswort(e.target.value)} placeholder={T('interessent_password_placeholder')} style={eingabeStil} />
        </Feld>
        <Feld label={T('interessent_assign_course')}>
          <select value={kursId} onChange={e => setKursId(e.target.value)} style={eingabeStil}>
            <option value="">{T('no_course_option')}</option>
            {kurse.map(k => <option key={k.id} value={k.id}>{k.instrumente?.icon} {k.name}</option>)}
          </select>
        </Feld>
        {fehler && <FehlerText>{fehler}</FehlerText>}
        <Knopf voll onClick={konvertieren} disabled={sendet || !item.email}>{sendet ? T('interessent_converting') : T('interessent_make_member')}</Knopf>
      </div>
    </Blatt>
  )
}

const kontakt = { display: 'flex', alignItems: 'center', gap: 8, marginTop: 4, fontSize: 16, color: 'var(--text-2)', overflowWrap: 'anywhere' }
