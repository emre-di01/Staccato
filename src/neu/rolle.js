// Pfad-Präfix der Rolle in der neuen Oberfläche
import { useApp } from '../context/AppContext'

export { NEU_ROLLEN } from './neuRollen'

// '/schueler' bzw. '/lehrer' – für Links auf gemeinsamen Seiten (Ich, Profil, Nachrichten …)
export function useBasis() {
  const { rolle } = useApp()
  return rolle === 'lehrer' ? '/lehrer' : '/schueler'
}
