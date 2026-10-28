import { useApp } from '../context/AppContext'
import EigeneDateien from '../components/stueck/EigeneDateien'

// Zentrale Übersicht aller eigenen (und mit mir geteilten) Dateien, unabhängig von Kurs oder Stück
export default function MeineDateien() {
  const { T } = useApp()
  return (
    <div style={{ maxWidth:820 }}>
      <h1 style={{ margin:'0 0 20px', fontSize:26, fontWeight:800, color:'var(--text)', letterSpacing:'-0.5px' }}>📂 {T('eigene_meine')}</h1>
      <EigeneDateien />
    </div>
  )
}
