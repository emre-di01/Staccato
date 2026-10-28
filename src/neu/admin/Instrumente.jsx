import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { Plus, Trash2 } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Chips, Gruppe, Trenner, Zeile, Knopf, Leer, Laden, Blatt, Feld, SchalterZeile, eingabeStil } from '../../ui'
import { useNeuLaden } from '../daten'

const ICONS = ['🎹', '🎸', '🎺', '🎻', '🥁', '🎷', '🪗', '🪕', '🎵', '🎼', '🎤', '🎙', '🪘', '🪈', '🎶']

function useInstrumente() {
  const { schule } = useApp()
  return useQuery({
    queryKey: ['na-instrumente', schule?.id],
    enabled: !!schule?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('instrumente').select('*').eq('schule_id', schule.id).order('name_de')
      if (error) throw error
      return data ?? []
    },
  })
}

function InstrumentBlatt({ instrument, onClose, onFertig, onLoeschen }) {
  const { T, schule, toast } = useApp()
  const istNeu = !instrument?.id
  const [form, setForm] = useState({
    name_de: instrument?.name_de ?? '', name_en: instrument?.name_en ?? '', name_tr: instrument?.name_tr ?? '',
    icon: instrument?.icon ?? '🎵', aktiv: instrument?.aktiv ?? true,
  })
  const [sendet, setSendet] = useState(false)
  const setze = (k, v) => setForm(f => ({ ...f, [k]: v }))

  async function speichern() {
    if (!form.name_de.trim()) { toast(T('nv_name_de_pflicht'), 'error'); return }
    setSendet(true)
    const daten = { name_de: form.name_de.trim(), name_en: form.name_en.trim() || null, name_tr: form.name_tr.trim() || null, icon: form.icon || null, aktiv: form.aktiv }
    const { error } = istNeu
      ? await supabase.from('instrumente').insert({ ...daten, schule_id: schule.id })
      : await supabase.from('instrumente').update(daten).eq('id', instrument.id)
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    toast(T('nl_gespeichert'), 'success')
    onFertig()
  }

  return (
    <Blatt titel={istNeu ? T('nv_neues_instrument') : instrument.name_de} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div>
          <div style={{ fontSize: 15, fontWeight: 600, marginBottom: 8 }}>{T('nv_symbol')}</div>
          <div role="radiogroup" aria-label={T('nv_symbol')} style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {ICONS.map(ic => (
              <button key={ic} role="radio" aria-checked={form.icon === ic} onClick={() => setze('icon', ic)} style={{
                width: 48, height: 48, fontSize: 24, borderRadius: 14, cursor: 'pointer',
                border: `2px solid ${form.icon === ic ? 'var(--primary)' : 'transparent'}`, background: form.icon === ic ? 'var(--n-tint)' : 'var(--n-fill)',
              }}>{ic}</button>
            ))}
            <input value={form.icon} onChange={e => setze('icon', e.target.value)} aria-label={T('nv_eigenes_symbol')} placeholder={T('nv_eigenes_symbol')}
              style={{ ...eingabeStil, width: 110, textAlign: 'center', fontSize: 20 }} />
          </div>
        </div>
        <Feld label={T('nv_name_deutsch')}>
          <input value={form.name_de} onChange={e => setze('name_de', e.target.value)} placeholder="Klavier" style={eingabeStil} />
        </Feld>
        <Feld label={T('nv_name_englisch')}>
          <input value={form.name_en} onChange={e => setze('name_en', e.target.value)} placeholder="Piano" style={eingabeStil} />
        </Feld>
        <Feld label={T('nv_name_tuerkisch')}>
          <input value={form.name_tr} onChange={e => setze('name_tr', e.target.value)} placeholder="Piyano" style={eingabeStil} />
        </Feld>
        {!istNeu && (
          <Gruppe style={{ margin: 0 }}>
            <SchalterZeile titel={T('active')} untertitel={T('nv_instrument_aktiv_hinweis')} an={form.aktiv} onChange={v => setze('aktiv', v)} />
          </Gruppe>
        )}
        <Knopf voll onClick={speichern} disabled={sendet}>{istNeu ? T('nv_instrument_anlegen') : T('save')}</Knopf>
        {!istNeu && <Knopf voll variante="gefahr" icon={Trash2} onClick={onLoeschen}>{T('nv_instrument_loeschen')}</Knopf>}
      </div>
    </Blatt>
  )
}

export default function AdminInstrumente() {
  const { T, lang, toast, confirm } = useApp()
  const neuLaden = useNeuLaden()
  const { data: instrumente = [], isLoading } = useInstrumente()
  const [filter, setFilter] = useState('aktiv')
  const [blatt, setBlatt] = useState(null)   // null | 'neu' | instrument

  const liste = instrumente.filter(i => filter === 'alle' || (filter === 'aktiv') === !!i.aktiv)
  const aktualisieren = () => neuLaden('na-instrumente', 'nl-kurs-optionen')
  const name = i => i[`name_${lang}`] || i.name_de

  async function loeschen(instr) {
    if (!await confirm(T('nv_loeschen_frage').replace('{name}', instr.name_de), { sub: T('nv_instrument_loeschen_hinweis'), confirmLabel: T('delete') })) return
    const { error } = await supabase.from('instrumente').delete().eq('id', instr.id)
    if (error) { toast(error.message, 'error'); return }
    setBlatt(null)
    aktualisieren()
  }

  return (
    <Seite titel={T('instruments')} rechts={<Knopf klein variante="tint" icon={Plus} onClick={() => setBlatt('neu')}>{T('nv_neu')}</Knopf>}>
      <div style={{ marginTop: 16 }}>
        <Chips label={T('status')} optionen={[['aktiv', T('active')], ['inaktiv', T('inactive')], ['alle', T('n_alle')]]} wert={filter} onChange={setFilter} />
      </div>
      <div style={{ marginTop: 16 }}>
        {isLoading ? <Laden hoehe={240} /> : liste.length === 0 ? <Leer text={T('nv_keine_instrumente')} /> : (
          <Gruppe>
            {liste.map((i, n) => (
              <div key={i.id}>
                {n > 0 && <Trenner />}
                <Zeile bild={<span aria-hidden="true" style={{ width: 40, height: 40, borderRadius: 12, background: 'var(--bg)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>{i.icon || '🎵'}</span>}
                  titel={name(i)} untertitel={[i.name_de, i.name_en, i.name_tr].filter(x => x && x !== name(i)).join(' · ')}
                  wert={i.aktiv ? null : T('inactive')} onClick={() => setBlatt(i)} />
              </div>
            ))}
          </Gruppe>
        )}
      </div>

      {blatt && <InstrumentBlatt instrument={blatt === 'neu' ? null : blatt} onClose={() => setBlatt(null)}
        onFertig={() => { setBlatt(null); aktualisieren() }} onLoeschen={() => loeschen(blatt)} />}
    </Seite>
  )
}
