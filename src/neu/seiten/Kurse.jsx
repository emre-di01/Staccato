import { useQuery } from '@tanstack/react-query'
import { Music, Users, MicVocal, Guitar } from 'lucide-react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Gruppe, Trenner, Zeile, Leer, Laden } from '../../ui'
import { useMeineStunden } from '../daten'
import { tagLabel, uhrzeit } from '../zeit'
import { useBasis } from '../rolle'

export const KURS_ICON = { einzel: Music, gruppe: Users, chor: MicVocal, ensemble: Guitar }

// Kurse inkl. Lehrkräften (Liste und Kopf im Kursdetail)
export function useKurseMitLehrern() {
  const { profil, schule } = useApp()
  return useQuery({
    queryKey: ['n-kurse-lehrer', profil?.id, schule?.id],
    enabled: !!profil?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('unterricht_schueler')
        .select('unterricht(id, name, typ, farbe, instrumente(name_de, name_en, name_tr), raeume(name), unterricht_lehrer(lehrer_id, profiles!unterricht_lehrer_lehrer_id_fkey(voller_name)))')
        .eq('schueler_id', profil.id).eq('status', 'aktiv')
      if (error) throw error
      return (data ?? []).map(d => d.unterricht).filter(Boolean)
        .map(k => ({ ...k, lehrer: (k.unterricht_lehrer ?? []).map(ul => ul.profiles?.voller_name).filter(Boolean) }))
        .sort((a, b) => a.name.localeCompare(b.name))
    },
  })
}

export default function NeuKurse() {
  const { T, lang, zeitzone } = useApp()
  const basis = useBasis()
  const { data: kurse = [], isLoading } = useKurseMitLehrern()
  const { data: stunden = [] } = useMeineStunden(60)

  const naechste = id => stunden.find(s => s.unterricht_id === id && new Date(s.ende) > Date.now() && s.status !== 'abgesagt')

  return (
    <Seite titel={T('my_classes')} zurueck={{ to: `${basis}/ich`, label: T('n_tab_ich') }}>
      <div style={{ marginTop: 20 }}>
        {isLoading ? <Laden hoehe={200} /> : kurse.length === 0 ? <Leer text={T('n_keine_kurse')} /> : (
          <Gruppe>
            {kurse.map((k, i) => {
              const n = naechste(k.id)
              const unter = [
                k.lehrer.join(', '),
                n ? `${T('n_naechste_stunde')}: ${tagLabel(n.beginn, zeitzone, lang, T)}, ${uhrzeit(n.beginn, zeitzone, lang)}` : null,
              ].filter(Boolean).join(' · ')
              return (
                <div key={k.id}>
                  {i > 0 && <Trenner />}
                  <Zeile icon={KURS_ICON[k.typ] ?? Music} titel={k.name} untertitel={unter || null} to={`${basis}/kurse/${k.id}`} />
                </div>
              )
            })}
          </Gruppe>
        )}
      </div>
    </Seite>
  )
}
