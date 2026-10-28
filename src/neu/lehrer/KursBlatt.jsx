import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Blatt, Feld, Knopf, eingabeStil } from '../../ui'

const TYPEN = ['einzel', 'gruppe', 'chor', 'ensemble']
const TAGE = ['mo', 'di', 'mi', 'do', 'fr', 'sa', 'so']

// Neuen Kurs anlegen (nur Lehrkräfte mit kann_kurse_anlegen); ich werde Hauptlehrer
export default function KursBlatt({ onClose, onFertig }) {
  const { profil, schule, T, lang, toast } = useApp()
  const [form, setForm] = useState({ name: '', typ: 'einzel', instrument_id: '', raum_id: '', wochentag: '', uhrzeit_von: '', uhrzeit_bis: '' })
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))

  const { data: optionen } = useQuery({
    queryKey: ['nl-kurs-optionen', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const [i, r] = await Promise.all([
        supabase.from('instrumente').select('id, name_de, name_en, name_tr, icon').eq('aktiv', true).eq('schule_id', schule.id).order('name_de'),
        supabase.from('raeume').select('id, name').eq('aktiv', true).order('name'),
      ])
      return { instrumente: i.data ?? [], raeume: r.data ?? [] }
    },
  })

  async function speichern() {
    if (!form.name.trim()) { toast(T('nl_kurs_name_pflicht'), 'error'); return }
    setSendet(true)
    const { data: id, error } = await supabase.rpc('create_unterricht', {
      p_name:          form.name.trim(),
      p_typ:           form.typ,
      p_instrument_id: form.instrument_id || null,
      p_lehrer_ids:    [profil.id],
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

  return (
    <Blatt titel={T('nl_kurs_anlegen')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('nl_kurs_name')}>
          <input value={form.name} onChange={e => setze('name', e.target.value)} placeholder={T('nl_kurs_name_beispiel')} style={eingabeStil} />
        </Feld>
        <Feld label={T('type')}>
          <select value={form.typ} onChange={e => setze('typ', e.target.value)} style={eingabeStil}>
            {TYPEN.map(t => <option key={t} value={t}>{T(`n_kurstyp_${t}`)}</option>)}
          </select>
        </Feld>
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
        <Feld label={T('kurs_mgmt_weekday')} hinweis={T('nl_kurs_zeit_hinweis')}>
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
        <Knopf voll onClick={speichern} disabled={sendet}>{T('nl_kurs_anlegen')}</Knopf>
      </div>
    </Blatt>
  )
}
