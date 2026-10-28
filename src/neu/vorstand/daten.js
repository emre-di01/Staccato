// Datenzugriff des Vorstandsbereichs (Übersicht, Hinweis auf der Startseite)
import { useQuery } from '@tanstack/react-query'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'

// Eigene offene Aufgaben, Anzahl offener Aufgaben/Ziele/Protokolle und die nächste Vorstandssitzung
export function useVorstandUebersicht({ aktiv = true } = {}) {
  const { profil, schule } = useApp()
  return useQuery({
    queryKey: ['nvs-uebersicht', profil?.id, schule?.id],
    enabled: aktiv && !!profil?.id && !!schule?.id,
    queryFn: async () => {
      const [aufgaben, ziele, protokolle, sitzung] = await Promise.all([
        supabase.from('vorstand_aufgaben').select('id, titel, faellig_am, status, verantwortlicher_id')
          .eq('schule_id', schule.id).in('status', ['offen', 'in_bearbeitung']).order('faellig_am', { nullsFirst: false }),
        supabase.from('vorstand_ziele').select('id', { count: 'exact', head: true }).eq('schule_id', schule.id).neq('status', 'erledigt'),
        supabase.from('vorstand_protokolle').select('id', { count: 'exact', head: true }).eq('schule_id', schule.id),
        supabase.from('events').select('id, titel, beginn, ort, raeume(name)').eq('schule_id', schule.id).eq('typ', 'vorstandssitzung')
          .gte('beginn', new Date().toISOString()).order('beginn').limit(1),
      ])
      const fehler = aufgaben.error ?? ziele.error ?? protokolle.error ?? sitzung.error
      if (fehler) throw fehler
      const offen = aufgaben.data ?? []
      return {
        offeneAufgaben: offen.length,
        meineAufgaben: offen.filter(a => a.verantwortlicher_id === profil.id),
        offeneZiele: ziele.count ?? 0,
        protokolle: protokolle.count ?? 0,
        naechsteSitzung: sitzung.data?.[0] ?? null,
      }
    },
  })
}
