import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Blatt, Feld, Knopf, Gruppe, Trenner, SchalterZeile, eingabeStil } from '../../ui'
import OrtAutocomplete from '../../components/OrtAutocomplete'
import { ibanGueltig, bicGueltig } from '../../pages/admin/Mitgliederverwaltung'

const ROLLEN = ['schueler', 'lehrer', 'eltern', 'vorstand']
const ALLE_ROLLEN = ['admin', ...ROLLEN]

function Zwischentitel({ children }) {
  return <h3 style={{ margin: '12px 0 0', fontSize: 15, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-2)' }}>{children}</h3>
}

function Zeile2({ children }) {
  return <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>{children}</div>
}

// Stammdaten, Zahlungsdaten und Erziehungsberechtigte eines Mitglieds bearbeiten
export default function MitgliedBlatt({ mitglied: m, onClose, onFertig }) {
  const { rolle, T, toast } = useApp()
  const [form, setForm] = useState({
    voller_name: m.voller_name ?? '', rolle: m.rolle ?? 'schueler', telefon: m.telefon ?? '', adresse: m.adresse ?? '',
    geburtsdatum: m.geburtsdatum ?? '', notizen: m.notizen ?? '', aktiv: m.aktiv ?? true, kann_kurse_anlegen: m.kann_kurse_anlegen ?? false,
    zahlungsweise: m.zahlungsweise ?? '', zahlungsrhythmus: m.zahlungsrhythmus ?? '', mitgliedsbeitrag: m.mitgliedsbeitrag ?? '',
    kontoinhaber: m.kontoinhaber ?? '', iban: m.iban ?? '', bic: m.bic ?? '',
    erziehungsberechtigter_name: m.erziehungsberechtigter_name ?? '', erziehungsberechtigter_telefon: m.erziehungsberechtigter_telefon ?? '',
    erziehungsberechtigter_email: m.erziehungsberechtigter_email ?? '',
  })
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const ibanFalsch = form.iban && !ibanGueltig(form.iban)
  const bicFalsch = form.bic && !bicGueltig(form.bic)

  async function speichern() {
    if (!form.voller_name.trim()) { toast(T('nm_name_pflicht'), 'error'); return }
    if (form.zahlungsweise === 'sepa' && ibanFalsch) { toast(T('nm_iban_ungueltig'), 'error'); return }
    if (form.zahlungsweise === 'sepa' && bicFalsch) { toast(T('nm_bic_ungueltig'), 'error'); return }
    setSendet(true)
    const leer = v => (typeof v === 'string' ? v.trim() : v) || null
    const { error } = await supabase.from('profiles').update({
      voller_name: form.voller_name.trim(), rolle: form.rolle, telefon: leer(form.telefon), adresse: leer(form.adresse),
      geburtsdatum: form.geburtsdatum || null, notizen: leer(form.notizen), aktiv: form.aktiv,
      kann_kurse_anlegen: form.rolle === 'lehrer' ? form.kann_kurse_anlegen : false,
      zahlungsweise: form.zahlungsweise || null, zahlungsrhythmus: form.zahlungsrhythmus || null,
      mitgliedsbeitrag: form.mitgliedsbeitrag !== '' ? form.mitgliedsbeitrag : null,
      kontoinhaber: leer(form.kontoinhaber), iban: leer(form.iban), bic: leer(form.bic),
      erziehungsberechtigter_name: leer(form.erziehungsberechtigter_name),
      erziehungsberechtigter_telefon: leer(form.erziehungsberechtigter_telefon),
      erziehungsberechtigter_email: leer(form.erziehungsberechtigter_email),
    }).eq('id', m.id)
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    toast(T('nl_gespeichert'), 'success')
    onFertig()
  }

  return (
    <Blatt titel={m.voller_name} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('name')}>
          <input value={form.voller_name} onChange={e => setze('voller_name', e.target.value)} style={eingabeStil} />
        </Feld>
        <Zeile2>
          <Feld label={T('role')}>
            <select value={form.rolle} onChange={e => setze('rolle', e.target.value)} style={eingabeStil}>
              {(rolle === 'superadmin' ? ALLE_ROLLEN : ROLLEN).map(r => <option key={r} value={r}>{T(r)}</option>)}
            </select>
          </Feld>
          <Feld label={T('profile_birthday')}>
            <input type="date" value={form.geburtsdatum} onChange={e => setze('geburtsdatum', e.target.value)} style={eingabeStil} />
          </Feld>
        </Zeile2>
        <Feld label={T('profile_phone')}>
          <input type="tel" value={form.telefon} onChange={e => setze('telefon', e.target.value)} style={eingabeStil} />
        </Feld>
        <Feld label={T('profile_address')}>
          <OrtAutocomplete value={form.adresse} onChange={v => setze('adresse', v)} inputStyle={eingabeStil} />
        </Feld>
        <Feld label={T('member_internal_notes')} hinweis={T('nm_notizen_hinweis')}>
          <textarea rows={3} value={form.notizen} onChange={e => setze('notizen', e.target.value)} style={{ ...eingabeStil, resize: 'vertical' }} />
        </Feld>
        <Gruppe style={{ margin: 0 }}>
          <SchalterZeile titel={T('active')} untertitel={T('nm_aktiv_hinweis')} an={form.aktiv} onChange={v => setze('aktiv', v)} />
          {form.rolle === 'lehrer' && <>
            <Trenner />
            <SchalterZeile titel={T('nm_kurse_anlegen')} untertitel={T('nm_kurse_anlegen_hinweis')} an={form.kann_kurse_anlegen} onChange={v => setze('kann_kurse_anlegen', v)} />
          </>}
        </Gruppe>

        <Zwischentitel>{T('nm_zahlungsdaten')}</Zwischentitel>
        <Zeile2>
          <Feld label={T('nm_zahlungsweise')}>
            <select value={form.zahlungsweise} onChange={e => setze('zahlungsweise', e.target.value)} style={eingabeStil}>
              <option value="">{T('none_option')}</option>
              {['sepa', 'ueberweisung', 'bar'].map(z => <option key={z} value={z}>{T(`nm_zw_${z}`)}</option>)}
            </select>
          </Feld>
          <Feld label={T('nm_zahlungsrhythmus')}>
            <select value={form.zahlungsrhythmus} onChange={e => setze('zahlungsrhythmus', e.target.value)} style={eingabeStil}>
              <option value="">{T('none_option')}</option>
              {['monatlich', 'quartalsweise', 'halbjaehrlich', 'jaehrlich'].map(z => <option key={z} value={z}>{T(`nm_zr_${z}`)}</option>)}
            </select>
          </Feld>
        </Zeile2>
        <Zeile2>
          <Feld label={T('nm_beitrag_euro')}>
            <input type="number" inputMode="decimal" step="0.01" min="0" value={form.mitgliedsbeitrag} onChange={e => setze('mitgliedsbeitrag', e.target.value)} style={eingabeStil} />
          </Feld>
          <Feld label={T('nm_kontoinhaber')}>
            <input value={form.kontoinhaber} onChange={e => setze('kontoinhaber', e.target.value)} placeholder={T('nm_kontoinhaber_hinweis')} style={eingabeStil} />
          </Feld>
        </Zeile2>
        {form.zahlungsweise === 'sepa' && (
          <Zeile2>
            <Feld label="IBAN" hinweis={form.iban ? (ibanFalsch ? T('nm_iban_ungueltig') : T('nm_iban_ok')) : null}>
              <input value={form.iban} onChange={e => setze('iban', e.target.value.toUpperCase())} placeholder="DE12 3456 7890 1234 5678 90" autoComplete="off"
                aria-invalid={ibanFalsch || undefined} style={{ ...eingabeStil, borderColor: ibanFalsch ? 'var(--danger)' : undefined }} />
            </Feld>
            <Feld label="BIC" hinweis={form.bic && bicFalsch ? T('nm_bic_ungueltig') : null}>
              <input value={form.bic} onChange={e => setze('bic', e.target.value.toUpperCase())} autoComplete="off"
                aria-invalid={bicFalsch || undefined} style={{ ...eingabeStil, borderColor: bicFalsch ? 'var(--danger)' : undefined }} />
            </Feld>
          </Zeile2>
        )}

        <Zwischentitel>{T('nm_erziehungsberechtigte')}</Zwischentitel>
        <Feld label={T('name')}>
          <input value={form.erziehungsberechtigter_name} onChange={e => setze('erziehungsberechtigter_name', e.target.value)} style={eingabeStil} />
        </Feld>
        <Zeile2>
          <Feld label={T('profile_phone')}>
            <input type="tel" value={form.erziehungsberechtigter_telefon} onChange={e => setze('erziehungsberechtigter_telefon', e.target.value)} style={eingabeStil} />
          </Feld>
          <Feld label={T('nm_email')}>
            <input type="email" value={form.erziehungsberechtigter_email} onChange={e => setze('erziehungsberechtigter_email', e.target.value)} style={eingabeStil} />
          </Feld>
        </Zeile2>

        <Knopf voll onClick={speichern} disabled={sendet} style={{ marginTop: 8 }}>{T('save')}</Knopf>
      </div>
    </Blatt>
  )
}
