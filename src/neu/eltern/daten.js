// Datenzugriff der Eltern-Oberfläche: Kinder, deren Kurse und Stunden.
// Eltern dürfen per RLS Profil, Kurse, Stunden und Anwesenheit ihrer Kinder lesen.
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

const TAG = 24 * 60 * 60 * 1000

export function useKinder() {
  const { profil } = useApp()
  return useQuery({
    queryKey: ['ne-kinder', profil?.id],
    enabled: !!profil?.id,
    queryFn: async () => {
      const { data, error } = await supabase.from('eltern_schueler')
        .select('kind:profiles!eltern_schueler_schueler_id_fkey(id, voller_name, avatar_url)')
        .eq('eltern_id', profil.id)
      if (error) throw error
      return (data ?? []).map(d => d.kind).filter(Boolean).sort((a, b) => a.voller_name.localeCompare(b.voller_name))
    },
  })
}

// Aktive Kurse aller Kinder: [{ kindId, kurs }]
export function useKinderKurse() {
  const { schule } = useApp()
  const { data: kinder } = useKinder()
  return useQuery({
    queryKey: ['ne-kurse', schule?.id, kinder?.map(k => k.id).join()],
    enabled: !!kinder,
    queryFn: async () => {
      if (!kinder.length) return []
      const { data, error } = await supabase.from('unterricht_schueler')
        .select('schueler_id, unterricht(id, name, typ, schule_id, raeume(name), unterricht_lehrer(profiles!unterricht_lehrer_lehrer_id_fkey(voller_name)))')
        .in('schueler_id', kinder.map(k => k.id)).eq('status', 'aktiv')
      if (error) throw error
      return (data ?? []).filter(d => d.unterricht && d.unterricht.schule_id === schule?.id).map(d => ({
        kindId: d.schueler_id,
        kurs: { ...d.unterricht, lehrer: (d.unterricht.unterricht_lehrer ?? []).map(ul => ul.profiles?.voller_name).filter(Boolean) },
      }))
    },
  })
}

// Stunden der Kurse aller Kinder im Zeitraum; jede Stunde mit den beteiligten Kindern und deren Anwesenheit
export function useKinderStunden(tage = 60, { zurueck = 1 } = {}) {
  const { schule } = useApp()
  const { data: kinder } = useKinder()
  const { data: kk } = useKinderKurse()
  return useQuery({
    queryKey: ['ne-stunden', schule?.id, tage, zurueck, kk?.length],
    enabled: !!kinder && !!kk,
    queryFn: async () => {
      if (!kk.length) return []
      const jetzt = Date.now()
      const { data, error } = await supabase.from('stunden')
        .select('id, beginn, ende, status, hausaufgaben, unterricht_id, unterricht(name, typ, raeume(name)), raeume(name), anwesenheit(status, schueler_id)')
        .in('unterricht_id', [...new Set(kk.map(e => e.kurs.id))])
        .gte('ende', new Date(jetzt - zurueck * TAG).toISOString())
        .lte('beginn', new Date(jetzt + tage * TAG).toISOString())
        .order('beginn')
      if (error) throw error
      const name = Object.fromEntries(kinder.map(k => [k.id, k.voller_name]))
      return (data ?? []).map(st => ({
        ...st,
        raum: st.raeume?.name ?? st.unterricht?.raeume?.name ?? null,
        kinder: kk.filter(e => e.kurs.id === st.unterricht_id).map(e => ({
          id: e.kindId,
          name: name[e.kindId] ?? '',
          status: (st.anwesenheit ?? []).find(a => a.schueler_id === e.kindId)?.status ?? null,
        })),
      }))
    },
  })
}

export const vorname = name => (name ?? '').split(' ')[0]
