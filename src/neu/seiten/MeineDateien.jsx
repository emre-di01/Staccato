import { useApp } from '../../context/AppContext'
import { Seite } from '../../ui'
import EigeneDateienNeu from '../EigeneDateienNeu'

export default function NeuMeineDateien() {
  const { T } = useApp()
  return (
    <Seite titel={T('eigene_meine')} zurueck={{ to: '/schueler/ich', label: T('n_tab_ich') }}>
      <p style={{ margin: '8px 20px 20px', fontSize: 16, color: 'var(--text-2)', lineHeight: 1.5 }}>{T('n_meine_dateien_erklaerung')}</p>
      <EigeneDateienNeu />
    </Seite>
  )
}
