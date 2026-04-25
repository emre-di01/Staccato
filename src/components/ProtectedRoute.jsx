import { Navigate, Outlet } from 'react-router-dom'
import { useApp } from '../context/AppContext'

export default function ProtectedRoute({ erlaubteRollen = [] }) {
  const { session, rolle, laden } = useApp()

  if (laden) return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', height:'100vh', background:'var(--bg)' }}>
      <div style={{ textAlign:'center' }}>
        <div style={{ fontSize:32, marginBottom:12 }}>🎵</div>
        <div style={{ color:'var(--text-3)', fontSize:14 }}>Staccato lädt…</div>
      </div>
    </div>
  )

  if (!session) return <Navigate to="/login" replace />

  if (erlaubteRollen.length > 0 && !erlaubteRollen.includes(rolle)) {
    return <Navigate to={startseiteNach(rolle)} replace />
  }

  return <Outlet />
}

export function startseiteNach(rolle) {
  switch (rolle) {
    case 'superadmin':
    case 'admin':    return '/admin'
    case 'lehrer':   return '/lehrer'
    case 'schueler': return '/schueler'
    case 'eltern':   return '/eltern'
    default:         return '/login'
  }
}
