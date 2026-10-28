// Pfad-Präfix der Rolle in der neuen Oberfläche
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export { NEU_ROLLEN, OPTIN_ROLLEN, DESIGN_ROLLEN } from './neuRollen'

// '/schueler', '/lehrer' bzw. '/admin' – für Links auf gemeinsamen Seiten (Ich, Profil, Nachrichten …)
export function useBasis() {
  const { rolle } = useApp()
  if (rolle === 'admin' || rolle === 'superadmin') return '/admin'
  return rolle === 'lehrer' ? '/lehrer' : '/schueler'
}

// true im Admin-Bereich: Lehrer-Seiten zeigen dann alle Kurse der Schule statt nur die eigenen
export function useSchulweit() {
  const { pathname } = useLocation()
  return pathname === '/admin' || pathname.startsWith('/admin/')
}
