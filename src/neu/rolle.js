// Pfad-Präfix der Rolle in der neuen Oberfläche
import { useApp } from '../context/AppContext'

export { NEU_ROLLEN, OPTIN_ROLLEN, DESIGN_ROLLEN } from './neuRollen'

// '/schueler', '/lehrer' bzw. '/admin' – für Links auf gemeinsamen Seiten (Ich, Profil, Nachrichten …)
export function useBasis() {
  const { rolle } = useApp()
  if (rolle === 'admin' || rolle === 'superadmin') return '/admin'
  return rolle === 'lehrer' ? '/lehrer' : '/schueler'
}
