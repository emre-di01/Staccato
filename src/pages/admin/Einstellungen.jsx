import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const RECHTSFORMEN = [
  { value: '',             label: '– Rechtsform wählen –' },
  { value: 'einzelperson', label_key: 'settings_rechtsform_einzelperson' },
  { value: 'gbr',          label_key: 'settings_rechtsform_gbr' },
  { value: 'ev',           label_key: 'settings_rechtsform_ev' },
  { value: 'ggmbh',        label_key: 'settings_rechtsform_ggmbh' },
  { value: 'gmbh',         label_key: 'settings_rechtsform_gmbh' },
  { value: 'ug',           label_key: 'settings_rechtsform_ug' },
  { value: 'sonstiges',    label_key: 'settings_rechtsform_sonstiges' },
]

// Rechtsformen mit Registereintrag (Vereins- oder Handelsregister)
const HAT_REGISTER = ['ev', 'ggmbh', 'gmbh', 'ug']
const IST_HANDELSREGISTER = ['ggmbh', 'gmbh', 'ug']

function Abschnitt({ titel, children }) {
  return (
    <div>
      <h2 style={{ fontSize: 13, fontWeight: 700, color: 'var(--text-3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 14 }}>
        {titel}
      </h2>
      <div style={{ background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 'var(--radius-lg)', padding: 24, display: 'flex', flexDirection: 'column', gap: 18 }}>
        {children}
      </div>
    </div>
  )
}

export default function AdminEinstellungen() {
  const { profil, schule, setSchule, T } = useApp()

  const [form, setForm] = useState({
    name:                       schule?.name                       ?? '',
    logo_url:                   schule?.logo_url                   ?? '',
    website:                    schule?.website                    ?? '',
    email:                      schule?.email                      ?? '',
    telefon:                    schule?.telefon                    ?? '',
    adresse:                    schule?.adresse                    ?? '',
    rechtsform:                 schule?.rechtsform                 ?? '',
    vereinsreg_nr:              schule?.vereinsreg_nr              ?? '',
    vereinsreg_gericht:         schule?.vereinsreg_gericht         ?? '',
    steuernummer:               schule?.steuernummer               ?? '',
    ustid:                      schule?.ustid                      ?? '',
    steuer_hinweis:             schule?.steuer_hinweis             ?? '',
    ist_gemeinnuetzig:          schule?.ist_gemeinnuetzig          ?? false,
    finanzamt:                  schule?.finanzamt                  ?? '',
    freistellungsbescheid_datum: schule?.freistellungsbescheid_datum ?? '',
    rechnungen_prefix:          schule?.rechnungen_prefix          ?? 'RG',
    inventar_prefix:            schule?.inventar_prefix            ?? 'INV',
    kuendigungsfrist:           schule?.kuendigungsfrist           ?? '',
    hat_ki_extraktion:          schule?.hat_ki_extraktion          ?? false,
  })
  // API-Key separat — wir lesen ihn nie aus der DB zurück; leeres Feld = unverändert
  const [anthropicKey,     setAnthropicKey]     = useState('')
  const [anthropicKeyGesetzt, setAnthropicKeyGesetzt] = useState(!!schule?.anthropic_api_key)
  const [laden, setLaden] = useState(false)
  const [erfolg, setErfolg] = useState(false)

  const hatRegister = HAT_REGISTER.includes(form.rechtsform)
  const istHandels  = IST_HANDELSREGISTER.includes(form.rechtsform)

  async function speichern() {
    setLaden(true)
    const payload = {
      name:                form.name.trim()                       || schule?.name,
      logo_url:            form.logo_url.trim()                   || null,
      website:             form.website.trim()                    || null,
      email:               form.email.trim()                      || null,
      telefon:             form.telefon.trim()                    || null,
      adresse:             form.adresse.trim()                    || null,
      rechtsform:          form.rechtsform                        || null,
      vereinsreg_nr:       form.vereinsreg_nr.trim()              || null,
      vereinsreg_gericht:  form.vereinsreg_gericht.trim()         || null,
      steuernummer:        form.steuernummer.trim()               || null,
      ustid:               form.ustid.trim()                      || null,
      steuer_hinweis:      form.steuer_hinweis.trim()             || null,
      ist_gemeinnuetzig:   form.ist_gemeinnuetzig,
      finanzamt:           form.finanzamt.trim()                  || null,
      freistellungsbescheid_datum: form.freistellungsbescheid_datum || null,
      rechnungen_prefix:   form.rechnungen_prefix.trim().toUpperCase() || 'RG',
      inventar_prefix:     form.inventar_prefix.trim().toUpperCase()   || 'INV',
      kuendigungsfrist:    form.kuendigungsfrist.trim()           || null,
      hat_ki_extraktion:   form.hat_ki_extraktion,
      ...(anthropicKey.trim() ? { anthropic_api_key: anthropicKey.trim() } : {}),
    }
    await supabase.from('schulen').update(payload).eq('id', profil.schule_id)
    if (anthropicKey.trim()) {
      setAnthropicKey('')
      setAnthropicKeyGesetzt(true)
    }
    setSchule(s => ({ ...s, ...payload }))
    setLaden(false)
    setErfolg(true)
    setTimeout(() => setErfolg(false), 2500)
  }

  function F({ label, k, type = 'text', placeholder = '', mono = false, hint }) {
    return (
      <div>
        <label style={sty.label}>{label}</label>
        <input type={type} value={form[k]}
          onChange={e => setForm(f => ({ ...f, [k]: e.target.value }))}
          placeholder={placeholder}
          style={{ ...sty.input, ...(mono ? { fontFamily: 'monospace', letterSpacing: '0.03em' } : {}) }} />
        {hint && <div style={sty.hint}>{hint}</div>}
      </div>
    )
  }

  return (
    <div style={{ maxWidth: 640 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, color: 'var(--text)', marginBottom: 28 }}>
        {T('settings_school_title')}
      </h1>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 32 }}>

        {/* ── 1. Allgemein ── */}
        <Abschnitt titel={T('settings_section_allgemein')}>
          <F label={T('settings_school_name')} k="name" placeholder="Meine Musikschule" />
          <div>
            <label style={sty.label}>
              {T('settings_logo_url')} <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>({T('settings_logo_hint')})</span>
            </label>
            <input type="url" value={form.logo_url}
              onChange={e => setForm(f => ({ ...f, logo_url: e.target.value }))}
              placeholder="https://beispiel.de/logo.png" style={sty.input} />
            {form.logo_url && (
              <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
                <img src={form.logo_url} alt="Logo"
                  style={{ maxHeight: 48, maxWidth: 160, objectFit: 'contain', borderRadius: 6, border: '1px solid var(--border)', padding: 4, background: '#fff' }}
                  onError={e => { e.target.style.display = 'none' }} />
                <button onClick={() => setForm(f => ({ ...f, logo_url: '' }))}
                  style={{ background: 'none', border: 'none', color: 'var(--danger)', fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>
                  {T('settings_logo_remove')}
                </button>
              </div>
            )}
          </div>
          <F label="Website"           k="website"  type="url"   placeholder="https://..." />
          <F label={T('email')}        k="email"    type="email" placeholder="info@musikschule.de" />
          <F label={T('profile_phone')} k="telefon" type="tel"   placeholder="+49 ..." />
          <F label={T('profile_address')} k="adresse"            placeholder="Musterstraße 1, 12345 Stadt" />
        </Abschnitt>

        {/* ── 2. Rechtsform & Register ── */}
        <Abschnitt titel={T('settings_section_rechtsform')}>
          <div>
            <label style={sty.label}>{T('settings_rechtsform')}</label>
            <select value={form.rechtsform}
              onChange={e => setForm(f => ({ ...f, rechtsform: e.target.value }))}
              style={sty.input}>
              {RECHTSFORMEN.map(r => (
                <option key={r.value} value={r.value}>
                  {r.label ?? T(r.label_key)}
                </option>
              ))}
            </select>
          </div>

          {hatRegister && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
              <F
                label={T('settings_vereinsreg_nr')}
                k="vereinsreg_nr"
                mono
                placeholder={form.rechtsform === 'ev' ? 'VR 12345' : 'HRB 12345'}
                hint={T(istHandels ? 'settings_vereinsreg_nr_hint_hb' : 'settings_vereinsreg_nr_hint_ev')}
              />
              <F
                label={T('settings_vereinsreg_gericht')}
                k="vereinsreg_gericht"
                placeholder={T('settings_vereinsreg_gericht_placeholder')}
              />
            </div>
          )}
        </Abschnitt>

        {/* ── 3. Steuerliches & Gemeinnützigkeit ── */}
        <Abschnitt titel={T('settings_section_steuer')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <F label={T('settings_steuernummer')} k="steuernummer" mono placeholder="12/345/67890"
               hint={T('settings_steuernummer_hint')} />
            <F label={T('settings_ustid')}        k="ustid"        mono placeholder="DE123456789"
               hint={T('settings_ustid_hint')} />
          </div>
          <div>
            <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:6 }}>
              <label style={{ ...sty.label, marginBottom:0 }}>{T('settings_steuer_hinweis')}</label>
              {!form.steuer_hinweis && (
                <button type="button"
                  onClick={() => setForm(f => ({ ...f, steuer_hinweis: 'Gemäß §4 Nr. 21 UStG umsatzsteuerfrei.' }))}
                  style={{ fontSize:12, fontWeight:600, color:'var(--primary)', background:'none', border:'none', cursor:'pointer', fontFamily:'inherit', padding:0, whiteSpace:'nowrap' }}>
                  ✦ Standard für Musikschulen übernehmen
                </button>
              )}
            </div>
            <textarea value={form.steuer_hinweis}
              onChange={e => setForm(f => ({ ...f, steuer_hinweis: e.target.value }))}
              rows={2}
              placeholder="Gemäß §4 Nr. 21 UStG umsatzsteuerfrei."
              style={{ ...sty.input, resize: 'vertical' }} />
            <div style={sty.hint}>Erscheint auf allen Rechnungen. Klicke auf "Standard übernehmen" wenn deine Musikschule nach §4 Nr. 21 UStG befreit ist (Regelfall). Sonst mit deinem Steuerberater abstimmen.</div>
          </div>

          <div>
            <label style={sty.label}>{T('settings_gemeinnuetzig')}</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.ist_gemeinnuetzig}
                onChange={e => setForm(f => ({ ...f, ist_gemeinnuetzig: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }} />
              <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{T('settings_ist_gemeinnuetzig')}</span>
            </label>
            <div style={sty.hint}>{T('settings_ist_gemeinnuetzig_hint')}</div>
          </div>

          {form.ist_gemeinnuetzig && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, borderTop: '1px solid var(--border)', paddingTop: 18 }}>
              <F label={T('settings_finanzamt')} k="finanzamt"
                 placeholder={T('settings_finanzamt_placeholder')} />
              <div>
                <label style={sty.label}>{T('settings_freistellung_datum')}</label>
                <input type="date" value={form.freistellungsbescheid_datum}
                  onChange={e => setForm(f => ({ ...f, freistellungsbescheid_datum: e.target.value }))}
                  style={sty.input} />
              </div>
            </div>
          )}
        </Abschnitt>

        {/* ── 4. Verwaltung & Rechnungen ── */}
        <Abschnitt titel={T('settings_section_verwaltung')}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div>
              <label style={sty.label}>
                {T('settings_rechnungen_prefix')} <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>({T('settings_rechnungen_prefix_hint')})</span>
              </label>
              <input value={form.rechnungen_prefix} maxLength={8}
                onChange={e => setForm(f => ({ ...f, rechnungen_prefix: e.target.value.toUpperCase() }))}
                placeholder="RG"
                style={{ ...sty.input, fontFamily: 'monospace', letterSpacing: '0.05em', maxWidth: 120 }} />
            </div>
            <div>
              <label style={sty.label}>
                {T('settings_inventar_prefix')} <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>({T('settings_inventar_prefix_hint')})</span>
              </label>
              <input value={form.inventar_prefix} maxLength={8}
                onChange={e => setForm(f => ({ ...f, inventar_prefix: e.target.value.toUpperCase() }))}
                placeholder="INV"
                style={{ ...sty.input, fontFamily: 'monospace', letterSpacing: '0.05em', maxWidth: 120 }} />
            </div>
          </div>
          <div>
            <label style={sty.label}>
              Kündigungsfrist <span style={{ fontWeight: 400, color: 'var(--text-3)' }}>(erscheint auf Formularen)</span>
            </label>
            <input value={form.kuendigungsfrist}
              onChange={e => setForm(f => ({ ...f, kuendigungsfrist: e.target.value }))}
              placeholder="z.B. 4 Wochen zum Monatsende"
              style={sty.input} />
          </div>
          <div>
            <label style={sty.label}>{T('settings_ki_extraktion')}</label>
            <label style={{ display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.hat_ki_extraktion}
                onChange={e => setForm(f => ({ ...f, hat_ki_extraktion: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: 'var(--primary)', cursor: 'pointer' }} />
              <span style={{ fontSize: 14, color: 'var(--text)', fontWeight: 500 }}>{T('settings_ki_extraktion')}</span>
            </label>
            <div style={sty.hint}>{T('settings_ki_extraktion_hint')}</div>
          </div>
          <div>
            <label style={sty.label}>Anthropic API Key</label>
            {anthropicKeyGesetzt && !anthropicKey && (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>✓ API Key hinterlegt</span>
                <button
                  type="button"
                  onClick={() => { setAnthropicKeyGesetzt(false); setAnthropicKey('') }}
                  style={{ fontSize: 12, color: 'var(--danger)', background: 'none', border: 'none', cursor: 'pointer', fontFamily: 'inherit', padding: 0 }}>
                  Ersetzen
                </button>
              </div>
            )}
            {(!anthropicKeyGesetzt || anthropicKey) && (
              <input
                type="password"
                value={anthropicKey}
                onChange={e => setAnthropicKey(e.target.value)}
                placeholder="sk-ant-api03-..."
                autoComplete="new-password"
                style={{ ...sty.input, fontFamily: 'monospace' }}
              />
            )}
            <div style={sty.hint}>Wird verschlüsselt gespeichert. Wird nur für die KI-Rechnungserkennung verwendet. Leer lassen um bestehenden Key beizubehalten.</div>
          </div>
        </Abschnitt>

      </div>

      {/* Speichern */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: 14, marginTop: 28 }}>
        {erfolg && <span style={{ fontSize: 13, color: 'var(--success)', fontWeight: 600 }}>{T('settings_saved')}</span>}
        <button onClick={speichern} disabled={laden}
          style={{ padding: '10px 26px', borderRadius: 'var(--radius)', border: 'none', background: 'var(--primary)', color: 'var(--primary-fg, #fff)', fontSize: 14, fontWeight: 700, cursor: laden ? 'wait' : 'pointer', fontFamily: 'inherit', opacity: laden ? 0.7 : 1 }}>
          {laden ? `${T('save')} …` : `💾 ${T('save')}`}
        </button>
      </div>
    </div>
  )
}

const sty = {
  label: { fontSize: 13, fontWeight: 600, color: 'var(--text-2)', display: 'block', marginBottom: 6 },
  input: { width: '100%', boxSizing: 'border-box', padding: '9px 12px', borderRadius: 'var(--radius)', border: '1.5px solid var(--border)', background: 'var(--bg)', color: 'var(--text)', fontSize: 14, fontFamily: 'inherit', outline: 'none' },
  hint:  { fontSize: 11, color: 'var(--text-3)', marginTop: 4 },
}
