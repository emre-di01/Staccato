import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Plus } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Abschnitt, Chips, Suchfeld, Knopf, Zeile, LiedCover, LiedKachel, Regal, Leer, Laden, Blatt, Feld, eingabeStil } from '../../ui'
import LiedVorschlaege from '../../components/LiedVorschlaege'
import { useOffeneVorschlaege } from '../../hooks/useOffeneVorschlaege'
import { liedInhalt } from '../daten'
import { useLehrerKurse } from '../lehrerDaten'

// Lieder der Lehrkraft: ganze Bibliothek der Schule, Filter je eigenem Kurs, Vorschläge prüfen
export default function LehrerLieder() {
  const { T } = useApp()
  const [params] = useSearchParams()
  const { data: kurse = [] } = useLehrerKurse()
  const { data: offeneVorschlaege = 0 } = useOffeneVorschlaege()
  const [filter, setFilter] = useState(params.get('tab') === 'vorschlaege' ? 'vorschlaege' : 'alle')
  const [suche, setSuche] = useState('')
  const [neuOffen, setNeuOffen] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['nl-lieder', kurse.length],
    queryFn: async () => {
      const ids = kurse.map(k => k.id)
      const [alle, us] = await Promise.all([
        supabase.from('stuecke').select('id, titel, komponist, liedtext, notizen, stueck_dateien(typ)').order('titel'),
        ids.length ? supabase.from('unterricht_stuecke').select('stueck_id, unterricht_id, status').in('unterricht_id', ids) : { data: [] },
      ])
      if (alle.error) throw alle.error
      return { stuecke: alle.data ?? [], zuordnung: us.data ?? [] }
    },
  })
  const stuecke = data?.stuecke ?? []
  const zuordnung = data?.zuordnung ?? []

  const q = suche.trim().toLowerCase()
  const imKurs = id => new Set(zuordnung.filter(z => z.unterricht_id === id).map(z => z.stueck_id))
  const kursSet = filter !== 'alle' && filter !== 'vorschlaege' ? imKurs(filter) : null
  const liste = stuecke
    .filter(st => !kursSet || kursSet.has(st.id))
    .filter(st => !q || st.titel.toLowerCase().includes(q) || (st.komponist ?? '').toLowerCase().includes(q))
  const navState = { liste: liste.map(st => ({ id: st.id, titel: st.titel })) }

  const aktuelleIds = new Set(zuordnung.filter(z => z.status === 'aktuell' && (!kursSet || z.unterricht_id === filter)).map(z => z.stueck_id))
  const aktuell = stuecke.filter(st => aktuelleIds.has(st.id))
  const aktuellState = { liste: aktuell.map(st => ({ id: st.id, titel: st.titel })) }

  const kurseMitLiedern = kurse.filter(k => zuordnung.some(z => z.unterricht_id === k.id))
  const chips = [
    ['alle', T('n_alle')],
    ...kurseMitLiedern.map(k => [k.id, k.name]),
    ['vorschlaege', offeneVorschlaege ? `${T('vorschlag_tab')} (${offeneVorschlaege})` : T('vorschlag_tab')],
  ]

  return (
    <Seite titel={T('n_tab_lieder')} rechts={
      <Knopf klein variante="tint" icon={Plus} onClick={() => setNeuOffen(true)}>{T('nl_neues_lied')}</Knopf>
    }>
      {filter !== 'vorschlaege' && (
        <div style={{ marginTop: 16 }}>
          <Suchfeld wert={suche} onChange={setSuche} label={T('n_lieder_suchen')} placeholder={T('n_titel_oder_komponist')} />
        </div>
      )}
      <div style={{ marginTop: 14 }}>
        <Chips label={T('n_filter')} optionen={chips} wert={filter} onChange={setFilter} />
      </div>

      {filter === 'vorschlaege' ? (
        <div style={{ margin: '24px 20px 0' }}>
          <LiedVorschlaege modus="lehrer" rollePfad="lehrer" fokusId={params.get('vorschlag')} />
        </div>
      ) : isLoading ? (
        <div style={{ marginTop: 24 }}><Laden hoehe={200} /></div>
      ) : (
        <>
          {!q && aktuell.length > 0 && (
            <Abschnitt titel={T('n_aktuell_geprobt')} style={{ marginTop: 26 }}>
              <Regal>
                {aktuell.map(st => <LiedKachel key={st.id} stueck={st} to={`/lehrer/repertoire/${st.id}`} state={aktuellState} />)}
              </Regal>
            </Abschnitt>
          )}
          <Abschnitt titel={filter === 'alle' ? T('nl_bibliothek') : T('n_alle_lieder')} style={{ marginTop: 26 }}>
            {liste.length === 0 ? (
              <Leer text={q ? T('n_kein_lied_gefunden') : T('n_noch_keine_lieder')} />
            ) : (
              <div>
                {liste.map(st => (
                  <div key={st.id} style={{ borderBottom: '1px solid var(--n-sep)', margin: '0 4px' }}>
                    <Zeile bild={<LiedCover id={st.id} />} titel={st.titel}
                      untertitel={[st.komponist, liedInhalt(st, T)].filter(Boolean).join(' · ')}
                      to={`/lehrer/repertoire/${st.id}`} state={navState} />
                  </div>
                ))}
              </div>
            )}
          </Abschnitt>
        </>
      )}

      {neuOffen && <NeuesLiedBlatt onClose={() => setNeuOffen(false)} />}
    </Seite>
  )
}

// Neues Stück anlegen; danach direkt in die Bearbeitung (Text, Akkorde, Dateien)
function NeuesLiedBlatt({ onClose }) {
  const { profil, schule, T, toast } = useApp()
  const navigate = useNavigate()
  const [form, setForm] = useState({ titel: '', komponist: '', tonart: '' })
  const [sendet, setSendet] = useState(false)

  async function anlegen() {
    if (!form.titel.trim()) { toast(T('title_required'), 'error'); return }
    setSendet(true)
    const { data, error } = await supabase.from('stuecke')
      .insert({ titel: form.titel.trim(), komponist: form.komponist.trim() || null, tonart: form.tonart.trim() || null, erstellt_von: profil.id, schule_id: schule?.id })
      .select('id').single()
    setSendet(false)
    if (error) { toast(error.message, 'error'); return }
    navigate(`/lehrer/repertoire/${data.id}/bearbeiten`)
  }

  return (
    <Blatt titel={T('nl_neues_lied')} onClose={onClose}>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Feld label={T('piece_title_label')}>
          <input value={form.titel} onChange={e => setForm(f => ({ ...f, titel: e.target.value }))} style={eingabeStil} />
        </Feld>
        <Feld label={T('piece_composer')}>
          <input value={form.komponist} onChange={e => setForm(f => ({ ...f, komponist: e.target.value }))} style={eingabeStil} />
        </Feld>
        <Feld label={T('piece_key')}>
          <input value={form.tonart} onChange={e => setForm(f => ({ ...f, tonart: e.target.value }))} style={eingabeStil} />
        </Feld>
        <Knopf voll onClick={anlegen} disabled={sendet}>{T('piece_create')}</Knopf>
      </div>
    </Blatt>
  )
}
