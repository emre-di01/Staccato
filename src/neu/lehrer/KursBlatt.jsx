import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { useSchulweit } from '../rolle'
import { Blatt, Feld, Knopf, AuswahlChips, Gruppe, SchalterZeile, eingabeStil } from '../../ui'

const TYPEN = ['einzel', 'gruppe', 'chor', 'ensemble']
const TAGE = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']

// Neuen Kurs anlegen (Lehrkräfte mit kann_kurse_anlegen werden selbst Hauptlehrer; Admins wählen die Lehrkraft)
// oder – mit `kurs` – einen bestehenden Kurs bearbeiten (nur Admins, RLS erlaubt Lehrkräften kein UPDATE)
export default function KursBlatt({ kurs, onClose, onFertig }) {
  const { profil, schule, T, lang, toast } = useApp()
  const schulweit = useSchulweit()
  const bearbeiten = !!kurs
  const altLehrer = [...(kurs?.unterricht_lehrer ?? [])].sort((a, b) => (a.rolle === 'hauptlehrer' ? -1 : 0) - (b.rolle === 'hauptlehrer' ? -1 : 0))
  const [form, setForm] = useState({
    name:          kurs?.name ?? '',
    typ:           kurs?.typ ?? 'einzel',
    instrument_id: kurs?.instrument_id ?? '',
    raum_id:       kurs?.raum_id ?? '',
    wochentag:     kurs?.wochentag ?? '',
    uhrzeit_von:   kurs?.uhrzeit_von?.slice(0, 5) ?? '',
    uhrzeit_bis:   kurs?.uhrzeit_bis?.slice(0, 5) ?? '',
    lehrer_id:     altLehrer[0]?.lehrer_id ?? '',
    aktiv:         kurs?.aktiv ?? true,
  })
  const [coLehrer, setCoLehrer] = useState(altLehrer.slice(1).map(l => l.lehrer_id))
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: optionen } = useQuery({
    queryKey: ['nl-kurs-optionen', schule?.id, schulweit],
    enabled: !!schule?.id,
    queryFn: async () => {
      const [i, r, l] = await Promise.all([
        supabase.from('instrumente').select('id, name_de, name_en, name_tr, icon').eq('aktiv', true).eq('schule_id', schule.id).order('name_de'),
        supabase.from('raeume').select('id, name').eq('aktiv', true).order('name'),
        schulweit
          ? supabase.from('profiles').select('id, voller_name').in('rolle', ['lehrer', 'admin', 'superadmin']).eq('aktiv', true).order('voller_name')
          : { data: [] },
      ])
      return { instrumente: i.data ?? [], raeume: r.data ?? [], lehrer: l.data ?? [] }
    },
  })

  async function lehrerSetzen(ids) {
    const vorher = altLehrer.map(l => l.lehrer_id)
    if (ids.length === vorher.length && ids.every((id, i) => id === vorher[i])) return null
    const zeilen = ids.map((lehrer_id, i) => ({ lehrer_id, rolle: i === 0 ? 'hauptlehrer' : 'co_lehrer' }))
    const del = await supabase.from('unterricht_lehrer').delete().eq('unterricht_id', kurs.id)
    if (del.error) return del.error
    const ins = await supabase.from('unterricht_lehrer').insert(zeilen.map(z => ({ ...z, unterricht_id: kurs.id })))
    if (ins.error) return ins.error
    // Künftige Stunden auf die neuen Lehrkräfte umstellen – Stundenplan der Lehrkräfte liest stunden_lehrer
    const { data: stunden, error } = await supabase.from('stunden').select('id').eq('unterricht_id', kurs.id)
      .eq('status', 'geplant').gte('beginn', new Date().toISOString())
    if (error) return error
    const sids = (stunden ?? []).map(s => s.id)
    if (!sids.length) return null
    const sdel = await supabase.from('stunden_lehrer').delete().in('stunde_id', sids)
    if (sdel.error) return sdel.error
    const sins = await supabase.from('stunden_lehrer').insert(sids.flatMap(stunde_id => zeilen.map(z => ({ ...z, stunde_id }))))
    return sins.error
  }

  async function speichern() {
    if (!form.name.trim()) { toast(T('nl_kurs_name_pflicht'), 'error'); return }
    if (schulweit && !form.lehrer_id) { toast(T('na_kurs_lehrer_pflicht'), 'error'); return }
    setSendet(true)
    if (bearbeiten) {
      const { error } = await supabase.from('unterricht').update({
        name:          form.name.trim(),
        typ:           form.typ,
        instrument_id: form.instrument_id || null,
        raum_id:       form.raum_id || null,
        wochentag:     form.wochentag || null,
        uhrzeit_von:   form.uhrzeit_von || null,
        uhrzeit_bis:   form.uhrzeit_bis || null,
        aktiv:         form.aktiv,
      }).eq('id', kurs.id)
      const fehler = error ?? await lehrerSetzen([form.lehrer_id, ...coLehrer.filter(id => id !== form.lehrer_id)])
      setSendet(false)
      if (fehler) { toast(fehler.message, 'error'); return }
      toast(T('nl_kurs_gespeichert'), 'success')
      onFertig(kurs.id)
      return
    }
    const { data: id, error } = await supabase.rpc('create_unterricht', {
      p_name:          form.name.trim(),
      p_typ:           form.typ,
      p_instrument_id: form.instrument_id || null,
      p_lehrer_ids:    [schulweit ? form.lehrer_id : profil.id],
      p_raum_id:       form.raum_id || null,
      p_wochentag:     form.wochentag || null,
      p_uhrzeit_von:   form.uhrzeit_von || null,
      p_uhrzeit_bis:   form.uhrzeit_bis || null,
      p_schule_id:     schule.id,
    })
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    onFertig(id)
  }

  const lehrerOptionen = optionen?.lehrer ?? []

  return (
    <Blatt titel={T(bearbeiten ? 'nl_kurs_bearbeiten' : 'nl_kurs_anlegen')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('nl_kurs_name')}>
          <input value={form.name} onChange={e => setze('name', e.target.value)} placeholder={T('nl_kurs_name_beispiel')} style={eingabeStil} />
        </Feld>
        <Feld label={T('type')}>
          <select value={form.typ} onChange={e => setze('typ', e.target.value)} style={eingabeStil}>
            {TYPEN.map(t => <option key={t} value={t}>{T(`n_kurstyp_${t}`)}</option>)}
          </select>
        </Feld>
        {schulweit && (
          <Feld label={T(bearbeiten ? 'nl_kv_hauptlehrer' : 'na_lehrkraft')}>
            <select value={form.lehrer_id} onChange={e => setze('lehrer_id', e.target.value)} style={eingabeStil}>
              <option value="">{T('nl_bitte_waehlen')}</option>
              {lehrerOptionen.map(l => <option key={l.id} value={l.id}>{l.voller_name}</option>)}
            </select>
          </Feld>
        )}
        {schulweit && bearbeiten && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 16, fontWeight: 600, color: 'var(--text-2)' }}>{T('nl_kurs_colehrer')}</span>
            <AuswahlChips label={T('nl_kurs_colehrer')} wert={coLehrer} onChange={setCoLehrer}
              optionen={lehrerOptionen.filter(l => l.id !== form.lehrer_id).map(l => [l.id, l.voller_name])} />
          </div>
        )}
        <Feld label={T('instrument')}>
          <select value={form.instrument_id} onChange={e => setze('instrument_id', e.target.value)} style={eingabeStil}>
            <option value="">{T('none_option')}</option>
            {(optionen?.instrumente ?? []).map(i => <option key={i.id} value={i.id}>{[i.icon, i[`name_${lang}`] ?? i.name_de].filter(Boolean).join(' ')}</option>)}
          </select>
        </Feld>
        <Feld label={T('room')}>
          <select value={form.raum_id} onChange={e => setze('raum_id', e.target.value)} style={eingabeStil}>
            <option value="">{T('none_option')}</option>
            {(optionen?.raeume ?? []).map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>
        </Feld>
        <Feld label={T('kurs_mgmt_weekday')} hinweis={T(bearbeiten ? 'nl_kurs_zeit_hinweis_bearbeiten' : 'nl_kurs_zeit_hinweis')}>
          <select value={form.wochentag} onChange={e => setze('wochentag', e.target.value)} style={eingabeStil}>
            <option value="">{T('none_option')}</option>
            {TAGE.map(t => <option key={t} value={t}>{T(`weekday_${t}`)}</option>)}
          </select>
        </Feld>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1 }}>
            <Feld label={T('nl_von')}>
              <input type="time" value={form.uhrzeit_von} onChange={e => setze('uhrzeit_von', e.target.value)} style={eingabeStil} />
            </Feld>
          </div>
          <div style={{ flex: 1 }}>
            <Feld label={T('nl_bis')}>
              <input type="time" value={form.uhrzeit_bis} onChange={e => setze('uhrzeit_bis', e.target.value)} style={eingabeStil} />
            </Feld>
          </div>
        </div>
        {bearbeiten && (
          <Gruppe style={{ margin: 0 }}>
            <SchalterZeile titel={T('nl_kurs_aktiv')} untertitel={T('nl_kurs_aktiv_hinweis')} an={form.aktiv} onChange={v => setze('aktiv', v)} />
          </Gruppe>
        )}
        <Knopf voll onClick={speichern} disabled={sendet}>{T(bearbeiten ? 'save' : 'nl_kurs_anlegen')}</Knopf>
      </div>
    </Blatt>
  )
}
