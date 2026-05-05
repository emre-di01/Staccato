import { useState, useEffect, useCallback, useRef } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import Avatar from '../../components/Avatar'

const ROLLEN = ['admin', 'lehrer', 'schueler', 'eltern', 'vorstand']
const ROLLEN_FARBE = {
  admin:     { bg: 'var(--accent)',   text: 'var(--accent-fg)' },
  lehrer:    { bg: 'var(--primary)',  text: 'var(--primary-fg)' },
  schueler:  { bg: 'var(--success)',  text: '#fff' },
  eltern:    { bg: 'var(--warning)',  text: '#fff' },
  superadmin:{ bg: 'var(--danger)',   text: '#fff' },
  vorstand:  { bg: '#7c3aed',         text: '#fff' },
}

// ─── UI Komponenten ───────────────────────────────────────────

function Badge({ rolle }) {
  const f = ROLLEN_FARBE[rolle] ?? { bg: 'var(--bg-3)', text: 'var(--text-2)' }
  return (
    <span style={{
      background: f.bg, color: f.text,
      padding: '3px 10px', borderRadius: 99,
      fontSize: 11, fontWeight: 700, textTransform: 'capitalize',
      whiteSpace: 'nowrap',
    }}>{rolle}</span>
  )
}

function Modal({ titel, onClose, children, breit = false }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.5)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      zIndex: 1000, padding: 16,
    }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{
        background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
        padding: '28px 32px', width: '100%', maxWidth: breit ? 600 : 460,
        boxShadow: 'var(--shadow-lg)', border: '1px solid var(--border)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
          <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--text)' }}>{titel}</h3>
          <button onClick={onClose} style={s.iconBtn}>✕</button>
        </div>
        {children}
      </div>
    </div>
  )
}

function Feld({ label, children }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <label style={s.label}>{label}</label>
      {children}
    </div>
  )
}

// ─── Nutzer anlegen Modal ─────────────────────────────────────

function NutzerAnlegenModal({ onClose, onErfolg, T }) {
  const [form, setForm] = useState({ email: '', voller_name: '', passwort: '', rolle: 'schueler', telefon: '', geburtsdatum: '' })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')
  const [erfolg, setErfolg] = useState(false)

  async function anlegen() {
    if (!form.email || !form.voller_name || !form.passwort) {
      setFehler(T('all_fields_required'))
      return
    }
    setLaden(true)
    setFehler('')

    const { error } = await supabase.rpc('create_user', {
      p_email:       form.email,
      p_passwort:    form.passwort,
      p_voller_name: form.voller_name,
      p_rolle:       form.rolle,
    })

    if (error) {
      setFehler(error.message.includes('409') || error.message.includes('already')
        ? T('interessent_email_exists')
        : error.message)
      setLaden(false)
      return
    }

    // Zusätzliche Felder updaten
    if (form.telefon || form.geburtsdatum) {
      const { data: u } = await supabase.from('profiles').select('id').eq('voller_name', form.voller_name).single()
      if (u) await supabase.from('profiles').update({ telefon: form.telefon, geburtsdatum: form.geburtsdatum || null }).eq('id', u.id)
    }

    setErfolg(true)
    setLaden(false)
    supabase.functions.invoke('send-email', {
      body: { type: 'welcome', email: form.email, voller_name: form.voller_name, passwort: form.passwort, rolle: form.rolle },
    }).catch(console.error)
    setTimeout(() => { onErfolg(); onClose() }, 1200)
  }

  return (
    <Modal titel={T('member_new_title')} onClose={onClose}>
      <div style={s.formGrid}>
        {erfolg ? (
          <div style={s.erfolg}>{T('member_created')}</div>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Feld label={T('full_name_label')}>
                <input style={s.input} placeholder="Max Mustermann" value={form.voller_name}
                  onChange={e => setForm(f => ({ ...f, voller_name: e.target.value }))} />
              </Feld>
              <Feld label={T('role')}>
                <select style={s.input} value={form.rolle} onChange={e => setForm(f => ({ ...f, rolle: e.target.value }))}>
                  {ROLLEN.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                </select>
              </Feld>
            </div>
            <Feld label={`${T('email')} *`}>
              <input type="email" style={s.input} placeholder="max@beispiel.de" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} />
            </Feld>
            <Feld label={`${T('password')} *`}>
              <input type="password" style={s.input} placeholder={T('password_min_chars')} value={form.passwort}
                onChange={e => setForm(f => ({ ...f, passwort: e.target.value }))} />
            </Feld>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <Feld label={T('profile_phone')}>
                <input style={s.input} placeholder="+49 123 456789" value={form.telefon}
                  onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
              </Feld>
              <Feld label={T('profile_birthday')}>
                <input type="date" style={s.input} value={form.geburtsdatum}
                  onChange={e => setForm(f => ({ ...f, geburtsdatum: e.target.value }))} />
              </Feld>
            </div>
            {fehler && <p style={s.fehler}>{fehler}</p>}
            <div style={s.btnRow}>
              <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
              <button onClick={anlegen} disabled={laden} style={s.btnPri}>
                {laden ? T('saving') : T('member_create')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Profil bearbeiten Modal ──────────────────────────────────

function ProfilModal({ mitglied, onClose, onErfolg, T }) {
  const [form, setForm] = useState({
    voller_name:         mitglied.voller_name ?? '',
    rolle:               mitglied.rolle ?? 'schueler',
    telefon:             mitglied.telefon ?? '',
    adresse:             mitglied.adresse ?? '',
    geburtsdatum:        mitglied.geburtsdatum ?? '',
    notizen:             mitglied.notizen ?? '',
    aktiv:               mitglied.aktiv ?? true,
    kann_kurse_anlegen:  mitglied.kann_kurse_anlegen ?? false,
  })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  async function speichern() {
    setLaden(true)
    const payload = { ...form, geburtsdatum: form.geburtsdatum || null }
    const { error } = await supabase.from('profiles').update(payload).eq('id', mitglied.id)
    if (error) setFehler(error.message)
    else { onErfolg(); onClose() }
    setLaden(false)
  }

  return (
    <Modal titel={`Profil – ${mitglied.voller_name}`} onClose={onClose} breit>
      <div style={s.formGrid}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Feld label={T('name')}>
            <input style={s.input} value={form.voller_name} onChange={e => setForm(f => ({ ...f, voller_name: e.target.value }))} />
          </Feld>
          <Feld label={T('role')}>
            <select style={s.input} value={form.rolle} onChange={e => setForm(f => ({ ...f, rolle: e.target.value }))}>
              {ROLLEN.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
            </select>
          </Feld>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Feld label={T('profile_phone')}>
            <input style={s.input} value={form.telefon} onChange={e => setForm(f => ({ ...f, telefon: e.target.value }))} />
          </Feld>
          <Feld label={T('profile_birthday')}>
            <input type="date" style={s.input} value={form.geburtsdatum}
              onChange={e => setForm(f => ({ ...f, geburtsdatum: e.target.value }))} />
          </Feld>
        </div>
        <Feld label={T('profile_address')}>
          <input style={s.input} value={form.adresse} onChange={e => setForm(f => ({ ...f, adresse: e.target.value }))} />
        </Feld>
        <Feld label={T('member_internal_notes')}>
          <textarea style={{ ...s.input, minHeight: 80, resize: 'vertical' }} value={form.notizen}
            onChange={e => setForm(f => ({ ...f, notizen: e.target.value }))} />
        </Feld>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <input type="checkbox" id="aktiv" checked={form.aktiv} onChange={e => setForm(f => ({ ...f, aktiv: e.target.checked }))} />
          <label htmlFor="aktiv" style={s.label}>{T('active')}</label>
        </div>
        {form.rolle === 'lehrer' && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <input type="checkbox" id="kann_kurse_anlegen" checked={form.kann_kurse_anlegen}
              onChange={e => setForm(f => ({ ...f, kann_kurse_anlegen: e.target.checked }))} />
            <label htmlFor="kann_kurse_anlegen" style={s.label}>Darf eigene Kurse anlegen</label>
          </div>
        )}
        {fehler && <p style={s.fehler}>{fehler}</p>}
        <div style={s.btnRow}>
          <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
          <button onClick={speichern} disabled={laden} style={s.btnPri}>
            {laden ? T('saving') : `💾 ${T('save')}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Lehrer-Schüler Zuordnung Modal ──────────────────────────

function ZuordnungModal({ mitglied, onClose, T }) {
  const [lehrer,    setLehrer]    = useState([])
  const [schueler,  setSchueler]  = useState([])
  const [zuordnung, setZuordnung] = useState([])
  const [unterricht, setUnterricht] = useState([])
  const [laden,     setLaden]     = useState(true)

  useEffect(() => {
    async function init() {
      const [l, sc, u] = await Promise.all([
        supabase.from('profiles').select('id, voller_name').eq('rolle', 'lehrer').eq('aktiv', true).order('voller_name'),
        supabase.from('profiles').select('id, voller_name').eq('rolle', 'schueler').eq('aktiv', true).order('voller_name'),
        supabase.from('unterricht').select('id, name, typ, unterricht_lehrer(lehrer_id), unterricht_schueler(schueler_id)'),
      ])
      setLehrer(l.data ?? [])
      setSchueler(sc.data ?? [])
      setUnterricht(u.data ?? [])
      setLaden(false)
    }
    init()
  }, [mitglied.id])

  const istLehrer = mitglied.rolle === 'lehrer'
  const liste = istLehrer ? schueler : lehrer

  // Unterrichte wo dieses Mitglied dabei ist
  const meineUnterricht = unterricht.filter(u =>
    istLehrer
      ? u.unterricht_lehrer?.some(ul => ul.lehrer_id === mitglied.id)
      : u.unterricht_schueler?.some(us => us.schueler_id === mitglied.id)
  )

  if (laden) return <Modal titel="Zuordnungen" onClose={onClose}><p style={{ color: 'var(--text-3)' }}>{T('loading')}</p></Modal>

  return (
    <Modal titel={`Zuordnungen – ${mitglied.voller_name}`} onClose={onClose} breit>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        {/* Aktuelle Unterrichte */}
        <div>
          <div style={s.sectionLabel}>{T('member_current_courses')}</div>
          {meineUnterricht.length === 0 ? (
            <p style={{ color: 'var(--text-3)', fontSize: 13 }}>{T('member_not_assigned')}</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
              {meineUnterricht.map(u => (
                <div key={u.id} style={{
                  padding: '10px 14px', borderRadius: 'var(--radius)',
                  background: 'var(--bg-2)', border: '1px solid var(--border)',
                  display: 'flex', alignItems: 'center', gap: 10,
                }}>
                  <span style={{ fontSize: 16 }}>
                    {u.typ === 'chor' ? '🎼' : u.typ === 'gruppe' ? '👥' : u.typ === 'ensemble' ? '🎻' : '🎵'}
                  </span>
                  <span style={{ fontSize: 14, fontWeight: 600, color: 'var(--text)' }}>{u.name}</span>
                  <span style={{ fontSize: 11, color: 'var(--text-3)', textTransform: 'capitalize', marginLeft: 'auto' }}>{u.typ}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <p style={{ color: 'var(--text-3)', fontSize: 13, margin: 0 }}>
            💡 {T('zuordnung_hint')}
          </p>
        </div>

        <div style={s.btnRow}>
          <button onClick={onClose} style={s.btnPri}>{T('done')}</button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Passwort zurücksetzen Modal ─────────────────────────────

function PasswortModal({ mitglied, onClose }) {
  const { T } = useApp()
  const [pw,     setPw]     = useState('')
  const [pw2,    setPw2]    = useState('')
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')
  const [erfolg, setErfolg] = useState(false)

  async function speichern() {
    if (!pw || pw.length < 6) { setFehler(T('password_min_error')); return }
    if (pw !== pw2) { setFehler(T('password_mismatch')); return }
    setLaden(true); setFehler('')

    // SQL Funktion um Passwort zu setzen
    const { error } = await supabase.rpc('admin_set_password', {
      p_user_id:  mitglied.id,
      p_passwort: pw,
    })

    if (error) {
      // Fallback: direkt in auth.users
      const { error: e2 } = await supabase.rpc('admin_set_password_direct', {
        p_user_id:  mitglied.id,
        p_passwort: pw,
      })
      if (e2) { setFehler('Fehler: ' + (error.message ?? e2.message)); setLaden(false); return }
    }

    setErfolg(true)
    setLaden(false)
    setTimeout(onClose, 1500)
  }

  return (
    <Modal titel={`🔑 Passwort – ${mitglied.voller_name}`} onClose={onClose}>
      <div style={s.formGrid}>
        {erfolg ? (
          <div style={{ padding:'16px', borderRadius:'var(--radius)', background:'#d1fae5', color:'#065f46', fontWeight:700, textAlign:'center' }}>
            {T('member_pw_success')}
          </div>
        ) : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>{T('new_password')}</label>
              <input type="password" style={s.input} value={pw} placeholder={T('password_min_chars')}
                onChange={e => setPw(e.target.value)} />
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>{T('confirm_password')}</label>
              <input type="password" style={s.input} value={pw2} placeholder={T('password_min_chars')}
                onChange={e => setPw2(e.target.value)} />
            </div>
            {fehler && <p style={s.fehler}>{fehler}</p>}
            <div style={s.btnRow}>
              <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
              <button onClick={speichern} disabled={laden} style={s.btnPri}>
                {laden ? T('member_pw_setting') : T('member_set_password')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── E-Mail ändern Modal ─────────────────────────────────────

function EmailModal({ mitglied, onClose, onErfolg }) {
  const { T } = useApp()
  const [email,  setEmail]  = useState(mitglied.email ?? '')
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')
  const [erfolg, setErfolg] = useState(false)

  async function speichern() {
    if (!email || !email.includes('@')) { setFehler(T('email_invalid')); return }
    setLaden(true); setFehler('')

    const { error } = await supabase.rpc('admin_set_email', {
      p_user_id: mitglied.id,
      p_email:   email,
    })

    if (error) { setFehler(error.message); setLaden(false); return }

    setErfolg(true)
    setLaden(false)
    setTimeout(() => { onErfolg(); onClose() }, 1500)
  }

  return (
    <Modal titel={`📧 E-Mail – ${mitglied.voller_name}`} onClose={onClose}>
      <div style={s.formGrid}>
        {erfolg ? (
          <div style={{ padding:'16px', borderRadius:'var(--radius)', background:'#d1fae5', color:'#065f46', fontWeight:700, textAlign:'center' }}>
            {T('member_email_updated')}
          </div>
        ) : (
          <>
            <div style={{ display:'flex', flexDirection:'column', gap:6 }}>
              <label style={s.label}>{T('email_address')}</label>
              <input type="email" style={s.input} value={email}
                onChange={e => setEmail(e.target.value)} />
            </div>
            {fehler && <p style={s.fehler}>{fehler}</p>}
            <div style={s.btnRow}>
              <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
              <button onClick={speichern} disabled={laden} style={s.btnPri}>
                {laden ? T('saving') : T('member_change_email')}
              </button>
            </div>
          </>
        )}
      </div>
    </Modal>
  )
}

// ─── Dokumente Modal ─────────────────────────────────────────

const DOK_TYPEN = [
  { key: 'aufnahmeformular', tKey: 'dok_type_aufnahmeformular' },
  { key: 'vertrag',          tKey: 'dok_type_vertrag' },
  { key: 'sepa',             tKey: 'dok_type_sepa' },
  { key: 'einverstaendnis',  tKey: 'dok_type_einverstaendnis' },
  { key: 'sonstiges',        tKey: 'dok_type_sonstiges' },
]

function DokumenteModal({ mitglied, onClose }) {
  const { T } = useApp()
  const fileRef = useRef()
  const [dateien,  setDateien]  = useState([])
  const [laden,    setLaden]    = useState(true)
  const [form,     setForm]     = useState({ name: '', typ: 'sonstiges' })
  const [datei,    setDatei]    = useState(null)
  const [uploading, setUploading] = useState(false)
  const [fehler,   setFehler]   = useState('')

  async function ladeData() {
    const { data } = await supabase.from('mitglied_dateien')
      .select('*').eq('profil_id', mitglied.id).order('hochgeladen_am', { ascending: false })
    setDateien(data ?? [])
    setLaden(false)
  }

  useEffect(() => { ladeData() }, [mitglied.id])

  async function hochladen() {
    if (!datei) { setFehler(T('dok_no_file')); return }
    const name = form.name.trim() || datei.name
    setUploading(true); setFehler('')
    const sauber = datei.name.replace(/[^a-zA-Z0-9._-]/g, '_')
    const pfad = `${mitglied.id}/${Date.now()}_${sauber}`
    const { error: sErr } = await supabase.storage.from('mitglied-dateien').upload(pfad, datei)
    if (sErr) { setFehler(sErr.message); setUploading(false); return }
    const { error: dErr } = await supabase.from('mitglied_dateien').insert({
      profil_id: mitglied.id, name, typ: form.typ, bucket_pfad: pfad,
    })
    if (dErr) setFehler(dErr.message)
    else { setForm({ name: '', typ: 'sonstiges' }); setDatei(null); ladeData() }
    setUploading(false)
  }

  async function loeschen(d) {
    if (!confirm(`„${d.name}" wirklich löschen?`)) return
    await supabase.storage.from('mitglied-dateien').remove([d.bucket_pfad])
    await supabase.from('mitglied_dateien').delete().eq('id', d.id)
    setDateien(prev => prev.filter(x => x.id !== d.id))
  }

  async function oeffnen(d) {
    const { data } = await supabase.storage.from('mitglied-dateien').createSignedUrl(d.bucket_pfad, 86400)
    if (data?.signedUrl) window.open(data.signedUrl, '_blank')
  }

  return (
    <Modal titel={`📁 Dokumente – ${mitglied.voller_name}`} onClose={onClose} breit>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

        {/* Dateiliste */}
        <div>
          <div style={s.sectionLabel}>{T('dok_documents')}</div>
          {laden ? (
            <div style={{ color: 'var(--text-3)', fontSize: 13 }}>{T('loading')}</div>
          ) : dateien.length === 0 ? (
            <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>{T('dok_none')}</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {dateien.map(d => (
                <div key={d.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 'var(--radius)', background: 'var(--bg-2)', border: '1px solid var(--border)' }}>
                  <span style={{ fontSize: 20 }}>📄</span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{d.name}</div>
                    <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>
                      {T(DOK_TYPEN.find(t => t.key === d.typ)?.tKey ?? d.typ)} · {new Date(d.hochgeladen_am).toLocaleDateString('de-DE')}
                    </div>
                  </div>
                  <button onClick={() => oeffnen(d)} style={s.btnSek}>{T('dok_open')}</button>
                  <button onClick={() => loeschen(d)} style={{ ...s.btnKlein, color: 'var(--danger)' }}>🗑</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upload */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16 }}>
          <div style={s.sectionLabel}>{T('member_upload_doc')}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginTop: 8 }}>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={s.label}>{T('dok_label')}</label>
                <input style={s.input} placeholder="z.B. Aufnahmeformular 2024" value={form.name}
                  onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                <label style={s.label}>{T('type')}</label>
                <select style={s.input} value={form.typ} onChange={e => setForm(f => ({ ...f, typ: e.target.value }))}>
                  {DOK_TYPEN.map(t => <option key={t.key} value={t.key}>{T(t.tKey)}</option>)}
                </select>
              </div>
            </div>
            <div style={{ border: '2px dashed var(--border)', borderRadius: 'var(--radius)', padding: '20px', textAlign: 'center', cursor: 'pointer', background: 'var(--bg-2)' }}
              onClick={() => fileRef.current.click()}
              onDragOver={e => e.preventDefault()}
              onDrop={e => { e.preventDefault(); setDatei(e.dataTransfer.files[0]) }}>
              {datei
                ? <span style={{ color: 'var(--text)', fontWeight: 600 }}>📎 {datei.name}</span>
                : <span style={{ color: 'var(--text-3)', fontSize: 14 }}>{T('dok_choose_file')}</span>
              }
              <input ref={fileRef} type="file" hidden onChange={e => setDatei(e.target.files[0])} />
            </div>
            {fehler && <p style={{ margin: 0, color: 'var(--danger)', fontSize: 13 }}>{fehler}</p>}
            <div style={s.btnRow}>
              <button onClick={onClose} style={s.btnSek}>{T('close')}</button>
              <button onClick={hochladen} disabled={uploading || !datei} style={s.btnPri}>
                {uploading ? T('dok_uploading') : T('dok_upload')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </Modal>
  )
}

// ─── Löschen Bestätigung Modal ────────────────────────────────

function LoeschenModal({ mitglied, onClose, onErfolg }) {
  const { T } = useApp()
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  async function loeschen() {
    setLaden(true)
    setFehler('')

    // 1. Alle Mitglied-Dokumente aus Storage löschen
    const { data: docs } = await supabase.from('mitglied_dateien')
      .select('bucket_pfad').eq('profil_id', mitglied.id)
    if (docs?.length > 0) {
      await supabase.storage.from('mitglied-dateien').remove(docs.map(d => d.bucket_pfad))
    }

    // 2. Avatar löschen (falls vorhanden)
    if (mitglied.avatar_url) {
      const match = mitglied.avatar_url.split('?')[0].match(/\/avatare\/(.+)$/)
      if (match?.[1]) {
        await supabase.storage.from('avatare').remove([decodeURIComponent(match[1])])
      }
    }

    // 3. Auth-User löschen (kaskadiert auf profiles, mitglied_dateien, etc.)
    const { error } = await supabase.rpc('delete_auth_user', { p_user_id: mitglied.id })
    if (error) {
      setFehler(error.message)
      setLaden(false)
      return
    }
    onErfolg()
    onClose()
  }

  return (
    <Modal titel={T('member_delete')} onClose={onClose}>
      <div style={s.formGrid}>
        <div style={{ padding:'16px', borderRadius:'var(--radius)', background:'#fee2e2', border:'1px solid #fecaca', color:'var(--danger)', fontSize:14 }}>
          {T('member_delete_confirm').replace('{name}', mitglied.voller_name)}
        </div>
        {fehler && <p style={s.fehler}>{fehler}</p>}
        <div style={s.btnRow}>
          <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
          <button onClick={loeschen} disabled={laden}
            style={{ ...s.btnPri, background:'var(--danger)' }}>
            {laden ? '…' : `🗑 ${T('delete')}`}
          </button>
        </div>
      </div>
    </Modal>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────

export default function Mitgliederverwaltung() {
  const { T } = useApp()
  const [mitglieder,  setMitglieder]  = useState([])
  const [laden,       setLaden]       = useState(true)
  const [suche,       setSuche]       = useState('')
  const [filterRolle, setFilterRolle] = useState('alle')
  const [filterAktiv, setFilterAktiv] = useState('alle')
  const [modal,       setModal]       = useState(null)

  const ladeMitglieder = useCallback(async () => {
    setLaden(true)
    const { data } = await supabase
      .from('mitglieder_mit_email')
      .select('*')
      .order('voller_name')
    setMitglieder(data ?? [])
    setLaden(false)
  }, [])

  useEffect(() => { ladeMitglieder() }, [ladeMitglieder])

  const gefiltert = mitglieder.filter(m => {
    const suchPasst = m.voller_name?.toLowerCase().includes(suche.toLowerCase())
    const rollePasst = filterRolle === 'alle' || m.rolle === filterRolle
    const aktivPasst = filterAktiv === 'alle' || (filterAktiv === 'aktiv' ? m.aktiv : !m.aktiv)
    return suchPasst && rollePasst && aktivPasst
  })

  // Statistiken
  const stats = {
    gesamt:   mitglieder.length,
    lehrer:   mitglieder.filter(m => m.rolle === 'lehrer').length,
    schueler: mitglieder.filter(m => m.rolle === 'schueler').length,
    eltern:   mitglieder.filter(m => m.rolle === 'eltern').length,
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={s.h1}>👥 {T('members')}</h1>
          <p style={s.sub}>{stats.gesamt} {T('members')} · {stats.lehrer} {T('lehrer')} · {stats.schueler} {T('schueler')}</p>
        </div>
        <button onClick={() => setModal({ typ: 'anlegen' })} style={s.btnPri}>
          {T('member_create')}
        </button>
      </div>

      {/* Stats Chips */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
        {[
          { label: T('all'), wert: stats.gesamt, key: 'alle' },
          { label: T('lehrer'), wert: stats.lehrer, key: 'lehrer' },
          { label: T('schueler'), wert: stats.schueler, key: 'schueler' },
          { label: T('eltern'), wert: stats.eltern, key: 'eltern' },
          { label: T('admin'), wert: mitglieder.filter(m => m.rolle === 'admin').length, key: 'admin' },
        ].map(item => (
          <button key={item.key} onClick={() => setFilterRolle(item.key)}
            style={{
              padding: '6px 14px', borderRadius: 99,
              border: '1.5px solid var(--border)',
              background: filterRolle === item.key ? 'var(--primary)' : 'var(--surface)',
              color: filterRolle === item.key ? 'var(--primary-fg)' : 'var(--text-2)',
              fontSize: 13, fontWeight: 600, cursor: 'pointer', fontFamily: 'inherit',
              transition: 'all 0.15s',
            }}>
            {item.label} {item.wert > 0 && <span style={{ opacity: 0.7 }}>({item.wert})</span>}
          </button>
        ))}
      </div>

      {/* Suche */}
      <div style={{ display: 'flex', gap: 10, marginBottom: 20, flexWrap: 'wrap' }}>
        <input
          placeholder={T('member_search')}
          value={suche}
          onChange={e => setSuche(e.target.value)}
          style={{ ...s.input, flex: 1, maxWidth: 340 }}
        />
        <select style={{ ...s.input, width: 'auto' }} value={filterAktiv} onChange={e => setFilterAktiv(e.target.value)}>
          <option value="alle">{T('all_status')}</option>
          <option value="aktiv">{T('active')}</option>
          <option value="inaktiv">{T('inactive')}</option>
        </select>
      </div>

      {/* Tabelle / Karten */}
      {laden ? (
        <div style={s.leer}>{T('member_loading')}</div>
      ) : gefiltert.length === 0 ? (
        <div style={s.leer}>{T('member_none_found')}</div>
      ) : (
        <>
          {/* Desktop Tabelle */}
          <div style={{ background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)', overflow: 'hidden', boxShadow: 'var(--shadow)' }} className="desktop-table">
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr style={{ background: 'var(--bg-2)' }}>
                  {[T('member_header'), T('role'), T('profile_phone'), T('profile_birthday'), T('status'), T('actions')].map(h => (
                    <th key={h} style={{ padding: '12px 16px', textAlign: 'left', fontSize: 11, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.08em', borderBottom: '1px solid var(--border)' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {gefiltert.map((m, i) => (
                  <tr key={m.id} style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)', borderBottom: '1px solid var(--border)' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={m.voller_name} avatarUrl={m.avatar_url} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{m.voller_name}</div>
                          {m.email && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{m.email}</div>}
                          {m.notizen && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{T('has_notes')}</div>}
                        </div>
                      </div>
                    </td>
                    <td style={{ padding: '12px 16px' }}><Badge rolle={m.rolle} /></td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>{m.telefon ?? '–'}</td>
                    <td style={{ padding: '12px 16px', fontSize: 13, color: 'var(--text-2)' }}>
                      {m.geburtsdatum ? new Date(m.geburtsdatum).toLocaleDateString('de-DE') : '–'}
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <span style={{ fontSize: 11, fontWeight: 700, color: m.aktiv ? 'var(--success)' : 'var(--danger)' }}>
                        {m.aktiv ? `● ${T('active')}` : `○ ${T('inactive')}`}
                      </span>
                    </td>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', gap: 6 }}>
                        <button onClick={() => setModal({ typ: 'profil', mitglied: m })} style={s.btnKlein} title="Bearbeiten">✏️</button>
                        <button onClick={() => setModal({ typ: 'email', mitglied: m })} style={s.btnKlein} title="E-Mail">📧</button>
                        <button onClick={() => setModal({ typ: 'passwort', mitglied: m })} style={s.btnKlein} title="Passwort">🔑</button>
                        {(m.rolle === 'lehrer' || m.rolle === 'schueler') && (
                          <button onClick={() => setModal({ typ: 'zuordnung', mitglied: m })} style={s.btnKlein} title="Zuordnungen">🔗</button>
                        )}
                        <button onClick={() => setModal({ typ: 'dokumente', mitglied: m })} style={s.btnKlein} title="Dokumente">📁</button>
                        <button onClick={() => setModal({ typ: 'loeschen', mitglied: m })} style={{ ...s.btnKlein, color:'var(--danger)' }} title="Löschen">🗑</button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Mobile Karten */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="mobile-cards">
            {gefiltert.map(m => (
              <div key={m.id} style={{
                background: 'var(--surface)', borderRadius: 'var(--radius-lg)',
                padding: '16px', border: '1px solid var(--border)',
                boxShadow: 'var(--shadow)',
              }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 12 }}>
                  <Avatar name={m.voller_name} avatarUrl={m.avatar_url} size={44} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text)' }}>{m.voller_name}</div>
                    {m.email && <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>{m.email}</div>}
                    <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                      <Badge rolle={m.rolle} />
                      <span style={{ fontSize: 11, fontWeight: 700, color: m.aktiv ? 'var(--success)' : 'var(--danger)' }}>
                        {m.aktiv ? `● ${T('active')}` : `○ ${T('inactive')}`}
                      </span>
                    </div>
                  </div>
                </div>
                {m.telefon && <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 8 }}>📞 {m.telefon}</div>}
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setModal({ typ: 'profil', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>
                      ✏️ {T('edit')}
                    </button>
                    {(m.rolle === 'lehrer' || m.rolle === 'schueler') && (
                      <button onClick={() => setModal({ typ: 'zuordnung', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>
                        🔗 {T('member_assignments')}
                      </button>
                    )}
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button onClick={() => setModal({ typ: 'email', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>
                      📧
                    </button>
                    <button onClick={() => setModal({ typ: 'passwort', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>
                      🔑
                    </button>
                    <button onClick={() => setModal({ typ: 'dokumente', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>
                      📁
                    </button>
                    <button onClick={() => setModal({ typ: 'loeschen', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13, color:'var(--danger)', borderColor:'var(--danger)' }}>
                      🗑
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* Modals */}
      {modal?.typ === 'anlegen'   && <NutzerAnlegenModal onClose={() => setModal(null)} onErfolg={ladeMitglieder} T={T} />}
      {modal?.typ === 'profil'    && <ProfilModal mitglied={modal.mitglied} onClose={() => setModal(null)} onErfolg={ladeMitglieder} T={T} />}
      {modal?.typ === 'email'     && <EmailModal mitglied={modal.mitglied} onClose={() => setModal(null)} onErfolg={ladeMitglieder} />}
      {modal?.typ === 'passwort'  && <PasswortModal mitglied={modal.mitglied} onClose={() => setModal(null)} />}
      {modal?.typ === 'zuordnung' && <ZuordnungModal mitglied={modal.mitglied} onClose={() => setModal(null)} T={T} />}
      {modal?.typ === 'dokumente' && <DokumenteModal mitglied={modal.mitglied} onClose={() => setModal(null)} />}
      {modal?.typ === 'loeschen'  && (
        <LoeschenModal
          mitglied={modal.mitglied}
          onClose={() => setModal(null)}
          onErfolg={ladeMitglieder}
        />
      )}

      <style>{`
        @media (max-width: 768px) {
          .desktop-table { display: none !important; }
          .mobile-cards { display: flex !important; }
        }
        @media (min-width: 769px) {
          .mobile-cards { display: none !important; }
        }
      `}</style>
    </div>
  )
}

// ─── Styles ───────────────────────────────────────────────────
const s = {
  h1:         { margin: '0 0 4px', fontSize: 26, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.5px' },
  sub:        { margin: 0, color: 'var(--text-3)', fontSize: 14 },
  label:      { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em' },
  sectionLabel: { fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 8 },
  input:      { padding: '10px 14px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', fontSize: 14, outline: 'none', fontFamily: 'inherit', background: 'var(--bg)', color: 'var(--text)', width: '100%', transition: 'border-color 0.15s' },
  btnPri:     { padding: '10px 20px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'inherit', transition: 'opacity 0.15s', whiteSpace: 'nowrap' },
  btnSek:     { padding: '10px 16px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit' },
  btnKlein:   { padding: '6px 10px', borderRadius: 8, border: 'none', background: 'var(--bg-2)', color: 'var(--text-2)', fontSize: 14, cursor: 'pointer', fontFamily: 'inherit', transition: 'background 0.15s' },
  iconBtn:    { background: 'none', border: 'none', fontSize: 18, cursor: 'pointer', color: 'var(--text-3)', padding: 4 },
  leer:       { padding: '64px', textAlign: 'center', color: 'var(--text-3)', fontSize: 14, background: 'var(--surface)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--border)' },
  formGrid:   { display: 'flex', flexDirection: 'column', gap: 16 },
  btnRow:     { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  fehler:     { margin: 0, color: 'var(--danger)', fontSize: 13 },
  erfolg:     { padding: '16px', borderRadius: 'var(--radius)', background: 'var(--bg-2)', color: 'var(--success)', fontWeight: 700, textAlign: 'center' },
}
