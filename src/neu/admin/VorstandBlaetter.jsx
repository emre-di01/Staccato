import { useState, useEffect } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Blatt, Feld, Knopf, Segment, AuswahlChips, FehlerText, eingabeStil } from '../../ui'

// Formular-Blätter des Vorstandsmoduls: Ziel, Aufgabe, Protokoll.
// Logik wie in pages/vorstand (Ziele.jsx / Protokolle.jsx), nur neue Oberfläche.

const LOCALE = { de: 'de-DE', en: 'en-GB', tr: 'tr-TR' }
const textfeld = { ...eingabeStil, resize: 'vertical' }

function StatusWahl({ wert, onChange }) {
  const { T } = useApp()
  return (
    <Feld label={T('status')}>
      <Segment label={T('status')} wert={wert} onChange={onChange} optionen={[
        ['offen', T('vorstand_status_offen')],
        ['in_bearbeitung', T('vorstand_status_in_bearbeitung')],
        ['erledigt', T('vorstand_status_erledigt')],
      ]} />
    </Feld>
  )
}

function VerantwortlichWahl({ wert, onChange, mitglieder }) {
  const { T } = useApp()
  return (
    <Feld label={T('vorstand_verantwortlicher')}>
      <select value={wert} onChange={e => onChange(e.target.value)} style={eingabeStil}>
        <option value="">{T('vorstand_kein_verantwortlicher')}</option>
        {mitglieder.map(m => <option key={m.id} value={m.id}>{m.voller_name}</option>)}
      </select>
    </Feld>
  )
}

// Gemeinsames Speichern: insert oder update, Fehler anzeigen
function useSpeichern(tabelle, id, onGespeichert) {
  const [sendet, setSendet] = useState(false)
  const [fehler, setFehler] = useState('')
  async function speichern(payload) {
    setSendet(true)
    setFehler('')
    const { error } = id
      ? await supabase.from(tabelle).update(payload).eq('id', id)
      : await supabase.from(tabelle).insert(payload)
    if (error) { setFehler(error.message); setSendet(false); return }
    onGespeichert()
  }
  return { sendet, fehler, setFehler, speichern }
}

export function ZielBlatt({ ziel, vorstandMitglieder, schuleId, profilId, onClose, onGespeichert }) {
  const { T } = useApp()
  const jahr = new Date().getFullYear()
  const [form, setForm] = useState({
    titel: ziel?.titel ?? '',
    beschreibung: ziel?.beschreibung ?? '',
    zeitraum_typ: ziel?.zeitraum_typ ?? 'jahr',
    zeitraum_wert: ziel?.zeitraum_wert ?? String(jahr),
    verantwortlicher_id: ziel?.verantwortlicher_id ?? '',
    status: ziel?.status ?? 'offen',
  })
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const { sendet, fehler, setFehler, speichern } = useSpeichern('vorstand_ziele', ziel?.id, onGespeichert)

  const jahre = Array.from({ length: 5 }, (_, i) => String(jahr + i - 1))
  const quartale = jahre.flatMap(j => ['Q1', 'Q2', 'Q3', 'Q4'].map(q => `${j}-${q}`))

  function absenden() {
    if (!form.titel.trim()) { setFehler(T('title_required')); return }
    speichern({ ...form, schule_id: schuleId, erstellt_von: profilId, verantwortlicher_id: form.verantwortlicher_id || null })
  }

  return (
    <Blatt titel={ziel ? T('vorstand_edit_ziel') : T('vorstand_new_ziel')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('name')}>
          <input value={form.titel} onChange={e => setze('titel', e.target.value)} placeholder={T('vorstand_titel_ziel_placeholder')} style={eingabeStil} />
        </Feld>
        <Feld label={T('nb_beschreibung')}>
          <textarea rows={3} value={form.beschreibung} onChange={e => setze('beschreibung', e.target.value)} style={textfeld} />
        </Feld>
        <Feld label={T('vorstand_zeitraum_label')}>
          <Segment label={T('vorstand_zeitraum_label')} wert={form.zeitraum_typ}
            onChange={typ => setForm(f => ({ ...f, zeitraum_typ: typ, zeitraum_wert: typ === 'jahr' ? String(jahr) : `${jahr}-Q1` }))}
            optionen={[['jahr', T('vorstand_zeitraum_jahr')], ['quartal', T('vorstand_zeitraum_quartal')]]} />
        </Feld>
        <Feld label={form.zeitraum_typ === 'jahr' ? T('vorstand_zeitraum_jahr') : T('vorstand_zeitraum_quartal')}>
          <select value={form.zeitraum_wert} onChange={e => setze('zeitraum_wert', e.target.value)} style={eingabeStil}>
            {(form.zeitraum_typ === 'jahr' ? jahre : quartale).map(o => <option key={o} value={o}>{o}</option>)}
          </select>
        </Feld>
        <VerantwortlichWahl wert={form.verantwortlicher_id} onChange={v => setze('verantwortlicher_id', v)} mitglieder={vorstandMitglieder} />
        <StatusWahl wert={form.status} onChange={v => setze('status', v)} />
        {fehler && <FehlerText>{fehler}</FehlerText>}
        <Knopf voll onClick={absenden} disabled={sendet}>{sendet ? T('saving') : T('save')}</Knopf>
      </div>
    </Blatt>
  )
}

export function AufgabeBlatt({ aufgabe, zielId, vorstandMitglieder, schuleId, profilId, onClose, onGespeichert }) {
  const { T } = useApp()
  const [form, setForm] = useState({
    titel: aufgabe?.titel ?? '',
    beschreibung: aufgabe?.beschreibung ?? '',
    verantwortlicher_id: aufgabe?.verantwortlicher_id ?? '',
    faellig_am: aufgabe?.faellig_am ?? '',
    status: aufgabe?.status ?? 'offen',
  })
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const { sendet, fehler, setFehler, speichern } = useSpeichern('vorstand_aufgaben', aufgabe?.id, onGespeichert)

  function absenden() {
    if (!form.titel.trim()) { setFehler(T('title_required')); return }
    speichern({
      ...form, schule_id: schuleId, ziel_id: zielId, erstellt_von: profilId,
      verantwortlicher_id: form.verantwortlicher_id || null, faellig_am: form.faellig_am || null,
    })
  }

  return (
    <Blatt titel={aufgabe ? T('vorstand_edit_aufgabe') : T('vorstand_new_aufgabe')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('name')}>
          <input value={form.titel} onChange={e => setze('titel', e.target.value)} placeholder={T('vorstand_titel_aufgabe_placeholder')} style={eingabeStil} />
        </Feld>
        <Feld label={T('nb_beschreibung')}>
          <textarea rows={3} value={form.beschreibung} onChange={e => setze('beschreibung', e.target.value)} style={textfeld} />
        </Feld>
        <VerantwortlichWahl wert={form.verantwortlicher_id} onChange={v => setze('verantwortlicher_id', v)} mitglieder={vorstandMitglieder} />
        <Feld label={T('vorstand_faellig')}>
          <input type="date" value={form.faellig_am} onChange={e => setze('faellig_am', e.target.value)} style={eingabeStil} />
        </Feld>
        <StatusWahl wert={form.status} onChange={v => setze('status', v)} />
        {fehler && <FehlerText>{fehler}</FehlerText>}
        <Knopf voll onClick={absenden} disabled={sendet}>{sendet ? T('saving') : T('save')}</Knopf>
      </div>
    </Blatt>
  )
}

export function ProtokollBlatt({ protokoll, vorstandMitglieder, schuleId, profilId, onClose, onGespeichert }) {
  const { T, lang } = useApp()
  const [form, setForm] = useState({
    titel: protokoll?.titel ?? '',
    sitzungstyp: protokoll?.sitzungstyp ?? 'vorstandssitzung',
    datum: protokoll?.datum ?? new Date().toISOString().slice(0, 10),
    teilnehmer_ids: protokoll?.teilnehmer_ids ?? [],
    beschluesse: protokoll?.beschluesse ?? '',
    inhalt: protokoll?.inhalt ?? '',
    event_id: protokoll?.event_id ?? '',
  })
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))
  const [sitzungen, setSitzungen] = useState([])
  const { sendet, fehler, setFehler, speichern } = useSpeichern('vorstand_protokolle', protokoll?.id, onGespeichert)

  useEffect(() => {
    supabase.from('events').select('id, titel, beginn')
      .eq('schule_id', schuleId).eq('typ', 'vorstandssitzung')
      .order('beginn', { ascending: false })
      .then(({ data }) => setSitzungen(data ?? []))
  }, [schuleId])

  function absenden() {
    if (!form.titel.trim()) { setFehler(T('title_required')); return }
    if (!form.datum) { setFehler(T('all_fields_required')); return }
    speichern({ ...form, schule_id: schuleId, erstellt_von: profilId, event_id: form.event_id || null })
  }

  return (
    <Blatt titel={protokoll ? T('vorstand_edit_protokoll') : T('vorstand_new_protokoll')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('name')}>
          <input value={form.titel} onChange={e => setze('titel', e.target.value)} placeholder={T('vorstand_titel_protokoll_placeholder')} style={eingabeStil} />
        </Feld>
        <Feld label={T('vorstand_sitzungstyp')}>
          <select value={form.sitzungstyp} onChange={e => setze('sitzungstyp', e.target.value)} style={eingabeStil}>
            <option value="vorstandssitzung">{T('vorstand_typ_vorstandssitzung')}</option>
            <option value="mitgliederversammlung">{T('vorstand_typ_mitgliederversammlung')}</option>
            <option value="sonstiges">{T('vorstand_typ_sonstiges')}</option>
          </select>
        </Feld>
        <Feld label={T('date')}>
          <input type="date" value={form.datum} onChange={e => setze('datum', e.target.value)} style={eingabeStil} />
        </Feld>

        {sitzungen.length > 0 && (
          <Feld label={T('nb_verknuepfte_sitzung')}>
            <select value={form.event_id} onChange={e => {
              const id = e.target.value
              // Beim Verknüpfen ohne Teilnehmende: alle Vorstandsmitglieder vorschlagen
              setForm(f => ({ ...f, event_id: id, ...(id && f.teilnehmer_ids.length === 0 ? { teilnehmer_ids: vorstandMitglieder.map(m => m.id) } : {}) }))
            }} style={eingabeStil}>
              <option value="">{T('nb_keine')}</option>
              {sitzungen.map(ev => (
                <option key={ev.id} value={ev.id}>
                  {new Date(ev.beginn).toLocaleDateString(LOCALE[lang] ?? 'de-DE', { day: 'numeric', month: 'short', year: 'numeric' })} · {ev.titel}
                </option>
              ))}
            </select>
          </Feld>
        )}

        {vorstandMitglieder.length > 0 && (
          <div>
            <div style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)', marginBottom: 8 }}>{T('vorstand_teilnehmer')}</div>
            <AuswahlChips label={T('vorstand_teilnehmer')} wert={form.teilnehmer_ids} onChange={ids => setze('teilnehmer_ids', ids)}
              optionen={vorstandMitglieder.map(m => [m.id, m.voller_name])} />
          </div>
        )}

        <Feld label={T('vorstand_beschluesse')}>
          <textarea rows={3} value={form.beschluesse} onChange={e => setze('beschluesse', e.target.value)} placeholder={T('vorstand_beschluesse_placeholder')} style={textfeld} />
        </Feld>
        <Feld label={T('vorstand_inhalt')}>
          <textarea rows={6} value={form.inhalt} onChange={e => setze('inhalt', e.target.value)} placeholder={T('vorstand_inhalt_placeholder')} style={textfeld} />
        </Feld>
        {fehler && <FehlerText>{fehler}</FehlerText>}
        <Knopf voll onClick={absenden} disabled={sendet}>{sendet ? T('saving') : T('save')}</Knopf>
      </div>
    </Blatt>
  )
}
