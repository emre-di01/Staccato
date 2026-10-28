// Pfad-Präfix der Rolle in der neuen Oberfläche
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export { NEU_ROLLEN, DESIGN_ROLLEN } from './neuRollen'

// '/schueler', '/lehrer', '/admin', '/vorstand' bzw. '/eltern' – für Links auf gemeinsamen Seiten (Ich, Profil, Nachrichten …)
export function useBasis() {
  const { rolle } = useApp()
  if (rolle === 'admin' || rolle === 'superadmin') return '/admin'
  if (rolle === 'lehrer' || rolle === 'vorstand' || rolle === 'eltern') return '/' + rolle
  return '/schueler'
}

// true im Admin-Bereich: Lehrer-Seiten zeigen dann alle Kurse der Schule statt nur die eigenen
export function useSchulweit() {
  const { pathname } = useLocation()
  return pathname === '/admin' || pathname.startsWith('/admin/')
}
