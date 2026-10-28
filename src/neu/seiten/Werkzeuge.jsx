import { useState } from 'react'
import { useApp } from '../../context/AppContext'
import { Seite, Segment } from '../../ui'
import { KapoTab, TunerTab, BpmTab } from '../../pages/Tools'
import { useBasis } from '../rolle'

// Kapo-Rechner, Stimmgerät und Tempo – die Werkzeuge selbst kommen aus pages/Tools
export default function NeuWerkzeuge() {
  const { T } = useApp()
  const basis = useBasis()
  const [tab, setTab] = useState('kapo')
  return (
    <Seite titel={T('tools_title')} zurueck={{ to: `${basis}/ich`, label: T('n_tab_ich') }}>
      <Segment label={T('tools_title')} wert={tab} onChange={setTab} style={{ margin: '16px 20px 0' }}
        optionen={[['kapo', T('tools_kapo')], ['tuner', T('tools_tuner')], ['bpm', T('tools_bpm')]]} />
      <div style={{ padding: '24px 20px 0' }}>
        {tab === 'kapo' && <KapoTab />}
        {tab === 'tuner' && <TunerTab />}
        {tab === 'bpm' && <BpmTab />}
      </div>
    </Seite>
  )
}
