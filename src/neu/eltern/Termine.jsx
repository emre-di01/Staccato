import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Segment, Leer, Laden } from '../../ui'
import { useMeineEvents, useNeuLaden } from '../daten'
import { Karte, EventKarte } from '../karten'
import { useKinderStunden, vorname } from './daten'
import { gruppenLabel, uhrzeit } from '../zeit'

// Stunde eines oder mehrerer Kinder (Eltern können nicht absagen – das bleibt beim Kind bzw. der Schule)
function KinderStundeKarte({ s }) {
  const { T, lang, zeitzone } = useApp()
  const abgesagt = s.status === 'abgesagt'
  const zeit = `${uhrzeit(s.beginn, zeitzone, lang)} – ${uhrzeit(s.ende, zeitzone, lang)}`
  const namen = s.kinder.map(k => vorname(k.name) + (k.status === 'entschuldigt' ? ` (${T('ne_entschuldigt')})` : '')).join(', ')
  return (
    <Karte beginn={s.beginn} titel={s.unterricht?.name} unter={[zeit, s.raum].filter(Boolean).join(' · ')}
      status={abgesagt ? T('n_faellt_aus') : namen} statusFarbe={abgesagt ? 'var(--danger)' : 'var(--text-2)'} />
  )
}

export default function ElternTermine() {
  const { profil, T, lang, zeitzone, toast } = useApp()
  const { data: stunden, isLoading: l1 } = useKinderStunden(60)
  const { data: events, isLoading: l2 } = useMeineEvents()
  const neuLaden = useNeuLaden()
  const [filter, setFilter] = useState('alle')
  const [sendet, setSendet] = useState(null)

  const jetzt = Date.now()
  const eintraege = [
    ...(filter !== 'events' ? (stunden ?? []).filter(s => new Date(s.ende) > jetzt).map(s => ({ art: 'stunde', id: s.id, beginn: s.beginn, daten: s })) : []),
    ...(filter !== 'unterricht' ? (events ?? []).map(e => ({ art: 'event', id: e.id, beginn: e.beginn, daten: e })) : []),
  ].sort((a, b) => new Date(a.beginn) - new Date(b.beginn))

  const gruppen = []
  for (const e of eintraege) {
    const label = gruppenLabel(e.beginn, zeitzone, lang, T)
    if (!gruppen.length || gruppen[gruppen.length - 1].label !== label) gruppen.push({ label, eintraege: [] })
    gruppen[gruppen.length - 1].eintraege.push(e)
  }

  async function antworten(ev, zusage) {
    setSendet(ev.id)
    const { error } = ev.eingeladen
      ? await supabase.from('event_teilnehmer').update({ zusage }).eq('event_id', ev.id).eq('profil_id', profil.id)
      : await supabase.from('event_teilnehmer').upsert({ event_id: ev.id, profil_id: profil.id, zusage })
    setSendet(null)
    if (error) { toast(error.message, 'error'); return }
    neuLaden('n-events')
  }

  return (
    <Seite titel={T('n_tab_termine')}>
      <Segment label={T('n_termine_filtern')} wert={filter} onChange={setFilter} style={{ margin: '16px 20px 0' }}
        optionen={[['alle', T('n_alle')], ['unterricht', T('n_unterricht')], ['events', T('n_veranstaltungen')]]} />

      {l1 || l2 ? <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}><Laden /><Laden /></div>
        : gruppen.length === 0 ? <div style={{ marginTop: 24 }}><Leer text={T('n_keine_termine')} /></div>
        : gruppen.map(g => (
          <section key={g.label} style={{ margin: '28px 20px 0' }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>{g.label}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.eintraege.map(e => e.art === 'stunde'
                ? <KinderStundeKarte key={e.id} s={e.daten} />
                : <EventKarte key={e.id} ev={e.daten} onAntwort={z => antworten(e.daten, z)} sendet={sendet === e.id} />)}
            </div>
          </section>
        ))}
    </Seite>
  )
}
