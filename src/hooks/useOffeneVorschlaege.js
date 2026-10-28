import { useQuery } from '@tanstack/react-query'
import { supabase } from '../lib/supabase'
import { useApp } from '../context/AppContext'

// Anzahl offener Lied-/Textvorschläge, die der Aufrufer entscheiden darf (RLS filtert auf eigene Kurse).
// Gemeinsamer Query-Key: Menü-Badge, Repertoire-Tab und Dashboard aktualisieren sich zusammen.
export function useOffeneVorschlaege() {
  const { rolle, schule } = useApp()
  const darfEntscheiden = rolle === 'lehrer' || rolle === 'admin' || rolle === 'superadmin'
  return useQuery({
    queryKey: ['lied-vorschlaege', 'offen-anzahl', schule?.id],
    enabled: darfEntscheiden && !!schule?.id,
    refetchInterval: 5 * 60 * 1000,
    queryFn: async () => {
      const { count } = await supabase.from('lied_vorschlaege')
        .select('id', { count: 'exact', head: true }).eq('schule_id', schule.id).eq('status', 'offen')
      return count ?? 0
    },
  })
}
