import { useState } from 'react'
import { supabase } from '../../lib/supabase'
import { useApp } from '../../context/AppContext'
import { Seite, Segment, Leer, Laden } from '../../ui'
import { useMeineStunden, useMeineEvents, useNeuLaden, useAbsage } from '../daten'
import { StundeKarte, EventKarte } from '../karten'
import { gruppenLabel } from '../zeit'

export default function NeuTermine() {
  const { profil, T, lang, zeitzone, toast } = useApp()
  const { data: stunden, isLoading: l1 } = useMeineStunden(60)
  const { data: events, isLoading: l2 } = useMeineEvents()
  const neuLaden = useNeuLaden()
  const absage = useAbsage()
  const [filter, setFilter] = useState('alle')
  const [sendet, setSendet] = useState(null)

  const jetzt = Date.now()
  const eintraege = [
    ...(filter !== 'events' ? (stunden ?? []).filter(s => new Date(s.ende) > jetzt).map(s => ({ art: 'stunde', id: s.id, beginn: s.beginn, ende: s.ende, daten: s })) : []),
    ...(filter !== 'unterricht' ? (events ?? []).map(e => ({ art: 'event', id: e.id, beginn: e.beginn, ende: e.ende, daten: e })) : []),
  ].sort((a, b) => new Date(a.beginn) - new Date(b.beginn))

  // Gruppieren: Heute, Morgen, Diese Woche, dann Monate
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

  const laden = l1 || l2

  return (
    <Seite titel={T('n_tab_termine')}>
      <Segment label={T('n_termine_filtern')} wert={filter} onChange={setFilter} style={{ margin: '16px 20px 0' }}
        optionen={[['alle', T('n_alle')], ['unterricht', T('n_unterricht')], ['events', T('n_veranstaltungen')]]} />

      {laden ? <div style={{ marginTop: 24, display: 'flex', flexDirection: 'column', gap: 10 }}><Laden /><Laden /></div>
        : gruppen.length === 0 ? <div style={{ marginTop: 24 }}><Leer text={T('n_keine_termine')} /></div>
        : gruppen.map(g => (
          <section key={g.label} style={{ margin: '28px 20px 0' }}>
            <h2 style={{ margin: '0 0 10px', fontSize: 22, fontWeight: 800, letterSpacing: '-0.01em' }}>{g.label}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {g.eintraege.map(e => e.art === 'stunde'
                ? <StundeKarte key={e.id} s={e.daten} onUmschalten={() => absage.umschalten(e.daten)} sendet={absage.sendet === e.id} />
                : <EventKarte key={e.id} ev={e.daten} onAntwort={z => antworten(e.daten, z)} sendet={sendet === e.id} />)}
            </div>
          </section>
        ))}
    </Seite>
  )
}
