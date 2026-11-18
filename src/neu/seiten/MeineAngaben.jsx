import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { ibanGueltig, bicGueltig } from '../../lib/bank'
import OrtAutocomplete from '../../components/OrtAutocomplete'
import { Feld, Knopf, Laden, FehlerText, eingabeStil } from '../../ui'

// Rollen, die Beiträge zahlen und deshalb Zahlungsdaten angeben
export const ZAHLENDE_ROLLEN = ['schueler', 'vorstand']

function Zwischentitel({ children }) {
  return <h3 style={{ margin: '12px 0 0', fontSize: 15, fontWeight: 700, letterSpacing: '0.04em', textTransform: 'uppercase', color: 'var(--text-2)' }}>{children}</h3>
}

function Hinweis({ children }) {
  return <p style={{ margin: 0, fontSize: 15, lineHeight: 1.45, color: 'var(--text-2)' }}>{children}</p>
}

function minderjaehrig(geburtsdatum) {
  if (!geburtsdatum) return false
  const g = new Date(geburtsdatum)
  const h = new Date()
  const alter = h.getFullYear() - g.getFullYear() - (h < new Date(h.getFullYear(), g.getMonth(), g.getDate()) ? 1 : 0)
  return alter < 18
}

const leer = v => (typeof v === 'string' ? v.trim() : v) || null
const ohneLeerzeichen = v => v.replace(/\s/g, '').toUpperCase()

// Eigene Angaben (Kontakt, Zahlungsdaten, Erziehungsberechtigte) selbst eintragen.
// Genutzt nach dem Annehmen einer Einladung und auf der Profilseite.
//   persoenlich: Telefon, Geburtsdatum, Adresse mit abfragen
//   rolle:       steuert, ob Zahlungsdaten und Erziehungsberechtigte erscheinen
//   onFertig:    nach dem Speichern; onSpaeter: optionaler „Später“-Knopf
export default function MeineAngaben({ persoenlich = false, rolle, schuleName, knopfText, onFertig, onSpaeter }) {
  const { T, toast } = useApp()
  const [uid, setUid] = useState(null)
  const [alt, setAlt] = useState(null)
  const [form, setForm] = useState(null)
  const [zustimmung, setZustimmung] = useState(false)
  const [fehler, setFehler] = useState('')
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))

  useEffect(() => {
    let aktiv = true
    ;(async () => {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || !aktiv) return
      const { data } = await supabase.from('profiles')
        .select('telefon, adresse, geburtsdatum, zahlungsweise, kontoinhaber, iban, bic, sepa_mandat_am, erziehungsberechtigter_name, erziehungsberechtigter_telefon, erziehungsberechtigter_email')
        .eq('id', user.id).single()
      if (!aktiv) return
      const p = data ?? {}
      setUid(user.id)
      setAlt(p)
      setForm({
        telefon: p.telefon ?? '', adresse: p.adresse ?? '', geburtsdatum: p.geburtsdatum ?? '',
        zahlungsweise: p.zahlungsweise ?? '', kontoinhaber: p.kontoinhaber ?? '', iban: p.iban ?? '', bic: p.bic ?? '',
        erziehungsberechtigter_name: p.erziehungsberechtigter_name ?? '',
        erziehungsberechtigter_telefon: p.erziehungsberechtigter_telefon ?? '',
        erziehungsberechtigter_email: p.erziehungsberechtigter_email ?? '',
      })
    })()
    return () => { aktiv = false }
  }, [])

  if (!form) return <Laden hoehe={200} />

  const zahlt = ZAHLENDE_ROLLEN.includes(rolle)
  const sepa = form.zahlungsweise === 'sepa'
  const ibanFalsch = form.iban && !ibanGueltig(form.iban)
  const bicFalsch = form.bic && !bicGueltig(form.bic)
  const ibanGeaendert = ohneLeerzeichen(form.iban) !== ohneLeerzeichen(alt.iban ?? '')
  const zustimmungNoetig = sepa && (ibanGeaendert || !alt.sepa_mandat_am)
  const zeigeEltern = rolle === 'schueler' && (minderjaehrig(form.geburtsdatum) || !!alt.erziehungsberechtigter_name)
  const schule = schuleName ?? T('nma_musikschule')

  async function speichern(e) {
    e.preventDefault()
    setFehler('')
    if (zahlt && sepa) {
      if (!form.iban || ibanFalsch) { setFehler(T('nma_iban_pflicht')); return }
      if (bicFalsch) { setFehler(T('nm_bic_ungueltig')); return }
      if (zustimmungNoetig && !zustimmung) { setFehler(T('nma_sepa_pflicht')); return }
    }
    const daten = {}
    if (persoenlich) Object.assign(daten, {
      telefon: leer(form.telefon), adresse: leer(form.adresse), geburtsdatum: form.geburtsdatum || null,
    })
    if (zahlt) Object.assign(daten, sepa ? {
      zahlungsweise: 'sepa', kontoinhaber: leer(form.kontoinhaber), iban: ohneLeerzeichen(form.iban), bic: form.bic ? ohneLeerzeichen(form.bic) : null,
      ...(zustimmungNoetig ? { sepa_mandat_am: new Date().toISOString() } : {}),
    } : {
      // Ohne Lastschrift wird keine Bankverbindung gebraucht (Datenminimierung)
      zahlungsweise: form.zahlungsweise || null, kontoinhaber: null, iban: null, bic: null, sepa_mandat_am: null,
    })
    if (zeigeEltern) Object.assign(daten, {
      erziehungsberechtigter_name: leer(form.erziehungsberechtigter_name),
      erziehungsberechtigter_telefon: leer(form.erziehungsberechtigter_telefon),
      erziehungsberechtigter_email: leer(form.erziehungsberechtigter_email),
    })
    setSendet(true)
    const { error } = await supabase.from('profiles').update(daten).eq('id', uid)
    setSendet(false)
    if (error) { setFehler(error.message); return }
    setAlt(a => ({ ...a, ...daten, sepa_mandat_am: daten.sepa_mandat_am !== undefined ? daten.sepa_mandat_am : a.sepa_mandat_am }))
    setZustimmung(false)
    toast(T('profile_saved'), 'success')
    onFertig?.()
  }

  return (
    <form onSubmit={speichern} style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {persoenlich && <>
        <Feld label={T('profile_phone')}>
          <input type="tel" autoComplete="tel" value={form.telefon} onChange={e => setze('telefon', e.target.value)} placeholder="+49 …" style={eingabeStil} />
        </Feld>
        <Feld label={T('profile_birthday')}>
          <input type="date" autoComplete="bday" value={form.geburtsdatum} onChange={e => setze('geburtsdatum', e.target.value)} style={eingabeStil} />
        </Feld>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)' }}>{T('profile_address')}</span>
          <OrtAutocomplete value={form.adresse} onChange={v => setze('adresse', v)} inputStyle={eingabeStil} />
        </div>
      </>}

      {zahlt && <>
        {persoenlich && <Zwischentitel>{T('nm_zahlungsdaten')}</Zwischentitel>}
        <Hinweis>{T('nma_zahlung_hinweis')}</Hinweis>
        <Feld label={T('nm_zahlungsweise')}>
          <select value={form.zahlungsweise} onChange={e => setze('zahlungsweise', e.target.value)} style={eingabeStil}>
            <option value="">{T('none_option')}</option>
            {['sepa', 'ueberweisung', 'bar'].map(z => <option key={z} value={z}>{T(`nm_zw_${z}`)}</option>)}
          </select>
        </Feld>
        {sepa && <>
          <Feld label={T('nm_kontoinhaber')} hinweis={T('nm_kontoinhaber_hinweis')}>
            <input autoComplete="cc-name" value={form.kontoinhaber} onChange={e => setze('kontoinhaber', e.target.value)} style={eingabeStil} />
          </Feld>
          <Feld label="IBAN" hinweis={form.iban ? (ibanFalsch ? T('nm_iban_ungueltig') : T('nm_iban_ok')) : null}>
            <input value={form.iban} onChange={e => setze('iban', e.target.value.toUpperCase())} placeholder="DE12 3456 7890 1234 5678 90" autoComplete="off" inputMode="text"
              aria-invalid={ibanFalsch || undefined} style={{ ...eingabeStil, borderColor: ibanFalsch ? 'var(--danger)' : undefined }} />
          </Feld>
          <Feld label={T('nma_bic_optional')} hinweis={bicFalsch ? T('nm_bic_ungueltig') : null}>
            <input value={form.bic} onChange={e => setze('bic', e.target.value.toUpperCase())} autoComplete="off"
              aria-invalid={bicFalsch || undefined} style={{ ...eingabeStil, borderColor: bicFalsch ? 'var(--danger)' : undefined }} />
          </Feld>
          {zustimmungNoetig ? (
            <label style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '14px 16px', borderRadius: 14, background: 'var(--n-fill)', cursor: 'pointer' }}>
              <input type="checkbox" checked={zustimmung} onChange={e => setZustimmung(e.target.checked)} style={{ width: 22, height: 22, marginTop: 2, flexShrink: 0, accentColor: 'var(--primary)' }} />
              <span style={{ fontSize: 15, lineHeight: 1.45 }}>{T('nma_sepa_zustimmung').replaceAll('{schule}', schule)}</span>
            </label>
          ) : (
            <Hinweis>{T('nma_sepa_erteilt').replace('{datum}', new Date(alt.sepa_mandat_am).toLocaleDateString())}</Hinweis>
          )}
        </>}
      </>}

      {zeigeEltern && <>
        <Zwischentitel>{T('nm_erziehungsberechtigte')}</Zwischentitel>
        <Hinweis>{T('nma_eltern_hinweis')}</Hinweis>
        <Feld label={T('name')}>
          <input value={form.erziehungsberechtigter_name} onChange={e => setze('erziehungsberechtigter_name', e.target.value)} style={eingabeStil} />
        </Feld>
        <Feld label={T('profile_phone')}>
          <input type="tel" value={form.erziehungsberechtigter_telefon} onChange={e => setze('erziehungsberechtigter_telefon', e.target.value)} style={eingabeStil} />
        </Feld>
        <Feld label={T('nm_email')}>
          <input type="email" value={form.erziehungsberechtigter_email} onChange={e => setze('erziehungsberechtigter_email', e.target.value)} style={eingabeStil} />
        </Feld>
      </>}

      {fehler && <FehlerText>{fehler}</FehlerText>}
      <Knopf type="submit" voll disabled={sendet} style={{ marginTop: 8 }}>{sendet ? T('loading') : (knopfText ?? T('save'))}</Knopf>
      {onSpaeter && <Knopf type="button" voll variante="sekundaer" onClick={onSpaeter} disabled={sendet}>{T('nma_spaeter')}</Knopf>}
    </form>
  )
}
