import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Gruppe, Feld, Knopf, SchalterZeile, eingabeStil } from '../../ui'

const RECHTSFORMEN = ['einzelperson', 'gbr', 'ev', 'ggmbh', 'gmbh', 'ug', 'sonstiges']
const HAT_REGISTER = ['ev', 'ggmbh', 'gmbh', 'ug']
const IST_HANDELSREGISTER = ['ggmbh', 'gmbh', 'ug']
const STEUER_STANDARD = 'Gemäß §4 Nr. 21 UStG umsatzsteuerfrei.'
const FELDER = [
  'name', 'logo_url', 'logo_url_dark', 'website', 'email', 'telefon', 'adresse', 'rechtsform', 'vereinsreg_nr', 'vereinsreg_gericht',
  'steuernummer', 'ustid', 'steuer_hinweis', 'finanzamt', 'freistellungsbescheid_datum', 'rechnungen_prefix', 'inventar_prefix', 'kuendigungsfrist',
]
const mono = { ...eingabeStil, fontFamily: 'ui-monospace, monospace', letterSpacing: '0.03em' }

// Weißer Kasten mit Feldern (wie die Gruppen, nur mit Innenabstand)
function Kasten({ children }) {
  return <div style={{ margin: '0 20px', padding: 20, borderRadius: 18, background: 'var(--n-fill)', display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
}

function Zeile2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16 }}>{children}</div>
}

function LogoFeld({ label, wert, onChange, dunkel }) {
  const { T } = useApp()
  const [fehler, setFehler] = useState(false)
  return (
    <Feld label={label}>
      <input type="url" value={wert} onChange={e => { setFehler(false); onChange(e.target.value) }} placeholder="https://…/logo.png" style={eingabeStil} />
      {wert && (
        <div style={{ marginTop: 10, display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 96, minHeight: 56, padding: 10, borderRadius: 12, background: dunkel ? '#1C1C1E' : '#FFFFFF', border: '1px solid var(--n-sep)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {fehler ? <span style={{ fontSize: 14, color: 'var(--danger)' }}>{T('ns_logo_fehler')}</span>
              : <img src={wert} alt="" onError={() => setFehler(true)} style={{ maxHeight: 44, maxWidth: 160, objectFit: 'contain' }} />}
          </div>
          <button onClick={() => onChange('')} style={{ minHeight: 44, border: 'none', background: 'none', color: 'var(--danger)', fontFamily: 'inherit', fontSize: 16, fontWeight: 600, cursor: 'pointer' }}>{T('settings_logo_remove')}</button>
        </div>
      )}
    </Feld>
  )
}

export default function AdminSchule() {
  const { schule, setSchule, T, toast } = useApp()
  const [form, setForm] = useState(() => ({
    ...Object.fromEntries(FELDER.map(k => [k, schule?.[k] ?? ''])),
    rechnungen_prefix: schule?.rechnungen_prefix ?? 'RG', inventar_prefix: schule?.inventar_prefix ?? 'INV',
    ist_gemeinnuetzig: schule?.ist_gemeinnuetzig ?? false,
  }))
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const eingabe = (k, props = {}) => <input value={form[k]} onChange={e => setze(k, e.target.value)} style={eingabeStil} {...props} />
  const hatRegister = HAT_REGISTER.includes(form.rechtsform)

  async function speichern() {
    if (!form.name.trim()) { toast(T('nv_name_pflicht'), 'error'); return }
    setSendet(true)
    const daten = {
      ...Object.fromEntries(FELDER.map(k => [k, String(form[k] ?? '').trim() || null])),
      name: form.name.trim(),
      rechnungen_prefix: form.rechnungen_prefix.trim().toUpperCase() || 'RG',
      inventar_prefix: form.inventar_prefix.trim().toUpperCase() || 'INV',
      ist_gemeinnuetzig: form.ist_gemeinnuetzig,
    }
    const { error } = await supabase.from('schulen').update(daten).eq('id', schule.id)
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    setSchule(s => ({ ...s, ...daten }))
    toast(T('settings_saved'), 'success')
  }

  return (
    <Seite titel={T('na_schule')} zurueck={{ to: '/admin/verwaltung', label: T('na_tab_verwaltung') }}>
      <Abschnitt titel={T('settings_section_allgemein')} style={{ marginTop: 24 }}>
        <Kasten>
          <Feld label={T('settings_school_name')}>{eingabe('name')}</Feld>
          <LogoFeld label={T('ns_logo_hell')} wert={form.logo_url} onChange={v => setze('logo_url', v)} />
          <LogoFeld label={T('ns_logo_dunkel')} wert={form.logo_url_dark} onChange={v => setze('logo_url_dark', v)} dunkel />
          <Feld label="Website">{eingabe('website', { type: 'url', placeholder: 'https://…' })}</Feld>
          <Zeile2>
            <Feld label={T('email')}>{eingabe('email', { type: 'email' })}</Feld>
            <Feld label={T('profile_phone')}>{eingabe('telefon', { type: 'tel' })}</Feld>
          </Zeile2>
          <Feld label={T('profile_address')}>{eingabe('adresse')}</Feld>
        </Kasten>
      </Abschnitt>

      <Abschnitt titel={T('settings_section_rechtsform')}>
        <Kasten>
          <Feld label={T('settings_rechtsform')}>
            <select value={form.rechtsform} onChange={e => setze('rechtsform', e.target.value)} style={eingabeStil}>
              <option value="">{T('none_option')}</option>
              {RECHTSFORMEN.map(r => <option key={r} value={r}>{T(`settings_rechtsform_${r}`)}</option>)}
            </select>
          </Feld>
          {hatRegister && (
            <Zeile2>
              <Feld label={T('settings_vereinsreg_nr')} hinweis={T(IST_HANDELSREGISTER.includes(form.rechtsform) ? 'settings_vereinsreg_nr_hint_hb' : 'settings_vereinsreg_nr_hint_ev')}>
                <input value={form.vereinsreg_nr} onChange={e => setze('vereinsreg_nr', e.target.value)} placeholder={form.rechtsform === 'ev' ? 'VR 12345' : 'HRB 12345'} style={mono} />
              </Feld>
              <Feld label={T('settings_vereinsreg_gericht')}>{eingabe('vereinsreg_gericht', { placeholder: T('settings_vereinsreg_gericht_placeholder') })}</Feld>
            </Zeile2>
          )}
        </Kasten>
      </Abschnitt>

      <Abschnitt titel={T('settings_section_steuer')}>
        <Kasten>
          <Zeile2>
            <Feld label={T('settings_steuernummer')} hinweis={T('settings_steuernummer_hint')}>
              <input value={form.steuernummer} onChange={e => setze('steuernummer', e.target.value)} placeholder="12/345/67890" style={mono} />
            </Feld>
            <Feld label={T('settings_ustid')} hinweis={T('settings_ustid_hint')}>
              <input value={form.ustid} onChange={e => setze('ustid', e.target.value)} placeholder="DE123456789" style={mono} />
            </Feld>
          </Zeile2>
          <Feld label={T('settings_steuer_hinweis')} hinweis={T('ns_steuer_hinweis_text')}>
            <textarea rows={2} value={form.steuer_hinweis} onChange={e => setze('steuer_hinweis', e.target.value)} placeholder={STEUER_STANDARD} style={{ ...eingabeStil, resize: 'vertical' }} />
          </Feld>
          {!form.steuer_hinweis && (
            <div><Knopf klein variante="tint" onClick={() => setze('steuer_hinweis', STEUER_STANDARD)}>{T('ns_steuer_standard')}</Knopf></div>
          )}
          <Gruppe style={{ margin: 0, background: 'var(--bg)' }}>
            <SchalterZeile titel={T('settings_ist_gemeinnuetzig')} untertitel={T('settings_ist_gemeinnuetzig_hint')}
              an={form.ist_gemeinnuetzig} onChange={v => setze('ist_gemeinnuetzig', v)} />
          </Gruppe>
          {form.ist_gemeinnuetzig && (
            <Zeile2>
              <Feld label={T('settings_finanzamt')}>{eingabe('finanzamt', { placeholder: T('settings_finanzamt_placeholder') })}</Feld>
              <Feld label={T('settings_freistellung_datum')}>{eingabe('freistellungsbescheid_datum', { type: 'date' })}</Feld>
            </Zeile2>
          )}
        </Kasten>
      </Abschnitt>

      <Abschnitt titel={T('settings_section_verwaltung')}>
        <Kasten>
          <Zeile2>
            <Feld label={T('settings_rechnungen_prefix')} hinweis={T('settings_rechnungen_prefix_hint')}>
              <input value={form.rechnungen_prefix} maxLength={8} onChange={e => setze('rechnungen_prefix', e.target.value.toUpperCase())} style={mono} />
            </Feld>
            <Feld label={T('settings_inventar_prefix')} hinweis={T('settings_inventar_prefix_hint')}>
              <input value={form.inventar_prefix} maxLength={8} onChange={e => setze('inventar_prefix', e.target.value.toUpperCase())} style={mono} />
            </Feld>
          </Zeile2>
          <Feld label={T('ns_kuendigungsfrist')} hinweis={T('ns_kuendigungsfrist_hinweis')}>
            {eingabe('kuendigungsfrist', { placeholder: T('ns_kuendigungsfrist_beispiel') })}
          </Feld>
        </Kasten>
      </Abschnitt>

      <div style={{ margin: '28px 20px 0' }}>
        <Knopf voll onClick={speichern} disabled={sendet}>{T('save')}</Knopf>
      </div>
    </Seite>
  )
}
