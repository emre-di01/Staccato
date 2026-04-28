import { useState, useRef, useEffect } from 'react'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

// ─── Avatar Upload ────────────────────────────────────────────
function AvatarBereich({ profil, onUpdate }) {
  const { T } = useApp()
  const fileRef = useRef()
  const [laden, setLaden] = useState(false)

  async function hochladen(datei) {
    if (!datei) return
    setLaden(true)
    const sauber = datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pfad   = `${profil.id}/avatar_${Date.now()}_${sauber}`

    const { error: sErr } = await supabase.storage.from('avatare').upload(pfad, datei, { upsert: true })
    if (sErr) { alert(T('upload_failed') + ': ' + sErr.message); setLaden(false); return }

    const { data: urlData } = supabase.storage.from('avatare').getPublicUrl(pfad)
    const { error: pErr } = await supabase.from('profiles').update({ avatar_url: urlData.publicUrl }).eq('id', profil.id)
    if (!pErr) onUpdate({ ...profil, avatar_url: urlData.publicUrl })
    setLaden(false)
  }

  const initialen = profil.voller_name?.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', gap:12 }}>
      <div style={{ position:'relative', cursor:'pointer' }} onClick={() => fileRef.current.click()}>
        {profil.avatar_url ? (
          <img src={profil.avatar_url} alt="Avatar"
            style={{ width:100, height:100, borderRadius:'50%', objectFit:'cover', border:'3px solid var(--primary)' }} />
        ) : (
          <div style={{ width:100, height:100, borderRadius:'50%', background:'var(--primary)', color:'var(--primary-fg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:36, fontWeight:800, border:'3px solid var(--border)' }}>
            {initialen}
          </div>
        )}
        <div style={{ position:'absolute', bottom:0, right:0, width:32, height:32, borderRadius:'50%', background:'var(--accent)', color:'var(--accent-fg)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:14, border:'2px solid var(--surface)' }}>
          {laden ? '…' : '📷'}
        </div>
      </div>
      <span style={{ fontSize:12, color:'var(--text-3)' }}>{T('profile_tap_to_change')}</span>
      <input ref={fileRef} type="file" accept="image/*" hidden onChange={e => hochladen(e.target.files[0])} />
    </div>
  )
}

// ─── Profil Info bearbeiten ───────────────────────────────────
function ProfilForm({ profil, onUpdate }) {
  const { setLang } = useApp()
  const [form, setForm] = useState({
    voller_name:  profil.voller_name  ?? '',
    telefon:      profil.telefon      ?? '',
    adresse:      profil.adresse      ?? '',
    geburtsdatum: profil.geburtsdatum ?? '',
    sprache:      profil.sprache      ?? 'de',
  })
  const [laden,  setLaden]  = useState(false)
  const [erfolg, setErfolg] = useState(false)
  const [fehler, setFehler] = useState('')

  async function speichern() {
    if (!form.voller_name) { setFehler(T('name_required')); return }
    setLaden(true)
    const { error } = await supabase.from('profiles').update(form).eq('id', profil.id)
    if (error) { setFehler(error.message); setLaden(false); return }
    setLang(form.sprache)
    onUpdate({ ...profil, ...form })
    setErfolg(true)
    setTimeout(() => setErfolg(false), 2000)
    setLaden(false)
  }

  return (
    <div style={s.karte}>
      <h3 style={s.karteTitle}>👤 {T('profile_personal_data')}</h3>
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:14 }}>
        <div style={{ gridColumn:'span 2', display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>{T('full_name_label')}</label>
          <input style={s.input} value={form.voller_name} onChange={e => setForm(f => ({ ...f, voller_name: e.target.value }))} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>{T('profile_phone')}</label>
          <input style={s.input} placeholder="+49 123 456789" value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>{T('profile_birthday')}</label>
          <input type="date" style={s.input} value={form.geburtsdatum} onChange={e => setForm(f => ({ ...f, geburtsdatum: e.target.value }))} />
        </div>
        <div style={{ gridColumn:'span 2', display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>{T('profile_address')}</label>
          <input style={s.input} placeholder="Straße, PLZ Ort" value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>{T('language')}</label>
          <select style={s.input} value={form.sprache} onChange={e => setForm(f => ({ ...f, sprache: e.target.value }))}>
            <option value="de">🇩🇪 Deutsch</option>
            <option value="en">🇬🇧 English</option>
            <option value="tr">🇹🇷 Türkçe</option>
          </select>
        </div>
      </div>
      {fehler && <p style={s.fehler}>{fehler}</p>}
      {erfolg && <p style={s.erfolg}>{T('profile_saved')}</p>}
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
        <button onClick={speichern} disabled={laden} style={s.btnPri}>
          {laden ? T('saving') : T('save')}
        </button>
      </div>
    </div>
  )
}

// ─── E-Mail-Benachrichtigungen ────────────────────────────────
function BenachrichtigungenForm({ profil, onUpdate }) {
  const { T } = useApp()
  const DEFAULT = { event_invite: true, new_piece: true }
  const [prefs, setPrefs] = useState({ ...DEFAULT, ...(profil.email_benachrichtigungen ?? {}) })
  const [laden,  setLaden]  = useState(false)
  const [erfolg, setErfolg] = useState(false)

  async function speichern() {
    setLaden(true)
    const { error } = await supabase
      .from('profiles')
      .update({ email_benachrichtigungen: prefs })
      .eq('id', profil.id)
    if (!error) {
      onUpdate({ ...profil, email_benachrichtigungen: prefs })
      setErfolg(true)
      setTimeout(() => setErfolg(false), 2000)
    }
    setLaden(false)
  }

  function toggle(key) {
    setPrefs(p => ({ ...p, [key]: !p[key] }))
  }

  const OPTIONEN = [
    { key: 'event_invite', label: T('notif_event_invite'), beschreibung: T('notif_event_invite_desc') },
    { key: 'new_piece',    label: T('notif_new_piece'),    beschreibung: T('notif_new_piece_desc') },
  ]

  return (
    <div style={s.karte}>
      <h3 style={s.karteTitle}>{T('email_notifications_title')}</h3>
      <div style={{ display:'flex', flexDirection:'column', gap:12 }}>
        {OPTIONEN.map(opt => (
          <label key={opt.key} style={{ display:'flex', alignItems:'center', gap:14, cursor:'pointer', padding:'12px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', background: prefs[opt.key] ? 'var(--bg-2)' : 'var(--bg)', transition:'background 0.15s' }}>
            <div style={{ position:'relative', flexShrink:0 }}>
              <input
                type="checkbox"
                checked={prefs[opt.key]}
                onChange={() => toggle(opt.key)}
                style={{ position:'absolute', opacity:0, width:0, height:0 }}
              />
              <div style={{
                width:42, height:24, borderRadius:99,
                background: prefs[opt.key] ? 'var(--primary)' : 'var(--border)',
                position:'relative', transition:'background 0.2s',
              }}>
                <div style={{
                  position:'absolute', top:3, left: prefs[opt.key] ? 21 : 3,
                  width:18, height:18, borderRadius:'50%', background:'#fff',
                  boxShadow:'0 1px 4px rgba(0,0,0,.2)', transition:'left 0.2s',
                }} />
              </div>
            </div>
            <div>
              <div style={{ fontWeight:600, fontSize:14, color:'var(--text)' }}>{opt.label}</div>
              <div style={{ fontSize:12, color:'var(--text-3)', marginTop:2 }}>{opt.beschreibung}</div>
            </div>
          </label>
        ))}
      </div>
      {erfolg && <p style={{ ...s.erfolg, marginTop:12 }}>{T('profile_saved')}</p>}
      <div style={{ display:'flex', justifyContent:'flex-end', marginTop:16 }}>
        <button onClick={speichern} disabled={laden} style={s.btnPri}>
          {laden ? T('saving') : T('save')}
        </button>
      </div>
    </div>
  )
}

// ─── E-Mail ändern ────────────────────────────────────────────
function EmailForm() {
  const { T } = useApp()
  const [email,  setEmail]  = useState('')
  const [laden,  setLaden]  = useState(false)
  const [erfolg, setErfolg] = useState(false)
  const [fehler, setFehler] = useState('')

  async function aendern() {
    if (!email || !email.includes('@')) { setFehler(T('email_invalid')); return }
    setLaden(true)
    setFehler('')
    const { error } = await supabase.auth.updateUser({ email })
    if (error) setFehler(error.message)
    else {
      setErfolg(true)
      setEmail('')
      setTimeout(() => setErfolg(false), 6000)
    }
    setLaden(false)
  }

  return (
    <div style={s.karte}>
      <h3 style={s.karteTitle}>{T('email_change_title')}</h3>
      <p style={{ fontSize:13, color:'var(--text-3)', margin:'0 0 16px' }}>
        {T('email_change_desc')}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>{T('email_new_label')}</label>
          <input type="email" style={s.input} placeholder="neue@email.de" value={email}
            onChange={e => setEmail(e.target.value)} />
        </div>
        {fehler && <p style={s.fehler}>{fehler}</p>}
        {erfolg && <p style={s.erfolg}>{T('email_change_sent')}</p>}
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button onClick={aendern} disabled={laden} style={s.btnPri}>
            {laden ? T('sending') : T('email_change_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Passwort ändern ──────────────────────────────────────────
function PasswortForm() {
  const { T } = useApp()
  const [form, setForm] = useState({ neu: '', bestaetigung: '' })
  const [laden,  setLaden]  = useState(false)
  const [erfolg, setErfolg] = useState(false)
  const [fehler, setFehler] = useState('')

  async function aendern() {
    if (form.neu.length < 6) { setFehler(T('password_min_error')); return }
    if (form.neu !== form.bestaetigung) { setFehler(T('password_mismatch')); return }
    setLaden(true)
    setFehler('')
    const { error } = await supabase.auth.updateUser({ password: form.neu })
    if (error) setFehler(error.message)
    else {
      setErfolg(true)
      setForm({ neu: '', bestaetigung: '' })
      setTimeout(() => setErfolg(false), 3000)
    }
    setLaden(false)
  }

  return (
    <div style={s.karte}>
      <h3 style={s.karteTitle}>{T('profile_change_password')}</h3>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>{T('new_password')}</label>
          <input type="password" style={s.input} placeholder={T('password_min_chars')} value={form.neu}
            onChange={e => setForm(f => ({ ...f, neu: e.target.value }))} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>{T('confirm_password')}</label>
          <input type="password" style={s.input} placeholder={T('password_repeat_placeholder')} value={form.bestaetigung}
            onChange={e => setForm(f => ({ ...f, bestaetigung: e.target.value }))} />
        </div>
        {fehler && <p style={s.fehler}>{fehler}</p>}
        {erfolg && <p style={s.erfolg}>{T('profile_pw_changed_short')}</p>}
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button onClick={aendern} disabled={laden} style={s.btnPri}>
            {laden ? T('profile_pw_changing') : T('profile_change_pw_btn')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Admin: Passwort eines anderen Nutzers zurücksetzen ───────
function AdminPasswortReset() {
  const { T } = useApp()
  const [email,  setEmail]  = useState('')
  const [neues,  setNeues]  = useState('')
  const [laden,  setLaden]  = useState(false)
  const [erfolg, setErfolg] = useState(false)
  const [fehler, setFehler] = useState('')

  async function zuruecksetzen() {
    if (!email || !neues) { setFehler(T('all_fields_required')); return }
    if (neues.length < 6) { setFehler(T('password_min_error')); return }
    setLaden(true)
    setFehler('')

    // Nutzer ID über E-Mail finden
    const { data: nutzer } = await supabase.from('profiles')
      .select('id')
      .eq('id',
        (await supabase.from('profiles')
          .select('id')
          .filter('id', 'in', `(${(await supabase.auth.admin?.listUsers?.()?.data?.users ?? []).filter(u => u.email === email).map(u => u.id).join(',')})`)
        )?.data?.[0]?.id ?? ''
      ).single()

    // Direkt über SQL Funktion
    const { error } = await supabase.rpc('admin_passwort_setzen', {
      p_email: email,
      p_neues_passwort: neues,
    })

    if (error) setFehler(error.message)
    else {
      setErfolg(true)
      setEmail('')
      setNeues('')
      setTimeout(() => setErfolg(false), 3000)
    }
    setLaden(false)
  }

  return (
    <div style={s.karte}>
      <h3 style={s.karteTitle}>{T('admin_pw_reset_title')}</h3>
      <p style={{ fontSize:13, color:'var(--text-3)', margin:'0 0 16px' }}>
        {T('admin_pw_reset_desc')}
      </p>
      <div style={{ display:'flex', flexDirection:'column', gap:14 }}>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>{T('admin_pw_user_email')}</label>
          <input type="email" style={s.input} placeholder="nutzer@schule.de" value={email}
            onChange={e => setEmail(e.target.value)} />
        </div>
        <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
          <label style={s.label}>{T('new_password')}</label>
          <input type="password" style={s.input} placeholder={T('password_min_chars')} value={neues}
            onChange={e => setNeues(e.target.value)} />
        </div>
        {fehler && <p style={s.fehler}>{fehler}</p>}
        {erfolg && <p style={s.erfolg}>{T('admin_pw_reset_success')}</p>}
        <div style={{ display:'flex', justifyContent:'flex-end' }}>
          <button onClick={zuruecksetzen} disabled={laden} style={{ ...s.btnPri, background:'var(--warning)' }}>
            {laden ? T('admin_pw_resetting') : T('member_set_password')}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────
export default function ProfilSeite() {
  const { profil, rolle, ladeProfil, T } = useApp()
  const [lokalesProfil, setLokalesProfil] = useState(profil)

  useEffect(() => { setLokalesProfil(profil) }, [profil])

  if (!lokalesProfil) return <div style={{ padding:40, color:'var(--text-3)' }}>{T('loading')}</div>

  function onUpdate(neuesDaten) {
    setLokalesProfil(neuesDaten)
    ladeProfil(neuesDaten.id)
  }

  const rollenFarbe = {
    admin: 'var(--accent)', superadmin: 'var(--danger)',
    lehrer: 'var(--primary)', schueler: 'var(--success)', eltern: 'var(--warning)',
  }

  return (
    <div style={{ maxWidth:640, margin:'0 auto' }}>
      <h1 style={s.h1}>⚙️ {T('profile_title')}</h1>

      {/* Avatar + Name */}
      <div style={{ ...s.karte, display:'flex', gap:24, alignItems:'center', flexWrap:'wrap' }}>
        <AvatarBereich profil={lokalesProfil} onUpdate={onUpdate} />
        <div style={{ flex:1 }}>
          <div style={{ fontSize:22, fontWeight:800, color:'var(--text)', marginBottom:6 }}>{lokalesProfil.voller_name}</div>
          <span style={{ fontSize:12, padding:'4px 12px', borderRadius:99, background: rollenFarbe[rolle] ?? 'var(--bg-2)', color:'#fff', fontWeight:700, textTransform:'capitalize' }}>
            {rolle}
          </span>
          {lokalesProfil.telefon && <div style={{ fontSize:13, color:'var(--text-3)', marginTop:8 }}>📞 {lokalesProfil.telefon}</div>}
        </div>
      </div>

      {/* Profil Formular */}
      <ProfilForm profil={lokalesProfil} onUpdate={onUpdate} />

      {/* E-Mail-Benachrichtigungen */}
      <BenachrichtigungenForm profil={lokalesProfil} onUpdate={onUpdate} />

      {/* E-Mail ändern */}
      <EmailForm />

      {/* Passwort ändern */}
      <PasswortForm />

      {/* Admin: Passwort zurücksetzen */}
      {(rolle === 'admin' || rolle === 'superadmin') && <AdminPasswortReset />}

      {/* Hinweis: Bucket anlegen */}
      <div style={{ padding:'12px 16px', borderRadius:'var(--radius)', background:'var(--bg-2)', border:'1px solid var(--border)', fontSize:12, color:'var(--text-3)', marginTop:8 }}>
        💡 Für Profilbilder muss der Bucket <strong>avatare</strong> (öffentlich) in Supabase Storage angelegt sein.
      </div>
    </div>
  )
}

const s = {
  h1:        { margin:'0 0 20px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' },
  karte:     { background:'var(--surface)', borderRadius:'var(--radius-lg)', padding:'20px 24px', border:'1px solid var(--border)', boxShadow:'var(--shadow)', marginBottom:16 },
  karteTitle:{ margin:'0 0 16px', fontSize:16, fontWeight:800, color:'var(--text)' },
  label:     { fontSize:12, fontWeight:700, color:'var(--text-3)', textTransform:'uppercase', letterSpacing:'0.06em' },
  input:     { padding:'10px 14px', borderRadius:'var(--radius)', border:'1.5px solid var(--border)', fontSize:14, outline:'none', fontFamily:'inherit', background:'var(--bg)', color:'var(--text)', width:'100%' },
  btnPri:    { padding:'10px 20px', borderRadius:'var(--radius)', border:'none', background:'var(--primary)', color:'var(--primary-fg)', fontSize:14, fontWeight:700, cursor:'pointer', fontFamily:'inherit' },
  fehler:    { margin:0, color:'var(--danger)', fontSize:13 },
  erfolg:    { margin:0, color:'var(--success)', fontSize:13, fontWeight:600 },
}
