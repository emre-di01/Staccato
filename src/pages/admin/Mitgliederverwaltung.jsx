import { useState, useEffect, useCallback, useRef } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import SharedModal from '../../components/Modal'
import Avatar from '../../components/Avatar'
import AufnahmeantragModal from '../../components/AufnahmeantragModal'
import KursantragModal from '../../components/KursantragModal'

const ROLLEN      = ['lehrer', 'schueler', 'eltern', 'vorstand']
const ALLE_ROLLEN = ['admin', 'lehrer', 'schueler', 'eltern', 'vorstand']
const ROLLEN_FARBE = {
  admin:     { bg: 'var(--accent)',   text: 'var(--accent-fg)' },
  lehrer:    { bg: 'var(--primary)',  text: 'var(--primary-fg)' },
  schueler:  { bg: 'var(--success)',  text: '#fff' },
  eltern:    { bg: 'var(--warning)',  text: '#fff' },
  superadmin:{ bg: 'var(--danger)',   text: '#fff' },
  vorstand:  { bg: '#7c3aed',         text: '#fff' },
}

function bicGueltig(bic) {
  return /^[A-Z]{4}[A-Z]{2}[A-Z0-9]{2}([A-Z0-9]{3})?$/.test(bic.replace(/\s/g, '').toUpperCase())
}

function ibanGueltig(iban) {
  const rein = iban.replace(/\s/g, '').toUpperCase()
  if (!/^[A-Z]{2}[0-9]{2}[A-Z0-9]+$/.test(rein)) return false
  const umgestellt = rein.slice(4) + rein.slice(0, 4)
  const ziffern = umgestellt.split('').map(c => isNaN(c) ? String(c.charCodeAt(0) - 55) : c).join('')
  let rest = 0
  for (const chunk of ziffern.match(/.{1,9}/g)) rest = Number(String(rest) + chunk) % 97
  return rest === 1
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
  return <SharedModal titel={titel} onClose={onClose} maxWidth={breit ? 600 : 460}>{children}</SharedModal>
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
  const { profil, rolle: currentRolle } = useApp()
  const [form, setForm] = useState({ email: '', voller_name: '', passwort: '', rolle: 'schueler', telefon: '', geburtsdatum: '' })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')
  const [erfolg, setErfolg] = useState(false)

  async function anlegen() {
    if (!form.email || !form.voller_name || !form.passwort) {
      setFehler(T('all_fields_required'))
      return
    }
    if (form.passwort.length < 8 || !/[A-Z]/.test(form.passwort) || !/[a-z]/.test(form.passwort) || !/[0-9]/.test(form.passwort)) {
      setFehler(T('password_min_error'))
      return
    }
    setLaden(true)
    setFehler('')

    const { error } = await supabase.rpc('create_user', {
      p_email:       form.email,
      p_passwort:    form.passwort,
      p_voller_name: form.voller_name,
      p_rolle:       form.rolle,
      p_schule_id:   profil?.schule_id,
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
                  {(currentRolle === 'superadmin' ? ALLE_ROLLEN : ROLLEN).map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
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

// ─── Einladung senden Modal ───────────────────────────────────

function EinladungModal({ onClose, T }) {
  const { schule, profil } = useApp()
  const [form,   setForm]   = useState({ email: '', rolle: 'schueler' })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')
  const [erfolg, setErfolg] = useState(null) // { action, message }

  async function senden() {
    if (!form.email) { setFehler(T('all_fields_required')); return }
    setLaden(true)
    setFehler('')

    const { data, error } = await supabase.rpc('einladung_versenden', {
      p_email: form.email,
      p_rolle: form.rolle,
    })

    if (error) { setFehler(error.message); setLaden(false); return }

    const action = data?.action

    if (action === 'already_member') {
      setFehler(T('invitation_already_member'))
      setLaden(false)
      return
    }

    if (action === 'einladung_erstellt') {
      // Einladungs-E-Mail versenden
      await supabase.functions.invoke('send-email', {
        body: {
          type:       'schuleinladung',
          email:      data.email,
          token:      data.token,
          schule_name:          schule?.name ?? 'Staccato',
          eingeladen_von_name:  profil?.voller_name,
          rolle:                form.rolle,
        },
      }).catch(console.error)
      setErfolg({ action, message: T('invitation_sent') })
    } else if (action === 'mitgliedschaft_erstellt') {
      setErfolg({ action, message: T('invitation_direct') })
    }

    setLaden(false)
  }

  return (
    <Modal titel={`📧 ${T('invite_member')}`} onClose={onClose}>
      <div style={s.formGrid}>
        {erfolg ? (
          <div style={{ textAlign: 'center', padding: '16px 0' }}>
            <div style={{ fontSize: 40, marginBottom: 12 }}>
              {erfolg.action === 'einladung_erstellt' ? '📧' : '✅'}
            </div>
            <div style={{ fontSize: 15, fontWeight: 700, color: 'var(--text)', marginBottom: 8 }}>
              {erfolg.message}
            </div>
            <div style={{ fontSize: 13, color: 'var(--text-3)' }}>
              {erfolg.action === 'einladung_erstellt'
                ? 'Der Einladungslink wurde per E-Mail versendet. Er ist 7 Tage gültig.'
                : 'Die Person wurde direkt als Mitglied hinzugefügt.'
              }
            </div>
            <button onClick={onClose} style={{ ...s.btnPri, marginTop: 20, width: '100%' }}>
              {T('close')}
            </button>
          </div>
        ) : (
          <>
            <Feld label={`${T('email')} *`}>
              <input type="email" style={s.input} placeholder="name@beispiel.de" value={form.email}
                onChange={e => setForm(f => ({ ...f, email: e.target.value }))} autoFocus />
            </Feld>
            <Feld label={T('role')}>
              <select style={s.input} value={form.rolle} onChange={e => setForm(f => ({ ...f, rolle: e.target.value }))}>
                {ROLLEN.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
              </select>
            </Feld>
            <div style={{ fontSize: 12, color: 'var(--text-3)', background: 'var(--bg)', borderRadius: 'var(--radius)', padding: '10px 12px', lineHeight: 1.5 }}>
              💡 Hat die Person bereits ein Konto, wird sie direkt hinzugefügt. Andernfalls erhält sie einen Einladungslink per E-Mail.
            </div>
            {fehler && <p style={s.fehler}>{fehler}</p>}
            <div style={s.btnRow}>
              <button onClick={onClose} style={s.btnSek}>{T('cancel')}</button>
              <button onClick={senden} disabled={laden} style={s.btnPri}>
                {laden ? T('sending') : `📧 ${T('invitation_send')}`}
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
  const { rolle: currentRolle } = useApp()
  const [form, setForm] = useState({
    voller_name:                    mitglied.voller_name ?? '',
    rolle:                          mitglied.rolle ?? 'schueler',
    telefon:                        mitglied.telefon ?? '',
    adresse:                        mitglied.adresse ?? '',
    geburtsdatum:                   mitglied.geburtsdatum ?? '',
    notizen:                        mitglied.notizen ?? '',
    aktiv:                          mitglied.aktiv ?? true,
    kann_kurse_anlegen:             mitglied.kann_kurse_anlegen ?? false,
    iban:                           mitglied.iban ?? '',
    bic:                            mitglied.bic ?? '',
    kontoinhaber:                   mitglied.kontoinhaber ?? '',
    zahlungsweise:                  mitglied.zahlungsweise ?? '',
    zahlungsrhythmus:               mitglied.zahlungsrhythmus ?? '',
    mitgliedsbeitrag:               mitglied.mitgliedsbeitrag ?? '',
    erziehungsberechtigter_name:    mitglied.erziehungsberechtigter_name ?? '',
    erziehungsberechtigter_telefon: mitglied.erziehungsberechtigter_telefon ?? '',
    erziehungsberechtigter_email:   mitglied.erziehungsberechtigter_email ?? '',
  })
  const [laden,  setLaden]  = useState(false)
  const [fehler, setFehler] = useState('')

  async function speichern() {
    if (form.iban && !ibanGueltig(form.iban)) { setFehler('Ungültige IBAN – bitte prüfen.'); return }
    if (form.bic  && !bicGueltig(form.bic))  { setFehler('Ungültige BIC – bitte prüfen.');  return }
    setLaden(true)
    const payload = {
      ...form,
      geburtsdatum:    form.geburtsdatum    || null,
      zahlungsweise:   form.zahlungsweise   || null,
      zahlungsrhythmus: form.zahlungsrhythmus || null,
      mitgliedsbeitrag: form.mitgliedsbeitrag !== '' ? form.mitgliedsbeitrag : null,
      iban:            form.iban            || null,
      bic:             form.bic             || null,
      kontoinhaber:    form.kontoinhaber    || null,
      erziehungsberechtigter_name:    form.erziehungsberechtigter_name    || null,
      erziehungsberechtigter_telefon: form.erziehungsberechtigter_telefon || null,
      erziehungsberechtigter_email:   form.erziehungsberechtigter_email   || null,
    }
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
              {(currentRolle === 'superadmin' ? ALLE_ROLLEN : ROLLEN).map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
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
        {/* Zahlungsdaten */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            💳 Zahlungsdaten
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Feld label="Zahlungsweise">
              <select style={s.input} value={form.zahlungsweise} onChange={e => setForm(f => ({ ...f, zahlungsweise: e.target.value }))}>
                <option value="">– wählen –</option>
                <option value="sepa">SEPA-Lastschrift</option>
                <option value="ueberweisung">Überweisung</option>
                <option value="bar">Barzahlung</option>
              </select>
            </Feld>
            <Feld label="Zahlungsrhythmus">
              <select style={s.input} value={form.zahlungsrhythmus} onChange={e => setForm(f => ({ ...f, zahlungsrhythmus: e.target.value }))}>
                <option value="">– wählen –</option>
                <option value="monatlich">Monatlich</option>
                <option value="quartalsweise">Quartalsweise</option>
                <option value="halbjaehrlich">Halbjährlich</option>
                <option value="jaehrlich">Jährlich</option>
              </select>
            </Feld>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
            <Feld label="Mitgliedsbeitrag (€)">
              <input type="number" step="0.01" min="0" style={s.input} value={form.mitgliedsbeitrag}
                placeholder="z.B. 29.00" onChange={e => setForm(f => ({ ...f, mitgliedsbeitrag: e.target.value }))} />
            </Feld>
            <Feld label="Kontoinhaber">
              <input style={s.input} value={form.kontoinhaber} placeholder="Abweichend vom Mitglied"
                onChange={e => setForm(f => ({ ...f, kontoinhaber: e.target.value }))} />
            </Feld>
          </div>
          {form.zahlungsweise === 'sepa' && (
            <div style={{ display: 'grid', gridTemplateColumns: '2fr 1fr', gap: 12 }}>
              <Feld label="IBAN">
                <input style={{ ...s.input, borderColor: form.iban && !ibanGueltig(form.iban) ? 'var(--danger)' : undefined }}
                  value={form.iban} placeholder="DE12 3456 7890 1234 5678 90"
                  onChange={e => setForm(f => ({ ...f, iban: e.target.value.toUpperCase() }))} />
                {form.iban && !ibanGueltig(form.iban) && (
                  <span style={{ fontSize: 11, color: 'var(--danger)', marginTop: 3 }}>Ungültige IBAN</span>
                )}
                {form.iban && ibanGueltig(form.iban) && (
                  <span style={{ fontSize: 11, color: 'var(--success)', marginTop: 3 }}>✓ Gültige IBAN</span>
                )}
              </Feld>
              <Feld label="BIC">
                <input style={{ ...s.input, borderColor: form.bic && !bicGueltig(form.bic) ? 'var(--danger)' : undefined }}
                  value={form.bic} placeholder="XXXXXXXX"
                  onChange={e => setForm(f => ({ ...f, bic: e.target.value.toUpperCase() }))} />
                {form.bic && !bicGueltig(form.bic) && <span style={{ fontSize:11, color:'var(--danger)', marginTop:3 }}>Ungültige BIC</span>}
                {form.bic && bicGueltig(form.bic) && <span style={{ fontSize:11, color:'var(--success)', marginTop:3 }}>✓ Gültige BIC</span>}
              </Feld>
            </div>
          )}
        </div>

        {/* Erziehungsberechtigte */}
        <div style={{ borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 4 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 12 }}>
            👨‍👩‍👧 Erziehungsberechtigte (bei Minderjährigen)
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <Feld label="Name">
              <input style={s.input} value={form.erziehungsberechtigter_name}
                onChange={e => setForm(f => ({ ...f, erziehungsberechtigter_name: e.target.value }))} />
            </Feld>
            <Feld label="Telefon">
              <input style={s.input} value={form.erziehungsberechtigter_telefon}
                onChange={e => setForm(f => ({ ...f, erziehungsberechtigter_telefon: e.target.value }))} />
            </Feld>
          </div>
          <Feld label="E-Mail" style={{ marginTop: 12 }}>
            <input style={{ ...s.input, marginTop: 6 }} value={form.erziehungsberechtigter_email}
              onChange={e => setForm(f => ({ ...f, erziehungsberechtigter_email: e.target.value }))} />
          </Feld>
        </div>

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
    if (!pw || pw.length < 8 || !/[A-Z]/.test(pw) || !/[a-z]/.test(pw) || !/[0-9]/.test(pw)) { setFehler(T('password_min_error')); return }
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
  const { T, confirm } = useApp()
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
    if (datei.size > 15 * 1024 * 1024) { setFehler(T('datei_zu_gross')); return }
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
    if (!await confirm(`„${d.name}" wirklich löschen?`, { confirmLabel: 'Löschen' })) return
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

// ─── Kursantrag Modal (Kursauswahl) ──────────────────────────

function KursantragAuswahlModal({ mitglied, onClose }) {
  const [kurse,  setKurse]  = useState([])
  const [laden,  setLaden]  = useState(true)
  const [gewählt, setGewählt] = useState(null)

  useEffect(() => {
    supabase.from('unterricht_schueler')
      .select('unterricht(id, name, typ, wochentag, uhrzeit_von, uhrzeit_bis, abrechnungs_typ, farbe, instrumente(name_de, icon), raeume(name), unterricht_lehrer(lehrer_id, rolle, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name)))')
      .eq('schueler_id', mitglied.id)
      .eq('status', 'aktiv')
      .then(({ data }) => { setKurse((data ?? []).map(r => r.unterricht).filter(Boolean)); setLaden(false) })
  }, [mitglied.id])

  if (gewählt) return <KursantragModal schueler={mitglied} kurs={gewählt} onClose={onClose} />

  return (
    <Modal titel={`📋 Kursanmeldung – ${mitglied.voller_name}`} onClose={onClose} breit>
      {laden ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13 }}>Lade Kurse…</div>
      ) : kurse.length === 0 ? (
        <div style={{ color: 'var(--text-3)', fontSize: 13, padding: '12px 0' }}>Kein aktiver Kurs zugeordnet.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 13, color: 'var(--text-2)', marginBottom: 4 }}>Für welchen Kurs soll die Anmeldung erstellt werden?</div>
          {kurse.map(k => (
            <button key={k.id} onClick={() => setGewählt(k)} style={{
              display: 'flex', alignItems: 'center', gap: 12,
              padding: '12px 16px', borderRadius: 'var(--radius)',
              border: '1.5px solid var(--border)', background: 'var(--bg-2)',
              cursor: 'pointer', fontFamily: 'inherit', textAlign: 'left',
              transition: 'border-color 0.15s',
            }}
              onMouseEnter={e => e.currentTarget.style.borderColor = 'var(--primary)'}
              onMouseLeave={e => e.currentTarget.style.borderColor = 'var(--border)'}>
              <span style={{ fontSize: 20 }}>{k.instrumente?.icon ?? '🎵'}</span>
              <div>
                <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{k.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-3)', marginTop: 2 }}>
                  {k.wochentag?.toUpperCase()} {k.uhrzeit_von?.slice(0,5)}–{k.uhrzeit_bis?.slice(0,5)}
                  {k.instrumente && ` · ${k.instrumente.name_de}`}
                </div>
              </div>
            </button>
          ))}
        </div>
      )}
    </Modal>
  )
}

// ─── Schulen Modal (Superadmin) ───────────────────────────────

function SchulenModal({ mitglied, onClose }) {
  const [allSchulen,       setAllSchulen]       = useState([])
  const [mitgliedschaften, setMitgliedschaften] = useState([])
  const [laden,            setLaden]            = useState(true)
  const [hinzufuegen,      setHinzufuegen]      = useState(null)
  const [neuRolle,         setNeuRolle]         = useState('schueler')
  const [saving,           setSaving]           = useState(null)

  async function ladeDaten() {
    const [{ data: schulen }, { data: mships }] = await Promise.all([
      supabase.rpc('alle_schulen_stats'),
      supabase.rpc('nutzer_schulen', { p_user_id: mitglied.id }),
    ])
    setAllSchulen(schulen ?? [])
    setMitgliedschaften(mships ?? [])
    setLaden(false)
  }

  useEffect(() => { ladeDaten() }, [mitglied.id])

  async function mitgliedMachen(schule_id, rolle) {
    setSaving(schule_id)
    await supabase.rpc('mitgliedschaft_setzen', { p_user_id: mitglied.id, p_schule_id: schule_id, p_rolle: rolle })
    const { data } = await supabase.rpc('nutzer_schulen', { p_user_id: mitglied.id })
    setMitgliedschaften(data ?? [])
    setSaving(null)
    setHinzufuegen(null)
  }

  async function entfernen(schule_id) {
    setSaving(schule_id)
    await supabase.rpc('mitgliedschaft_entfernen', { p_user_id: mitglied.id, p_schule_id: schule_id })
    const { data } = await supabase.rpc('nutzer_schulen', { p_user_id: mitglied.id })
    setMitgliedschaften(data ?? [])
    setSaving(null)
  }

  return (
    <Modal titel={`🏫 Schulen – ${mitglied.voller_name}`} onClose={onClose} breit>
      {laden ? (
        <div style={{ color: 'var(--text-3)', textAlign: 'center', padding: 32 }}>Lade…</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {allSchulen.map(schul => {
            const ship = mitgliedschaften.find(m => m.schule_id === schul.schule_id)
            const isBusy   = saving === schul.schule_id
            const isAdding = hinzufuegen === schul.schule_id
            return (
              <div key={schul.schule_id} style={{
                display: 'flex', alignItems: 'center', gap: 12,
                padding: '12px 16px', borderRadius: 'var(--radius)',
                border: `1.5px solid ${ship ? 'var(--primary)' : 'var(--border)'}`,
                background: ship ? 'color-mix(in srgb, var(--primary) 6%, var(--surface))' : 'var(--surface)',
              }}>
                <div style={{
                  width: 36, height: 36, borderRadius: 8, flexShrink: 0,
                  background: schul.farbe ?? 'var(--primary)',
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  fontSize: 16, color: '#fff', fontWeight: 700, overflow: 'hidden',
                }}>
                  {schul.logo_url
                    ? <img src={schul.logo_url} alt="" style={{ width: 36, height: 36, objectFit: 'cover' }} />
                    : schul.name.charAt(0)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontWeight: 700, fontSize: 14, color: 'var(--text)' }}>{schul.name}</div>
                  {ship && <span style={{ fontSize: 11, fontWeight: 700, color: 'var(--primary)', textTransform: 'capitalize' }}>{ship.rolle}</span>}
                </div>
                {ship ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <select
                      value={ship.rolle}
                      onChange={e => mitgliedMachen(schul.schule_id, e.target.value)}
                      disabled={isBusy}
                      style={{ ...s.input, fontSize: 12, padding: '4px 8px', width: 'auto' }}
                    >
                      {ALLE_ROLLEN.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => entfernen(schul.schule_id)} disabled={isBusy}
                      style={{ padding: '4px 10px', borderRadius: 6, border: '1px solid var(--danger)', background: 'transparent', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {isBusy ? '…' : '✕'}
                    </button>
                  </div>
                ) : isAdding ? (
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }}>
                    <select value={neuRolle} onChange={e => setNeuRolle(e.target.value)}
                      style={{ ...s.input, fontSize: 12, padding: '4px 8px', width: 'auto' }}>
                      {ALLE_ROLLEN.map(r => <option key={r} value={r}>{r}</option>)}
                    </select>
                    <button onClick={() => mitgliedMachen(schul.schule_id, neuRolle)} disabled={isBusy}
                      style={{ padding: '4px 10px', borderRadius: 6, border: 'none', background: 'var(--primary)', color: 'var(--primary-fg)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      {isBusy ? '…' : '✓'}
                    </button>
                    <button onClick={() => setHinzufuegen(null)}
                      style={{ padding: '4px 8px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-3)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                      ✕
                    </button>
                  </div>
                ) : (
                  <button onClick={() => { setHinzufuegen(schul.schule_id); setNeuRolle('schueler') }}
                    style={{ padding: '4px 12px', borderRadius: 6, border: '1px solid var(--border)', background: 'transparent', color: 'var(--text-2)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit', flexShrink: 0 }}>
                    + Hinzufügen
                  </button>
                )}
              </div>
            )
          })}
        </div>
      )}
    </Modal>
  )
}

// ─── Hauptkomponente ──────────────────────────────────────────

export default function Mitgliederverwaltung() {
  const { T, rolle } = useApp()
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

  function csvExportieren() {
    const zeilen = [
      ['Name', 'E-Mail', 'Rolle', 'Telefon', 'Geburtsdatum', 'Aktiv'].join(';'),
      ...gefiltert.map(m => [
        m.voller_name ?? '',
        m.email ?? '',
        m.rolle ?? '',
        m.telefon ?? '',
        m.geburtsdatum ?? '',
        m.aktiv ? 'ja' : 'nein',
      ].map(v => `"${String(v).replace(/"/g, '""')}"`).join(';')),
    ]
    const blob = new Blob(['﻿' + zeilen.join('\r\n')], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = 'mitglieder.csv'; a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 12 }}>
        <div>
          <h1 style={s.h1}>👥 {T('members')}</h1>
          <p style={s.sub}>{stats.gesamt} {T('members')} · {stats.lehrer} {T('lehrer')} · {stats.schueler} {T('schueler')}</p>
        </div>
        <div style={{ display:'flex', gap:8 }}>
          <button onClick={csvExportieren} style={s.btnSek} title="Als CSV exportieren">📥 CSV</button>
          <button onClick={() => setModal({ typ: 'einladung' })} style={s.btnSek}>
            📧 {T('invite_member')}
          </button>
          <button onClick={() => setModal({ typ: 'anlegen' })} style={s.btnPri}>
            {T('member_create')}
          </button>
        </div>
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
        <div style={s.leer}>
          <div style={{ marginBottom: 12 }}>{T('member_none_found')}</div>
          {suche === '' && filterRolle === 'alle' && filterAktiv === 'alle' && (
            <button onClick={() => setModal({ typ: 'anlegen' })} style={s.btnPri}>{T('member_create')}</button>
          )}
        </div>
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
                {gefiltert.map((m, i) => {
                  const kannBearbeiten = m.rolle !== 'admin' || rolle === 'superadmin'
                  const zahlungUnvollstaendig = m.zahlungsweise === 'sepa' && !m.iban
                  const zahlungOk = m.zahlungsweise && !(m.zahlungsweise === 'sepa' && !m.iban)
                  return (
                  <tr key={m.id}
                    className={kannBearbeiten ? 'mitglied-row' : ''}
                    onClick={() => kannBearbeiten && setModal({ typ: 'profil', mitglied: m })}
                    style={{ background: i % 2 === 0 ? 'var(--surface)' : 'var(--bg)', borderBottom: '1px solid var(--border)', cursor: kannBearbeiten ? 'pointer' : 'default' }}>
                    <td style={{ padding: '12px 16px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar name={m.voller_name} avatarUrl={m.avatar_url} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: 14, color: 'var(--text)' }}>{m.voller_name}</div>
                          {m.email && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{m.email}</div>}
                          {m.notizen && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>{T('has_notes')}</div>}
                          {zahlungUnvollstaendig && <div style={{ fontSize: 11, color: 'var(--warning, #f59e0b)', marginTop: 1 }}>⚠️ IBAN fehlt</div>}
                          {zahlungOk && <div style={{ fontSize: 11, color: 'var(--text-3)', marginTop: 1 }}>💳 {m.zahlungsweise === 'sepa' ? 'SEPA' : m.zahlungsweise === 'ueberweisung' ? 'Überweisung' : 'Bar'}</div>}
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
                    <td style={{ padding: '12px 16px' }} onClick={e => e.stopPropagation()}>
                      {kannBearbeiten ? (
                        <div style={{ display: 'flex', gap: 6 }}>
                          <button onClick={() => setModal({ typ: 'profil', mitglied: m })} style={s.btnKlein} title={T('edit')}>✏️</button>
                          <button onClick={() => setModal({ typ: 'email', mitglied: m })} style={s.btnKlein} title="E-Mail">📧</button>
                          <button onClick={() => setModal({ typ: 'passwort', mitglied: m })} style={s.btnKlein} title="Passwort">🔑</button>
                          {(m.rolle === 'lehrer' || m.rolle === 'schueler') && (
                            <button onClick={() => setModal({ typ: 'zuordnung', mitglied: m })} style={s.btnKlein} title="Kurszuordnungen">🔗</button>
                          )}
                          <button onClick={() => setModal({ typ: 'antrag', mitglied: m })} style={s.btnKlein} title="Aufnahmeantrag">📋</button>
                          {m.rolle === 'schueler' && (
                            <button onClick={() => setModal({ typ: 'kursantrag', mitglied: m })} style={s.btnKlein} title="Kursanmeldung">📄</button>
                          )}
                          <button onClick={() => setModal({ typ: 'dokumente', mitglied: m })} style={s.btnKlein} title="Dokumente">📁</button>
                          <button onClick={() => setModal({ typ: 'loeschen', mitglied: m })} style={{ ...s.btnKlein, color:'var(--danger)' }} title="Löschen">🗑</button>
                          {rolle === 'superadmin' && (
                            <button onClick={() => setModal({ typ: 'schulen', mitglied: m })} style={s.btnKlein} title="Schulen verwalten">🏫</button>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: 12, color: 'var(--text-3)', paddingLeft: 4 }}>–</span>
                      )}
                    </td>
                  </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {/* Mobile Karten */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }} className="mobile-cards">
            {gefiltert.map(m => {
              const kannBearbeiten = m.rolle !== 'admin' || rolle === 'superadmin'
              return (
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
                {kannBearbeiten ? (
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
                      <button onClick={() => setModal({ typ: 'email', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>📧</button>
                      <button onClick={() => setModal({ typ: 'passwort', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>🔑</button>
                      <button onClick={() => setModal({ typ: 'antrag', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>📋</button>
                      {m.rolle === 'schueler' && (
                        <button onClick={() => setModal({ typ: 'kursantrag', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>📄</button>
                      )}
                      <button onClick={() => setModal({ typ: 'dokumente', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>📁</button>
                      <button onClick={() => setModal({ typ: 'loeschen', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13, color:'var(--danger)', borderColor:'var(--danger)' }}>🗑</button>
                      {rolle === 'superadmin' && (
                        <button onClick={() => setModal({ typ: 'schulen', mitglied: m })} style={{ ...s.btnSek, flex: 1, fontSize: 13 }}>🏫</button>
                      )}
                    </div>
                  </div>
                ) : (
                  <div style={{ fontSize: 12, color: 'var(--text-3)', textAlign: 'center', padding: '8px 0' }}>Nur Superadmin kann Admins bearbeiten</div>
                )}
              </div>
              )
            })}
          </div>
        </>
      )}

      {/* Modals */}
      {modal?.typ === 'einladung' && <EinladungModal onClose={() => setModal(null)} T={T} />}
      {modal?.typ === 'anlegen'   && <NutzerAnlegenModal onClose={() => setModal(null)} onErfolg={ladeMitglieder} T={T} />}
      {modal?.typ === 'profil'    && <ProfilModal mitglied={modal.mitglied} onClose={() => setModal(null)} onErfolg={ladeMitglieder} T={T} />}
      {modal?.typ === 'email'     && <EmailModal mitglied={modal.mitglied} onClose={() => setModal(null)} onErfolg={ladeMitglieder} />}
      {modal?.typ === 'passwort'  && <PasswortModal mitglied={modal.mitglied} onClose={() => setModal(null)} />}
      {modal?.typ === 'zuordnung' && <ZuordnungModal mitglied={modal.mitglied} onClose={() => setModal(null)} T={T} />}
      {modal?.typ === 'antrag'    && <AufnahmeantragModal mitglied={modal.mitglied} onClose={() => setModal(null)} />}
      {modal?.typ === 'kursantrag' && <KursantragAuswahlModal mitglied={modal.mitglied} onClose={() => setModal(null)} />}
      {modal?.typ === 'dokumente' && <DokumenteModal mitglied={modal.mitglied} onClose={() => setModal(null)} />}
      {modal?.typ === 'schulen'   && <SchulenModal   mitglied={modal.mitglied} onClose={() => setModal(null)} />}
      {modal?.typ === 'loeschen'  && (
        <LoeschenModal
          mitglied={modal.mitglied}
          onClose={() => setModal(null)}
          onErfolg={ladeMitglieder}
        />
      )}

      <style>{`
        .mitglied-row:hover td { background: color-mix(in srgb, var(--primary) 6%, var(--surface)) !important; }
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
