import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { useSchulweit } from '../rolle'
import { Blatt, Feld, Knopf, SchalterZeile, Gruppe, eingabeStil } from '../../ui'

const TYPEN = ['konzert', 'vorspiel', 'pruefung', 'veranstaltung', 'sonstiges']

// ISO → Wert für <input type="datetime-local"> (lokale Zeit des Geräts, wie bisher)
function inputWert(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  const p = n => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`
}

// Lieder, die nur in dieser Veranstaltung vorkommen, mit ihren Dateien entfernen (vor dem Löschen des Events)
async function verwaisteLiederLoeschen(eventId) {
  const { data } = await supabase.from('event_stuecke').select('stueck_id').eq('event_id', eventId)
  for (const { stueck_id } of data ?? []) {
    const [k, e] = await Promise.all([
      supabase.from('unterricht_stuecke').select('*', { count: 'exact', head: true }).eq('stueck_id', stueck_id),
      supabase.from('event_stuecke').select('*', { count: 'exact', head: true }).eq('stueck_id', stueck_id).neq('event_id', eventId),
    ])
    if ((k.count ?? 0) > 0 || (e.count ?? 0) > 0) continue
    const { data: dateien } = await supabase.from('stueck_dateien').select('bucket_pfad').eq('stueck_id', stueck_id)
    if (dateien?.length) await supabase.storage.from('stueck-dateien').remove(dateien.map(d => d.bucket_pfad))
    await supabase.from('stuecke').delete().eq('id', stueck_id)
  }
}

// Veranstaltung anlegen oder bearbeiten (Lehrer: nur eigene Events; im Admin-Bereich alle, inkl. Vorstandssitzung)
export default function EventBlatt({ ev, onClose, onFertig }) {
  const { schule, T, toast, confirm } = useApp()
  const schulweit = useSchulweit()
  const typen = schulweit ? [...TYPEN, 'vorstandssitzung'] : TYPEN
  const [form, setForm] = useState({
    titel: ev?.titel ?? '', typ: ev?.typ ?? 'konzert', beginn: inputWert(ev?.beginn), ende: inputWert(ev?.ende),
    ort: ev?.ort ?? '', raum_id: ev?.raum_id ?? '', beschreibung: ev?.beschreibung ?? '', oeffentlich: ev?.oeffentlich ?? false,
  })
  const { data: raeume = [] } = useQuery({
    queryKey: ['n-raeume-aktiv', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => (await supabase.from('raeume').select('id, name').eq('schule_id', schule.id).eq('aktiv', true).order('name')).data ?? [],
  })
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function speichern() {
    if (!form.titel.trim() || !form.beginn) { toast(T('nl_event_pflicht'), 'error'); return }
    setSendet(true)
    const payload = {
      titel: form.titel.trim(), typ: form.typ,
      beginn: new Date(form.beginn).toISOString(), ende: form.ende ? new Date(form.ende).toISOString() : null,
      ort: form.ort.trim() || null, raum_id: form.raum_id || null, beschreibung: form.beschreibung.trim() || null, oeffentlich: form.oeffentlich,
    }
    const { data: gespeichert, error } = ev
      ? await supabase.from('events').update(payload).eq('id', ev.id).select('id').single()
      : await supabase.from('events').insert({ ...payload, schule_id: schule.id }).select('id').single()
    if (!error && !ev && payload.typ === 'vorstandssitzung') {
      // Vorstand der Schule automatisch einladen
      const { data: vorstand } = await supabase.from('profiles').select('id').eq('schule_id', schule.id).in('rolle', ['vorstand', 'admin', 'superadmin'])
      if (vorstand?.length) await supabase.from('event_teilnehmer').insert(vorstand.map(m => ({ event_id: gespeichert.id, profil_id: m.id })))
    }
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    onFertig()
  }

  async function loeschen() {
    const ok = await confirm(T('nl_event_loeschen_frage'), { confirmLabel: T('delete') })
    if (!ok) return
    if (schulweit) await verwaisteLiederLoeschen(ev.id)
    const { error } = await supabase.from('events').delete().eq('id', ev.id)
    if (error) { toast(error.message, 'error'); return }
    onFertig()
  }

  return (
    <Blatt titel={ev ? T('nl_event_bearbeiten') : T('nl_event_neu')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('nl_event_name')}>
          <input value={form.titel} onChange={e => setze('titel', e.target.value)} style={eingabeStil} />
        </Feld>
        <Feld label={T('type')}>
          <select value={form.typ} onChange={e => setze('typ', e.target.value)} style={eingabeStil}>
            {typen.map(t => <option key={t} value={t}>{T(`n_evt_${t}`)}</option>)}
          </select>
        </Feld>
        <Feld label={T('event_start')}>
          <input type="datetime-local" value={form.beginn} onChange={e => setze('beginn', e.target.value)} style={eingabeStil} />
        </Feld>
        <Feld label={T('event_end')}>
          <input type="datetime-local" value={form.ende} onChange={e => setze('ende', e.target.value)} style={eingabeStil} />
        </Feld>
        <Feld label={T('event_location')}>
          <input value={form.ort} onChange={e => setze('ort', e.target.value)} style={eingabeStil} />
        </Feld>
        {raeume.length > 0 && (
          <Feld label={T('room')}>
            <select value={form.raum_id} onChange={e => setze('raum_id', e.target.value)} style={eingabeStil}>
              <option value="">{T('none_option')}</option>
              {raeume.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
            </select>
          </Feld>
        )}
        <Feld label={T('event_description')}>
          <textarea rows={3} value={form.beschreibung} onChange={e => setze('beschreibung', e.target.value)} style={{ ...eingabeStil, resize: 'vertical' }} />
        </Feld>
        <Gruppe style={{ margin: 0 }}>
          <SchalterZeile titel={T('nl_event_oeffentlich')} untertitel={T('nl_event_oeffentlich_hinweis')} an={form.oeffentlich} onChange={v => setze('oeffentlich', v)} />
        </Gruppe>
        <Knopf voll onClick={speichern} disabled={sendet}>{T('save')}</Knopf>
        {ev && <Knopf voll variante="gefahr" icon={Trash2} onClick={loeschen}>{T('nl_event_loeschen')}</Knopf>}
      </div>
    </Blatt>
  )
}
