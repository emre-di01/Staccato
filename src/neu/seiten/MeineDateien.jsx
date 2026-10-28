import { useApp } from '../../context/AppContext'
import { Seite } from '../../ui'
import EigeneDateienNeu from '../EigeneDateienNeu'
import { useBasis } from '../rolle'

export default function NeuMeineDateien() {
  const { T } = useApp()
  const basis = useBasis()
  return (
    <Seite titel={T('eigene_meine')} zurueck={{ to: `${basis}/ich`, label: T('n_tab_ich') }}>
      <p style={{ margin: '8px 20px 20px', fontSize: 16, color: 'var(--text-2)', lineHeight: 1.5 }}>{T('n_meine_dateien_erklaerung')}</p>
      <EigeneDateienNeu />
    </Seite>
  )
}
